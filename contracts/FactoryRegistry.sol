// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract FactoryRegistry {
mapping(string => address) private factories;

function register(string calldata name, address factory) external {
    factories[name] = factory;
}

function get(string calldata name) external view returns (address) {
    return factories[name];
}
}