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
    
    // Events
    event ProjectCreated(address indexed creator, uint256 timestamp);
    event ProjectUpdated(address indexed updater, uint256 timestamp);
    event ProjectDeactivated(address indexed creator, uint256 timestamp);
    event ProjectReactivated(address indexed creator, uint256 timestamp);
    event JoinRequestSubmitted(address indexed requester, string role, uint256 timestamp);
    event JoinRequestApproved(address indexed requester, address indexed approver, uint256 timestamp);
    event JoinRequestRejected(address indexed requester, address indexed rejector, uint256 timestamp);
    event InvitationSent(address indexed invitee, address indexed inviter, string role, uint256 timestamp);
    event InvitationAccepted(address indexed invitee, address indexed project, uint256 timestamp);
    event InvitationRejected(address indexed invitee, address indexed project, uint256 timestamp);
    event MemberAdded(address indexed member, string role, uint256 timestamp);

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
    
    // Send invitation to user (project creator only)
    function sendInvitation(address _invitee, string memory _role) external onlyCreator onlyActive {
        require(_invitee != creator, "Cannot invite project creator");
        require(!invitations[_invitee].exists, "Invitation already exists");
        require(bytes(_role).length > 0, "Role cannot be empty");
        
        // Add to invitations mapping
        invitations[_invitee] = Invitation({
            invitee: _invitee,
            role: _role,
            timestamp: block.timestamp,
            exists: true
        });
        
        // Add to invitees array for enumeration
        invitees.push(_invitee);
        
        emit InvitationSent(_invitee, msg.sender, _role, block.timestamp);
    }
    
    // Accept invitation (invitee only)
    function acceptInvitation() external onlyActive {
        require(invitations[msg.sender].exists, "Invitation does not exist");
        
        // Get invitation details before deleting
        Invitation memory invitation = invitations[msg.sender];
        
        // Remove the invitation
        delete invitations[msg.sender];
        
        // Emit events
        emit InvitationAccepted(msg.sender, address(this), block.timestamp);
        emit MemberAdded(msg.sender, invitation.role, block.timestamp);
    }
    
    // Update project data after invitation acceptance (can be called by anyone, but validates the data)
    function updateProjectDataAfterAcceptance(string memory newData) external onlyActive {
        // Basic validation - ensure the data is not empty
        require(bytes(newData).length > 0, "Project data cannot be empty");
        
        // Update the project data
        projectData = newData;
        emit ProjectUpdated(msg.sender, block.timestamp);
    }
    
    // Reject invitation (invitee only)
    function rejectInvitation() external {
        require(invitations[msg.sender].exists, "Invitation does not exist");
        
        // Remove the invitation
        delete invitations[msg.sender];
        
        emit InvitationRejected(msg.sender, address(this), block.timestamp);
    }
    
    // Add member to project (creator only, typically called after invitation acceptance)
    function addMember(address member, string memory role) external onlyCreator onlyActive {
        require(member != address(0), "Invalid address");
        require(bytes(role).length > 0, "Role cannot be empty");
        
        // Note: This is a simplified approach. In a real implementation,
        // you would parse the JSON, add the member, and update the project data
        // For now, we just emit an event that the frontend can listen to
        emit MemberAdded(member, role, block.timestamp);
    }
    
    // Get invitation details
    function getInvitation(address _invitee) external view returns (
        address invitee,
        string memory role,
        uint256 timestamp,
        bool exists
    ) {
        Invitation memory invitation = invitations[_invitee];
        return (invitation.invitee, invitation.role, invitation.timestamp, invitation.exists);
    }
    
    // Get all invitees
    function getAllInvitees() external view returns (address[] memory) {
        // Filter out processed invitations
        uint256 activeCount = 0;
        for (uint256 i = 0; i < invitees.length; i++) {
            if (invitations[invitees[i]].exists) {
                activeCount++;
            }
        }
        
        address[] memory activeInvitees = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < invitees.length; i++) {
            if (invitations[invitees[i]].exists) {
                activeInvitees[index] = invitees[i];
                index++;
            }
        }
        
        return activeInvitees;
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
