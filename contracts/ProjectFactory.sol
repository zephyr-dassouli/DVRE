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

        address projectAddress;

        if (keccak256(abi.encodePacked(projectType)) == keccak256(abi.encodePacked("active_learning"))) {
            JSONProject newProject = new JSONProject(
                msg.sender, _projectData, JSONProject.ProjectType.ACTIVE_LEARNING,
                "", 10, 60, address(0)
            );
            projectAddress = address(newProject);
            isDALProject[projectAddress] = true;
            dalProjects.push(projectAddress);
        } else if (keccak256(abi.encodePacked(projectType)) == keccak256(abi.encodePacked("federated_learning"))) {
            JSONProject newProject = new JSONProject(
                msg.sender, _projectData, JSONProject.ProjectType.FEDERATED_LEARNING,
                "", 5, 70, address(0)
            );
            projectAddress = address(newProject);
        } else {
            JSONProject newProject = new JSONProject(
                msg.sender, _projectData, JSONProject.ProjectType.GENERIC,
                "", 1, 50, address(0)
            );
            projectAddress = address(newProject);
        }

        userProjects[msg.sender].push(projectAddress);
        isProject[projectAddress] = true;
        allProjects.push(projectAddress);

        emit ProjectCreated(msg.sender, projectAddress, projectType, _templateId, block.timestamp);
        return projectAddress;
    }

    function createDALProject(
        string memory _projectData,
        uint256 _maxRounds,
        uint256 _consensusThreshold,
        address _orchestratorAddress,
        string memory _cwlWorkflowHash
    ) external returns (address) {
        require(bytes(_projectData).length > 0, "Project data cannot be empty");
        require(_maxRounds > 0, "Max rounds must be greater than 0");
        require(_consensusThreshold > 0 && _consensusThreshold <= 100, "Invalid consensus threshold");

        JSONProject newProject = new JSONProject(
            msg.sender, _projectData, JSONProject.ProjectType.ACTIVE_LEARNING,
            _cwlWorkflowHash, _maxRounds, _consensusThreshold, _orchestratorAddress
        );

        address projectAddress = address(newProject);

        userProjects[msg.sender].push(projectAddress);
        isProject[projectAddress] = true;
        allProjects.push(projectAddress);
        isDALProject[projectAddress] = true;
        dalProjects.push(projectAddress);

        emit ProjectCreated(msg.sender, projectAddress, "active_learning", 0, block.timestamp);
        return projectAddress;
    }

    function createCustomProject(string memory _projectData) external returns (address) {
        require(bytes(_projectData).length > 0, "Project data cannot be empty");

        JSONProject newProject = new JSONProject(
            msg.sender, _projectData, JSONProject.ProjectType.GENERIC,
            "", 1, 50, address(0)
        );

        address projectAddress = address(newProject);

        userProjects[msg.sender].push(projectAddress);
        isProject[projectAddress] = true;
        allProjects.push(projectAddress);

        emit ProjectCreated(msg.sender, projectAddress, "custom", 999999, block.timestamp);
        return projectAddress;
    }

    // Essential view functions only
    function getUserProjects(address _user) external view returns (address[] memory) {
        return userProjects[_user];
    }

    function getAllProjects() external view returns (address[] memory) {
        return allProjects;
    }

    function getAllDALProjects() external view returns (address[] memory) {
        return dalProjects;
    }

    function getTotalProjects() external view returns (uint256) {
        return allProjects.length;
    }

    function getTotalDALProjects() external view returns (uint256) {
        return dalProjects.length;
    }

    function isValidProject(address _projectAddress) external view returns (bool) {
        return isProject[_projectAddress];
    }

    function isValidDALProject(address _projectAddress) external view returns (bool) {
        return isDALProject[_projectAddress];
    }

    function getProjectData(address _projectAddress) external view returns (string memory) {
        require(isProject[_projectAddress], "Invalid project address");
        return JSONProject(_projectAddress).getProjectData();
    }

    function getProjectStatus(address _projectAddress) external view returns (
        bool active, uint256 created, uint256 modified, address creator
    ) {
        require(isProject[_projectAddress], "Invalid project address");
        return JSONProject(_projectAddress).getProjectStatus();
    }

    function getDALProjectInfo(address _projectAddress) external view returns (
        uint8 currentPhase, uint256 currentRound, uint256 maxRounds, uint256 consensusThreshold, address orchestratorAddress
    ) {
        require(isDALProject[_projectAddress], "Invalid DAL project address");
        
        JSONProject dalProject = JSONProject(_projectAddress);
        return (
            uint8(dalProject.currentPhase()),
            dalProject.currentRound(),
            dalProject.maxRounds(),
            dalProject.consensusThreshold(),
            dalProject.orchestratorAddress()
        );
    }

    function getTemplateRegistry() external view returns (address) {
        return address(templateRegistry);
    }
}
