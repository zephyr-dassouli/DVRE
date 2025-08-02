// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
    
    // Persistent participant management - Project as source of truth
    address[] public participants; // Renamed from members
    mapping(address => string) public participantRoles; // Track roles: "creator", "contributor", "observer", etc.
    mapping(address => uint256) public participantWeights; // Voting weights per participant
    mapping(address => uint256) public joinedAt; // Timestamp when participant joined
    
    // AL Extension Support
    address public alExtension; // Link to ALProject contract for AL projects
    mapping(address => bool) public approvedDelegates; // Delegates that can perform AL operations

    // AL Extension Events
    event DelegateApproved(address indexed delegate, address indexed creator);
    event DelegateRevoked(address indexed delegate, address indexed creator);
    
    // Common Project Events
    event ProjectCreated(address indexed creator, uint256 timestamp);
    event ProjectUpdated(address indexed updater, uint256 timestamp);
    event FinalROCrateHashUpdated(address indexed updater, string rocrateHashFinal, uint256 timestamp);
    event ProjectDeactivated(address indexed creator, uint256 timestamp);
    event ProjectReactivated(address indexed creator, uint256 timestamp);
    event ParticipantAutoAdded(address indexed participant, string role, uint256 weight);
    event ParticipantUpdated(address indexed participant, string role, uint256 weight);

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
    
    function updateROCrateHash(string memory _rocrateHash) external virtual onlyCreatorOrDelegate {
        require(bytes(_rocrateHash).length > 0, "RO-Crate hash cannot be empty");
        rocrateHash = _rocrateHash;
        lastModified = block.timestamp;
        emit ProjectUpdated(msg.sender, block.timestamp);
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
    function deactivateProject() external virtual onlyCreator {
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
    }
    
    /**
     * @dev Add participant with specific role and weight
     */
    function addParticipantWithRole(address _participant, string memory _role, uint256 _weight) external virtual onlyCreator {
        require(bytes(_role).length > 0, "Empty role");
        _addParticipantInternal(_participant, _role, _weight);
    }
    
    /**
     * @dev Update participant role or weight
     */
    function updateParticipant(address _participant, string memory _role, uint256 _weight) external virtual onlyCreator {
        require(bytes(participantRoles[_participant]).length > 0, "Not a participant");
        require(bytes(_role).length > 0, "Empty role");
        require(_weight > 0, "Weight must be positive");
        
        participantRoles[_participant] = _role;
        participantWeights[_participant] = _weight;
        lastModified = block.timestamp;
        
        emit ParticipantUpdated(_participant, _role, _weight);
    }
    
    /**
     * @dev Get participant role
     */
    function getParticipantRole(address _participant) external view virtual returns (string memory) {
        return participantRoles[_participant];
    }
    
    /**
     * @dev Get all participants and their details
     */
    function getAllParticipants() external view virtual returns (
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
    
    // --- View Functions ---
    function getCreator() external view returns (address) {
        return creator;
    }
    
    function getFinalROCrateHash() external view returns (string memory) {
        return rocrateHashFinal;
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
    
    function getProjectMetadata() external view virtual returns (
        string memory _title,
        string memory _description,
        address _owner,
        string memory _projectType,
        string memory _rocrateHash,
        uint256 _start,
        uint256 _end
    ) {
        return (title, description, creator, projectType, rocrateHash, startTime, endTime);
    }
    
    // --- AL Extension Management ---
    /**
     * @dev Approve a delegate (like ALProjectDeployer) to perform AL operations
     * @param _delegate Address to approve as delegate
     */
    function approveDelegate(address _delegate) external onlyCreator {
        require(_delegate != address(0), "Invalid delegate address");
        approvedDelegates[_delegate] = true;
        emit DelegateApproved(_delegate, msg.sender);
    }
    
    /**
     * @dev Revoke delegate permissions
     * @param _delegate Address to revoke delegate permissions from
     */
    function revokeDelegate(address _delegate) external onlyCreator {
        approvedDelegates[_delegate] = false;
        emit DelegateRevoked(_delegate, msg.sender);
    }
    
    /**
     * @dev Check if an address is an approved delegate
     */
    function isApprovedDelegate(address _delegate) external view returns (bool) {
        return approvedDelegates[_delegate];
    }
    
    /**
     * @dev Modifier that allows creator or approved delegates
     */
    modifier onlyCreatorOrDelegate() {
        require(msg.sender == creator || approvedDelegates[msg.sender], "Only creator or delegate");
        _;
    }

    /**
     * @dev Link an ALProject extension to this project
     * @param _alExtension Address of the deployed ALProject contract
     */
    function setALExtension(address _alExtension) external onlyCreatorOrDelegate {
        require(_alExtension != address(0), "Invalid AL extension address");
        require(alExtension == address(0), "AL extension already set");
        alExtension = _alExtension;
    }
    
    /**
     * @dev Check if this project has an AL extension
     */
    function hasALExtension() external view returns (bool) {
        return alExtension != address(0);
    }
    
    /**
     * @dev Get the AL extension address
     */
    function getALExtension() external view returns (address) {
        return alExtension;
    }
}