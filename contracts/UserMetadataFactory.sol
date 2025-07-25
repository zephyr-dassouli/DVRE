// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./UserMetadata.sol";

contract UserMetadataFactory {
    mapping(address => address) public userMetadataContracts;
    address[] public allUsers; // Track all registered users
    event UserMetadataCreated(address indexed user, address metadataContract);

    function registerUser(
        string memory email,
        string memory name,
        string memory institution
    ) public {
        require(userMetadataContracts[msg.sender] == address(0), "Already registered");
        UserMetadata metadata = new UserMetadata(msg.sender, email, name, institution);
        userMetadataContracts[msg.sender] = address(metadata);
        allUsers.push(msg.sender); // Add user to the list
        emit UserMetadataCreated(msg.sender, address(metadata));
    }

    function getUserMetadataContract(address user) public view returns (address) {
        return userMetadataContracts[user];
    }

    function getUserMetadataJSON(address user) public view returns (string memory) {
        address metadataAddr = userMetadataContracts[user];
        require(metadataAddr != address(0), "User not registered");
        return UserMetadata(metadataAddr).getMetadataJSON();
    }

    // Get all registered users
    function getAllUsers() public view returns (address[] memory) {
        return allUsers;
    }

    // Get total number of registered users
    function getTotalUsers() public view returns (uint256) {
        return allUsers.length;
    }
}