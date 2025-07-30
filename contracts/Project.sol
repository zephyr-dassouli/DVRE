// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// AL Contract Interfaces (no imports needed - just interfaces)
interface IALProjectVoting {
    function startBatchVoting(string[] memory sampleIds, uint256 round) external; // Internal call to voting contract
    function endBatchVoting(uint256 round) external; // Manual batch ending
    function setVoters(address[] memory _voters, uint256[] memory _weights) external;
    function submitBatchVoteOnBehalf(string[] memory sampleIds, string[] memory labels, address voter) external; // Batch vote method (works for single samples too)
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
    
    // Persistent participant management - Project as source of truth
    address[] public participants; // Renamed from members
    mapping(address => string) public participantRoles; // Track roles: "creator", "contributor", "observer", etc.
    mapping(address => uint256) public participantWeights; // Voting weights per participant
    mapping(address => uint256) public joinedAt; // Timestamp when participant joined
    
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
    event ParticipantAutoAdded(address indexed participant, string role, uint256 weight);
    event ParticipantUpdated(address indexed participant, string role, uint256 weight);
    event RoundIncremented(uint256 newRound);
    event ALRoundTriggered(uint256 round, string reason, uint256 timestamp);
    event AutoLabelStored(string sampleId, string label, uint256 round, uint256 timestamp);
    event InvitationSent(address indexed invitee, address indexed inviter, string role, uint256 timestamp);
    event InvitationAccepted(address indexed invitee, address indexed project, uint256 timestamp);
    event InvitationRejected(address indexed invitee, address indexed project, uint256 timestamp);
    event ALBatchStarted(uint256 round, uint256 sampleCount, uint256 timestamp);
    event ALBatchCompleted(uint256 round, uint256 completedSamples, uint256 timestamp);
    event VotersUpdated(uint256 round, uint256 voterCount, uint256 timestamp);
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
        
        // Initialize creator as first participant
        participants.push(_creator);
        participantRoles[_creator] = "creator";
        participantWeights[_creator] = 1;
        joinedAt[_creator] = block.timestamp;
        
        emit ProjectCreated(_creator, block.timestamp);
        emit ParticipantAdded(_creator);
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
        
        // Get the role from the join request
        string memory requestedRole = joinRequests[_requester].role;
        
        // Add as participant with the requested role and default weight
        _addParticipantInternal(_requester, requestedRole, 1);
        
        // Clean up the join request
        delete joinRequests[_requester];
        
        emit JoinRequestApproved(_requester, msg.sender, block.timestamp);
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
     * @dev Get all active samples (computation outsourced to ALProjectVoting)
     */
    function getActiveSamples() external view returns (string[] memory) {
        require(votingContract != address(0), "Voting contract not set");
        
        // Convert activeSamples mapping to boolean array
        bool[] memory sampleActiveStates = new bool[](currentBatchSampleIds.length);
        for (uint256 i = 0; i < currentBatchSampleIds.length; i++) {
            sampleActiveStates[i] = activeSamples[currentBatchSampleIds[i]];
        }
        
        // Get active samples from ALProjectVoting
        (string[] memory activeSampleIds, , , , ) = IALProjectVoting(votingContract).computeActiveBatch(
            currentBatchSampleIds,
            sampleActiveStates,
            labelSpace,
            votingTimeout,
            currentRound
        );
        
        return activeSampleIds;
    }
    
