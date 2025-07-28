// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// AL Contract Interfaces (no imports needed - just interfaces)
interface IALProjectVoting {
    function startVotingSession(string memory sampleId) external;
    function endVotingSession(string memory sampleId) external;
    function setVoters(address[] memory _voters, uint256[] memory _weights) external;
    function projectContract() external view returns (address);
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
}

contract JSONProject {
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
     event InvitationSent(address indexed invitee, address indexed inviter, string role, uint256 timestamp);
    event InvitationAccepted(address indexed invitee, address indexed project, uint256 timestamp);
    event InvitationRejected(address indexed invitee, address indexed project, uint256 timestamp);
    event MemberAdded(address indexed member, string role, uint256 timestamp);
    

    // Modifiers
    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }
    
    modifier onlyActive() {
        require(isActive, "Inactive");
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
        
        // Call via interface
        IALProjectVoting(votingContract).startVotingSession(sampleId);
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
}