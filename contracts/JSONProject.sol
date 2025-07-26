// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
    string public workflowId;
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
    
    mapping(address => JoinRequest) public joinRequests;
    address[] public requesters;
    
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
    event LinkedContractsSet(address votingContract, address storageContract);
    event ParticipantAdded(address indexed participant);
    event RoundIncremented(uint256 newRound);
    event ALRoundTriggered(uint256 round, string reason, uint256 timestamp);
    
    // Modifiers
    modifier onlyCreator() {
        require(msg.sender == creator, "Only project creator can perform this action");
        _;
    }
    
    modifier onlyActive() {
        require(isActive, "Project is not active");
        _;
    }
    
    // Constructor
    constructor(address _creator, string memory _projectData) {
        require(bytes(_projectData).length > 0, "Project data cannot be empty");
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
        string memory _rocrateHash,
        string memory _workflowId
    ) external onlyCreator {
        title = _title;
        description = _description;
        projectType = _projectType;
        rocrateHash = _rocrateHash;
        workflowId = _workflowId;
        lastModified = block.timestamp;
    }
    
    function setALMetadata(
        string memory _queryStrategy,
        string memory _alScenario,
        uint256 _maxIteration,
        uint256 _queryBatchSize,
        string[] memory _labelSpace
    ) external onlyCreator {
        require(_maxIteration > 0, "Max iteration must be greater than 0");
        require(_queryBatchSize > 0, "Query batch size must be greater than 0");
        
        queryStrategy = _queryStrategy;
        alScenario = _alScenario;
        maxIteration = _maxIteration;
        queryBatchSize = _queryBatchSize;
        labelSpace = _labelSpace;
        lastModified = block.timestamp;
    }
    
    function setStartAndEndTime(uint256 _start, uint256 _end) external onlyCreator {
        require(_start < _end, "Start time must be before end time");
        startTime = _start;
        endTime = _end;
    }
    
    function updateProjectData(string memory _newProjectData) external onlyCreator onlyActive {
        require(bytes(_newProjectData).length > 0, "Project data cannot be empty");
        projectData = _newProjectData;
        lastModified = block.timestamp;
        emit ProjectUpdated(msg.sender, block.timestamp);
    }
    
    // --- Join Requests ---
    function submitJoinRequest(string memory _role) external onlyActive {
        require(msg.sender != creator, "Project creator cannot submit join request");
        require(!joinRequests[msg.sender].exists, "Join request already exists");
        require(bytes(_role).length > 0, "Role cannot be empty");
        
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
        require(joinRequests[_requester].exists, "Join request does not exist");
        delete joinRequests[_requester];
        // Add as participant
        isParticipant[_requester] = true;
        emit JoinRequestApproved(_requester, msg.sender, block.timestamp);
        emit ParticipantAdded(_requester);
    }
    
    function rejectJoinRequest(address _requester) external onlyCreator {
        require(joinRequests[_requester].exists, "Join request does not exist");
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
        require(isActive, "Project is already inactive");
        isActive = false;
        lastModified = block.timestamp;
        emit ProjectDeactivated(msg.sender, block.timestamp);
    }
    
    function reactivateProject() external onlyCreator {
        require(!isActive, "Project is already active");
        isActive = true;
        lastModified = block.timestamp;
        emit ProjectReactivated(msg.sender, block.timestamp);
    }
    
    function getIsActive() external view returns (bool) {
        return isActive;
    }
    
    // --- Participant Registry ---
    function addParticipant(address _participant) external onlyCreator {
        require(!isParticipant[_participant], "Already a participant");
        isParticipant[_participant] = true;
        emit ParticipantAdded(_participant);
    }
    
    // --- Round Tracking ---
    function incrementRound() external {
        require(msg.sender == votingContract, "Only voting contract");
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
        require(votingContract == address(0), "AL contracts already linked");
        require(storageContract == address(0), "AL contracts already linked");
        
        votingContract = _voting;
        storageContract = _storage;
        
        emit LinkedContractsSet(_voting, _storage);
    }
    
    // --- Voting Management ---
    function setProjectVoters(address[] memory _voters, uint256[] memory _weights) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        
        // Call the voting contract's setVoters function
        (bool success, ) = votingContract.call(
            abi.encodeWithSignature("setVoters(address[],uint256[])", _voters, _weights)
        );
        require(success, "Failed to set voters");
    }
    
    function startVotingSession(string memory sampleId) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        
        (bool success, ) = votingContract.call(
            abi.encodeWithSignature("startVotingSession(string)", sampleId)
        );
        require(success, "Failed to start voting session");
    }
    
    function endVotingSession(string memory sampleId) external onlyCreator {
        require(votingContract != address(0), "Voting contract not set");
        
        (bool success, ) = votingContract.call(
            abi.encodeWithSignature("endVotingSession(string)", sampleId)
        );
        require(success, "Failed to end voting session");
    }
    
    function storeFinalLabel(
        string memory sampleId,
        string memory label,
        uint256 round,
        string memory justification,
        string memory ipfsHash
    ) external onlyCreator {
        require(storageContract != address(0), "Storage contract not set");
        
        (bool success, ) = storageContract.call(
            abi.encodeWithSignature(
                "storeFinalLabel(string,string,uint256,string,string)",
                sampleId, label, round, justification, ipfsHash
            )
        );
        require(success, "Failed to store final label");
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
        string memory _workflowId,
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
            workflowId,
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
