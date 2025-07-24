// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./WorkflowLibrary.sol";

contract JSONProject {
    using WorkflowLibrary for mapping(bytes32 => WorkflowLibrary.WorkflowExecution);
    using WorkflowLibrary for mapping(bytes32 => WorkflowLibrary.Submission[]);
    using WorkflowLibrary for mapping(bytes32 => WorkflowLibrary.ConsensusVote[]);
    
    // Project types enum for extensibility
    enum ProjectType { GENERIC, ACTIVE_LEARNING, FEDERATED_LEARNING, RESEARCH_COLLABORATION }
    
    // Workflow orchestration enums
    enum WorkflowPhase { SETUP, ACTIVE, CONSENSUS, PROCESSING, EVALUATION, COMPLETED }
    
    // Core project state
    address public creator;
    string public projectData;
    uint256 public createdAt;
    uint256 public lastModified;
    bool public isActive;
    ProjectType public projectType;
    
    // Workflow orchestration state
    WorkflowPhase public currentPhase;
    string public cwlWorkflowHash;
    address public orchestratorAddress;
    uint256 public currentRound;
    uint256 public maxRounds;
    uint256 public consensusThreshold;
    
    // Participant management
    mapping(address => bool) public isParticipant;
    mapping(address => uint256) public participantWeights;
    mapping(address => uint256) public contributionScores;
    address[] public participants;
    
    // Join request structure
    struct JoinRequest {
        address requester;
        string role;
        uint256 timestamp;
        bool exists;
    }
    
    // State mappings
    mapping(address => JoinRequest) public joinRequests;
    address[] public requesters;
    
    // Workflow tracking (using library structs)
    mapping(bytes32 => WorkflowLibrary.WorkflowExecution) public workflows;
    mapping(bytes32 => bool) public activeWorkflows;
    bytes32[] public workflowHistory;
    
    // Submissions and consensus (using library structs)
    mapping(bytes32 => WorkflowLibrary.Submission[]) public submissions;
    mapping(bytes32 => WorkflowLibrary.ConsensusVote[]) public consensusVotes;
    
    // IPFS hash tracking
    mapping(string => string) public ipfsHashes;
    
    // Events
    event ProjectCreated(address indexed creator, ProjectType projectType, uint256 timestamp);
    event ProjectUpdated(address indexed updater, uint256 timestamp);
    event ProjectDeactivated(address indexed creator, uint256 timestamp);
    event ProjectReactivated(address indexed creator, uint256 timestamp);
    event JoinRequestSubmitted(address indexed requester, string role, uint256 timestamp);
    event JoinRequestApproved(address indexed requester, address indexed approver, uint256 timestamp);
    event JoinRequestRejected(address indexed requester, address indexed rejector, uint256 timestamp);
    event ParticipantAdded(address indexed participant, uint256 weight);
    event ParticipantRemoved(address indexed participant);
    event ContributionScored(address indexed participant, uint256 score, string reason);
    event PhaseChanged(WorkflowPhase indexed oldPhase, WorkflowPhase indexed newPhase, uint256 timestamp);
    event CWLWorkflowUpdated(string indexed oldHash, string indexed newHash, uint256 timestamp);

    // Modifiers
    modifier onlyCreator() {
        require(msg.sender == creator, "Only project creator can perform this action");
        _;
    }

    modifier onlyActive() {
        require(isActive, "Project is not active");
        _;
    }

    modifier onlyParticipant() {
        require(isParticipant[msg.sender], "Only participants can perform this action");
        _;
    }
    
    modifier onlyCoordinator() {
        require(msg.sender == creator, "Only coordinator can perform this action");
        _;
    }
    
    modifier inPhase(WorkflowPhase _phase) {
        require(currentPhase == _phase, "Action not allowed in current phase");
        _;
    }
    
    modifier onlyOrchestrator() {
        require(msg.sender == orchestratorAddress, "Only orchestrator can perform this action");
        _;
    }

    // Constructor - supports both basic and workflow-enabled projects
    constructor(
        address _creator,
        string memory _projectData,
        ProjectType _projectType,
        string memory _cwlWorkflowHash,
        uint256 _maxRounds,
        uint256 _consensusThreshold,
        address _orchestratorAddress
    ) {
        require(bytes(_projectData).length > 0, "Project data cannot be empty");
        
        creator = _creator;
        projectData = _projectData;
        createdAt = block.timestamp;
        lastModified = block.timestamp;
        isActive = true;
        projectType = _projectType;
        currentPhase = WorkflowPhase.SETUP;
        
        // Workflow parameters (optional - use defaults for basic projects)
        if (bytes(_cwlWorkflowHash).length > 0) {
            require(_maxRounds > 0, "Max rounds must be greater than 0");
            require(_consensusThreshold > 0 && _consensusThreshold <= 100, "Invalid consensus threshold");
            
            cwlWorkflowHash = _cwlWorkflowHash;
            maxRounds = _maxRounds;
            consensusThreshold = _consensusThreshold;
            orchestratorAddress = _orchestratorAddress;
            currentRound = 0;
        } else {
            // Default values for basic projects
            maxRounds = 1;
            consensusThreshold = 50;
            currentRound = 0;
        }
        
        // Add creator as first participant with full weight
        _addParticipant(_creator, 100);

        emit ProjectCreated(_creator, _projectType, block.timestamp);
    }

    // Participant management functions
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
    
    function approveJoinRequest(address _requester, uint256 _weight) external onlyCreator {
        require(joinRequests[_requester].exists, "Join request does not exist");
        require(_weight > 0 && _weight <= 100, "Invalid weight");
        
        delete joinRequests[_requester];
        _addParticipant(_requester, _weight);
        
        emit JoinRequestApproved(_requester, msg.sender, block.timestamp);
    }
    
    function rejectJoinRequest(address _requester) external onlyCreator {
        require(joinRequests[_requester].exists, "Join request does not exist");
        
        delete joinRequests[_requester];
        
        emit JoinRequestRejected(_requester, msg.sender, block.timestamp);
    }
    
    function _addParticipant(address _participant, uint256 _weight) internal {
        require(!isParticipant[_participant], "Already a participant");
        
        isParticipant[_participant] = true;
        participantWeights[_participant] = _weight;
        participants.push(_participant);
        
        emit ParticipantAdded(_participant, _weight);
    }
    
    function removeParticipant(address _participant) external onlyCoordinator onlyActive {
        require(isParticipant[_participant], "Not a participant");
        require(_participant != creator, "Cannot remove coordinator");
        
        isParticipant[_participant] = false;
        participantWeights[_participant] = 0;
        
        // Remove from participants array
        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] == _participant) {
                participants[i] = participants[participants.length - 1];
                participants.pop();
                break;
            }
        }
        
        emit ParticipantRemoved(_participant);
    }

    // Workflow orchestration functions
    function updateCWLWorkflow(string memory _newCWLHash) external onlyCoordinator onlyActive {
        require(bytes(_newCWLHash).length > 0, "CWL hash cannot be empty");
        
        string memory oldHash = cwlWorkflowHash;
        cwlWorkflowHash = _newCWLHash;
        lastModified = block.timestamp;
        
        emit CWLWorkflowUpdated(oldHash, _newCWLHash, block.timestamp);
    }
    
    function setOrchestratorAddress(address _orchestratorAddress) external onlyCoordinator {
        require(_orchestratorAddress != address(0), "Invalid orchestrator address");
        orchestratorAddress = _orchestratorAddress;
    }
    
    function startNextPhase() external onlyCoordinator onlyActive {
        WorkflowPhase oldPhase = currentPhase;
        
        if (currentPhase == WorkflowPhase.SETUP) {
            currentPhase = WorkflowPhase.ACTIVE;
        } else if (currentPhase == WorkflowPhase.ACTIVE) {
            currentPhase = WorkflowPhase.CONSENSUS;
        } else if (currentPhase == WorkflowPhase.CONSENSUS) {
            currentPhase = WorkflowPhase.PROCESSING;
        } else if (currentPhase == WorkflowPhase.PROCESSING) {
            currentPhase = WorkflowPhase.EVALUATION;
        } else if (currentPhase == WorkflowPhase.EVALUATION) {
            if (currentRound < maxRounds) {
                currentPhase = WorkflowPhase.ACTIVE;
                currentRound++;
            } else {
                currentPhase = WorkflowPhase.COMPLETED;
            }
        }
        
        emit PhaseChanged(oldPhase, currentPhase, block.timestamp);
    }
    
    // Workflow functions using library
    function triggerWorkflow(string memory _workflowType, string memory _parameters) 
        external onlyCoordinator returns (bytes32) {
        return WorkflowLibrary.triggerWorkflow(workflows, activeWorkflows, workflowHistory, _workflowType, _parameters);
    }
    
    function completeWorkflow(bytes32 _workflowId, bool _success, string memory _resultHash) 
        external onlyOrchestrator {
        WorkflowLibrary.completeWorkflow(workflows, activeWorkflows, ipfsHashes, _workflowId, _success, _resultHash);
    }
    
    function makeSubmission(string memory _dataHash, string memory _submissionHash, 
        string memory _submissionType, uint256 _confidence) external onlyParticipant onlyActive {
        WorkflowLibrary.makeSubmission(submissions, contributionScores, _dataHash, _submissionHash, _submissionType, _confidence);
        emit ContributionScored(msg.sender, 1, string(abi.encodePacked(_submissionType, " submission")));
    }
    
    function submitConsensusVote(string memory _proposalHash, bool _support, string memory _reason) 
        external onlyParticipant inPhase(WorkflowPhase.CONSENSUS) {
        require(bytes(_proposalHash).length > 0, "Proposal hash cannot be empty");
        
        bytes32 proposalKey = keccak256(abi.encodePacked(_proposalHash));
        
        // Check if already voted
        WorkflowLibrary.ConsensusVote[] storage votes = consensusVotes[proposalKey];
        for (uint256 i = 0; i < votes.length; i++) {
            require(votes[i].voter != msg.sender, "Already voted on this proposal");
        }
        
        votes.push(WorkflowLibrary.ConsensusVote({
            voter: msg.sender,
            proposalHash: _proposalHash,
            support: _support,
            timestamp: block.timestamp,
            reason: _reason
        }));
        
        // Check if consensus reached using library
        bool consensusReached = WorkflowLibrary.checkConsensus(
            consensusVotes, participantWeights, participants, consensusThreshold, proposalKey, _proposalHash
        );
        
        if (consensusReached) {
            string memory workflowType = WorkflowLibrary.getWorkflowTypeForPhase(uint8(projectType), uint8(currentPhase));
            WorkflowLibrary.triggerWorkflow(workflows, activeWorkflows, workflowHistory, workflowType, _proposalHash);
        }
    }
    
    // IPFS hash management
    function updateIPFSHash(string memory _key, string memory _hash) external onlyCoordinator {
        require(bytes(_key).length > 0, "Key cannot be empty");
        require(bytes(_hash).length > 0, "Hash cannot be empty");
        
        ipfsHashes[_key] = _hash;
        lastModified = block.timestamp;
    }

    // Project data management
    function updateProjectData(string memory _newProjectData) external onlyCreator onlyActive {
        require(bytes(_newProjectData).length > 0, "Project data cannot be empty");
        
        projectData = _newProjectData;
        lastModified = block.timestamp;

        emit ProjectUpdated(msg.sender, block.timestamp);
    }

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

    // View functions
    function getJoinRequest(address _requester) external view returns (
        address requester, string memory role, uint256 timestamp, bool exists
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
    
    function getParticipants() external view returns (address[] memory) {
        return participants;
    }
    
    function getParticipantInfo(address _participant) external view returns (
        bool isActiveParticipant, uint256 weight, uint256 contributions
    ) {
        return (isParticipant[_participant], participantWeights[_participant], contributionScores[_participant]);
    }
    
    function getWorkflowInfo(bytes32 _workflowId) external view returns (
        string memory workflowType, string memory parameters, uint256 startTime, 
        uint256 endTime, bool isCompleted, bool success, string memory resultHash
    ) {
        WorkflowLibrary.WorkflowExecution storage workflow = workflows[_workflowId];
        return (workflow.workflowType, workflow.parameters, workflow.startTime, 
                workflow.endTime, workflow.isCompleted, workflow.success, workflow.resultHash);
    }
    
    function getSubmissions(string memory _dataHash) external view returns (WorkflowLibrary.Submission[] memory) {
        bytes32 dataKey = keccak256(abi.encodePacked(_dataHash));
        return submissions[dataKey];
    }

    function getConsensusVotes(string memory _proposalHash) external view returns (WorkflowLibrary.ConsensusVote[] memory) {
        bytes32 proposalKey = keccak256(abi.encodePacked(_proposalHash));
        return consensusVotes[proposalKey];
    }
    
    function getIPFSHash(string memory _key) external view returns (string memory) {
        return ipfsHashes[_key];
    }
    
    function getWorkflowHistory() external view returns (bytes32[] memory) {
        return workflowHistory;
    }

    function getProjectData() external view returns (string memory) {
        return projectData;
    }

    function getCreator() external view returns (address) {
        return creator;
    }

    function getTimestamps() external view returns (uint256 created, uint256 modified) {
        return (createdAt, lastModified);
    }

    function getProjectStatus() external view returns (bool active, uint256 created, uint256 modified, address projectCreator) {
        return (isActive, createdAt, lastModified, creator);
    }

    function getIsActive() external view returns (bool) {
        return isActive;
    }
}
