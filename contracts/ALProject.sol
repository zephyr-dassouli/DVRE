// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Project.sol";

// AL Contract Interfaces
interface IALProjectVoting {
    function startBatchVoting(string[] memory sampleIds, uint256 round, string[] memory sampleDataHashes) external;
    function endBatchVoting(uint256 round) external;
    function setVoters(address[] memory _voters, uint256[] memory _weights) external;
    function submitBatchVoteOnBehalf(string[] memory sampleIds, string[] memory labels, address voter) external;
    function computeEligibleVoters(address[] memory participants, string[] memory roles, uint256[] memory weights) external pure returns (address[] memory voters, uint256[] memory eligibleWeights);
    function computeBatchProgress(uint256 round, string[] memory sampleIds, bool[] memory sampleActiveStates) external pure returns (uint256 _round, uint256 totalSamples, uint256 activeSamplesCount, uint256 completedSamples, string[] memory _sampleIds, bool batchActive);
    function computeActiveBatch(string[] memory allSampleIds, bool[] memory sampleActiveStates, string[] memory labelSpace, uint256 votingTimeout, uint256 _currentRound) external view returns (string[] memory activeSampleIds, string[] memory sampleData, string[] memory labelOptions, uint256 timeRemaining, uint256 round);
    function projectContract() external view returns (address);
    function getVotingSession(string memory sampleId) external view returns (
        uint256 startTime,
        bool isActive,
        bool isFinalized,
        string memory finalLabel
    );
    function getFinalLabel(string memory sampleId) external view returns (string memory);
    function isVotingActive(string memory sampleId) external view returns (bool);
    function voterWeights(address voter) external view returns (uint256);
}

interface IALProjectStorage {
    function storeFinalLabel(
        string memory sampleId,
        string memory label,
        uint256 round
    ) external;
    function getLabel(string memory sampleId) external view returns (string memory);
    function projectContract() external view returns (address);
    function getFinalLabel(string memory sampleId) external view returns (
        string memory label,
        uint256 round,
        uint256 timestamp
    );
}

