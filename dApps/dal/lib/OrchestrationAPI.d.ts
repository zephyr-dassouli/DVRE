/**
 * Orchestration API Client for DVRE DAL Extension
 * Handles communication with the DVRE Orchestration Server
 */
import { CWLWorkflow, ALConfiguration } from './CWLManager';
export interface WorkflowSubmissionData {
    project_id: string;
    cwl_workflow: string | CWLWorkflow;
    inputs: Record<string, any>;
    metadata: {
        creator: string;
        project_title: string;
        al_config?: ALConfiguration;
        contributors?: string[];
        [key: string]: any;
    };
    user_wallet: string;
    user_role: 'coordinator' | 'contributor' | 'observer';
    contract_address: string;
}
export interface WorkflowStatus {
    workflow_id: string;
    project_id?: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    created_at: string;
    started_at?: string;
    completed_at?: string;
    output?: string;
    error?: string;
    metadata?: Record<string, any>;
    submitted_by: string;
    accessible_to: string[];
}
export interface WorkflowListResponse {
    workflows: WorkflowStatus[];
    total_count?: number;
}
export interface ProjectWorkflowsResponse {
    project_id: string;
    workflows: WorkflowStatus[];
    total_count: number;
}
export interface ALEngineCommand {
    command_type: 'start_querying' | 'continue_querying' | 'prompt_training' | 'submit_labels' | 'terminate_project';
    project_id: string;
    workflow_id: string;
    parameters?: Record<string, any>;
    timestamp: string;
    user_wallet: string;
    user_role: 'coordinator' | 'contributor' | 'observer';
    contract_address: string;
}
export interface ALEngineResponse {
    command_id: string;
    status: 'accepted' | 'rejected' | 'completed' | 'failed';
    message?: string;
    data?: Record<string, any>;
    timestamp: string;
}
export interface QueryingSession {
    session_id: string;
    project_id: string;
    workflow_id: string;
    status: 'active' | 'waiting_for_labels' | 'training' | 'completed';
    current_round: number;
    total_rounds: number;
    queried_samples: any[];
    accuracy_metrics?: Record<string, number>;
}
export declare class OrchestrationAPI {
    private baseUrl;
    private defaultTimeout;
    private developmentMode;
    constructor(baseUrl?: string);
    /**
     * Enable development mode with mock responses
     */
    enableDevelopmentMode(): void;
    /**
     * Determine user role based on DVRE project data
     */
    private getUserRole;
    /**
     * Create authenticated workflow submission with user context
     */
    createAuthenticatedSubmission(projectId: string, projectTitle: string, cwlWorkflow: CWLWorkflow, alConfig: ALConfiguration, userWallet: string, projectData: any, inputs?: Record<string, any>): WorkflowSubmissionData;
    /**
     * Create authenticated AL engine command with user context
     */
    createAuthenticatedCommand(commandType: ALEngineCommand['command_type'], projectId: string, workflowId: string, userWallet: string, projectData: any, parameters?: Record<string, any>): ALEngineCommand;
    /**
     * Submit a project workflow to the orchestration server (Phase 1)
     */
    submitProjectWorkflow(data: WorkflowSubmissionData): Promise<{
        workflow_id: string;
        project_id: string;
        status: string;
        message: string;
    }>;
    /**
     * Submit a basic workflow (backward compatibility)
     */
    submitWorkflow(cwlWorkflow: string, inputs?: Record<string, any>): Promise<{
        workflow_id: string;
        status: string;
    }>;
    /**
     * Get workflow status by ID
     */
    getWorkflowStatus(workflowId: string): Promise<WorkflowStatus>;
    /**
     * List all workflows, optionally filtered by project
     */
    listWorkflows(projectId?: string): Promise<WorkflowListResponse>;
    /**
     * Get all workflows for a specific project
     */
    getProjectWorkflows(projectId: string): Promise<ProjectWorkflowsResponse>;
    /**
     * Start a new querying session (Phase 2)
     */
    startQuerying(projectId: string, workflowId: string, parameters?: {
        query_count?: number;
        strategy_override?: string;
    }): Promise<ALEngineResponse>;
    /**
     * Continue querying in an existing session
     */
    continueQuerying(projectId: string, workflowId: string, sessionId: string): Promise<ALEngineResponse>;
    /**
     * Prompt training with current labeled data
     */
    promptTraining(projectId: string, workflowId: string, parameters: {
        session_id: string;
        training_config?: Record<string, any>;
    }): Promise<ALEngineResponse>;
    /**
     * Submit new labels for queried samples
     */
    submitLabels(projectId: string, workflowId: string, labels: {
        session_id: string;
        labeled_samples: Array<{
            sample_id: string;
            label: any;
            confidence?: number;
            contributor?: string;
        }>;
    }): Promise<ALEngineResponse>;
    /**
     * Get current querying session status
     */
    getQueryingSession(projectId: string, sessionId: string): Promise<QueryingSession>;
    /**
     * List all active querying sessions for a project
     */
    listQueryingSessions(projectId: string): Promise<QueryingSession[]>;
    /**
     * Terminate a project and clean up resources
     */
    terminateProject(projectId: string, workflowId: string): Promise<ALEngineResponse>;
    /**
     * Check if the orchestration server is healthy and responding
     */
    checkServerHealth(): Promise<boolean>;
    /**
     * Get server information and API documentation
     */
    getServerInfo(): Promise<any>;
    /**
     * Poll workflow status until completion
     */
    pollWorkflowUntilComplete(workflowId: string, intervalMs?: number, maxAttempts?: number): Promise<WorkflowStatus>;
    /**
     * Validate workflow inputs before submission
     */
    validateInputs(cwlWorkflow: CWLWorkflow, inputs: Record<string, any>): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    };
    /**
     * Get multi-user session statistics for a project
     */
    getMultiUserSessionStats(projectId: string, userWallet: string, projectData: any): Promise<any>;
    /**
     * Send invitation to a contributor (placeholder for future implementation)
     */
    sendContributorInvitation(invitation: {
        projectId: string;
        contributorWallet?: string;
        contributorEmail?: string;
        invitedBy: string;
        message?: string;
    }, userWallet: string, projectData: any): Promise<any>;
    /**
     * Remove contributor from project (placeholder for future implementation)
     */
    removeContributor(projectId: string, contributorWallet: string, userWallet: string, projectData: any): Promise<any>;
    private makeRequest;
}
export declare const orchestrationAPI: OrchestrationAPI;
