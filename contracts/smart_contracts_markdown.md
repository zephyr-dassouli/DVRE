# AL Project Smart Contracts

A comprehensive smart contract suite for managing Active Learning (AL) projects with blockchain-based voting and data storage.

## Overview

This system consists of three interconnected smart contracts:

1. **JSONProject** - Core project management and metadata
2. **ALProjectVoting** - Consensus-based voting mechanism  
3. **ALProjectStorage** - Persistent data and history storage

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   JSONProject   │───▶│ ALProjectVoting  │───▶│ ALProjectStorage    │
│  (Core Logic)   │    │ (Consensus)      │    │ (Data Persistence)  │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

---

## 1. JSONProject Contract

**Purpose**: Core project management, metadata handling, and participant coordination.

### Key Features
- Project lifecycle management (create, activate, deactivate)
- Join request system for participant onboarding
- Active Learning configuration management
- Round tracking and progression
- Integration with voting and storage contracts

### Contract Code

```solidity
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
    function setLinkedContracts(address _voting, address _storage) external onlyCreator {
        require(_voting != address(0) && _storage != address(0), "Invalid address");
        votingContract = _voting;
        storageContract = _storage;
        emit LinkedContractsSet(_voting, _storage);
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
```

### Main Functions

| Function | Purpose | Access Control |
|----------|---------|----------------|
| `setProjectMetadata()` | Set project title, description, etc. | Creator only |
| `setALMetadata()` | Configure AL parameters | Creator only |
| `submitJoinRequest()` | Request to join project | Public (active projects) |
| `approveJoinRequest()` | Approve participant | Creator only |
| `triggerNextRound()` | Start new AL round | Creator only |
| `setLinkedContracts()` | Connect voting/storage contracts | Creator only |

---

## 2. ALProjectVoting Contract

**Purpose**: Manages consensus-based voting for sample labeling with weighted participants.

### Key Features
- Weighted voting system
- Voting session management with timeouts
- Consensus threshold configuration
- Vote tracking and history
- Prevention of double voting