contract ALProject is Project {
    // AL-specific metadata
    string public queryStrategy;
    string public alScenario;
    uint256 public maxIteration;
    uint256 public queryBatchSize;
    string[] public labelSpace;
    
    // DAL-specific state
    uint256 public votingTimeout = 3600; // 1 hour default voting timeout
    string[] private currentBatchSampleIds;
    mapping(string => bool) private activeSamples;
    
    // Linked AL contracts
    address public votingContract;
    address public storageContract;
    
    // Round tracking
    uint256 public currentRound;
    
    // AL Project end conditions tracking
    bool public unlabeledSamplesExhausted = false;

    // AL Project Events
    event ALContractsDeployed(address votingContract, address storageContract);
    event RoundIncremented(uint256 newRound);
    event ALRoundTriggered(uint256 round, string reason, uint256 timestamp);
    event AutoLabelStored(string sampleId, string label, uint256 round, uint256 timestamp);
    event ALBatchStarted(uint256 round, uint256 sampleCount, uint256 timestamp);
    event ALBatchCompleted(uint256 round, uint256 completedSamples, uint256 timestamp);
    event VotersUpdated(uint256 round, uint256 voterCount, uint256 timestamp);
    event VotingSessionStarted(string sampleId, uint256 round, uint256 timeout, uint256 timestamp);
    event VotingSessionEnded(string sampleId, string finalLabel, uint256 round, uint256 timestamp);
    event VoteSubmitted(string sampleId, address voter, string label, uint256 timestamp);
    event ProjectEndTriggered(address indexed trigger, string reason, uint256 currentRound, uint256 timestamp);

    // AL-specific modifiers
    modifier onlyVotingContract() {
        require(msg.sender == votingContract, "Only voting contract can call");
        _;
    }
    
    // Constructor - calls parent constructor
    constructor(address _creator, string memory _projectData) 
        Project(_creator, _projectData) 
    {
        // AL-specific initialization can go here if needed
    }
    
    /**
     * @dev Primary function to set up AL project in a single transaction
     * Replaces the removed individual functions: linkALContracts + setALMetadata + updateROCrateHash
     * This is now the only way to configure AL projects, reducing deployment from 5 to 3 transactions
     */
    function setupALProject(
        address _votingContract,
        address _storageContract,
        string memory _queryStrategy,
        string memory _alScenario,
        uint256 _maxIteration,
        uint256 _queryBatchSize,
        string[] memory _labelSpace,
        string memory _rocrateHash
    ) external onlyCreator {
        // Validate inputs
        require(_votingContract != address(0) && _storageContract != address(0), "Invalid contract addresses");
        require(votingContract == address(0), "AL contracts already linked");
        require(storageContract == address(0), "AL contracts already linked");
        require(_maxIteration > 0, "Invalid max iteration");
        require(_queryBatchSize > 0, "Invalid batch size");
        require(bytes(_rocrateHash).length > 0, "RO-Crate hash cannot be empty");
        
        // 1. Link AL contracts (from linkALContracts)
        votingContract = _votingContract;
        storageContract = _storageContract;
        
        // Set initial voters in voting contract
        _updateVotersInContract();
        
        // 2. Set AL metadata (from setALMetadata)
        queryStrategy = _queryStrategy;
        alScenario = _alScenario;
        maxIteration = _maxIteration;
        queryBatchSize = _queryBatchSize;
        labelSpace = _labelSpace;
        
        // 3. Update RO-Crate hash (from updateROCrateHash)
        this.updateROCrateHash(_rocrateHash);
        
        // Emit events
        emit ALContractsDeployed(_votingContract, _storageContract);
    }
    
    /**
     * @dev Get current batch sample IDs
     */
    function getCurrentBatchSampleIds() external view returns (string[] memory) {
        return currentBatchSampleIds;
    }
    
    /**
     * @dev Check if a sample is currently active for voting
     */
    function isSampleActive(string memory sampleId) external view returns (bool) {
        return activeSamples[sampleId];
    }
    
    /**
     * @dev Get project AL configuration
     */
    function getALConfiguration() external view returns (
        string memory _queryStrategy,
        string memory _alScenario,
        uint256 _maxIteration,
        uint256 _currentRound,
        uint256 _queryBatchSize,
        uint256 _votingTimeout,
        string[] memory _labelSpace
    ) {
        return (
            queryStrategy,
            alScenario,
            maxIteration,
            currentRound,
            queryBatchSize,
            votingTimeout,
            labelSpace
        );
    }

    /**
     * @dev Helper to update voters in voting contract when participant membership changes
     */
    function _updateVotersInContract() internal {
        if (votingContract == address(0)) return; // Skip if not linked yet
        
        // Get participant data from parent contract
        (address[] memory participantAddresses, string[] memory roles, uint256[] memory weights,) = this.getAllParticipants();
        
        if (participantAddresses.length == 0) return;
        
        // Let ALProjectVoting compute eligible voters and set them
        (address[] memory eligibleVoters, uint256[] memory voterWeights) = IALProjectVoting(votingContract).computeEligibleVoters(participantAddresses, roles, weights);
        
        if (eligibleVoters.length > 0) {
            IALProjectVoting(votingContract).setVoters(eligibleVoters, voterWeights);
        }
    }
    
    // Override parent's addParticipantWithRole to update AL voters
    function addParticipantWithRole(address _participant, string memory _role, uint256 _weight) public override onlyCreator {
        // Call parent implementation directly since super doesn't work properly here
        require(bytes(_role).length > 0, "Empty role");
        require(bytes(participantRoles[_participant]).length == 0, "Already participant");
        require(_weight > 0, "Weight must be positive");
        
        participants.push(_participant);
        participantRoles[_participant] = _role;
        participantWeights[_participant] = _weight;
        joinedAt[_participant] = block.timestamp;
        
        emit ParticipantAutoAdded(_participant, _role, _weight);
        _updateVotersInContract();
    }
    
    // Override parent's updateParticipant to update AL voters
    function updateParticipant(address _participant, string memory _role, uint256 _weight) public override onlyCreator {
        // Call parent implementation directly since super doesn't work properly here
        require(bytes(participantRoles[_participant]).length > 0, "Not a participant");
        require(bytes(_role).length > 0, "Empty role");
        require(_weight > 0, "Weight must be positive");
        
        participantRoles[_participant] = _role;
        participantWeights[_participant] = _weight;
        lastModified = block.timestamp;
        
        emit ParticipantUpdated(_participant, _role, _weight);
        _updateVotersInContract();
    }
    
    // Override parent's deactivateProject to emit AL-specific event
    function deactivateProject() public override onlyCreator {
        // Call parent implementation directly
        require(isActive, "Already inactive");
        isActive = false;
        lastModified = block.timestamp;
        emit ProjectDeactivated(msg.sender, block.timestamp);
        
        // Add AL-specific event
        emit ProjectEndTriggered(msg.sender, "Project manually ended by coordinator", currentRound, block.timestamp);
    }
    
    // --- Project End Guards ---
    /**
     * @dev Internal function to check if project should end and emit event if so
     */
    function _checkProjectEndConditions() internal {
        if (!isActive) return; // Already ended
        
        // Check condition 1: Max iteration reached
        if (maxIteration > 0 && currentRound >= maxIteration) {
            emit ProjectEndTriggered(msg.sender, "Maximum iterations reached", currentRound, block.timestamp);
            return;
        }
        
        // Check condition 2: Unlabeled samples exhausted
        if (unlabeledSamplesExhausted) {
            emit ProjectEndTriggered(msg.sender, "No more unlabeled samples available", currentRound, block.timestamp);
            return;
        }
    }
    
    /**
     * @dev External function for AL-Engine or coordinator to notify when unlabeled samples are exhausted
     */
    function notifyUnlabeledSamplesExhausted() external onlyCreator {
        require(!unlabeledSamplesExhausted, "Already marked as exhausted");
        unlabeledSamplesExhausted = true;
        _checkProjectEndConditions();
    }
    
    // --- Round Tracking ---
    function incrementRound() external {
        require(msg.sender == votingContract, "Only voting");
        _incrementRoundInternal(false, "");
    }
    
    function triggerNextRound(string memory reason) external onlyCreator onlyActive {
        _incrementRoundInternal(true, reason);
    }
    
    function _incrementRoundInternal(bool isManualTrigger, string memory reason) internal {
        currentRound += 1;
        
        if (isManualTrigger) {
            lastModified = block.timestamp;
            emit ALRoundTriggered(currentRound, reason, block.timestamp);
        }
        
        emit RoundIncremented(currentRound);
        _checkProjectEndConditions();
    }
    
    // --- Voting Management ---
    /**
     * @dev Start batch voting for AL iteration samples
     * Always use this method (even for single samples) for consistent event handling
     * Voters are automatically managed when project membership changes
     */
    function startBatchVoting(string[] memory sampleIds, string[] memory sampleDataHashes) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        require(sampleIds.length > 0, "Empty sample batch");
        
        // Increment round for new batch
        currentRound += 1;
        
        // Check if project should end due to max iterations or sample exhaustion
        _checkProjectEndConditions();
        
        // Start the batch voting session (voters already set from membership)
        IALProjectVoting(votingContract).startBatchVoting(sampleIds, currentRound, sampleDataHashes);
        
        emit ALBatchStarted(currentRound, sampleIds.length, block.timestamp);
    }

    function endBatchVoting(uint256 round) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        require(round == currentRound, "Invalid round");
        
        // Forward to ALProjectVoting which will handle finalization and completion
        IALProjectVoting(votingContract).endBatchVoting(round);
        
        // Note: ALProjectVoting will automatically:
        // 1. Finalize remaining active samples
        // 2. Call _checkBatchCompletion  
        // 3. Emit BatchCompleted event
        // 4. Call notifyVotingSessionEnded for each sample (which clears activeSamples)
    }

    function storeFinalLabel(
        string memory sampleId,
        string memory label,
        uint256 round
    ) external onlyCreator {
        require(storageContract != address(0), "Storage contract not set");
        
        // Call via interface
        IALProjectStorage(storageContract).storeFinalLabel(sampleId, label, round);
    }
    
    /**
     * @dev Automatically receives and stores finalized labels from the voting contract
     * This function is called automatically when voting sessions are finalized
     */
    function receiveFinalLabelFromVoting(
        string memory sampleId,
        string memory label
    ) external onlyVotingContract {
        require(storageContract != address(0), "Storage contract not set");
        
        // Store the finalized label using current round
        IALProjectStorage(storageContract).storeFinalLabel(
            sampleId, 
            label, 
            currentRound
        );
        
        // Emit event for tracking automatic label storage
        emit AutoLabelStored(sampleId, label, currentRound, block.timestamp);
    }

    // ==================== DAL LABELING METHODS ====================
    
    /**
     * @dev Submit votes for multiple samples (batch voting only)
     * Auto-adds users as project members if needed
     */
    function submitBatchVote(string[] memory sampleIds, string[] memory labels) external {
        require(votingContract != address(0), "Voting contract not set");
        require(sampleIds.length == labels.length, "Mismatched arrays");
        require(sampleIds.length > 0, "Empty batch");
        
        // Verify all samples are active for voting
        for (uint256 i = 0; i < sampleIds.length; i++) {
            require(activeSamples[sampleIds[i]], "Sample not active for voting");
            require(bytes(sampleIds[i]).length > 0, "Empty sample ID");
            require(bytes(labels[i]).length > 0, "Empty label");
        }
        
        // Auto-add user as project participant if needed
        if (bytes(this.getParticipantRole(msg.sender)).length == 0) {
            addParticipantWithRole(msg.sender, "contributor", 1);
            // Note: addParticipantWithRole automatically updates voters in voting contract
        }
        
        // Verify user is eligible to vote
        require(bytes(this.getParticipantRole(msg.sender)).length > 0, "Not a project participant");
        
        // Check if user is registered in voting contract
        uint256 voterWeight = IALProjectVoting(votingContract).voterWeights(msg.sender);
        require(voterWeight > 0, "Voter not registered in voting contract");
        
        // Emit events for each vote
        for (uint256 i = 0; i < sampleIds.length; i++) {
            emit VoteSubmitted(sampleIds[i], msg.sender, labels[i], block.timestamp);
        }
        
        // Forward batch vote to ALProjectVoting contract
        IALProjectVoting(votingContract).submitBatchVoteOnBehalf(sampleIds, labels, msg.sender);
    }
    
    /**
     * @dev Called by ALProjectVoting when a voting session starts
     * This enables DAL event emission
     */
    function notifyVotingSessionStarted(string memory sampleId) external onlyVotingContract {
        activeSamples[sampleId] = true;
        
        // Add to current batch if not already present
        bool found = false;
        for (uint i = 0; i < currentBatchSampleIds.length; i++) {
            if (keccak256(bytes(currentBatchSampleIds[i])) == keccak256(bytes(sampleId))) {
                found = true;
                break;
            }
        }
        if (!found) {
            currentBatchSampleIds.push(sampleId);
        }
        
        emit VotingSessionStarted(sampleId, currentRound, votingTimeout, block.timestamp);
    }
    
    /**
     * @dev Called by ALProjectVoting when a voting session ends
     * This enables DAL event emission
     */
    function notifyVotingSessionEnded(string memory sampleId, string memory finalLabel) external onlyVotingContract {
        activeSamples[sampleId] = false;
        emit VotingSessionEnded(sampleId, finalLabel, currentRound, block.timestamp);
        
        // Check if all samples in current batch are completed
        bool allCompleted = true;
        uint256 completedCount = 0;
        
        for (uint i = 0; i < currentBatchSampleIds.length; i++) {
            if (activeSamples[currentBatchSampleIds[i]]) {
                allCompleted = false;
            } else {
                completedCount++;
            }
        }
        
        if (allCompleted && currentBatchSampleIds.length > 0) {
            emit ALBatchCompleted(currentRound, completedCount, block.timestamp);
            
            // Clear the batch after all samples are completed
            delete currentBatchSampleIds;
        }
    }
    
    function hasALContracts() external view returns (bool) {
        return votingContract != address(0) && storageContract != address(0);
    }
    
    function needsALDeployment() external view returns (bool) {
        // Check if this is an AL project that needs AL contracts
        if (this.hasALContracts()) {
            return false; // Already has AL contracts
        }
        
        // Check projectType field - this is the primary and efficient method
        return keccak256(bytes(projectType)) == keccak256(bytes("active_learning"));
    }
    
    /**
     * @dev Check if project should end based on any of the three conditions
     * Returns (shouldEnd, reason)
     */
    function shouldProjectEnd() external view returns (bool shouldEnd, string memory reason) {
        if (!isActive) {
            return (true, "Project manually deactivated");
        }
        
        // Condition 1: Max iteration reached
        if (maxIteration > 0 && currentRound >= maxIteration) {
            return (true, "Maximum iterations reached");
        }
        
        // Condition 2: Unlabeled samples exhausted
        if (unlabeledSamplesExhausted) {
            return (true, "No more unlabeled samples available");
        }
        
        // Condition 3: Manual end (handled by coordinator through frontend)
        return (false, "Project is still active");
    }

    // AL-specific metadata getter with extended fields
    function getALProjectMetadata() external view returns (
        string memory _title,
        string memory _description,
        address _owner,
        string memory _projectType,
        string memory _rocrateHash,
        uint256 _start,
        uint256 _end,
        string memory _queryStrategy,
        string memory _alScenario,
        uint256 _maxIteration,
        uint256 _queryBatchSize,
        string[] memory _labelSpace
    ) {
        return (
            title,
            description,
            creator,
            projectType,
            rocrateHash,
            startTime,
            endTime,
            queryStrategy,
            alScenario,
            maxIteration,
            queryBatchSize,
            labelSpace
        );
    }
} 