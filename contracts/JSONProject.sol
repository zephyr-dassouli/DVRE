// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract JSONProject {
    // State variables
    address public creator;
    string public projectData; // JSON string containing all project data
    uint256 public createdAt;
    uint256 public lastModified;
    bool public isActive;
    
    // Join request structure
    struct JoinRequest {
        address requester;
        string role;
        uint256 timestamp;
        bool exists;
    }
    
    // Mapping to store join requests: requester address => JoinRequest
    mapping(address => JoinRequest) public joinRequests;
    
    // Array to keep track of all requesters for enumeration
    address[] public requesters;
    
    // Events
    event ProjectCreated(address indexed creator, uint256 timestamp);
    event ProjectUpdated(address indexed updater, uint256 timestamp);
    event ProjectDeactivated(address indexed creator, uint256 timestamp);
    event ProjectReactivated(address indexed creator, uint256 timestamp);
    event JoinRequestSubmitted(address indexed requester, string role, uint256 timestamp);
    event JoinRequestApproved(address indexed requester, address indexed approver, uint256 timestamp);
    event JoinRequestRejected(address indexed requester, address indexed rejector, uint256 timestamp);

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
    constructor(
        address _creator,
        string memory _projectData
    ) {
        require(bytes(_projectData).length > 0, "Project data cannot be empty");
        
        creator = _creator;
        projectData = _projectData;
        createdAt = block.timestamp;
        lastModified = block.timestamp;
        isActive = true;

        emit ProjectCreated(_creator, block.timestamp);
    }

    // Submit a join request
    function submitJoinRequest(string memory _role) external onlyActive {
        require(msg.sender != creator, "Project creator cannot submit join request");
        require(!joinRequests[msg.sender].exists, "Join request already exists");
        require(bytes(_role).length > 0, "Role cannot be empty");
        
        // Add to requests mapping
        joinRequests[msg.sender] = JoinRequest({
            requester: msg.sender,
            role: _role,
            timestamp: block.timestamp,
            exists: true
        });
        
        // Add to requesters array for enumeration
        requesters.push(msg.sender);
        
        emit JoinRequestSubmitted(msg.sender, _role, block.timestamp);
    }
    
    // Get join request details
    function getJoinRequest(address _requester) external view returns (
        address requester,
        string memory role,
        uint256 timestamp,
        bool exists
    ) {
        JoinRequest memory request = joinRequests[_requester];
        return (request.requester, request.role, request.timestamp, request.exists);
    }
    
    // Get all join requesters
    function getAllRequesters() external view returns (address[] memory) {
        // Filter out processed requests
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
    
    // Approve join request and remove it (project creator only)
    function approveJoinRequest(address _requester) external onlyCreator {
        require(joinRequests[_requester].exists, "Join request does not exist");
        
        // Remove the join request
        delete joinRequests[_requester];
        
        emit JoinRequestApproved(_requester, msg.sender, block.timestamp);
    }
    
    // Reject join request and remove it (project creator only)
    function rejectJoinRequest(address _requester) external onlyCreator {
        require(joinRequests[_requester].exists, "Join request does not exist");
        
        // Remove the join request
        delete joinRequests[_requester];
        
        emit JoinRequestRejected(_requester, msg.sender, block.timestamp);
    }
    
    // Update project data (replace entire JSON)
    function updateProjectData(string memory _newProjectData) 
        external 
        onlyCreator 
        onlyActive 
    {
        require(bytes(_newProjectData).length > 0, "Project data cannot be empty");
        
        projectData = _newProjectData;
        lastModified = block.timestamp;

        emit ProjectUpdated(msg.sender, block.timestamp);
    }

    // Deactivate project
    function deactivateProject() external onlyCreator {
        require(isActive, "Project is already inactive");
        
        isActive = false;
        lastModified = block.timestamp;

        emit ProjectDeactivated(msg.sender, block.timestamp);
    }

    // Reactivate project
    function reactivateProject() external onlyCreator {
        require(!isActive, "Project is already active");
        
        isActive = true;
        lastModified = block.timestamp;

        emit ProjectReactivated(msg.sender, block.timestamp);
    }

    // Get project data
    function getProjectData() external view returns (string memory) {
        return projectData;
    }

    // Get project creator
    function getCreator() external view returns (address) {
        return creator;
    }

    // Get project timestamps
    function getTimestamps() external view returns (
        uint256 created,
        uint256 modified
    ) {
        return (createdAt, lastModified);
    }

    // Get project status
    function getProjectStatus() external view returns (
        bool active,
        uint256 created,
        uint256 modified,
        address projectCreator
    ) {
        return (isActive, createdAt, lastModified, creator);
    }

    // Check if project is active
    function getIsActive() external view returns (bool) {
        return isActive;
    }
}
