// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./JSONProject.sol";
import "./ProjectTemplateRegistry.sol";

contract ProjectFactory {
    // Reference to the template registry
    ProjectTemplateRegistry public templateRegistry;
    
    // Events
    event ProjectCreated(
        address indexed creator,
        address indexed projectAddress,
        string projectType,
        uint256 templateId,
        uint256 timestamp
    );

    // State variables
    mapping(address => address[]) public userProjects; // user => project addresses
    mapping(address => bool) public isProject;
    address[] public allProjects;

    constructor(address _templateRegistry) {
        require(_templateRegistry != address(0), "Template registry address cannot be zero");
        templateRegistry = ProjectTemplateRegistry(_templateRegistry);
    }

    // Create a new project using a template
    function createProjectFromTemplate(
        uint256 _templateId,
        string memory _projectData
    ) external returns (address) {
        // Validate template exists and is active
        (,, string memory projectType,, , bool isActive) = templateRegistry.getTemplate(_templateId);
        require(isActive, "Template is not active");
        require(bytes(_projectData).length > 0, "Project data cannot be empty");

        // Deploy new JSONProject contract
        JSONProject newProject = new JSONProject(
            msg.sender,
            _projectData
        );

        address projectAddress = address(newProject);

        // Update mappings
        userProjects[msg.sender].push(projectAddress);
        isProject[projectAddress] = true;
        allProjects.push(projectAddress);

        emit ProjectCreated(msg.sender, projectAddress, projectType, _templateId, block.timestamp);

        return projectAddress;
    }

    // Create a custom project (no specific template)
    function createCustomProject(
        string memory _projectData
    ) external returns (address) {
        require(bytes(_projectData).length > 0, "Project data cannot be empty");

        // Deploy new JSONProject contract
        JSONProject newProject = new JSONProject(
            msg.sender,
            _projectData
        );

        address projectAddress = address(newProject);

        // Update mappings
        userProjects[msg.sender].push(projectAddress);
        isProject[projectAddress] = true;
        allProjects.push(projectAddress);

        emit ProjectCreated(msg.sender, projectAddress, "custom", 999999, block.timestamp);

        return projectAddress;
    }

    // Create project with automatic JSON generation from basic parameters
    function createProjectFromBasicInfo(
        uint256 _templateId,
        string memory _projectId,
        string memory _objective,
        address[] memory _participantAddresses,
        string[] memory _participantRoles
    ) external returns (address) {
        require(_participantAddresses.length == _participantRoles.length, "Participants and roles length mismatch");
        
        // Get template info
        (, , string memory projectType, , , bool isActive) = templateRegistry.getTemplate(_templateId);
        require(isActive, "Template is not active");

        // Build basic JSON structure
        string memory participantsJson = _buildParticipantsJson(_participantAddresses, _participantRoles);
        string memory projectData = string(abi.encodePacked(
            '{"project_id":"', _projectId, '",',
            '"type":"', projectType, '",',
            '"objective":"', _objective, '",',
            '"participants":', participantsJson,
            '}'
        ));

        return this.createProjectFromTemplate(_templateId, projectData);
    }

    // Helper function to build participants JSON
    function _buildParticipantsJson(
        address[] memory _addresses,
        string[] memory _roles
    ) internal pure returns (string memory) {
        if (_addresses.length == 0) {
            return "[]";
        }

        string memory result = "[";
        for (uint256 i = 0; i < _addresses.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(
                result,
                '{"id":"', _addressToString(_addresses[i]), '",',
                '"role":"', _roles[i], '"}'
            ));
        }
        return string(abi.encodePacked(result, "]"));
    }

    // Helper function to convert address to string
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

    // Get projects created by a user
    function getUserProjects(address _user) external view returns (address[] memory) {
        return userProjects[_user];
    }

    // Get all projects
    function getAllProjects() external view returns (address[] memory) {
        return allProjects;
    }

    // Get total number of projects
    function getTotalProjects() external view returns (uint256) {
        return allProjects.length;
    }

    // Check if an address is a valid project created by this factory
    function isValidProject(address _projectAddress) external view returns (bool) {
        return isProject[_projectAddress];
    }

    // Get project data from a project address
    function getProjectData(address _projectAddress) external view returns (string memory) {
        require(isProject[_projectAddress], "Invalid project address");
        return JSONProject(_projectAddress).getProjectData();
    }

    // Get project status from a project address
    function getProjectStatus(address _projectAddress) external view returns (
        bool active,
        uint256 created,
        uint256 modified,
        address creator
    ) {
        require(isProject[_projectAddress], "Invalid project address");
        return JSONProject(_projectAddress).getProjectStatus();
    }

    // Update template registry (admin function)
    function updateTemplateRegistry(address _newTemplateRegistry) external {
        require(_newTemplateRegistry != address(0), "Template registry address cannot be zero");
        // Note: In production, this should have access control
        templateRegistry = ProjectTemplateRegistry(_newTemplateRegistry);
    }

    // Get template registry address
    function getTemplateRegistry() external view returns (address) {
        return address(templateRegistry);
    }
}
