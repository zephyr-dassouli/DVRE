// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Project Contract Interface for composition
interface IProject {
    function creator() external view returns (address);
    function isActive() external view returns (bool);
    function getAllParticipants() external view returns (
        address[] memory participantAddresses,
        string[] memory roles,
        uint256[] memory weights,
        uint256[] memory joinTimestamps
    );
    function getParticipantRole(address _participant) external view returns (string memory);
    function addParticipantWithRole(address _participant, string memory _role, uint256 _weight) external;
    function updateParticipant(address _participant, string memory _role, uint256 _weight) external;
    function updateROCrateHash(string memory _rocrateHash) external;
}

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

contract ALProject {
    // Link to base Project contract
    address public baseProject;
    
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
    bool public finalTraining = false; // Track final training completion

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
    
    modifier onlyCreator() {
        require(msg.sender == IProject(baseProject).creator(), "Only creator");
        _;
    }
    
    modifier onlyActive() {
        require(IProject(baseProject).isActive(), "Inactive");
        _;
    }
    
    // Constructor - takes base project address
    constructor(address _baseProject, string memory _projectData) 
    {
        // AL-specific initialization can go here if needed
        baseProject = _baseProject;
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
    ) external {
        // During initial setup, allow any caller (ALProjectLinker)
        // After setup, only allow creator
        if (votingContract != address(0) || storageContract != address(0)) {
            require(msg.sender == IProject(baseProject).creator(), "Only creator after initial setup");
        }
        
        // Validate inputs
        require(_votingContract != address(0) && _storageContract != address(0), "Invalid contract addresses");
        require(votingContract == address(0), "AL contracts already linked");
        require(storageContract == address(0), "AL contracts already linked");
        require(_maxIteration > 0, "Invalid max iteration");
        require(_queryBatchSize > 0, "Invalid batch size");
        // Allow empty rocrateHash during deployment - ALProjectDeployer handles it separately
        // require(bytes(_rocrateHash).length > 0, "RO-Crate hash cannot be empty");
        
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
        
        // Get participant data from base Project contract
        (address[] memory participantAddresses, string[] memory roles, uint256[] memory weights,) = IProject(baseProject).getAllParticipants();
        
        if (participantAddresses.length == 0) return;
        
        // Let ALProjectVoting compute eligible voters and set them
        (address[] memory eligibleVoters, uint256[] memory voterWeights) = IALProjectVoting(votingContract).computeEligibleVoters(participantAddresses, roles, weights);
        
        if (eligibleVoters.length > 0) {
            IALProjectVoting(votingContract).setVoters(eligibleVoters, voterWeights);
        }
    }
    
    // Note: Participant management is handled by base Project contract
    // AL-specific participant updates should be triggered via events or callbacks
    
    // --- Project End Guards ---
    /**
     * @dev Internal function to check if project should end and emit event if so
     */
    function _checkProjectEndConditions() internal {
        if (!IProject(baseProject).isActive()) return; // Already ended
        
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
    
    /**
     * @dev External function for coordinator to mark final training as completed
     */
    function markFinalTrainingCompleted() external onlyCreator {
        require(!finalTraining, "Final training already completed");
        finalTraining = true;
        emit ALRoundTriggered(currentRound, "Final training completed", block.timestamp);
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
            // lastModified = block.timestamp; // This line was removed from the new_code
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
        if (bytes(IProject(baseProject).getParticipantRole(msg.sender)).length == 0) {
            IProject(baseProject).addParticipantWithRole(msg.sender, "contributor", 1);
            // Note: addParticipantWithRole automatically updates voters in voting contract
        }
        
        // Verify user is eligible to vote
        require(bytes(IProject(baseProject).getParticipantRole(msg.sender)).length > 0, "Not a project participant");
        
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
        // Check if this AL extension already has contracts
        if (this.hasALContracts()) {
            return false; // Already has AL contracts
        }
        
        // Since this is an ALProject, it always needs AL contracts if they don't exist
        return true;
    }
    
    /**
     * @dev Check if project should end based on any of the three conditions
     * Returns (shouldEnd, reason)
     */
    function shouldProjectEnd() external view returns (bool shouldEnd, string memory reason) {
        if (!IProject(baseProject).isActive()) {
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
        // Get base project metadata via interface (note: would need to add this to IProject interface)
        // For now, we'll return partial data - the caller should combine with base project data
        return (
            "", // title - get from base project
            "", // description - get from base project  
            IProject(baseProject).creator(),
            "", // projectType - get from base project
            "", // rocrateHash - get from base project
            0,  // startTime - get from base project
            0,  // endTime - get from base project
            queryStrategy,
            alScenario,
            maxIteration,
            queryBatchSize,
            labelSpace
        );
    }
} 