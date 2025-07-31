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
    string public rocrateHashFinal; // Final RO-Crate hash for published results
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
    
    // AL Project end conditions tracking
    bool public unlabeledSamplesExhausted = false;

    
    // Common Project Events
    event ProjectCreated(address indexed creator, uint256 timestamp);
    event ProjectUpdated(address indexed updater, uint256 timestamp);
    event FinalROCrateHashUpdated(address indexed updater, string rocrateHashFinal, uint256 timestamp);
    event ProjectDeactivated(address indexed creator, uint256 timestamp);
    event ProjectReactivated(address indexed creator, uint256 timestamp);

    // AL Project Events
    event ALContractsDeployed(address votingContract, address storageContract);
    event ParticipantAutoAdded(address indexed participant, string role, uint256 weight);
    event ParticipantUpdated(address indexed participant, string role, uint256 weight);
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

    // Member Management Events
    event InvitationSent(address indexed invitee, address indexed inviter, string role, uint256 timestamp);
    event InvitationAccepted(address indexed invitee, address indexed project, uint256 timestamp);
    event InvitationRejected(address indexed invitee, address indexed project, uint256 timestamp);
    event JoinRequestSubmitted(address indexed requester, string role, uint256 timestamp);
    event JoinRequestApproved(address indexed requester, address indexed approver, uint256 timestamp);
    event JoinRequestRejected(address indexed requester, address indexed rejector, uint256 timestamp);
    
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
        emit ParticipantAutoAdded(_creator, "creator", 1);
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
    
    function setFinalROCrateHash(string memory _rocrateHashFinal) external onlyCreator {
        require(bytes(_rocrateHashFinal).length > 0, "Final RO-Crate hash cannot be empty");
        rocrateHashFinal = _rocrateHashFinal;
        lastModified = block.timestamp;
        emit FinalROCrateHashUpdated(msg.sender, _rocrateHashFinal, block.timestamp);
    }
    
    function updateROCrateHash(string memory _rocrateHash) external onlyCreator {
        require(bytes(_rocrateHash).length > 0, "RO-Crate hash cannot be empty");
        rocrateHash = _rocrateHash;
        lastModified = block.timestamp;
        emit ProjectUpdated(msg.sender, block.timestamp);
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
        
        // Only add to requesters array if not already present
        bool alreadyInArray = false;
        for (uint256 i = 0; i < requesters.length; i++) {
            if (requesters[i] == msg.sender) {
                alreadyInArray = true;
                break;
            }
        }
        if (!alreadyInArray) {
            requesters.push(msg.sender);
        }
        
        emit JoinRequestSubmitted(msg.sender, _role, block.timestamp);
    }
    
    function approveJoinRequest(address _requester) external onlyCreator {
        require(joinRequests[_requester].exists, "No request");
        
        // Get the role from the join request
        string memory requestedRole = joinRequests[_requester].role;
        
        // Auto-add as participant with the requested role and default weight
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
    
    // --- Invitations ---
    function sendInvitation(address _invitee, string memory _role) external onlyCreator onlyActive {
        require(_invitee != address(0), "Invalid invitee address");
        require(_invitee != creator, "Cannot invite creator");
        require(!invitations[_invitee].exists, "Invitation already exists");
        require(bytes(_role).length > 0, "Empty role");
        require(bytes(participantRoles[_invitee]).length == 0, "Already participant");
        
        invitations[_invitee] = Invitation({
            invitee: _invitee,
            role: _role,
            timestamp: block.timestamp,
            exists: true
        });
        
        // Only add to invitees array if not already present
        bool alreadyInArray = false;
        for (uint256 i = 0; i < invitees.length; i++) {
            if (invitees[i] == _invitee) {
                alreadyInArray = true;
                break;
            }
        }
        if (!alreadyInArray) {
            invitees.push(_invitee);
        }
        
        emit InvitationSent(_invitee, msg.sender, _role, block.timestamp);
    }
    
    function acceptInvitation() external onlyActive {
        require(invitations[msg.sender].exists, "No invitation found");
        require(bytes(participantRoles[msg.sender]).length == 0, "Already participant");
        
        // Get the role from the invitation
        string memory invitedRole = invitations[msg.sender].role;
        
        // Auto-add as participant with the invited role and default weight
        _addParticipantInternal(msg.sender, invitedRole, 1);
        
        // Clean up the invitation
        delete invitations[msg.sender];
        
        emit InvitationAccepted(msg.sender, address(this), block.timestamp);
    }
    
    function rejectInvitation() external {
        require(invitations[msg.sender].exists, "No invitation found");
        delete invitations[msg.sender];
        emit InvitationRejected(msg.sender, address(this), block.timestamp);
    }
    
    function getInvitation(address _invitee) external view returns (
        address invitee,
        string memory role,
        uint256 timestamp,
        bool exists
    ) {
        Invitation memory invitation = invitations[_invitee];
        return (invitation.invitee, invitation.role, invitation.timestamp, invitation.exists);
    }
    
    // Allow invitation acceptors to update project data after joining
    function updateProjectDataAfterAcceptance(string memory _newProjectData) external onlyActive {
        require(bytes(_newProjectData).length > 0, "Empty data");
        require(bytes(participantRoles[msg.sender]).length > 0, "Not a project participant");
        
        projectData = _newProjectData;
        lastModified = block.timestamp;
        emit ProjectUpdated(msg.sender, block.timestamp);
    }
    
    // --- Project Status ---
    function deactivateProject() external onlyCreator {
        require(isActive, "Already inactive");
        isActive = false;
        lastModified = block.timestamp;
        emit ProjectDeactivated(msg.sender, block.timestamp);
        emit ProjectEndTriggered(msg.sender, "Project manually ended by coordinator", currentRound, block.timestamp);
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
     * @dev Internal function to auto-add a participant with role and weight
     */
    function _addParticipantInternal(address _participant, string memory _role, uint256 _weight) internal {
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
        
        // Build participant data inline since getEligibleVoters was removed
        uint256 participantCount = participants.length;
        if (participantCount == 0) return;
        
        address[] memory participantAddresses = new address[](participantCount);
        string[] memory roles = new string[](participantCount);
        uint256[] memory participantWeightList = new uint256[](participantCount);
        
        for (uint256 i = 0; i < participantCount; i++) {
            address participant = participants[i];
            participantAddresses[i] = participant;
            roles[i] = participantRoles[participant];
            participantWeightList[i] = participantWeights[participant];
        }
        
        // Let ALProjectVoting compute eligible voters and set them
        (address[] memory eligibleVoters, uint256[] memory voterWeights) = IALProjectVoting(votingContract).computeEligibleVoters(participantAddresses, roles, participantWeightList);
        
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
     * @dev Start batch voting for AL iteration samples
     * Always use this method (even for single samples) for consistent event handling
     * Voters are automatically managed when project membership changes
     */
    function startBatchVoting(string[] memory sampleIds) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        require(sampleIds.length > 0, "Empty sample batch");
        
        // Increment round for new batch
        currentRound += 1;
        
        // Check if project should end due to max iterations or sample exhaustion
        _checkProjectEndConditions();
        
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
            _addParticipantInternal(msg.sender, "contributor", 1);
            // Note: _addParticipantInternal automatically updates voters in voting contract
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
    
    // --- View Functions ---
    function getCreator() external view returns (address) {
        return creator;
    }
    
    function getFinalROCrateHash() external view returns (string memory) {
        return rocrateHashFinal;
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
}