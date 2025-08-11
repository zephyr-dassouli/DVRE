// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ALProjectStorage {
    address public project;
    
    struct FinalLabel {
        string sampleId;
        string label;
        uint256 round;
        uint256 timestamp;
        uint256 originalIndex; // NEW: Store original dataset index
    }
    
    // sampleId => FinalLabel
    mapping(string => FinalLabel) public finalLabels;
    
    event LabelFinalized(string sampleId, string label, uint256 round, uint256 timestamp, uint256 originalIndex);
    
    modifier onlyProject() {
        require(msg.sender == project, "Only main project can call");
        _;
    }
    
    constructor(address _project) {
        require(_project != address(0), "Invalid project address");
        project = _project;
    }
    
    function storeFinalLabel(
        string memory sampleId,
        string memory label,
        uint256 round,
        uint256 originalIndex
    ) external onlyProject {
        _storeFinalLabelInternal(sampleId, label, round, originalIndex);
    }
    
    /**
     * @dev Internal function to store final labels
     */
    function _storeFinalLabelInternal(
        string memory sampleId,
        string memory label,
        uint256 round,
        uint256 originalIndex
    ) internal {
        require(bytes(sampleId).length > 0, "Sample ID cannot be empty");
        require(bytes(label).length > 0, "Label cannot be empty");
        
        FinalLabel memory f = FinalLabel({
            sampleId: sampleId,
            label: label,
            round: round,
            timestamp: block.timestamp,
            originalIndex: originalIndex
        });
        
        finalLabels[sampleId] = f;
        
        emit LabelFinalized(sampleId, label, round, block.timestamp, originalIndex);
    }
    
    function getFinalLabel(string memory sampleId) external view returns (
        string memory label,
        uint256 round,
        uint256 timestamp,
        uint256 originalIndex
    ) {
        FinalLabel memory f = finalLabels[sampleId];
        return (f.label, f.round, f.timestamp, f.originalIndex);
    }
    
    function getLabel(string memory sampleId) external view returns (string memory) {
        return finalLabels[sampleId].label;
    }
    
    /**
     * @dev Check if a sample already has a final label
     */
    function hasFinalLabel(string memory sampleId) external view returns (bool) {
        return bytes(finalLabels[sampleId].sampleId).length > 0;
    }
    
    /**
     * @dev Validate sample ID format
     */
    function isValidSampleId(string memory sampleId) external pure returns (bool) {
        return bytes(sampleId).length > 0 && bytes(sampleId).length <= 64;
    }
} 