    /**
     * @dev Get current batch progress (computation outsourced to ALProjectVoting)
     */
    function getCurrentBatchProgress() external view returns (
        uint256 round,
        uint256 totalSamples,
        uint256 activeSamplesCount,
        uint256 completedSamples,
        string[] memory sampleIds,
        bool batchActive
    ) {
        require(votingContract != address(0), "Voting contract not set");
        
        // Convert activeSamples mapping to boolean array
        bool[] memory sampleActiveStates = new bool[](currentBatchSampleIds.length);
        for (uint256 i = 0; i < currentBatchSampleIds.length; i++) {
            sampleActiveStates[i] = activeSamples[currentBatchSampleIds[i]];
        }
        
        // Let ALProjectVoting compute the batch progress
        return IALProjectVoting(votingContract).computeBatchProgress(
            currentRound,
            currentBatchSampleIds,
            sampleActiveStates
        );
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

    function getIsActive() external view returns (bool) {
        return isActive;
    }
    
    // --- Participant Registry ---
    function addParticipant(address _participant) external onlyCreator {
        require(bytes(participantRoles[_participant]).length == 0, "Already participant");
        _addParticipantInternal(_participant, "contributor", 1);
    }
    
    /**
     * @dev Internal function to add a participant with role and weight
     */
    function _addParticipantInternal(address _participant, string memory _role, uint256 _weight) internal {
        require(bytes(participantRoles[_participant]).length == 0, "Already participant");
        require(_weight > 0, "Weight must be positive");
        
        participants.push(_participant);
        participantRoles[_participant] = _role;
        participantWeights[_participant] = _weight;
        joinedAt[_participant] = block.timestamp;
        
        emit ParticipantAdded(_participant);
        
        // Update voters in voting contract if AL contracts are linked
        _updateVotersInContract();
    }
    
    /**
     * @dev Internal function for auto-adding participants (emits different event)
     */
    function _autoAddParticipantInternal(address _participant, string memory _role, uint256 _weight) internal {
        require(bytes(participantRoles[_participant]).length == 0, "Already participant");
        require(_weight > 0, "Weight must be positive");
        
        participants.push(_participant);
        participantRoles[_participant] = _role;
        participantWeights[_participant] = _weight;
        joinedAt[_participant] = block.timestamp;
        
        emit ParticipantAutoAdded(_participant, _role, _weight);
        
        // Update voters in voting contract if AL contracts are linked
        _updateVotersInContract();
    }
    
    /**
     * @dev Helper to update voters in voting contract when participant membership changes
     */
    function _updateVotersInContract() internal {
        if (votingContract == address(0)) return; // Skip if not linked yet
        
        (address[] memory eligibleVoters, uint256[] memory voterWeights) = this.getEligibleVoters();
        if (eligibleVoters.length > 0) {
            IALProjectVoting(votingContract).setVoters(eligibleVoters, voterWeights);
        }
    }
    
    /**
     * @dev Add participant with specific role and weight
     */
    function addParticipantWithRole(address _participant, string memory _role, uint256 _weight) external onlyCreator {
        require(bytes(_role).length > 0, "Empty role");
        _addParticipantInternal(_participant, _role, _weight);
    }
    
    /**
     * @dev Update participant role or weight
     */
    function updateParticipant(address _participant, string memory _role, uint256 _weight) external onlyCreator {
        require(bytes(participantRoles[_participant]).length > 0, "Not a participant");
        require(bytes(_role).length > 0, "Empty role");
        require(_weight > 0, "Weight must be positive");
        
        participantRoles[_participant] = _role;
        participantWeights[_participant] = _weight;
        lastModified = block.timestamp;
        
        emit ParticipantUpdated(_participant, _role, _weight);
        
        // Update voters in voting contract since weights/roles changed
        _updateVotersInContract();
    }
    
    /**
     * @dev Get all participants and their details
     */
    function getAllParticipants() external view returns (
        address[] memory participantAddresses,
        string[] memory roles,
        uint256[] memory weights,
        uint256[] memory joinTimestamps
    ) {
        uint256 participantCount = participants.length;
        participantAddresses = new address[](participantCount);
        roles = new string[](participantCount);
        weights = new uint256[](participantCount);
        joinTimestamps = new uint256[](participantCount);
        
        for (uint256 i = 0; i < participantCount; i++) {
            address participant = participants[i];
            participantAddresses[i] = participant;
            roles[i] = participantRoles[participant];
            weights[i] = participantWeights[participant];
            joinTimestamps[i] = joinedAt[participant];
        }
        
        return (participantAddresses, roles, weights, joinTimestamps);
    }
    
    /**
     * @dev Get eligible voters (computation outsourced to ALProjectVoting)
     */
    function getEligibleVoters() external view returns (address[] memory voters, uint256[] memory weights) {
        require(votingContract != address(0), "Voting contract not set");
        
        // Get all participant data
        (address[] memory participantAddresses, string[] memory roles, uint256[] memory participantWeightList, ) = this.getAllParticipants();
        
        // Let ALProjectVoting compute eligible voters
        return IALProjectVoting(votingContract).computeEligibleVoters(participantAddresses, roles, participantWeightList);
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
        
        // Set initial voters in voting contract
        _updateVotersInContract();
        
        lastModified = block.timestamp;
        emit ProjectUpdated(msg.sender, block.timestamp);
    }
    
    // --- Voting Management ---
    /**
     * @dev DEPRECATED: Manually set voters (use addParticipant/addParticipantWithRole instead)
     * This function is deprecated as the new system automatically manages voters from project members
     */
    function setProjectVoters(address[] memory _voters, uint256[] memory _weights) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        
        // This is now deprecated - startBatchVoting automatically sets voters from members
        // Kept for backward compatibility but not recommended
        IALProjectVoting(votingContract).setVoters(_voters, _weights);
        
        emit VotersUpdated(currentRound, _voters.length, block.timestamp);
    }

