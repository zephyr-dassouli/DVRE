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
  // User authentication
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
  // User tracking
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

// Runtime orchestration interfaces for AL-engine communication
export interface ALEngineCommand {
  command_type: 'start_querying' | 'continue_querying' | 'prompt_training' | 'submit_labels' | 'terminate_project';
  project_id: string;
  workflow_id: string;
  parameters?: Record<string, any>;
  timestamp: string;
  // User authentication for commands
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

export class OrchestrationAPI {
  private baseUrl: string;
  private defaultTimeout: number = 30000; // 30 seconds
  private developmentMode: boolean = false;

  constructor(baseUrl: string = 'http://145.100.135.97:5004') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Enable development mode with mock responses
   */
  enableDevelopmentMode() {
    this.developmentMode = true;
    console.log('DAL: Orchestration API running in development mode with mock responses');
  }

  /**
   * Determine user role based on DVRE project data
   */
  private getUserRole(userWallet: string, projectData: any): 'coordinator' | 'contributor' | 'observer' {
    const userAddress = userWallet.toLowerCase();
    
    // Check if user is the project creator (coordinator)
    if (projectData.creator && projectData.creator.toLowerCase() === userAddress) {
      return 'coordinator';
    }
    
    // Check if user is in participants list (contributor)
    if (projectData.participants && Array.isArray(projectData.participants)) {
      const isParticipant = projectData.participants.some(
        (p: any) => p.address && p.address.toLowerCase() === userAddress
      );
      if (isParticipant) {
        return 'contributor';
      }
    }
    
    // Check if user is a member (from DVRE integration)
    if (projectData.isMember || projectData.isOwner) {
      return projectData.isOwner ? 'coordinator' : 'contributor';
    }
    
    // Default to observer
    return 'observer';
  }

  /**
   * Create authenticated workflow submission with user context
   */
  createAuthenticatedSubmission(
    projectId: string,
    projectTitle: string,
    cwlWorkflow: CWLWorkflow,
    alConfig: ALConfiguration,
    userWallet: string,
    projectData: any,
    inputs: Record<string, any> = {}
  ): WorkflowSubmissionData {
    const userRole = this.getUserRole(userWallet, projectData);
    
    return {
      project_id: projectId,
      cwl_workflow: cwlWorkflow,
      inputs: {
        dataset: inputs.dataset || 'default_dataset.csv',
        query_strategy: alConfig.queryStrategy,
        model_config: JSON.stringify(alConfig.modelConfig),
        labeling_budget: alConfig.labelingBudget,
        max_iterations: alConfig.maxIterations,
        validation_split: alConfig.validationSplit || 0.2,
        ...inputs
      },
      metadata: {
        creator: userWallet,
        project_title: projectTitle,
        al_config: alConfig,
        contributors: alConfig.contributors,
        // Phase 1 metadata
        configuration_phase: 'finalized',
        smart_contract_address: projectData.address || projectId,
        ipfs_dataset_hash: inputs.ipfs_dataset_hash,
        ipfs_model_hash: inputs.ipfs_model_hash,
        // User context
        submitted_by: userWallet,
        user_role: userRole,
        project_creator: projectData.creator,
        project_participants: projectData.participants || []
      },
      // User authentication
      user_wallet: userWallet,
      user_role: userRole,
      contract_address: projectData.address || projectId
    };
  }

  /**
   * Create authenticated AL engine command with user context
   */
  createAuthenticatedCommand(
    commandType: ALEngineCommand['command_type'],
    projectId: string,
    workflowId: string,
    userWallet: string,
    projectData: any,
    parameters: Record<string, any> = {}
  ): ALEngineCommand {
    const userRole = this.getUserRole(userWallet, projectData);
    
    return {
      command_type: commandType,
      project_id: projectId,
      workflow_id: workflowId,
      parameters: parameters,
      timestamp: new Date().toISOString(),
      // User authentication
      user_wallet: userWallet,
      user_role: userRole,
      contract_address: projectData.address || projectId
    };
  }

