// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ProjectTemplateRegistry {
    // Structs
    struct TemplateField {
        string fieldName;
        string fieldType; // "string", "array", "object", "number", "boolean"
        bool isRequired;
        string defaultValue;
    }

    struct ProjectTemplate {
        string name;
        string description;
        string projectType;
        string[] participantRoles;
        TemplateField[] fields;
        string exampleJSON;
        bool isActive;
        address creator;
        uint256 createdAt;
    }

    // Events
    event TemplateRegistered(
        uint256 indexed templateId,
        string name,
        string projectType,
        address indexed creator,
        uint256 timestamp
    );

    event TemplateUpdated(
        uint256 indexed templateId,
        string name,
        uint256 timestamp
    );

    event TemplateDeactivated(uint256 indexed templateId, uint256 timestamp);

    // State variables
    ProjectTemplate[] public templates;
    mapping(string => uint256[]) public templatesByType; // projectType => templateId[]
    mapping(address => uint256[]) public templatesByCreator; // creator => templateId[]
    
    constructor() {
        // Initialize with predefined templates
        _createFederatedLearningTemplate();
        _createResearchCollaborationTemplate();
    }

    function _createFederatedLearningTemplate() internal {
        string[] memory roles = new string[](3);
        roles[0] = "data_owner";
        roles[1] = "aggregator";
        roles[2] = "coordinator";

        string memory exampleJSON = '{"project_id":"fl-cancer-study-01","type":"federated_learning","objective":"Cancer study AI","roles":["data_owner","aggregator","coordinator"],"participants":[{"id":"0xABC","role":"data_owner"},{"id":"0xDEF","role":"aggregator"}],"assets":{"datasets":["ipfs://QmData1","ipfs://QmData2"],"scripts":["ipfs://QmTrainScript"]},"workflow":{"steps":[{"step":"local_training","executor":"0xABC"},{"step":"aggregation","executor":"0xDEF"}]},"policies":{"access":{"0xDEF":["view_results"],"0xABC":["execute_step_1"]}}}';

        uint256 templateId = templates.length;
        templates.push();
        ProjectTemplate storage template = templates[templateId];
        
        template.name = "Federated Learning";
        template.description = "Collaborative machine learning where data remains distributed";
        template.projectType = "federated_learning";
        template.participantRoles = roles;
        template.exampleJSON = exampleJSON;
        template.isActive = true;
        template.creator = address(this);
        template.createdAt = block.timestamp;

        // Add fields
        template.fields.push(TemplateField("project_id", "string", true, ""));
        template.fields.push(TemplateField("type", "string", true, "federated_learning"));
        template.fields.push(TemplateField("objective", "string", true, ""));
        template.fields.push(TemplateField("roles", "array", true, '["data_owner","aggregator","coordinator"]'));
        template.fields.push(TemplateField("participants", "array", true, "[]"));
        template.fields.push(TemplateField("assets", "object", true, '{"datasets":[],"scripts":[]}'));
        template.fields.push(TemplateField("workflow", "object", true, '{"steps":[]}'));
        template.fields.push(TemplateField("policies", "object", true, '{"access":{}}'));

        templatesByType["federated_learning"].push(templateId);
        templatesByCreator[address(this)].push(templateId);

        emit TemplateRegistered(templateId, "Federated Learning", "federated_learning", address(this), block.timestamp);
    }


    function _createResearchCollaborationTemplate() internal {
        string[] memory roles = new string[](3);
        roles[0] = "researcher";
        roles[1] = "reviewer";
        roles[2] = "coordinator";

        string memory exampleJSON = '{"project_id":"research-collab-01","type":"research_collaboration","objective":"Climate change research","roles":["researcher","reviewer","coordinator"],"participants":[{"id":"0xABC","role":"researcher"},{"id":"0xDEF","role":"reviewer"}],"research_areas":["climate","environment"],"publications":[],"milestones":[{"name":"Data collection","deadline":"2025-12-31","completed":false}]}';

        uint256 templateId = templates.length;
        templates.push();
        ProjectTemplate storage template = templates[templateId];
        
        template.name = "Research Collaboration";
        template.description = "Academic and research collaboration platform";
        template.projectType = "research_collaboration";
        template.participantRoles = roles;
        template.exampleJSON = exampleJSON;
        template.isActive = true;
        template.creator = address(this);
        template.createdAt = block.timestamp;

        // Add fields
        template.fields.push(TemplateField("project_id", "string", true, ""));
        template.fields.push(TemplateField("type", "string", true, "research_collaboration"));
        template.fields.push(TemplateField("objective", "string", true, ""));
        template.fields.push(TemplateField("roles", "array", true, '["researcher","reviewer","coordinator"]'));
        template.fields.push(TemplateField("participants", "array", true, "[]"));
        template.fields.push(TemplateField("research_areas", "array", true, "[]"));
        template.fields.push(TemplateField("publications", "array", false, "[]"));
        template.fields.push(TemplateField("milestones", "array", false, "[]"));

        templatesByType["research_collaboration"].push(templateId);
        templatesByCreator[address(this)].push(templateId);

        emit TemplateRegistered(templateId, "Research Collaboration", "research_collaboration", address(this), block.timestamp);
    }

    // Get template by ID
    function getTemplate(uint256 _templateId) external view returns (
        string memory name,
        string memory description,
        string memory projectType,
        string[] memory participantRoles,
        string memory exampleJSON,
        bool isActive
    ) {
        require(_templateId < templates.length, "Template does not exist");
        ProjectTemplate memory template = templates[_templateId];
        return (
            template.name,
            template.description,
            template.projectType,
            template.participantRoles,
            template.exampleJSON,
            template.isActive
        );
    }

    // Get template fields
    function getTemplateFields(uint256 _templateId) external view returns (
        string[] memory fieldNames,
        string[] memory fieldTypes,
        bool[] memory isRequired,
        string[] memory defaultValues
    ) {
        require(_templateId < templates.length, "Template does not exist");
        ProjectTemplate storage template = templates[_templateId];
        
        uint256 fieldCount = template.fields.length;
        fieldNames = new string[](fieldCount);
        fieldTypes = new string[](fieldCount);
        isRequired = new bool[](fieldCount);
        defaultValues = new string[](fieldCount);
        
        for (uint256 i = 0; i < fieldCount; i++) {
            fieldNames[i] = template.fields[i].fieldName;
            fieldTypes[i] = template.fields[i].fieldType;
            isRequired[i] = template.fields[i].isRequired;
            defaultValues[i] = template.fields[i].defaultValue;
        }
    }

    // Get all templates
    function getAllTemplates() external view returns (uint256[] memory) {
        uint256[] memory templateIds = new uint256[](templates.length);
        for (uint256 i = 0; i < templates.length; i++) {
            templateIds[i] = i;
        }
        return templateIds;
    }

    // Get templates by type
    function getTemplatesByType(string memory _projectType) external view returns (uint256[] memory) {
        return templatesByType[_projectType];
    }

    // Get template count
    function getTemplateCount() external view returns (uint256) {
        return templates.length;
    }

    // Create new template (public function)
    function createTemplate(
        string memory _name,
        string memory _description,
        string memory _projectType,
        string[] memory _participantRoles,
        string memory _exampleJSON
    ) external returns (uint256) {
        require(bytes(_name).length > 0, "Template name cannot be empty");
        require(bytes(_projectType).length > 0, "Project type cannot be empty");

        uint256 templateId = templates.length;
        templates.push();
        ProjectTemplate storage template = templates[templateId];
        
        template.name = _name;
        template.description = _description;
        template.projectType = _projectType;
        template.participantRoles = _participantRoles;
        template.exampleJSON = _exampleJSON;
        template.isActive = true;
        template.creator = msg.sender;
        template.createdAt = block.timestamp;

        templatesByType[_projectType].push(templateId);
        templatesByCreator[msg.sender].push(templateId);

        emit TemplateRegistered(templateId, _name, _projectType, msg.sender, block.timestamp);
        
        return templateId;
    }

    // Add field to template
    function addTemplateField(
        uint256 _templateId,
        string memory _fieldName,
        string memory _fieldType,
        bool _isRequired,
        string memory _defaultValue
    ) external {
        require(_templateId < templates.length, "Template does not exist");
        require(templates[_templateId].creator == msg.sender, "Only template creator can add fields");
        
        templates[_templateId].fields.push(TemplateField(_fieldName, _fieldType, _isRequired, _defaultValue));
    }

    // Deactivate template
    function deactivateTemplate(uint256 _templateId) external {
        require(_templateId < templates.length, "Template does not exist");
        require(templates[_templateId].creator == msg.sender, "Only template creator can deactivate");
        
        templates[_templateId].isActive = false;
        emit TemplateDeactivated(_templateId, block.timestamp);
    }
}