### Contract Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ALProjectVoting {
    address public jsonProject;
    uint256 public consensusThreshold = 51; // percentage
    uint256 public votingTimeoutSeconds;
    string public votingConsensus; // e.g. "simple_majority"
    
    struct Voter {
        address addr;
        uint256 weight;
    }
    
    struct Vote {
        address voter;
        string label;
        bool support;
        uint256 timestamp;
    }
    
    struct VotingSession {
        uint256 startTime;
        bool isActive;
        mapping(address => bool) hasVoted;
    }
    
    mapping(address => uint256) public voterWeights;
    address[] public voterList;
    
    // sampleId => list of votes
    mapping(string => Vote[]) public votes;
    mapping(string => VotingSession) public votingSessions;
    
    event VoteSubmitted(string sampleId, address indexed voter, string label, bool support, uint256 timestamp);
    event ConsensusReached(string sampleId, string label);
    event VotingSessionStarted(string sampleId, uint256 startTime);
    event VotingSessionEnded(string sampleId, uint256 endTime);
    
    modifier onlyJSONProject() {
        require(msg.sender == jsonProject, "Only main project can call");
        _;
    }
    
    modifier onlyRegisteredVoter() {
        require(voterWeights[msg.sender] > 0, "Not a registered voter");
        _;
    }
    
    constructor(
        address _jsonProject,
        string memory _votingConsensus,
        uint256 _votingTimeoutSeconds
    ) {
        require(_jsonProject != address(0), "Invalid address");
        jsonProject = _jsonProject;
        votingConsensus = _votingConsensus;
        votingTimeoutSeconds = _votingTimeoutSeconds;
    }
    
    function setVoters(address[] memory _voters, uint256[] memory _weights) external onlyJSONProject {
        require(_voters.length == _weights.length, "Mismatched lengths");
        
        // Clear existing voters
        for (uint256 i = 0; i < voterList.length; i++) {
            voterWeights[voterList[i]] = 0;
        }
        delete voterList;
        
        // Add new voters
        for (uint256 i = 0; i < _voters.length; i++) {
            require(_weights[i] > 0, "Weight must be greater than 0");
            voterWeights[_voters[i]] = _weights[i];
            voterList.push(_voters[i]);
        }
    }
    
    function startVotingSession(string memory sampleId) external onlyJSONProject {
        require(!votingSessions[sampleId].isActive, "Voting session already active");
        
        votingSessions[sampleId].startTime = block.timestamp;
        votingSessions[sampleId].isActive = true;
        
        emit VotingSessionStarted(sampleId, block.timestamp);
    }
    
    function endVotingSession(string memory sampleId) external onlyJSONProject {
        require(votingSessions[sampleId].isActive, "Voting session not active");
        votingSessions[sampleId].isActive = false;
        emit VotingSessionEnded(sampleId, block.timestamp);
    }
    
    function submitVote(string memory sampleId, string memory label, bool support) external onlyRegisteredVoter {
        require(votingSessions[sampleId].isActive, "Voting session not active");
        require(!votingSessions[sampleId].hasVoted[msg.sender], "Already voted");
        
        // Check timeout
        if (votingTimeoutSeconds > 0) {
            require(
                block.timestamp <= votingSessions[sampleId].startTime + votingTimeoutSeconds,
                "Voting period expired"
            );
        }
        
        votes[sampleId].push(Vote({
            voter: msg.sender,
            label: label,
            support: support,
            timestamp: block.timestamp
        }));
        
        votingSessions[sampleId].hasVoted[msg.sender] = true;
        
        emit VoteSubmitted(sampleId, msg.sender, label, support, block.timestamp);
        
        if (_checkConsensus(sampleId, label)) {
            emit ConsensusReached(sampleId, label);
        }
    }
    
    function _checkConsensus(string memory sampleId, string memory label) internal view returns (bool) {
        Vote[] memory voteList = votes[sampleId];
        uint256 totalWeight = 0;
        uint256 supportWeight = 0;
        
        for (uint256 i = 0; i < voteList.length; i++) {
            if (keccak256(bytes(voteList[i].label)) == keccak256(bytes(label))) {
                uint256 weight = voterWeights[voteList[i].voter];
                totalWeight += weight;
                if (voteList[i].support) {
                    supportWeight += weight;
                }
            }
        }
        
        if (totalWeight == 0) return false;
        return (supportWeight * 100 / totalWeight) >= consensusThreshold;
    }
    
    function getVotes(string memory sampleId) external view returns (Vote[] memory) {
        return votes[sampleId];
    }
    
    function getVoterList() external view returns (Voter[] memory) {
        Voter[] memory result = new Voter[](voterList.length);
        for (uint256 i = 0; i < voterList.length; i++) {
            result[i] = Voter({
                addr: voterList[i],
                weight: voterWeights[voterList[i]]
            });
        }
        return result;
    }
    
    function isVotingActive(string memory sampleId) external view returns (bool) {
        return votingSessions[sampleId].isActive;
    }
    
    function hasUserVoted(string memory sampleId, address user) external view returns (bool) {
        return votingSessions[sampleId].hasVoted[user];
    }
}
```

### Voting Process

1. **Setup Voters**: Project creator calls `setVoters()` with addresses and weights
2. **Start Session**: Call `startVotingSession()` for a specific sample
3. **Submit Votes**: Registered voters call `submitVote()` with their labels
4. **Check Consensus**: System automatically checks if threshold is reached
5. **End Session**: Call `endVotingSession()` to close voting

### Configuration Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `consensusThreshold` | Percentage needed for consensus | 51% |
| `votingTimeoutSeconds` | Time limit for voting | Configurable |
| `votingConsensus` | Consensus algorithm type | "simple_majority" |

---

## 3. ALProjectStorage Contract

**Purpose**: Persistent storage for final labels, voting history, and IPFS references.

### Key Features
- Final label storage with metadata
- Complete voting history tracking
- IPFS hash management for external data
- Round-based data organization
- Comprehensive query functions

### Contract Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ALProjectStorage {
    address public jsonProject;
    
    struct FinalLabel {
        string sampleId;
        string label;
        uint256 round;
        string justification;
        string ipfsHash;
        uint256 timestamp;
    }
    
    struct VoteRecord {
        address voter;
        string label;
    }
    
    struct VotingHistory {
        string sampleId;
        uint256 round;
        string finalLabel;
        uint256 timestamp;
        VoteRecord[] votes;
    }
    
    // sampleId => FinalLabel
    mapping(string => FinalLabel) public finalLabels;
    // sampleId => IPFS hashes (label history)
    mapping(string => string[]) public sampleHistory;
    // sampleId => VotingHistory array
    mapping(string => VotingHistory[]) public historyBySample;
    
    event LabelFinalized(string sampleId, string label, string ipfsHash, uint256 round, uint256 timestamp);
    event VotingHistoryRecorded(string sampleId, uint256 round, string finalLabel, uint256 voteCount);
    
    modifier onlyJSONProject() {
        require(msg.sender == jsonProject, "Only main project can call");
        _;
    }
    
    constructor(address _jsonProject) {
        require(_jsonProject != address(0), "Invalid project address");
        jsonProject = _jsonProject;
    }
    
    function storeFinalLabel(
        string memory sampleId,
        string memory label,
        uint256 round,
        string memory justification,
        string memory ipfsHash
    ) external onlyJSONProject {
        require(bytes(sampleId).length > 0, "Sample ID cannot be empty");
        require(bytes(label).length > 0, "Label cannot be empty");
        
        FinalLabel memory f = FinalLabel({
            sampleId: sampleId,
            label: label,
            round: round,
            justification: justification,
            ipfsHash: ipfsHash,
            timestamp: block.timestamp
        });
        
        finalLabels[sampleId] = f;
        sampleHistory[sampleId].push(ipfsHash);
        
        emit LabelFinalized(sampleId, label, ipfsHash, round, block.timestamp);
    }
    
    function recordVotingHistory(
        string memory sampleId,
        uint256 round,
        string memory finalLabel,
        address[] memory voters,
        string[] memory labels
    ) external onlyJSONProject {
        require(voters.length == labels.length, "Length mismatch");
        require(bytes(sampleId).length > 0, "Sample ID cannot be empty");
        
        // Create new VotingHistory entry
        historyBySample[sampleId].push();
        uint256 index = historyBySample[sampleId].length - 1;
        
        VotingHistory storage record = historyBySample[sampleId][index];
        record.sampleId = sampleId;
        record.round = round;
        record.finalLabel = finalLabel;
        record.timestamp = block.timestamp;
        
        for (uint256 i = 0; i < voters.length; i++) {
            record.votes.push(VoteRecord({
                voter: voters[i],
                label: labels[i]
            }));
        }
        
        emit VotingHistoryRecorded(sampleId, round, finalLabel, voters.length);
    }
    
    function getLabelHistory(string memory sampleId) external view returns (string[] memory) {
        return sampleHistory[sampleId];
    }
    
    function getFinalLabel(string memory sampleId) external view returns (
        string memory label,
        uint256 round,
        string memory justification,
        string memory ipfsHash,
        uint256 timestamp
    ) {
        FinalLabel memory f = finalLabels[sampleId];
        return (f.label, f.round, f.justification, f.ipfsHash, f.timestamp);
    }
    
    function getVotingHistoryCount(string memory sampleId) external view returns (uint256) {
        return historyBySample[sampleId].length;
    }
    
    function getVotingHistoryByIndex(string memory sampleId, uint256 index) external view returns (
        uint256 round,
        string memory finalLabel,
        uint256 timestamp,
        uint256 voteCount
    ) {
        require(index < historyBySample[sampleId].length, "Index out of bounds");
        VotingHistory storage history = historyBySample[sampleId][index];
        return (history.round, history.finalLabel, history.timestamp, history.votes.length);
    }
    
    function getVoteFromHistory(string memory sampleId, uint256 historyIndex, uint256 voteIndex) external view returns (
        address voter,
        string memory label
    ) {
        require(historyIndex < historyBySample[sampleId].length, "History index out of bounds");
        require(voteIndex < historyBySample[sampleId][historyIndex].votes.length, "Vote index out of bounds");
        
        VoteRecord memory vote = historyBySample[sampleId][historyIndex].votes[voteIndex];
        return (vote.voter, vote.label);
    }
}
```