  /**
   * Submit a project workflow to the orchestration server (Phase 1)
   */
  async submitProjectWorkflow(data: WorkflowSubmissionData): Promise<{
    workflow_id: string;
    project_id: string;
    status: string;
    message: string;
  }> {
    if (this.developmentMode) {
      // Mock response for development
      const mockWorkflowId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      return {
        workflow_id: mockWorkflowId,
        project_id: data.project_id,
        status: 'SUBMITTED',
        message: 'Workflow submitted successfully (development mode)'
      };
    }

    try {
      const response = await this.makeRequest('/streamflow/submit-project-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 500) {
          console.warn('DAL: Streamflow extension not available, enabling development mode');
          this.enableDevelopmentMode();
          return this.submitProjectWorkflow(data); // Retry with development mode
        }
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.message.includes('streamflow extension')) {
        throw error; // Re-throw our custom error
      }
      console.warn('DAL: Server error, enabling development mode:', error.message);
      this.enableDevelopmentMode();
      return this.submitProjectWorkflow(data); // Retry with development mode
    }
  }

  /**
   * Submit a basic workflow (backward compatibility)
   */
  async submitWorkflow(cwlWorkflow: string, inputs: Record<string, any> = {}): Promise<{
    workflow_id: string;
    status: string;
  }> {
    const response = await this.makeRequest('/streamflow/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cwl_workflow: cwlWorkflow,
        inputs: inputs
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get workflow status by ID
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus> {
    if (this.developmentMode) {
      // Mock workflow status for development
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (workflowId.startsWith('mock-')) {
        return {
          workflow_id: workflowId,
          project_id: 'mock-project',
          status: Math.random() > 0.5 ? 'COMPLETED' : 'RUNNING',
          created_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          started_at: new Date(Date.now() - Math.random() * 1800000).toISOString(),
          completed_at: Math.random() > 0.3 ? new Date().toISOString() : undefined,
          output: 'Mock workflow execution completed successfully',
          metadata: {
            phase: 'configuration',
            creator: 'development-user'
          },
          submitted_by: 'development-user',
          accessible_to: ['development-user']
        };
      }
    }

    const response = await this.makeRequest(`/streamflow/status/${workflowId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Workflow not found');
      }
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List all workflows, optionally filtered by project
   */
  async listWorkflows(projectId?: string): Promise<WorkflowListResponse> {
    const url = projectId 
      ? `/streamflow/workflows?project_id=${encodeURIComponent(projectId)}`
      : '/streamflow/workflows';
      
    const response = await this.makeRequest(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all workflows for a specific project
   */
  async getProjectWorkflows(projectId: string): Promise<ProjectWorkflowsResponse> {
    const response = await this.makeRequest(`/streamflow/projects/${encodeURIComponent(projectId)}/workflows`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Phase 2: Runtime Orchestration Methods for AL-engine interaction

  /**
   * Start a new querying session (Phase 2)
   */
  async startQuerying(projectId: string, workflowId: string, parameters: {
    query_count?: number;
    strategy_override?: string;
  } = {}): Promise<ALEngineResponse> {
    const command: ALEngineCommand = {
      command_type: 'start_querying',
      project_id: projectId,
      workflow_id: workflowId,
      parameters: parameters,
      timestamp: new Date().toISOString(),
      // User authentication for commands
      user_wallet: 'development-user', // Placeholder, replace with actual user
      user_role: 'coordinator', // Placeholder, replace with actual user role
      contract_address: '0x0000000000000000000000000000000000000000' // Placeholder, replace with actual contract address
    };

    const response = await this.makeRequest('/al-engine/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Continue querying in an existing session
   */
  async continueQuerying(projectId: string, workflowId: string, sessionId: string): Promise<ALEngineResponse> {
    const command: ALEngineCommand = {
      command_type: 'continue_querying',
      project_id: projectId,
      workflow_id: workflowId,
      parameters: { session_id: sessionId },
      timestamp: new Date().toISOString(),
      // User authentication for commands
      user_wallet: 'development-user', // Placeholder, replace with actual user
      user_role: 'coordinator', // Placeholder, replace with actual user role
      contract_address: '0x0000000000000000000000000000000000000000' // Placeholder, replace with actual contract address
    };

    const response = await this.makeRequest('/al-engine/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Prompt training with current labeled data
   */
  async promptTraining(projectId: string, workflowId: string, parameters: {
    session_id: string;
    training_config?: Record<string, any>;
  }): Promise<ALEngineResponse> {
    const command: ALEngineCommand = {
      command_type: 'prompt_training',
      project_id: projectId,
      workflow_id: workflowId,
      parameters: parameters,
      timestamp: new Date().toISOString(),
      // User authentication for commands
      user_wallet: 'development-user', // Placeholder, replace with actual user
      user_role: 'coordinator', // Placeholder, replace with actual user role
      contract_address: '0x0000000000000000000000000000000000000000' // Placeholder, replace with actual contract address
    };

    const response = await this.makeRequest('/al-engine/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Submit new labels for queried samples
   */
  async submitLabels(projectId: string, workflowId: string, labels: {
    session_id: string;
    labeled_samples: Array<{
      sample_id: string;
      label: any;
      confidence?: number;
      contributor?: string;
    }>;
  }): Promise<ALEngineResponse> {
    const command: ALEngineCommand = {
      command_type: 'submit_labels',
      project_id: projectId,
      workflow_id: workflowId,
      parameters: labels,
      timestamp: new Date().toISOString(),
      // User authentication for commands
      user_wallet: 'development-user', // Placeholder, replace with actual user
      user_role: 'coordinator', // Placeholder, replace with actual user role
      contract_address: '0x0000000000000000000000000000000000000000' // Placeholder, replace with actual contract address
    };

    const response = await this.makeRequest('/al-engine/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get current querying session status
   */
  async getQueryingSession(projectId: string, sessionId: string): Promise<QueryingSession> {
    const response = await this.makeRequest(
      `/al-engine/sessions/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}`
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List all active querying sessions for a project
   */
  async listQueryingSessions(projectId: string): Promise<QueryingSession[]> {
    const response = await this.makeRequest(`/al-engine/sessions/${encodeURIComponent(projectId)}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.sessions || [];
  }

  /**
   * Terminate a project and clean up resources
   */
  async terminateProject(projectId: string, workflowId: string): Promise<ALEngineResponse> {
    const command: ALEngineCommand = {
      command_type: 'terminate_project',
      project_id: projectId,
      workflow_id: workflowId,
      parameters: {},
      timestamp: new Date().toISOString(),
      // User authentication for commands
      user_wallet: 'development-user', // Placeholder, replace with actual user
      user_role: 'coordinator', // Placeholder, replace with actual user role
      contract_address: '0x0000000000000000000000000000000000000000' // Placeholder, replace with actual contract address
    };

    const response = await this.makeRequest('/al-engine/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if the orchestration server is healthy and responding
   */
  async checkServerHealth(): Promise<boolean> {
    try {
      // Check Jupyter server API which should always be available
      const response = await this.makeRequest('/api', { timeout: 5000 });
      return response.ok;
    } catch (error) {
      console.warn('DAL: Server health check failed:', error);
      return false;
    }
  }

  /**
   * Get server information and API documentation
   */
  async getServerInfo(): Promise<any> {
    const response = await this.makeRequest('/');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Poll workflow status until completion
   */
  async pollWorkflowUntilComplete(
    workflowId: string, 
    intervalMs: number = 2000,
    maxAttempts: number = 150 // 5 minutes at 2-second intervals
  ): Promise<WorkflowStatus> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          const status = await this.getWorkflowStatus(workflowId);

          if (status.status === 'COMPLETED' || status.status === 'FAILED') {
            resolve(status);
            return;
          }

          if (attempts >= maxAttempts) {
            reject(new Error(`Workflow polling timeout after ${maxAttempts} attempts`));
            return;
          }

          // Continue polling
          setTimeout(poll, intervalMs);
        } catch (error) {
          reject(error);
        }
      };

      // Start polling
      poll();
    });
  }

