// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAsset {
    function transferOwnership(address _newOwner) external;
}

interface IAssetFactory {
    function createAsset(
        string memory name,
        string memory assetType,
        string memory ipfsHash,
        address[] memory initialViewers
    ) external returns (address);
}

interface IProject {
    function updateROCrateHash(string memory _rocrateHash) external;
    function creator() external view returns (address);
    function setALExtension(address _alProject) external;
    function approveDelegate(address _delegate) external;
}

/**
 * @title ALProjectDeployer
 * @dev Complete AL deployment service that deploys all AL contracts + RO-Crate asset in one transaction
 * Uses CREATE2 with stored bytecode to deploy contracts without importing them
 */
contract ALProjectDeployer {
    event ALProjectDeployed(
        address indexed baseProject,
        address indexed alProject,
        address votingContract,
        address storageContract,
        address roCrateAsset
    );
    
    // Detailed debugging events
    event ALProjectCreated(address indexed alProject, address indexed baseProject);
    event ALVotingCreated(address indexed votingContract, address indexed alProject);
    event ALStorageCreated(address indexed storageContract, address indexed alProject);
    event RoCrateAssetCreated(address indexed roCrateAsset, string ipfsHash, uint256 viewerCount);
    event LinkingStarted(address indexed baseProject, address indexed alProject);
    event LinkingCompleted(address indexed baseProject, address indexed alProject);
    
    // Contract bytecodes stored in storage (set during deployment)
    bytes private alProjectBytecode;
    bytes private alVotingBytecode;
    bytes private alStorageBytecode;
    address immutable linkerContract;
    address immutable assetFactory;
    
    constructor(
        bytes memory _alProjectBytecode,
        bytes memory _alVotingBytecode,
        bytes memory _alStorageBytecode,
        address _linkerContract,
        address _assetFactory
    ) {
        alProjectBytecode = _alProjectBytecode;
        alVotingBytecode = _alVotingBytecode;
        alStorageBytecode = _alStorageBytecode;
        linkerContract = _linkerContract;
        assetFactory = _assetFactory;
    }
    
    struct ALProjectConfig {
        string queryStrategy;
        string alScenario;
        uint256 maxIteration;
        uint256 queryBatchSize;
        string[] labelSpace;
    }
    
    struct VotingConfig {
        string votingConsensus;
        uint256 votingTimeout;
    }
    
    /**
     * @dev Deploy and link all AL contracts + create RO-Crate asset in one transaction
     * @param originalCaller The address of the user who initiated the deployment (becomes asset owner)
     */
    function deployAL(
        address originalCaller,
        address baseProject,
        ALProjectConfig calldata alConfig,
        VotingConfig calldata votingConfig,
        string calldata rocrateHash,
        address[] calldata contributors,
        uint256 nonce
    ) external returns (
        address alProject, 
        address votingContract, 
        address storageContract,
        address roCrateAsset
    ) {
        
        // Deploy ALProject
        bytes memory alCreationCode = abi.encodePacked(
            alProjectBytecode,
            abi.encode(baseProject, "")
        );
        assembly {
            alProject := create2(0, add(alCreationCode, 0x20), mload(alCreationCode), nonce)
        }
        require(alProject != address(0), "ALProject deployment failed");
        emit ALProjectCreated(alProject, baseProject);
        
        // Deploy ALProjectVoting
        bytes memory votingCreationCode = abi.encodePacked(
            alVotingBytecode,
            abi.encode(alProject, votingConfig.votingConsensus, votingConfig.votingTimeout)
        );
        assembly {
            votingContract := create2(0, add(votingCreationCode, 0x20), mload(votingCreationCode), add(nonce, 1))
        }
        require(votingContract != address(0), "ALProjectVoting deployment failed");
        emit ALVotingCreated(votingContract, alProject);
        
        // Deploy ALProjectStorage
        bytes memory storageCreationCode = abi.encodePacked(
            alStorageBytecode,
            abi.encode(alProject)
        );
        assembly {
            storageContract := create2(0, add(storageCreationCode, 0x20), mload(storageCreationCode), add(nonce, 2))
        }
        require(storageContract != address(0), "ALProjectStorage deployment failed");
        emit ALStorageCreated(storageContract, alProject);
        
        // Create RO-Crate asset with originalCaller as owner (not this contract)
        string memory assetName = string(abi.encodePacked("ro-crate-", _addressToString(baseProject), "-initial"));
        
        // Use delegatecall or create asset on behalf of originalCaller
        // Since AssetFactory.createAsset uses msg.sender as owner, we need a different approach
        // We'll create the asset and then transfer ownership to originalCaller
        roCrateAsset = IAssetFactory(assetFactory).createAsset(
            assetName,
            "ro-crate",
            rocrateHash,
            contributors
        );
        require(roCrateAsset != address(0), "RO-Crate asset creation failed");
        
        // Transfer ownership to the original caller
        IAsset(roCrateAsset).transferOwnership(originalCaller);
        
        emit RoCrateAssetCreated(roCrateAsset, rocrateHash, contributors.length);
        
        // Call linker for ALProject setup only
        emit LinkingStarted(baseProject, alProject);
        (bool setupSuccess,) = linkerContract.call(
            abi.encodeWithSignature(
                "setupALProjectOnly(address,address,address,string,string,uint256,uint256,string[])",
                alProject,
                votingContract,
                storageContract,
                alConfig.queryStrategy,
                alConfig.alScenario,
                alConfig.maxIteration,
                alConfig.queryBatchSize,
                alConfig.labelSpace
            )
        );
        require(setupSuccess, "AL project setup failed");
        
        // Handle Project contract updates
        // NOTE: The user must have pre-approved this deployer as a delegate
        // by calling project.approveDelegate(ALProjectDeployerAddress) before deployment
        IProject(baseProject).setALExtension(alProject);
        IProject(baseProject).updateROCrateHash(rocrateHash);
        
        emit LinkingCompleted(baseProject, alProject);
        
        emit ALProjectDeployed(baseProject, alProject, votingContract, storageContract, roCrateAsset);
        return (alProject, votingContract, storageContract, roCrateAsset);
    }
    
    /**
     * @dev Helper function to convert address to string for asset naming
     */
    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
} 