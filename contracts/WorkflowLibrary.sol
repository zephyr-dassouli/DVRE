// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title WorkflowLibrary
 * @dev Library for workflow orchestration and tracking in decentralized applications
 * 
 * GENERAL-PURPOSE FUNCTIONS (used by all dApps):
 * - triggerWorkflow() / completeWorkflow() - Basic workflow execution tracking
 * - Workflow data structures and events
 * 
 * DAL-SPECIFIC FUNCTIONS (primarily for Decentralized Active Learning):
 * - makeSubmission() - For tracking data annotations and contributions
 * - checkConsensus() - For weighted voting on query selections and model updates
 * - getWorkflowTypeForPhase() - Maps AL phases to specific workflow types
 * 
 * FEDERATED LEARNING ADAPTATIONS:
 * - Can reuse workflow tracking for training rounds
 * - May use consensus for model aggregation decisions
 * - Submissions could track local model updates
 */
library WorkflowLibrary {
    // ========================================
    // GENERAL-PURPOSE WORKFLOW STRUCTURES
    // ========================================
    
    /**
     * @dev Core workflow execution tracking - used by all dApps
     */
    struct WorkflowExecution {
        bytes32 workflowId;
        string workflowType;        // e.g., "query_selection", "federated_training", "data_processing"
        string parameters;
        uint256 startTime;
        uint256 endTime;
        bool isCompleted;
        bool success;
        string resultHash;          // IPFS hash of workflow results
    }
    
    /**
     * @dev Participant submission tracking - primarily for DAL, adaptable for FL
     * DAL use case: Data annotations, query selections, model evaluations
     * FL use case: Local model updates, training metrics, validation results
     */
    struct Submission {
        address contributor;
        string dataHash;            // IPFS hash of submitted data
        string submissionHash;      // IPFS hash of the submission itself
        uint256 timestamp;
        uint256 confidence;         // DAL: annotation confidence, FL: model accuracy
        string submissionType;      // DAL: "annotation", "query", FL: "model_update", "metrics"
    }
    
    /**
     * @dev Consensus voting system - useful for both DAL and FL
     * DAL use case: Voting on query selections, model acceptance
     * FL use case: Voting on aggregation strategies, round completion
     */
    struct ConsensusVote {
        address voter;
        string proposalHash;        // IPFS hash of the proposal being voted on
        bool support;
        uint256 timestamp;
        string reason;              // Optional justification
    }
    
    // ========================================
    // GENERAL-PURPOSE EVENTS
    // ========================================
    
    event WorkflowTriggered(string workflowType, bytes32 indexed workflowId, string parameters);
    event WorkflowCompleted(bytes32 indexed workflowId, bool success, string resultHash);
    event SubmissionMade(address indexed contributor, string dataHash, string submissionType);
    event ConsensusReached(bytes32 indexed proposalHash, bool approved, uint256 totalVotes);
    
    // ========================================
    // GENERAL-PURPOSE WORKFLOW FUNCTIONS
    // ========================================
    
    /**
     * @dev Trigger a new workflow execution - GENERAL PURPOSE
     * @param workflows Storage mapping for workflow executions
     * @param activeWorkflows Storage mapping for active workflow tracking
     * @param workflowHistory Storage array for workflow history
     * @param _workflowType Type of workflow (e.g., "query_selection", "federated_training")
     * @param _parameters JSON parameters for the workflow
     * @return workflowId Unique identifier for the workflow
     */
    function triggerWorkflow(
        mapping(bytes32 => WorkflowExecution) storage workflows,
        mapping(bytes32 => bool) storage activeWorkflows,
        bytes32[] storage workflowHistory,
        string memory _workflowType,
        string memory _parameters
    ) external returns (bytes32) {
        bytes32 workflowId = keccak256(abi.encodePacked(
            _workflowType,
            _parameters,
            block.timestamp,
            msg.sender
        ));
        
        workflows[workflowId] = WorkflowExecution({
            workflowId: workflowId,
            workflowType: _workflowType,
            parameters: _parameters,
            startTime: block.timestamp,
            endTime: 0,
            isCompleted: false,
            success: false,
            resultHash: ""
        });
        
        activeWorkflows[workflowId] = true;
        workflowHistory.push(workflowId);
        
        emit WorkflowTriggered(_workflowType, workflowId, _parameters);
        
        return workflowId;
    }
    
    /**
     * @dev Complete a workflow execution - GENERAL PURPOSE
     * @param workflows Storage mapping for workflow executions
     * @param activeWorkflows Storage mapping for active workflow tracking
     * @param ipfsHashes Storage mapping for IPFS hash updates
     * @param _workflowId Unique workflow identifier
     * @param _success Whether the workflow completed successfully
     * @param _resultHash IPFS hash of the workflow results
     */
    function completeWorkflow(
        mapping(bytes32 => WorkflowExecution) storage workflows,
        mapping(bytes32 => bool) storage activeWorkflows,
        mapping(string => string) storage ipfsHashes,
        bytes32 _workflowId,
        bool _success,
        string memory _resultHash
    ) external {
        require(activeWorkflows[_workflowId], "Invalid or inactive workflow");
        
        workflows[_workflowId].endTime = block.timestamp;
        workflows[_workflowId].isCompleted = true;
        workflows[_workflowId].success = _success;
        workflows[_workflowId].resultHash = _resultHash;
        activeWorkflows[_workflowId] = false;
        
        // Update IPFS hashes based on workflow type - ADAPTABLE FOR DIFFERENT dApps
        if (_success && bytes(_resultHash).length > 0) {
            string memory workflowType = workflows[_workflowId].workflowType;
            
            // DAL-specific hash updates
            if (keccak256(abi.encodePacked(workflowType)) == keccak256(abi.encodePacked("model_training"))) {
                ipfsHashes["current_model"] = _resultHash;
            } else if (keccak256(abi.encodePacked(workflowType)) == keccak256(abi.encodePacked("query_selection"))) {
                ipfsHashes["current_queries"] = _resultHash;
            }
            // FL-specific hash updates could be added here:
            // else if (keccak256(abi.encodePacked(workflowType)) == keccak256(abi.encodePacked("federated_training"))) {
            //     ipfsHashes["global_model"] = _resultHash;
            // }
        }
        
        emit WorkflowCompleted(_workflowId, _success, _resultHash);
    }
    
    // ========================================
    // DAL-SPECIFIC FUNCTIONS
    // ========================================
    
    /**
     * @dev Record participant submissions - PRIMARILY FOR DAL
     * DAL use case: Data annotations, query selections, model evaluations
     * FL adaptation: Could track local model updates, training metrics
     * 
     * @param submissions Storage mapping for submission tracking
     * @param contributionScores Storage mapping for participant scoring
     * @param _dataHash IPFS hash of the data being submitted about
     * @param _submissionHash IPFS hash of the actual submission
     * @param _submissionType Type of submission (e.g., "annotation", "query", "model_update")
     * @param _confidence Confidence level (0-100)
     */
    function makeSubmission(
        mapping(bytes32 => Submission[]) storage submissions,
        mapping(address => uint256) storage contributionScores,
        string memory _dataHash,
        string memory _submissionHash,
        string memory _submissionType,
        uint256 _confidence
    ) external {
        require(bytes(_dataHash).length > 0, "Data hash cannot be empty");
        require(bytes(_submissionHash).length > 0, "Submission hash cannot be empty");
        require(bytes(_submissionType).length > 0, "Submission type cannot be empty");
        require(_confidence <= 100, "Invalid confidence value");
        
        bytes32 dataKey = keccak256(abi.encodePacked(_dataHash));
        
        submissions[dataKey].push(Submission({
            contributor: msg.sender,
            dataHash: _dataHash,
            submissionHash: _submissionHash,
            timestamp: block.timestamp,
            confidence: _confidence,
            submissionType: _submissionType
        }));
        
        // Update contribution score
        contributionScores[msg.sender] += 1;
        
        emit SubmissionMade(msg.sender, _dataHash, _submissionType);
    }
    
    /**
     * @dev Check if consensus has been reached - USEFUL FOR DAL AND FL
     * DAL use case: Consensus on query selections, model acceptance
     * FL use case: Consensus on aggregation strategies, round completion
     * 
     * @param consensusVotes Storage mapping for consensus votes
     * @param participantWeights Storage mapping for participant weights
     * @param participants Storage array of project participants
     * @param consensusThreshold Percentage threshold for consensus (0-100)
     * @param _proposalKey Unique key for the proposal
     * @param _proposalHash IPFS hash of the proposal
     * @return bool Whether consensus has been reached
     */
    function checkConsensus(
        mapping(bytes32 => ConsensusVote[]) storage consensusVotes,
        mapping(address => uint256) storage participantWeights,
        address[] storage participants,
        uint256 consensusThreshold,
        bytes32 _proposalKey,
        string memory _proposalHash
    ) external returns (bool) {
        ConsensusVote[] storage votes = consensusVotes[_proposalKey];
        uint256 totalWeight = 0;
        uint256 supportWeight = 0;
        
        // Calculate weighted votes
        for (uint256 i = 0; i < votes.length; i++) {
            uint256 voterWeight = participantWeights[votes[i].voter];
            totalWeight += voterWeight;
            if (votes[i].support) {
                supportWeight += voterWeight;
            }
        }
        
        // Check if enough participants voted and consensus reached
        if (votes.length >= participants.length / 2) {
            uint256 supportPercentage = (supportWeight * 100) / totalWeight;
            bool consensusReached = supportPercentage >= consensusThreshold;
            
            emit ConsensusReached(_proposalKey, consensusReached, votes.length);
            
            return consensusReached;
        }
        
        return false;
    }
    
    /**
     * @dev Get appropriate workflow type for project phase - DAL-SPECIFIC
     * This function maps project phases to specific workflow types for DAL projects.
     * Other dApps (like FL) would implement their own phase-to-workflow mapping.
     * 
     * @param projectType Type of project (0=GENERIC, 1=ACTIVE_LEARNING, 2=FEDERATED_LEARNING, 3=RESEARCH_COLLABORATION)
     * @param currentPhase Current workflow phase (0=SETUP, 1=ACTIVE, 2=CONSENSUS, 3=PROCESSING, 4=EVALUATION, 5=COMPLETED)
     * @return string Workflow type for the given phase
     */
    function getWorkflowTypeForPhase(uint8 projectType, uint8 currentPhase) external pure returns (string memory) {
        // ProjectType: 0=GENERIC, 1=ACTIVE_LEARNING, 2=FEDERATED_LEARNING, 3=RESEARCH_COLLABORATION
        // WorkflowPhase: 0=SETUP, 1=ACTIVE, 2=CONSENSUS, 3=PROCESSING, 4=EVALUATION, 5=COMPLETED
        
        if (projectType == 1) { // ACTIVE_LEARNING - DAL-specific workflows
            if (currentPhase == 1) return "query_selection";      // ACTIVE
            if (currentPhase == 3) return "model_training";       // PROCESSING
            if (currentPhase == 4) return "model_evaluation";     // EVALUATION
        } else if (projectType == 2) { // FEDERATED_LEARNING - FL-specific workflows
            if (currentPhase == 3) return "federated_training";   // PROCESSING
            if (currentPhase == 4) return "aggregation";          // EVALUATION
        }
        // Generic fallback for other project types
        return "generic_workflow";
    }
} 