// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// AL Contract Interfaces (no imports needed - just interfaces)
interface IALProjectVoting {
    function startVotingSession(string memory sampleId) external;
    function startBatchVoting(string[] memory sampleIds, uint256 round) external; // Internal call to voting contract
    function endVotingSession(string memory sampleId) external;
    function setVoters(address[] memory _voters, uint256[] memory _weights) external;
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
        uint256 round,
        string memory justification,
        string memory ipfsHash
    ) external;
    function getLabel(string memory sampleId) external view returns (string memory);
    function projectContract() external view returns (address);
    // Add missing methods for voting history
    function getVotingHistoryCount(string memory sampleId) external view returns (uint256);
    function getVotingHistoryByIndex(string memory sampleId, uint256 index) external view returns (
        uint256 round,
        string memory finalLabel,
        uint256 timestamp,
        uint256 voteCount
    );
    function getVoteFromHistory(string memory sampleId, uint256 historyIndex, uint256 voteIndex) external view returns (
        address voter,
        string memory label
    );
    function getFinalLabel(string memory sampleId) external view returns (
        string memory label,
        uint256 round,
        string memory justification,
        string memory ipfsHash,
        uint256 timestamp
    );
}

contract Project {
    // Core ownership and status
    address public creator;
    bool public isActive;
    uint256 public createdAt;
    uint256 public lastModified;
    
    // Project-wide metadata
    string public projectData;
    string public title;
    string public description;
    string public projectType;
    string public rocrateHash;
    uint256 public startTime;
    uint256 public endTime;
    
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
    
    // Join request structure
    struct JoinRequest {
        address requester;
        string role;
        uint256 timestamp;
        bool exists;
    }

    // Invitation structure
    struct Invitation {
        address invitee;
        string role;
        uint256 timestamp;
        bool exists;
    }
    
    // Mapping to store join requests: requester address => JoinRequest
    mapping(address => JoinRequest) public joinRequests;
    
    // Mapping to store invitations: invitee address => Invitation
    mapping(address => Invitation) public invitations;
    
    // Array to keep track of all requesters for enumeration
    address[] public requesters;
    
    // Array to keep track of all invitees for enumeration
    address[] public invitees;
    
    // Linked contracts
    address public votingContract;
    address public storageContract;
    
    // Optional participant registry
    mapping(address => bool) public isParticipant;
    
    // Round tracking
    uint256 public currentRound;

    
    // Events
    event ProjectCreated(address indexed creator, uint256 timestamp);
    event ProjectUpdated(address indexed updater, uint256 timestamp);
    event ProjectDeactivated(address indexed creator, uint256 timestamp);
    event ProjectReactivated(address indexed creator, uint256 timestamp);
    event JoinRequestSubmitted(address indexed requester, string role, uint256 timestamp);
    event JoinRequestApproved(address indexed requester, address indexed approver, uint256 timestamp);
    event JoinRequestRejected(address indexed requester, address indexed rejector, uint256 timestamp);
    event ALContractsDeployed(address votingContract, address storageContract);
    event ParticipantAdded(address indexed participant);
    event RoundIncremented(uint256 newRound);
    event ALRoundTriggered(uint256 round, string reason, uint256 timestamp);
    event AutoLabelStored(string sampleId, string label, uint256 round, uint256 timestamp);
    event InvitationSent(address indexed invitee, address indexed inviter, string role, uint256 timestamp);
    event InvitationAccepted(address indexed invitee, address indexed project, uint256 timestamp);
    event InvitationRejected(address indexed invitee, address indexed project, uint256 timestamp);
    event MemberAdded(address indexed member, string role, uint256 timestamp);
    event ALBatchStarted(uint256 round, uint256 sampleCount, uint256 timestamp);
    event ALBatchCompleted(uint256 round, uint256 completedSamples, uint256 timestamp);
    
    // DAL Events for labeling interface
    event VotingSessionStarted(string sampleId, uint256 round, uint256 timeout, uint256 timestamp);
    event VotingSessionEnded(string sampleId, string finalLabel, uint256 round, uint256 timestamp);
    event VoteSubmitted(string sampleId, address voter, string label, uint256 timestamp);
    

    // Modifiers
    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }
    
    modifier onlyActive() {
        require(isActive, "Inactive");
        _;
    }
    
    modifier onlyVotingContract() {
        require(msg.sender == votingContract, "Only voting contract can call");
        _;
    }
    
    // Constructor
    constructor(address _creator, string memory _projectData) {
        require(bytes(_projectData).length > 0, "Empty data");
        creator = _creator;
        projectData = _projectData;
        createdAt = block.timestamp;
        lastModified = block.timestamp;
        isActive = true;
        emit ProjectCreated(_creator, block.timestamp);
    }
    
    // --- Metadata Setters ---
    function setProjectMetadata(
        string memory _title,
        string memory _description,
        string memory _projectType,
        string memory _rocrateHash
    ) external onlyCreator {
        title = _title;
        description = _description;
        projectType = _projectType;
        rocrateHash = _rocrateHash;
        lastModified = block.timestamp;
    }
    
    function setALMetadata(
        string memory _queryStrategy,
        string memory _alScenario,
        uint256 _maxIteration,
        uint256 _queryBatchSize,
        string[] memory _labelSpace
    ) external onlyCreator {
        require(_maxIteration > 0, "Invalid max iteration");
        require(_queryBatchSize > 0, "Invalid batch size");
        
        queryStrategy = _queryStrategy;
        alScenario = _alScenario;
        maxIteration = _maxIteration;
        queryBatchSize = _queryBatchSize;
        labelSpace = _labelSpace;
        lastModified = block.timestamp;
    }
    
    function setStartAndEndTime(uint256 _start, uint256 _end) external onlyCreator {
        require(_start < _end, "Invalid time range");
        startTime = _start;
        endTime = _end;
    }
    
    function updateProjectData(string memory _newProjectData) external onlyCreator onlyActive {
        require(bytes(_newProjectData).length > 0, "Empty data");
        projectData = _newProjectData;
        lastModified = block.timestamp;
        emit ProjectUpdated(msg.sender, block.timestamp);
    }
    
    // --- Join Requests ---
    function submitJoinRequest(string memory _role) external onlyActive {
        require(msg.sender != creator, "Creator cannot join");
        require(!joinRequests[msg.sender].exists, "Request exists");
        require(bytes(_role).length > 0, "Empty role");
        
        joinRequests[msg.sender] = JoinRequest({
            requester: msg.sender,
            role: _role,
            timestamp: block.timestamp,
            exists: true
        });
        
        requesters.push(msg.sender);
        emit JoinRequestSubmitted(msg.sender, _role, block.timestamp);
    }
    
    function approveJoinRequest(address _requester) external onlyCreator {
        require(joinRequests[_requester].exists, "No request");
        delete joinRequests[_requester];
        // Add as participant
        isParticipant[_requester] = true;
        emit JoinRequestApproved(_requester, msg.sender, block.timestamp);
        emit ParticipantAdded(_requester);
    }
    
    function rejectJoinRequest(address _requester) external onlyCreator {
        require(joinRequests[_requester].exists, "No request");
        delete joinRequests[_requester];
        emit JoinRequestRejected(_requester, msg.sender, block.timestamp);
    }
    
    function getJoinRequest(address _requester) external view returns (
        address requester,
        string memory role,
        uint256 timestamp,
        bool exists
    ) {
        JoinRequest memory request = joinRequests[_requester];
        return (request.requester, request.role, request.timestamp, request.exists);
    }
    
    function getAllRequesters() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < requesters.length; i++) {
            if (joinRequests[requesters[i]].exists) {
                activeCount++;
            }
        }
        
        address[] memory activeRequesters = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < requesters.length; i++) {
            if (joinRequests[requesters[i]].exists) {
                activeRequesters[index] = requesters[i];
                index++;
            }
        }
        return activeRequesters;
    }
    
    // --- Project Status ---
    function deactivateProject() external onlyCreator {
        require(isActive, "Already inactive");
        isActive = false;
        lastModified = block.timestamp;
        emit ProjectDeactivated(msg.sender, block.timestamp);
    }
    
    function reactivateProject() external onlyCreator {
        require(!isActive, "Already active");
        isActive = true;
        lastModified = block.timestamp;
        emit ProjectReactivated(msg.sender, block.timestamp);
    }
    
    function getIsActive() external view returns (bool) {
        return isActive;
    }
    
    // --- Participant Registry ---
    function addParticipant(address _participant) external onlyCreator {
        require(!isParticipant[_participant], "Already participant");
        isParticipant[_participant] = true;
        emit ParticipantAdded(_participant);
    }
    
    // --- Round Tracking ---
    function incrementRound() external {
        require(msg.sender == votingContract, "Only voting");
        currentRound += 1;
        emit RoundIncremented(currentRound);
    }
    
    function triggerNextRound(string memory reason) external onlyCreator onlyActive {
        currentRound += 1;
        lastModified = block.timestamp;
        emit RoundIncremented(currentRound);
        emit ALRoundTriggered(currentRound, reason, block.timestamp);
    }
    
    // --- Linked Contracts ---
    function linkALContracts(address _voting, address _storage) external onlyCreator {
        require(_voting != address(0) && _storage != address(0), "Invalid addresses");
        require(votingContract == address(0), "Already linked");
        require(storageContract == address(0), "Already linked");
        
        votingContract = _voting;
        storageContract = _storage;
        
        lastModified = block.timestamp;
        emit ProjectUpdated(msg.sender, block.timestamp);
    }
    
    // --- Voting Management ---
    function setProjectVoters(address[] memory _voters, uint256[] memory _weights) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        
        // Call via interface instead of direct call
        IALProjectVoting(votingContract).setVoters(_voters, _weights);
    }

    function startVotingSession(string memory sampleId) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        
        // NOTE: This method is deprecated in favor of startBatchVoting
        // Even for single samples, use startBatchVoting([sampleId]) for consistency
        
        // Call via interface
        IALProjectVoting(votingContract).startVotingSession(sampleId);
    }

    /**
     * @dev Start batch voting for AL iteration samples
     * Always use this method (even for single samples) for consistent event handling
     */
    function startBatchVoting(string[] memory sampleIds) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        require(sampleIds.length > 0, "Empty sample batch");
        
        // Increment round for new batch
        currentRound += 1;
        
        // Call via interface - supports any batch size including 1
        IALProjectVoting(votingContract).startBatchVoting(sampleIds, currentRound);
        
        emit ALBatchStarted(currentRound, sampleIds.length, block.timestamp);
    }

    function endVotingSession(string memory sampleId) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        
        // Call via interface
        IALProjectVoting(votingContract).endVotingSession(sampleId);
    }
    
    function storeFinalLabel(
        string memory sampleId,
        string memory label,
        uint256 round,
        string memory justification,
        string memory ipfsHash
    ) external onlyCreator {
        require(storageContract != address(0), "Storage contract not set");
        
        // Call via interface
        IALProjectStorage(storageContract).storeFinalLabel(sampleId, label, round, justification, ipfsHash);
    }
    
    /**
     * @dev Automatically receives and stores finalized labels from the voting contract
     * This function is called automatically when voting sessions are finalized
     */
    function receiveFinalLabelFromVoting(
        string memory sampleId,
        string memory label,
        string memory justification,
        string memory ipfsHash
    ) external onlyVotingContract {
        require(storageContract != address(0), "Storage contract not set");
        
        // Store the finalized label using current round
        IALProjectStorage(storageContract).storeFinalLabel(
            sampleId, 
            label, 
            currentRound, 
            justification, 
            ipfsHash
        );
        
        // Emit event for tracking automatic label storage
        emit AutoLabelStored(sampleId, label, currentRound, block.timestamp);
    }

    // ==================== DAL LABELING METHODS ====================
    
    /**
     * @dev Submit vote for a sample (DAL interface method)
     * This is the main entry point for DAL to submit votes
     */
    function submitVote(string memory sampleId, string memory label) external {
        require(votingContract != address(0), "Voting contract not set");
        require(bytes(sampleId).length > 0, "Empty sample ID");
        require(bytes(label).length > 0, "Empty label");
        
        // Verify the sample is currently active for voting
        require(activeSamples[sampleId], "Sample not active for voting");
        
        // Submit vote to ALProjectVoting contract
        // Note: ALProjectVoting will handle voter authorization and validation
        // This requires ALProjectVoting to have a submitVote function that accepts any caller
        // and handles the authorization internally
        
        // For now, we'll emit the event and assume the vote will be processed
        emit VoteSubmitted(sampleId, msg.sender, label, block.timestamp);
        
        // TODO: Once ALProjectVoting has a public submitVote method, call it here:
        // IALProjectVoting(votingContract).submitVote(sampleId, label, msg.sender);
    }
    
    /**
     * @dev Get current active voting session for DAL interface
     * Returns the first active sample found
     */
    function getActiveVoting() external view returns (
        string memory sampleId,
        string memory sampleData,
        string[] memory labelOptions,
        uint256 timeRemaining,
        address[] memory voters
    ) {
        require(votingContract != address(0), "Voting contract not set");
        
        // Find the first active sample in current batch
        for (uint i = 0; i < currentBatchSampleIds.length; i++) {
            string memory currentSampleId = currentBatchSampleIds[i];
            
            if (activeSamples[currentSampleId] && 
                IALProjectVoting(votingContract).isVotingActive(currentSampleId)) {
                
                // Get voting session details from ALProjectVoting
                (uint256 sessionStartTime, bool sessionIsActive, bool isFinalized, string memory finalLabel) = 
                    IALProjectVoting(votingContract).getVotingSession(currentSampleId);
                
                if (sessionIsActive && !isFinalized) {
                    uint256 elapsed = block.timestamp - sessionStartTime;
                    uint256 remaining = elapsed >= votingTimeout ? 0 : votingTimeout - elapsed;
                    
                    return (
                        currentSampleId,
                        string(abi.encodePacked("Sample data for ", currentSampleId)), // Placeholder
                        labelSpace, // Use project's label space
                        remaining,
                        new address[](0) // Empty voters array for now
                    );
                }
            }
        }
        
        // No active voting session found
        return ("", "", new string[](0), 0, new address[](0));
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
            
            // Clear the batch
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
        
        // Check projectType field first
        if (keccak256(bytes(projectType)) == keccak256(bytes("active_learning"))) {
            return true;
        }
        
        // Fallback: check projectData JSON for "active_learning" string
        bytes memory dataBytes = bytes(projectData);
        bytes memory searchBytes = bytes("active_learning");
        
        if (dataBytes.length >= searchBytes.length) {
            for (uint i = 0; i <= dataBytes.length - searchBytes.length; i++) {
                bool found = true;
                for (uint j = 0; j < searchBytes.length; j++) {
                    if (dataBytes[i + j] != searchBytes[j]) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // --- View Functions ---
    function getCreator() external view returns (address) {
        return creator;
    }
    
    function getProjectData() external view returns (string memory) {
        return projectData;
    }
    
    function getTimestamps() external view returns (uint256 created, uint256 modified) {
        return (createdAt, lastModified);
    }
    
    function getProjectStatus() external view returns (
        bool active,
        uint256 created,
        uint256 modified,
        address projectCreator
    ) {
        return (isActive, createdAt, lastModified, creator);
    }
    
    function getProjectMetadata() external view returns (
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

    // ========================================================================
    // DELEGATION METHODS - Call linked contracts for DAL integration
    // ========================================================================

    /**
     * @dev Get voting history by delegating to ALProjectStorage
     */
    function getVotingHistory() external view returns (
        string[] memory sampleIds,
        uint256[] memory rounds,
        string[] memory finalLabels,
        uint256[] memory timestamps
    ) {
        require(storageContract != address(0), "Storage contract not set");
        
        // This is a simplified version - in a full implementation, 
        // you'd need to track all sample IDs or iterate through known samples
        // For now, return empty arrays as placeholder
        return (new string[](0), new uint256[](0), new string[](0), new uint256[](0));
    }

    /**
     * @dev Get user contributions by delegating to ALProjectVoting
     */
    function getUserContributions() external view returns (
        address[] memory voters,
        uint256[] memory voteCounts,
        uint256[] memory weights
    ) {
        require(votingContract != address(0), "Voting contract not set");
        
        // Get voter weights directly from the mapping
        // Note: This is a simplified implementation
        // In a full implementation, you'd need to track voters separately
        // or iterate through known voters
        
        // For now, return empty arrays as placeholder
        // The actual implementation would need additional tracking
        return (new address[](0), new uint256[](0), new uint256[](0));
    }

    /**
     * @dev Get detailed voting history for a specific sample
     */
    function getSampleVotingHistory(string memory sampleId) external view returns (
        uint256 round,
        string memory finalLabel,
        uint256 timestamp,
        address[] memory voters,
        string[] memory labels
    ) {
        require(storageContract != address(0), "Storage contract not set");
        
        // Get voting history count for this sample
        uint256 historyCount = IALProjectStorage(storageContract).getVotingHistoryCount(sampleId);
        
        if (historyCount == 0) {
            return (0, "", 0, new address[](0), new string[](0));
        }
        
        // Get the latest history entry (most recent)
        uint256 latestIndex = historyCount - 1;
        (uint256 historyRound, string memory historyFinalLabel, uint256 historyTimestamp, uint256 voteCount) = 
            IALProjectStorage(storageContract).getVotingHistoryByIndex(sampleId, latestIndex);
        
        // Get all votes for this history entry
        address[] memory historyVoters = new address[](voteCount);
        string[] memory historyLabels = new string[](voteCount);
        
        for (uint256 i = 0; i < voteCount; i++) {
            (address voter, string memory label) = 
                IALProjectStorage(storageContract).getVoteFromHistory(sampleId, latestIndex, i);
            historyVoters[i] = voter;
            historyLabels[i] = label;
        }
        
        return (historyRound, historyFinalLabel, historyTimestamp, historyVoters, historyLabels);
    }

    /**
     * @dev Get voter statistics from ALProjectVoting
     */
    function getVoterStats(address voter) external view returns (
        uint256 weight,
        uint256 totalVotes,
        bool isRegistered
    ) {
        require(votingContract != address(0), "Voting contract not set");
        
        uint256 voterWeight = IALProjectVoting(votingContract).voterWeights(voter);
        bool registered = voterWeight > 0;
        
        // Note: totalVotes would need to be tracked separately in ALProjectVoting
        // For now, return weight and registration status
        return (voterWeight, 0, registered);
    }
}