    /**
     * @dev Start batch voting for AL iteration samples
     * Always use this method (even for single samples) for consistent event handling
     * Voters are automatically managed when project membership changes
     */
    function startBatchVoting(string[] memory sampleIds) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        require(sampleIds.length > 0, "Empty sample batch");
        
        // Increment round for new batch
        currentRound += 1;
        
        // Start the batch voting session (voters already set from membership)
        IALProjectVoting(votingContract).startBatchVoting(sampleIds, currentRound);
        
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
        if (bytes(participantRoles[msg.sender]).length == 0) {
            _autoAddParticipantInternal(msg.sender, "contributor", 1);
            // Note: _autoAddParticipantInternal automatically updates voters in voting contract
        }
        
        // Verify user is eligible to vote
        require(bytes(participantRoles[msg.sender]).length > 0, "Not a project participant");
        
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
    // DELEGATION METHODS - Call linked contracts
    // ========================================================================

    /**
     * @dev Get voting history (simplified)
     */
    function getVotingHistory() external view returns (
        string[] memory sampleIds,
        string[] memory finalLabels
    ) {
        require(storageContract != address(0), "Storage contract not set");
        
        // Simplified version - returns empty arrays as placeholder
        return (new string[](0), new string[](0));
    }

    /**
     * @dev Get user contributions (simplified)
     */
    function getUserContributions() external view returns (
        address[] memory voters,
        uint256[] memory voteCounts,
        uint256[] memory weights
    ) {
        require(votingContract != address(0), "Voting contract not set");
        
        // Simplified implementation - returns empty arrays as placeholder
        return (new address[](0), new uint256[](0), new uint256[](0));
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

    /**
     * @dev Get current active batch (computation outsourced to ALProjectVoting)
     */
    function getActiveBatch() external view returns (
        string[] memory sampleIds,
        string[] memory sampleData, 
        string[] memory labelOptions,
        uint256 timeRemaining,
        uint256 round
    ) {
        require(votingContract != address(0), "Voting contract not set");
        
        // Convert activeSamples mapping to boolean array
        bool[] memory sampleActiveStates = new bool[](currentBatchSampleIds.length);
        for (uint256 i = 0; i < currentBatchSampleIds.length; i++) {
            sampleActiveStates[i] = activeSamples[currentBatchSampleIds[i]];
        }
        
        // Let ALProjectVoting compute the active batch
        return IALProjectVoting(votingContract).computeActiveBatch(
            currentBatchSampleIds,
            sampleActiveStates,
            labelSpace,
            votingTimeout,
            currentRound
        );
    }
}