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