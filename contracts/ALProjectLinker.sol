// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IALProject {
    function setupALProject(
        address votingContract,
        address storageContract,
        string memory queryStrategy,
        string memory alScenario,
        uint256 maxIteration,
        uint256 queryBatchSize,
        string[] memory labelSpace,
        string memory rocrateHash
    ) external;
}

interface IProject {
    function setALExtension(address _alExtension) external;
    function updateROCrateHash(string memory _rocrateHash) external;
    function creator() external view returns (address);
}

/**
 * @title ALProjectLinker
 * @dev Minimal contract that links pre-deployed AL contracts together
 * Frontend deploys the 3 contracts separately, then calls this to link them
 */
contract ALProjectLinker {
    event ALProjectLinked(
        address indexed baseProject,
        address indexed alProject,
        address votingContract,
        address storageContract
    );
    
    // Detailed debugging events
    event ALProjectSetupStarted(address indexed alProject);
    event ALProjectSetupCompleted(address indexed alProject);
    event ALExtensionLinked(address indexed baseProject, address indexed alProject);
    event ROCrateHashUpdated(address indexed baseProject, string rocrateHash);
    
    /**
     * @dev Setup ALProject only (called by ALProjectDeployer)
     * Does not touch base Project contract - ALProjectDeployer handles that
     */
    function setupALProjectOnly(
        address alProject,
        address votingContract,
        address storageContract,
        string calldata queryStrategy,
        string calldata alScenario,
        uint256 maxIteration,
        uint256 queryBatchSize,
        string[] calldata labelSpace
    ) external {
        // Setup AL project with voting and storage contracts
        emit ALProjectSetupStarted(alProject);
        IALProject(alProject).setupALProject(
            votingContract,
            storageContract,
            queryStrategy,
            alScenario,
            maxIteration,
            queryBatchSize,
            labelSpace,
            "" // empty rocrateHash since ALProjectDeployer handles it
        );
        emit ALProjectSetupCompleted(alProject);
    }
    
    /**
     * @dev Link pre-deployed AL contracts together and to base project
     * @param baseProject Address of existing Project contract
     * @param alProject Address of deployed ALProject contract
     * @param votingContract Address of deployed ALProjectVoting contract
     * @param storageContract Address of deployed ALProjectStorage contract
     * @param queryStrategy AL query strategy
     * @param alScenario AL scenario
     * @param maxIteration Maximum iterations
     * @param queryBatchSize Batch size
     * @param labelSpace Label space array
     * @param rocrateHash RO-Crate hash
     */
    function linkALProject(
        address baseProject,
        address alProject,
        address votingContract,
        address storageContract,
        string calldata queryStrategy,
        string calldata alScenario,
        uint256 maxIteration,
        uint256 queryBatchSize,
        string[] calldata labelSpace,
        string calldata rocrateHash
    ) external {
        // Setup AL project with voting and storage contracts
        emit ALProjectSetupStarted(alProject);
        IALProject(alProject).setupALProject(
            votingContract,
            storageContract,
            queryStrategy,
            alScenario,
            maxIteration,
            queryBatchSize,
            labelSpace,
            rocrateHash
        );
        emit ALProjectSetupCompleted(alProject);
        
        // Link AL extension to base project
        IProject(baseProject).setALExtension(alProject);
        emit ALExtensionLinked(baseProject, alProject);
        
        // Update RO-Crate hash on base project
        IProject(baseProject).updateROCrateHash(rocrateHash);
        emit ROCrateHashUpdated(baseProject, rocrateHash);
        
        emit ALProjectLinked(baseProject, alProject, votingContract, storageContract);
    }
} 