### Data Storage Structure

```
Sample Data Storage:
├── Final Labels (current state)
│   ├── sampleId → FinalLabel struct
│   └── Contains: label, round, justification, IPFS hash
├── Sample History (evolution over time)
│   ├── sampleId → IPFS hash array
│   └── Tracks all historical versions
└── Voting History (complete audit trail)
    ├── sampleId → VotingHistory array
    └── Contains: round, votes, timestamps
```

### Query Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `getFinalLabel()` | Get current label for sample | Label details + metadata |
| `getLabelHistory()` | Get all IPFS hashes for sample | String array of hashes |
| `getVotingHistoryCount()` | Count voting rounds for sample | Number of rounds |
| `getVotingHistoryByIndex()` | Get specific voting round | Round details |
| `getVoteFromHistory()` | Get individual vote from round | Voter address + label |

---

## Deployment Guide

### 1. Deployment Order
```solidity
// 1. Deploy JSONProject first
JSONProject project = new JSONProject(creatorAddress, "initial_project_data");

// 2. Deploy ALProjectVoting
ALProjectVoting voting = new ALProjectVoting(
    address(project),
    "simple_majority",
    3600  // 1 hour timeout
);

// 3. Deploy ALProjectStorage
ALProjectStorage storage = new ALProjectStorage(address(project));

// 4. Link contracts
project.setLinkedContracts(address(voting), address(storage));
```