  /**
   * Validate workflow inputs before submission
   */
  validateInputs(cwlWorkflow: CWLWorkflow, inputs: Record<string, any>): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!cwlWorkflow.inputs) {
      errors.push('CWL workflow has no inputs defined');
      return { valid: false, errors, warnings };
    }

    // Check required inputs
    for (const [inputName, inputDef] of Object.entries(cwlWorkflow.inputs)) {
      const hasDefault = inputDef.default !== undefined;
      const hasValue = inputs[inputName] !== undefined;

      if (!hasDefault && !hasValue) {
        errors.push(`Required input '${inputName}' is missing`);
      }

      // Type checking (basic)
      if (hasValue) {
        const expectedType = inputDef.type;
        const actualValue = inputs[inputName];

        if (expectedType === 'int' && !Number.isInteger(actualValue)) {
          errors.push(`Input '${inputName}' should be an integer`);
        } else if (expectedType === 'float' && typeof actualValue !== 'number') {
          errors.push(`Input '${inputName}' should be a number`);
        } else if (expectedType === 'string' && typeof actualValue !== 'string') {
          errors.push(`Input '${inputName}' should be a string`);
        }
      }
    }

    // Check for extra inputs
    for (const inputName of Object.keys(inputs)) {
      if (!cwlWorkflow.inputs[inputName]) {
        warnings.push(`Input '${inputName}' is not defined in the CWL workflow`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get multi-user session statistics for a project
   */
  async getMultiUserSessionStats(projectId: string, userWallet: string, projectData: any): Promise<any> {
    try {
      // Create authenticated command for session stats
      const response = await this.makeRequest(`/al-engine/session-stats/${encodeURIComponent(projectId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Wallet': userWallet,
          'X-User-Role': this.getUserRole(userWallet, projectData),
          'X-Contract-Address': projectData?.address || projectId
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No session found, return empty stats
          return {
            project_id: projectId,
            contributors: [],
            total_samples: 0,
            consensus_samples: 0,
            progress_percentage: 0
          };
        }
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.warn('Failed to get session stats:', error);
      // Return empty stats on error
      return {
        project_id: projectId,
        contributors: [],
        total_samples: 0,
        consensus_samples: 0,
        progress_percentage: 0
      };
    }
  }

  /**
   * Send invitation to a contributor (placeholder for future implementation)
   */
  async sendContributorInvitation(invitation: {
    projectId: string;
    contributorWallet?: string;
    contributorEmail?: string;
    invitedBy: string;
    message?: string;
  }, userWallet: string, projectData: any): Promise<any> {
    // TODO: Implement when server-side invitation system is ready
    const response = await this.makeRequest('/contributors/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...invitation,
        user_wallet: userWallet,
        user_role: this.getUserRole(userWallet, projectData),
        contract_address: projectData?.address || invitation.projectId
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Remove contributor from project (placeholder for future implementation)
   */
  async removeContributor(projectId: string, contributorWallet: string, userWallet: string, projectData: any): Promise<any> {
    // TODO: Implement when server-side contributor management is ready
    const response = await this.makeRequest('/contributors/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: projectId,
        contributor_wallet: contributorWallet,
        user_wallet: userWallet,
        user_role: this.getUserRole(userWallet, projectData),
        contract_address: projectData?.address || projectId
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Private methods

  private async makeRequest(endpoint: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
    const { timeout = this.defaultTimeout, ...fetchOptions } = options;
    const url = `${this.baseUrl}${endpoint}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }
}

// Export singleton instance with remote VM configuration
export const orchestrationAPI = new OrchestrationAPI(); 