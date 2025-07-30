// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IProject {
    function receiveFinalLabelFromVoting(
        string memory sampleId,
        string memory label,
        string memory justification,
        string memory ipfsHash
    ) external;
    function notifyVotingSessionStarted(string memory sampleId) external;
    function notifyVotingSessionEnded(string memory sampleId, string memory finalLabel) external;
}

contract ALProjectVoting {
    address public project;
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
        bool isFinalized;
        string finalLabel;
        uint256 totalVoters;
        uint256 round; // Add round tracking
        mapping(address => bool) hasVoted;
        mapping(string => uint256) labelVotes;
        mapping(string => uint256) labelWeights;
    }
    
    struct BatchInfo {
        uint256 round;
        string[] sampleIds;
        uint256 completedCount;
        bool isActive;
        uint256 startTime;
    }
    
    mapping(address => uint256) public voterWeights;
    address[] public voterList;
    
    // sampleId => list of votes
    mapping(string => Vote[]) public votes;
    mapping(string => VotingSession) public votingSessions;
    // round => BatchInfo
    mapping(uint256 => BatchInfo) public batches;
    // Track current round
    uint256 public currentRound;
    
    event VoteSubmitted(string sampleId, address indexed voter, string label, bool support, uint256 timestamp);
    event ConsensusReached(string sampleId, string label);
    event VotingSessionStarted(string sampleId, uint256 startTime);
    event VotingSessionEnded(string sampleId, uint256 endTime);
    event VotingSessionFinalized(string sampleId, string finalLabel, uint256 endTime, string reason);
    event TimeoutReached(string sampleId, uint256 endTime);
    event LabelStoredInProject(string sampleId, string finalLabel, uint256 timestamp);
    event BatchStarted(uint256 round, string[] sampleIds, uint256 startTime);
    event BatchCompleted(uint256 round, uint256 completedSamples, uint256 timestamp);
    event BatchSampleCompleted(uint256 round, string sampleId, string finalLabel, uint256 remainingSamples);
    
    modifier onlyProject() {
        require(msg.sender == project, "Only main project can call");
        _;
    }
    
    modifier onlyRegisteredVoter() {
        require(voterWeights[msg.sender] > 0, "Not a registered voter");
        _;
    }
    
    constructor(
        address _project,
        string memory _votingConsensus,
        uint256 _votingTimeoutSeconds
    ) {
        require(_project != address(0), "Invalid address");
        project = _project;
        votingConsensus = _votingConsensus;
        votingTimeoutSeconds = _votingTimeoutSeconds;
    }
    
    function setVoters(address[] memory _voters, uint256[] memory _weights) external onlyProject {
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
    
    function startVotingSession(string memory sampleId) external onlyProject {
        require(!votingSessions[sampleId].isActive, "Voting session already active");
        require(!votingSessions[sampleId].isFinalized, "Voting session already finalized");
        
        votingSessions[sampleId].startTime = block.timestamp;
        votingSessions[sampleId].isActive = true;
        votingSessions[sampleId].isFinalized = false;
        votingSessions[sampleId].totalVoters = voterList.length;
        votingSessions[sampleId].round = 0; // Default round for individual samples
        
        emit VotingSessionStarted(sampleId, block.timestamp);
        
        // Notify main contract
        try IProject(project).notifyVotingSessionStarted(sampleId) {
            // Success
        } catch {
            // Continue if notification fails
        }
    }
    
    function startBatchVoting(string[] memory sampleIds, uint256 round) external onlyProject {
        require(sampleIds.length > 0, "Empty sample batch");
        require(!batches[round].isActive, "Batch already active for this round");
        
        // Initialize batch
        batches[round].round = round;
        batches[round].sampleIds = sampleIds;
        batches[round].completedCount = 0;
        batches[round].isActive = true;
        batches[round].startTime = block.timestamp;
        currentRound = round;
        
        // Start voting sessions for all samples in the batch
        for (uint256 i = 0; i < sampleIds.length; i++) {
            string memory sampleId = sampleIds[i];
            require(!votingSessions[sampleId].isActive, "Sample already has active session");
            require(!votingSessions[sampleId].isFinalized, "Sample already finalized");
            
            votingSessions[sampleId].startTime = block.timestamp;
            votingSessions[sampleId].isActive = true;
            votingSessions[sampleId].isFinalized = false;
            votingSessions[sampleId].totalVoters = voterList.length;
            votingSessions[sampleId].round = round;
            
            emit VotingSessionStarted(sampleId, block.timestamp);
            
            // Notify main contract
            try IProject(project).notifyVotingSessionStarted(sampleId) {
                // Success
            } catch {
                // Continue if notification fails
            }
        }
        
        emit BatchStarted(round, sampleIds, block.timestamp);
    }
    
    function endVotingSession(string memory sampleId) external onlyProject {
        require(votingSessions[sampleId].isActive, "Voting session not active");
        _finalizeVotingSession(sampleId, "Manual finalization");
    }
    
    function submitVote(string memory sampleId, string memory label, bool support) external onlyRegisteredVoter {
        require(votingSessions[sampleId].isActive, "Voting session not active");
        require(!votingSessions[sampleId].isFinalized, "Voting session already finalized");
        require(!votingSessions[sampleId].hasVoted[msg.sender], "Already voted");
        
        // Check if timeout has been reached - if so, finalize automatically
        if (_isTimeoutReached(sampleId)) {
            _finalizeVotingSession(sampleId, "Timeout reached");
            return;
        }
        
        // Record the vote
        votes[sampleId].push(Vote({
            voter: msg.sender,
            label: label,
            support: support,
            timestamp: block.timestamp
        }));
        
        votingSessions[sampleId].hasVoted[msg.sender] = true;
        
        // Update vote aggregation
        if (support) {
            votingSessions[sampleId].labelVotes[label]++;
            votingSessions[sampleId].labelWeights[label] += voterWeights[msg.sender];
        }
        
        emit VoteSubmitted(sampleId, msg.sender, label, support, block.timestamp);
        
        // Check for automatic finalization conditions
        string memory consensusLabel = _checkForConsensus(sampleId);
        if (bytes(consensusLabel).length > 0) {
            _finalizeVotingSession(sampleId, "Consensus reached");
            emit ConsensusReached(sampleId, consensusLabel);
        } else if (_allVotersVoted(sampleId)) {
            _finalizeVotingSession(sampleId, "All voters participated");
        }
    }
    
    /**
     * @dev Submit vote on behalf of a user (called by Project contract)
     * This allows Project to forward votes after auto-registering users
     */
    function submitVoteOnBehalf(string memory sampleId, string memory label, address voter) external onlyProject {
        require(voterWeights[voter] > 0, "Voter not registered");
        require(votingSessions[sampleId].isActive, "Voting session not active");
        require(!votingSessions[sampleId].isFinalized, "Voting session already finalized");
        require(!votingSessions[sampleId].hasVoted[voter], "Already voted");
        
        // Check if timeout has been reached - if so, finalize automatically
        if (_isTimeoutReached(sampleId)) {
            _finalizeVotingSession(sampleId, "Timeout reached");
            return;
        }
        
        // Record the vote (assuming support = true for positive vote)
        votes[sampleId].push(Vote({
            voter: voter,
            label: label,
            support: true,
            timestamp: block.timestamp
        }));
        
        votingSessions[sampleId].hasVoted[voter] = true;
        
        // Update vote aggregation
        votingSessions[sampleId].labelVotes[label]++;
        votingSessions[sampleId].labelWeights[label] += voterWeights[voter];
        
        emit VoteSubmitted(sampleId, voter, label, true, block.timestamp);
        
        // Check for automatic finalization conditions
        string memory consensusLabel = _checkForConsensus(sampleId);
        if (bytes(consensusLabel).length > 0) {
            _finalizeVotingSession(sampleId, "Consensus reached");
            emit ConsensusReached(sampleId, consensusLabel);
        } else if (_allVotersVoted(sampleId)) {
            _finalizeVotingSession(sampleId, "All voters participated");
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
        return votingSessions[sampleId].isActive && !votingSessions[sampleId].isFinalized;
    }
    
    function hasUserVoted(string memory sampleId, address user) external view returns (bool) {
        return votingSessions[sampleId].hasVoted[user];
    }
    
    function checkAndFinalizeTimeout(string memory sampleId) external {
        require(votingSessions[sampleId].isActive, "Session not active");
        require(!votingSessions[sampleId].isFinalized, "Already finalized");
        require(_isTimeoutReached(sampleId), "Timeout not reached yet");
        
        _finalizeVotingSession(sampleId, "Timeout reached - external trigger");
        emit TimeoutReached(sampleId, block.timestamp);
    }
    
    function isTimeoutReached(string memory sampleId) external view returns (bool) {
        return _isTimeoutReached(sampleId);
    }
    
    function getFinalLabel(string memory sampleId) external view returns (string memory) {
        return votingSessions[sampleId].finalLabel;
    }
    
    function getVotingSession(string memory sampleId) external view returns (
        uint256 startTime,
        bool isActive,
        bool isFinalized,
        string memory finalLabel
    ) {
        VotingSession storage session = votingSessions[sampleId];
        return (session.startTime, session.isActive, session.isFinalized, session.finalLabel);
    }
    
    function getVotingResult(string memory sampleId) external view returns (
        bool isFinalized,
        string memory finalLabel,
        uint256 totalVotes,
        uint256 votedCount
    ) {
        VotingSession storage session = votingSessions[sampleId];
        
        uint256 voted = 0;
        for (uint256 i = 0; i < voterList.length; i++) {
            if (session.hasVoted[voterList[i]]) {
                voted++;
            }
        }
        
        return (
            session.isFinalized,
            session.finalLabel,
            votes[sampleId].length,
            voted
        );
    }
    
    function getVotingDistribution(string memory sampleId) external view returns (
        string[] memory labels,
        uint256[] memory voteCounts,
        uint256[] memory voteWeights
    ) {
        Vote[] memory voteList = votes[sampleId];
        VotingSession storage session = votingSessions[sampleId];
        
        if (voteList.length == 0) {
            return (new string[](0), new uint256[](0), new uint256[](0));
        }
        
        // Get unique labels (simplified - in production might want more efficient approach)
        string[] memory tempLabels = new string[](voteList.length);
        uint256 labelCount = 0;
        
        for (uint256 i = 0; i < voteList.length; i++) {
            string memory currentLabel = voteList[i].label;
            bool exists = false;
            
            for (uint256 j = 0; j < labelCount; j++) {
                if (keccak256(bytes(tempLabels[j])) == keccak256(bytes(currentLabel))) {
                    exists = true;
                    break;
                }
            }
            
            if (!exists) {
                tempLabels[labelCount] = currentLabel;
                labelCount++;
            }
        }
        
        // Create arrays with actual size
        labels = new string[](labelCount);
        voteCounts = new uint256[](labelCount);
        voteWeights = new uint256[](labelCount);
        
        for (uint256 i = 0; i < labelCount; i++) {
            labels[i] = tempLabels[i];
            voteCounts[i] = session.labelVotes[tempLabels[i]];
            voteWeights[i] = session.labelWeights[tempLabels[i]];
        }
        
        return (labels, voteCounts, voteWeights);
    }
    
    function getVotingSessionStatus(string memory sampleId) external view returns (
        bool isActive,
        bool isFinalized,
        string memory finalLabel,
        uint256 startTime,
        uint256 timeRemaining,
        uint256 votedCount,
        uint256 totalVoters
    ) {
        VotingSession storage session = votingSessions[sampleId];
        
        uint256 remaining = 0;
        if (votingTimeoutSeconds > 0 && session.isActive && !session.isFinalized) {
            uint256 endTime = session.startTime + votingTimeoutSeconds;
            if (block.timestamp < endTime) {
                remaining = endTime - block.timestamp;
            }
        }
        
        uint256 voted = 0;
        for (uint256 i = 0; i < voterList.length; i++) {
            if (session.hasVoted[voterList[i]]) {
                voted++;
            }
        }
        
        return (
            session.isActive,
            session.isFinalized,
            session.finalLabel,
            session.startTime,
            remaining,
            voted,
            session.totalVoters
        );
    }
    
    function _isTimeoutReached(string memory sampleId) internal view returns (bool) {
        if (votingTimeoutSeconds == 0) return false;
        return block.timestamp > votingSessions[sampleId].startTime + votingTimeoutSeconds;
    }
    
    function _allVotersVoted(string memory sampleId) internal view returns (bool) {
        uint256 votedCount = 0;
        for (uint256 i = 0; i < voterList.length; i++) {
            if (votingSessions[sampleId].hasVoted[voterList[i]]) {
                votedCount++;
            }
        }
        return votedCount == votingSessions[sampleId].totalVoters;
    }
    
    function _checkForConsensus(string memory sampleId) internal view returns (string memory) {
        Vote[] memory voteList = votes[sampleId];
        if (voteList.length == 0) return "";
        
        // Get all unique labels
        string[] memory uniqueLabels = new string[](voteList.length);
        uint256 labelCount = 0;
        
        for (uint256 i = 0; i < voteList.length; i++) {
            string memory currentLabel = voteList[i].label;
            bool exists = false;
            
            for (uint256 j = 0; j < labelCount; j++) {
                if (keccak256(bytes(uniqueLabels[j])) == keccak256(bytes(currentLabel))) {
                    exists = true;
                    break;
                }
            }
            
            if (!exists) {
                uniqueLabels[labelCount] = currentLabel;
                labelCount++;
            }
        }
        
        // Check consensus for each label
        for (uint256 i = 0; i < labelCount; i++) {
            if (_checkConsensus(sampleId, uniqueLabels[i])) {
                return uniqueLabels[i];
            }
        }
        
        return "";
    }
    
    function _finalizeVotingSession(string memory sampleId, string memory reason) internal {
        require(votingSessions[sampleId].isActive, "Session not active");
        require(!votingSessions[sampleId].isFinalized, "Already finalized");
        
        // Mark as finalized
        votingSessions[sampleId].isActive = false;
        votingSessions[sampleId].isFinalized = true;
        
        // Determine final label through vote aggregation
        string memory finalLabel = _aggregateVotes(sampleId);
        votingSessions[sampleId].finalLabel = finalLabel;
        
        // Emit events
        emit VotingSessionEnded(sampleId, block.timestamp);
        emit VotingSessionFinalized(sampleId, finalLabel, block.timestamp, reason);
        
        // Check if this sample is part of a batch
        uint256 sampleRound = votingSessions[sampleId].round;
        if (sampleRound > 0 && batches[sampleRound].isActive) {
            _checkBatchCompletion(sampleRound, sampleId, finalLabel);
        }
        
        // Notify main contract to store the result
        _notifyMainContract(sampleId, finalLabel);
    }
    
    function _checkBatchCompletion(uint256 round, string memory completedSampleId, string memory finalLabel) internal {
        batches[round].completedCount++;
        
        uint256 remaining = batches[round].sampleIds.length - batches[round].completedCount;
        emit BatchSampleCompleted(round, completedSampleId, finalLabel, remaining);
        
        // Check if batch is complete
        if (batches[round].completedCount >= batches[round].sampleIds.length) {
            batches[round].isActive = false;
            emit BatchCompleted(round, batches[round].completedCount, block.timestamp);
        }
    }
    
    function getBatchStatus(uint256 round) external view returns (
        bool isActive,
        uint256 totalSamples,
        uint256 completedSamples,
        uint256 remainingSamples,
        uint256 startTime
    ) {
        BatchInfo storage batch = batches[round];
        return (
            batch.isActive,
            batch.sampleIds.length,
            batch.completedCount,
            batch.sampleIds.length - batch.completedCount,
            batch.startTime
        );
    }
    
    function getBatchSamples(uint256 round) external view returns (string[] memory) {
        return batches[round].sampleIds;
    }
    
    function getCurrentBatchProgress() external view returns (
        uint256 round,
        bool isActive,
        uint256 totalSamples,
        uint256 completedSamples,
        string[] memory sampleIds
    ) {
        BatchInfo storage batch = batches[currentRound];
        return (
            currentRound,
            batch.isActive,
            batch.sampleIds.length,
            batch.completedCount,
            batch.sampleIds
        );
    }
    
    function _aggregateVotes(string memory sampleId) internal view returns (string memory) {
        Vote[] memory voteList = votes[sampleId];
        if (voteList.length == 0) return "NO_VOTES";
        
        // Simple majority voting based on support
        mapping(string => uint256) storage labelWeights = votingSessions[sampleId].labelWeights;
        
        string memory bestLabel = "";
        uint256 maxWeight = 0;
        
        // Find label with highest weighted support
        for (uint256 i = 0; i < voteList.length; i++) {
            if (voteList[i].support) {
                string memory label = voteList[i].label;
                uint256 weight = labelWeights[label];
                
                if (weight > maxWeight) {
                    maxWeight = weight;
                    bestLabel = label;
                }
            }
        }
        
        return bytes(bestLabel).length > 0 ? bestLabel : "NO_CONSENSUS";
    }
    
    function _notifyMainContract(string memory sampleId, string memory finalLabel) internal {
        // Call back to Project to store the final result
        try this.notifyMainContractExternal(sampleId, finalLabel) {
            // Success
            emit LabelStoredInProject(sampleId, finalLabel, block.timestamp);
        } catch {
            // Continue even if notification fails
        }
    }
    
    function notifyMainContractExternal(string memory sampleId, string memory finalLabel) external {
        require(msg.sender == address(this), "Internal call only");
        
        // Interface call to Project to store final label
        try IProject(project).receiveFinalLabelFromVoting(
            sampleId,
            finalLabel,
            "Automated vote aggregation",
            "" // IPFS hash - could be generated for vote record
        ) {
            // Success
        } catch {
            // Continue even if storage fails
        }
        
        // Notify Project about session ending
        try IProject(project).notifyVotingSessionEnded(sampleId, finalLabel) {
            // Success
        } catch {
            // Continue even if notification fails
        }
    }
} 