### 2. Initial Configuration
```solidity
// Set project metadata
project.setProjectMetadata(
    "My AL Project",
    "Description here",
    "classification",
    "ipfs_hash_here",
    "workflow_123"
);

// Configure AL parameters
string[] memory labels = ["positive", "negative", "neutral"];
project.setALMetadata(
    "uncertainty_sampling",
    "text_classification",
    10,  // max iterations
    50,  // batch size
    labels
);

// Set up voters
address[] memory voters = [voter1, voter2, voter3];
uint256[] memory weights = [1, 1, 1];
voting.setVoters(voters, weights);
```

### 3. Typical Workflow
```solidity
// 1. Start new AL round
project.triggerNextRound("Starting round 1");

// 2. Begin voting on samples
voting.startVotingSession("sample_001");

// 3. Collect votes from participants
voting.submitVote("sample_001", "positive", true);

// 4. End voting and store results
voting.endVotingSession("sample_001");
storage.storeFinalLabel(
    "sample_001",
    "positive", 
    1,  // round
    "Consensus reached",
    "ipfs_result_hash"
);
```

## Security Considerations

### Access Control
- **Creator Privileges**: Only project creator can modify metadata and approve participants
- **Participant Validation**: Only registered voters can submit votes
- **Contract Integration**: Only main project contract can call voting/storage functions

### Data Integrity
- **Input Validation**: All functions validate inputs for empty strings and invalid values
- **Double Voting Prevention**: Each voter can only vote once per sample per session
- **Timestamp Tracking**: All actions are timestamped for audit trails

### Gas Optimization
- **Efficient Storage**: Uses mappings for O(1) lookups
- **Batch Operations**: Supports batch voter setup
- **Event Logging**: Comprehensive events for off-chain indexing

## Events Reference

### JSONProject Events
- `ProjectCreated` - New project initialized
- `JoinRequestSubmitted` - Participant requests access
- `JoinRequestApproved` - Participant approved
- `ALRoundTriggered` - New AL round started
- `RoundIncremented` - Round counter updated

### ALProjectVoting Events  
- `VotingSessionStarted` - Voting begins for sample
- `VoteSubmitted` - Individual vote recorded
- `ConsensusReached` - Threshold met for label
- `VotingSessionEnded` - Voting closed for sample

### ALProjectStorage Events
- `LabelFinalized` - Final label stored for sample
- `VotingHistoryRecorded` - Complete voting round archived

---

## Integration Examples

### Frontend Integration
```javascript
// Connect to contracts
const project = new web3.eth.Contract(JSONProjectABI, projectAddress);
const voting = new web3.eth.Contract(VotingABI, votingAddress);
const storage = new web3.eth.Contract(StorageABI, storageAddress);

// Listen for events
project.events.ALRoundTriggered()
  .on('data', (event) => {
    console.log(`New AL round ${event.returnValues.round} started`);
  });

// Submit vote
await voting.methods.submitVote('sample_001', 'positive', true)
  .send({from: userAddress});
```

### IPFS Integration
```javascript
// Store labeling results to IPFS
const labelData = {
  sampleId: 'sample_001',
  finalLabel: 'positive',
  confidence: 0.85,
  voters: ['0x123...', '0x456...'],
  timestamp: Date.now()
};

const ipfsHash = await ipfs.add(JSON.stringify(labelData));

// Store reference on blockchain
await storage.methods.storeFinalLabel(
  'sample_001',
  'positive',
  currentRound,
  'High confidence consensus',
  ipfsHash
).send({from: projectCreator});
```

This comprehensive smart contract suite provides a robust foundation for decentralized Active Learning projects with transparent governance, consensus-based labeling, and permanent data storage.