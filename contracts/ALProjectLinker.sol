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
        address rocrateAsset      // Keep hash for AL project internal storage
    ) external;
}

interface IProject {
    function setALExtension(address _alExtension) external;
    function updateROCrateAsset(address _rocrateAsset) external;  // Changed from updateROCrateHash
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
    event ROCrateAssetUpdated(address indexed baseProject, address rocrateAsset);  // Changed event
    
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
            address(0) // empty rocrateHash since ALProjectDeployer handles it
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
     * @param rocrateAsset RO-Crate asset address
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
        address rocrateAsset                    // Changed parameter type from string to address
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
            address(0)  // Pass empty address for hash since we're now using asset address
        );
        emit ALProjectSetupCompleted(alProject);
        
        // Link AL extension to base project
        IProject(baseProject).setALExtension(alProject);
        emit ALExtensionLinked(baseProject, alProject);
        
        // Update RO-Crate asset address on base project
        IProject(baseProject).updateROCrateAsset(rocrateAsset);   // Changed from updateROCrateHash
        emit ROCrateAssetUpdated(baseProject, rocrateAsset);      // Changed event emission
        
        emit ALProjectLinked(baseProject, alProject, votingContract, storageContract);
    }
} 