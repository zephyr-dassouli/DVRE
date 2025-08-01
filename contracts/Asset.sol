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
    
    // Viewer system (for UI filtering only)
    mapping(address => bool) public viewers;
    address[] public viewerList;
    
    // Events
    event AssetCreated(address indexed owner, string name, string ipfsHash);
    event AssetUpdated(string newIpfsHash);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ViewerAdded(address indexed viewer);
    event ViewerRemoved(address indexed viewer);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor(
        address _owner,
        string memory _name,
        string memory _assetType,
        string memory _ipfsHash,
        address[] memory _initialViewers
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

        // Add initial viewers during construction (if any provided)
        for (uint256 i = 0; i < _initialViewers.length; i++) {
            address viewer = _initialViewers[i];
            if (viewer != address(0) && viewer != _owner && !viewers[viewer]) {
                viewers[viewer] = true;
                viewerList.push(viewer);
                emit ViewerAdded(viewer);
            }
        }

        emit AssetCreated(_owner, _name, _ipfsHash);
    }

    function getIpfsHash() external view returns (string memory) {
        return ipfsHash;
    }

    // Public function - no access control, anyone can view asset info
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

    // Viewer management functions (for UI filtering)
    function addViewer(address _viewer) external onlyOwner {
        require(_viewer != address(0), "Invalid viewer address");
        require(_viewer != owner, "Owner is automatically a viewer");
        require(!viewers[_viewer], "Already a viewer");

        viewers[_viewer] = true;
        viewerList.push(_viewer);
        emit ViewerAdded(_viewer);
    }

    function removeViewer(address _viewer) external onlyOwner {
        require(viewers[_viewer], "Not a viewer");

        viewers[_viewer] = false;
        
        // Remove from viewerList array
        for (uint256 i = 0; i < viewerList.length; i++) {
            if (viewerList[i] == _viewer) {
                viewerList[i] = viewerList[viewerList.length - 1];
                viewerList.pop();
                break;
            }
        }
        
        emit ViewerRemoved(_viewer);
    }

    function isViewer(address _address) external view returns (bool) {
        return _address == owner || viewers[_address];
    }

    function getViewers() external view returns (address[] memory) {
        return viewerList;
    }

    function getViewerCount() external view returns (uint256) {
        return viewerList.length;
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
