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
    event AutoHistoryRecorded(string sampleId, uint256 round, string finalLabel);
    
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
        _storeFinalLabelInternal(sampleId, label, round, justification, ipfsHash);
    }
    
    /**
     * @dev Internal function to store final labels (called by both external functions)
     */
    function _storeFinalLabelInternal(
        string memory sampleId,
        string memory label,
        uint256 round,
        string memory justification,
        string memory ipfsHash
    ) internal {
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
    
    /**
     * @dev Automatically record basic voting history when label is finalized
     * This is called when automatic vote aggregation occurs
     */
    function autoRecordFinalizedLabel(
        string memory sampleId,
        string memory label,
        uint256 round,
        string memory justification,
        string memory ipfsHash
    ) external onlyJSONProject {
        // First store the final label using internal function
        _storeFinalLabelInternal(sampleId, label, round, justification, ipfsHash);
        
        // Create a basic voting history entry for automatic finalization
        historyBySample[sampleId].push();
        uint256 index = historyBySample[sampleId].length - 1;
        
        VotingHistory storage record = historyBySample[sampleId][index];
        record.sampleId = sampleId;
        record.round = round;
        record.finalLabel = label;
        record.timestamp = block.timestamp;
        
        // Note: Detailed vote records would need to be added separately if needed
        
        emit AutoHistoryRecorded(sampleId, round, label);
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
    
    /**
     * @dev Check if a sample already has a final label
     */
    function hasFinalLabel(string memory sampleId) external view returns (bool) {
        return bytes(finalLabels[sampleId].sampleId).length > 0;
    }
    
    /**
     * @dev Get all samples that have been finalized
     */
    function getAllFinalizedSamples() external view returns (string[] memory) {
        // Note: This is a simplified version. In production, you might want to track samples in an array
        // For now, this would need to be implemented with additional storage if needed
        string[] memory empty = new string[](0);
        return empty;
    }
    
    /**
     * @dev Get total number of finalized labels
     */
    function getTotalFinalizedCount() external view returns (uint256) {
        // Note: This would need additional tracking in a real implementation
        // For now, returning 0 as placeholder
        return 0;
    }
    
    /**
     * @dev Validate sample ID format
     */
    function isValidSampleId(string memory sampleId) external pure returns (bool) {
        return bytes(sampleId).length > 0 && bytes(sampleId).length <= 64;
    }
} 