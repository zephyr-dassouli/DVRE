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
        string memory _ipfsHash,
        address[] memory _viewers
    ) external returns (address) {
        // Create new Asset contract with initial viewers (empty array if none provided)
        Asset newAsset = new Asset(
            msg.sender,
            _name,
            _assetType,
            _ipfsHash,
            _viewers
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

    // Viewer management functions
    function addAssetViewer(address _assetAddress, address _viewer) external {
        require(isAsset[_assetAddress], "Invalid asset address");
        
        Asset asset = Asset(_assetAddress);
        asset.addViewer(_viewer);
    }

    function removeAssetViewer(address _assetAddress, address _viewer) external {
        require(isAsset[_assetAddress], "Invalid asset address");
        
        Asset asset = Asset(_assetAddress);
        asset.removeViewer(_viewer);
    }

    function canAccessAsset(address _assetAddress, address _user) external view returns (bool) {
        if (!isAsset[_assetAddress]) return false;
        
        try Asset(_assetAddress).isViewer(_user) returns (bool result) {
            return result;
        } catch {
            return false;
        }
    }

    function getAccessibleAssets(address _user) external view returns (address[] memory) {
        uint256 accessibleCount = 0;
        
        // First pass: count accessible assets
        for (uint256 i = 0; i < assets.length; i++) {
            try Asset(assets[i]).isViewer(_user) returns (bool canAccess) {
                if (canAccess) {
                    accessibleCount++;
                }
            } catch {
                // Skip assets that can't be accessed or have errors
            }
        }
        
        // Second pass: collect accessible assets
        address[] memory accessibleAssets = new address[](accessibleCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < assets.length; i++) {
            try Asset(assets[i]).isViewer(_user) returns (bool canAccess) {
                if (canAccess) {
                    accessibleAssets[index] = assets[i];
                    index++;
                }
            } catch {
                // Skip assets that can't be accessed or have errors
            }
        }
        
        return accessibleAssets;
    }
}
