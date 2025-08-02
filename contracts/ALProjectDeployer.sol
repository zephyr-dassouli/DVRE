// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
     */
    function deployAL(
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
        
        // Deploy ALProjectVoting
        bytes memory votingCreationCode = abi.encodePacked(
            alVotingBytecode,
            abi.encode(alProject, votingConfig.votingConsensus, votingConfig.votingTimeout)
        );
        assembly {
            votingContract := create2(0, add(votingCreationCode, 0x20), mload(votingCreationCode), add(nonce, 1))
        }
        require(votingContract != address(0), "ALProjectVoting deployment failed");
        
        // Deploy ALProjectStorage
        bytes memory storageCreationCode = abi.encodePacked(
            alStorageBytecode,
            abi.encode(alProject)
        );
        assembly {
            storageContract := create2(0, add(storageCreationCode, 0x20), mload(storageCreationCode), add(nonce, 2))
        }
        require(storageContract != address(0), "ALProjectStorage deployment failed");
        
        // Create RO-Crate asset with contributors as viewers
        string memory assetName = string(abi.encodePacked("ro-crate-", _addressToString(baseProject), "-initial"));
        roCrateAsset = IAssetFactory(assetFactory).createAsset(
            assetName,
            "ro-crate",
            rocrateHash,
            contributors
        );
        require(roCrateAsset != address(0), "RO-Crate asset creation failed");
        
        // Call linker to setup and link everything (includes RO-Crate hash update)
        (bool success,) = linkerContract.call(
            abi.encodeWithSignature(
                "linkALProject(address,address,address,address,string,string,uint256,uint256,string[],string)",
                baseProject,
                alProject,
                votingContract,
                storageContract,
                alConfig.queryStrategy,
                alConfig.alScenario,
                alConfig.maxIteration,
                alConfig.queryBatchSize,
                alConfig.labelSpace,
                rocrateHash
            )
        );
        require(success, "Linking failed");
        
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