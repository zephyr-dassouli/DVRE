// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./JSONProject.sol";
import "./ProjectTemplateRegistry.sol";

contract ProjectFactory {
    ProjectTemplateRegistry public templateRegistry;
    
    event ProjectCreated(address indexed creator, address indexed projectAddress, string projectType, uint256 templateId, uint256 timestamp);

    mapping(address => address[]) public userProjects;
    mapping(address => bool) public isProject;
    address[] public allProjects;
    mapping(address => bool) public isDALProject;
    address[] public dalProjects;

    constructor(address _templateRegistry) {
        require(_templateRegistry != address(0), "Template registry address cannot be zero");
        templateRegistry = ProjectTemplateRegistry(_templateRegistry);
    }

    function createProjectFromTemplate(uint256 _templateId, string memory _projectData) external returns (address) {
        (,, string memory projectType,, , bool isActive) = templateRegistry.getTemplate(_templateId);
        require(isActive, "Template is not active");
        require(bytes(_projectData).length > 0, "Project data cannot be empty");

        // Create new project with simplified constructor
        JSONProject newProject = new JSONProject(msg.sender, _projectData);
        address projectAddress = address(newProject);

        // Track DAL projects for special handling
        if (keccak256(abi.encodePacked(projectType)) == keccak256(abi.encodePacked("active_learning"))) {
            isDALProject[projectAddress] = true;
            dalProjects.push(projectAddress);
        }

        // Register project
        userProjects[msg.sender].push(projectAddress);
        isProject[projectAddress] = true;
        allProjects.push(projectAddress);

        emit ProjectCreated(msg.sender, projectAddress, projectType, _templateId, block.timestamp);
        return projectAddress;
    }

    function createCustomProject(string memory _projectData) external returns (address) {
        require(bytes(_projectData).length > 0, "Project data cannot be empty");

        // Create new project with simplified constructor
        JSONProject newProject = new JSONProject(msg.sender, _projectData);
        address projectAddress = address(newProject);

        // Register project
        userProjects[msg.sender].push(projectAddress);
        isProject[projectAddress] = true;
        allProjects.push(projectAddress);

        emit ProjectCreated(msg.sender, projectAddress, "custom", 0, block.timestamp);
        return projectAddress;
    }

    // View functions remain the same
    function getUserProjects(address _user) external view returns (address[] memory) {
        return userProjects[_user];
    }

    function getAllProjects() external view returns (address[] memory) {
        return allProjects;
    }

    function getProjectCount() external view returns (uint256) {
        return allProjects.length;
    }

    function getUserProjectCount(address _user) external view returns (uint256) {
        return userProjects[_user].length;
    }

    function getDALProjects() external view returns (address[] memory) {
        return dalProjects;
    }

    function getDALProjectCount() external view returns (uint256) {
        return dalProjects.length;
    }

    function checkIsProject(address _projectAddress) external view returns (bool) {
        return isProject[_projectAddress];
    }

    function checkIsDALProject(address _projectAddress) external view returns (bool) {
        return isDALProject[_projectAddress];
    }
}
