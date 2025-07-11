// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Asset.sol";

contract AssetFactory {
    // State variables
    address[] public assets;
    mapping(address => address[]) public userAssets; // user => array of asset addresses
    mapping(address => bool) public isAsset; // check if address is a valid asset
    
    // Events
    event AssetCreated(
        address indexed creator,
        address indexed assetAddress,
        string name,
        string assetType,
        string ipfsHash
    );

    function createAsset(
        string memory _name,
        string memory _assetType,
        string memory _ipfsHash
    ) external returns (address) {
        // Create new Asset contract
        Asset newAsset = new Asset(
            msg.sender,
            _name,
            _assetType,
            _ipfsHash
        );

        address assetAddress = address(newAsset);
        
        // Track the asset
        assets.push(assetAddress);
        userAssets[msg.sender].push(assetAddress);
        isAsset[assetAddress] = true;

        emit AssetCreated(msg.sender, assetAddress, _name, _assetType, _ipfsHash);

        return assetAddress;
    }

    function getUserAssets(address _user) external view returns (address[] memory) {
        return userAssets[_user];
    }

    function getAllAssets() external view returns (address[] memory) {
        return assets;
    }

    function getAssetCount() external view returns (uint256) {
        return assets.length;
    }

    function getUserAssetCount(address _user) external view returns (uint256) {
        return userAssets[_user].length;
    }

    function isValidAsset(address _assetAddress) external view returns (bool) {
        return isAsset[_assetAddress];
    }

    function getAssetInfo(address _assetAddress) external view returns (
        address assetOwner,
        string memory assetName,
        string memory assetTypeValue,
        string memory assetIpfsHash,
        uint256 created,
        uint256 updated
    ) {
        require(isAsset[_assetAddress], "Invalid asset address");
        
        Asset asset = Asset(_assetAddress);
        return asset.getAssetInfo();
    }
}
