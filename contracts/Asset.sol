// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


contract Asset {
    // State variables
    address public owner;
    string public name;
    string public ipfsHash;
    string public assetType; // "dataset", "model", "script", etc.
    uint256 public createdAt;
    uint256 public updatedAt;
    
    // Events
    event AssetCreated(address indexed owner, string name, string ipfsHash);
    event AssetUpdated(string newIpfsHash);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor(
        address _owner,
        string memory _name,
        string memory _assetType,
        string memory _ipfsHash
    ) {
        require(_owner != address(0), "Owner address cannot be zero");
        require(bytes(_name).length > 0, "Asset name cannot be empty");
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");

        owner = _owner;
        name = _name;
        assetType = _assetType;
        ipfsHash = _ipfsHash;
        createdAt = block.timestamp;
        updatedAt = block.timestamp;

        emit AssetCreated(_owner, _name, _ipfsHash);
    }

    function getIpfsHash() external view returns (string memory) {
        return ipfsHash;
    }

    function getAssetInfo() external view returns (
        address assetOwner,
        string memory assetName,
        string memory assetTypeValue,
        string memory assetIpfsHash,
        uint256 created,
        uint256 updated
    ) {
        return (
            owner,
            name,
            assetType,
            ipfsHash,
            createdAt,
            updatedAt
        );
    }

    function updateIpfsHash(string memory _newIpfsHash) external onlyOwner {
        require(bytes(_newIpfsHash).length > 0, "IPFS hash cannot be empty");
        
        ipfsHash = _newIpfsHash;
        updatedAt = block.timestamp;

        emit AssetUpdated(_newIpfsHash);
    }

    function updateMetadata(
        string memory _name
    ) external onlyOwner {
        if (bytes(_name).length > 0) {
            name = _name;
        }
        updatedAt = block.timestamp;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "New owner address cannot be zero");
        require(_newOwner != owner, "New owner is the same as current owner");

        address previousOwner = owner;
        owner = _newOwner;

        emit OwnershipTransferred(previousOwner, _newOwner);
    }
}
