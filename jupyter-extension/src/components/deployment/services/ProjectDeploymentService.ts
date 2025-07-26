/**
 * Project Deployment Service - Centralized deployment for all DVRE projects
 * Handles deployment to orchestration server after RO-Crate publication
 */

export interface DeploymentStatus {
  status: 'pending' | 'deploying' | 'deployed' | 'running' | 'failed';
  deployedAt?: string;
  orchestrationWorkflowId?: string;
  orchestrationUrl?: string;
  error?: string;
  lastUpdated: string;
}

export interface DeploymentConfig {
  orchestrationServerUrl: string;
  enableHealthChecks: boolean;
  deploymentTimeout: number;
  retryAttempts: number;
}

export interface OrchestrationRequest {
  project_id: string;
  cwl_workflow: string;
  inputs: Record<string, any>;
  metadata: {
    creator: string;
    project_title: string;
    contributors: string[];
    smart_contract_address: string;
    ipfs_dataset_hash?: string;
    ipfs_model_hash?: string;
    ipfs_rocrate_hash: string;
    ipfs_bundle_hash: string;
    configuration_phase: 'draft' | 'configured' | 'ready' | 'finalized';
    project_type: string;
    deployment_timestamp: string;
    al_config?: any;
  };
}

interface OrchestrationResponse {
  workflow_id: string;
  status: string;
  message?: string;
}

export class ProjectDeploymentService {
  private static instance: ProjectDeploymentService;
  private storagePrefix = 'dvre-deployment-status';
  
  // Default configuration
  private config: DeploymentConfig = {
    orchestrationServerUrl: 'http://145.100.135.97:5004', // From your VM
    enableHealthChecks: true,
    deploymentTimeout: 30000, // 30 seconds
    retryAttempts: 3
  };

  // In-memory cache for deployment statuses
  private deploymentCache = new Map<string, DeploymentStatus>();

  constructor() {
    // Load config from environment if available
    const envConfig = (window as any).__DVRE_CONFIG__?.ORCHESTRATION;
    if (envConfig) {
      this.config = { ...this.config, ...envConfig };
    }
    
    // Initialize from localStorage
    this.loadAllDeploymentStatuses();
  }

  static getInstance(): ProjectDeploymentService {
    if (!ProjectDeploymentService.instance) {
      ProjectDeploymentService.instance = new ProjectDeploymentService();
    }
    return ProjectDeploymentService.instance;
  }

  /**
   * Deploy a project to the orchestration server
   * This is called after successful IPFS publication
   */
  async deployProject(
    projectId: string,
    roCrateData: any,
    ipfsHashes: {
      roCrateHash: string;
      workflowHash?: string;
      bundleHash: string;
    },
    userAddress: string
  ): Promise<boolean> {
    console.log(`🚀 Starting deployment for project: ${projectId}`);
    
    try {
      // Update deployment status to 'deploying'
      this.updateDeploymentStatus(projectId, {
        status: 'deploying',
        lastUpdated: new Date().toISOString()
      });

      // Check orchestration server health first
      if (this.config.enableHealthChecks) {
        const isHealthy = await this.checkOrchestrationHealth();
        if (!isHealthy) {
          throw new Error('Orchestration server is not responding');
        }
      }

      // Extract CWL workflow and create orchestration request
      const orchestrationRequest = this.createOrchestrationRequest(
        projectId,
        roCrateData,
        ipfsHashes,
        userAddress
      );

      // Submit to orchestration server
      const response = await this.submitToOrchestration(orchestrationRequest);
      
      // Update deployment status with success
      this.updateDeploymentStatus(projectId, {
        status: 'deployed',
        deployedAt: new Date().toISOString(),
        orchestrationWorkflowId: response.workflow_id,
        orchestrationUrl: `${this.config.orchestrationServerUrl}/streamflow/status/${response.workflow_id}`,
        lastUpdated: new Date().toISOString()
      });

      console.log(`✅ Successfully deployed project ${projectId} (workflow: ${response.workflow_id})`);
      return true;

    } catch (error) {
      console.error(`❌ Deployment failed for project ${projectId}:`, error);
      
      // Update deployment status with failure
      this.updateDeploymentStatus(projectId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown deployment error',
        lastUpdated: new Date().toISOString()
      });
      
      return false;
    }
  }

  /**
   * Get deployment status for a project
   */
  getDeploymentStatus(projectId: string): DeploymentStatus | null {
    return this.deploymentCache.get(projectId) || null;
  }

  /**
   * Update deployment status (persisted to localStorage)
   */
  updateDeploymentStatus(projectId: string, updates: Partial<DeploymentStatus>): void {
    const existing = this.deploymentCache.get(projectId) || {
      status: 'pending' as const,
      lastUpdated: new Date().toISOString()
    };
    
    const updated = { ...existing, ...updates };
    
    // Update cache
    this.deploymentCache.set(projectId, updated);
    
    // Persist to localStorage
    const storageKey = `${this.storagePrefix}-${projectId}`;
    localStorage.setItem(storageKey, JSON.stringify(updated));
    
    console.log(`📊 Deployment status updated for ${projectId}:`, updated);
  }

  /**
   * Create orchestration request from RO-Crate data
   */
  private createOrchestrationRequest(
    projectId: string,
    roCrateData: any,
    ipfsHashes: { roCrateHash: string; workflowHash?: string; bundleHash: string },
    userAddress: string
  ): OrchestrationRequest {
    // Extract main workflow from RO-Crate
    const workflows = roCrateData['@graph']?.filter((item: any) => 
      item['@type']?.includes?.('ComputationalWorkflow') || 
      item['@id']?.endsWith?.('.cwl')
    ) || [];
    
    const mainWorkflow = workflows[0];
    if (!mainWorkflow) {
      throw new Error('No CWL workflow found in RO-Crate');
    }

    // Extract project metadata
    const rootDataEntity = roCrateData['@graph']?.find((item: any) => item['@id'] === './') || {};
    const projectTitle = rootDataEntity.name || `Project ${projectId}`;

    // Extract AL configuration if present
    const alConfig = this.extractALConfiguration(roCrateData);

    // Create inputs from RO-Crate datasets and AL config
    const inputs = this.createWorkflowInputs(roCrateData, alConfig, ipfsHashes);

    return {
      project_id: projectId,
      cwl_workflow: mainWorkflow.text || JSON.stringify(mainWorkflow, null, 2),
      inputs,
      metadata: {
        creator: userAddress,
        project_title: projectTitle,
        al_config: alConfig,
        contributors: rootDataEntity.contributor?.map((c: any) => c['@id'] || c) || [],
        smart_contract_address: projectId, // Assuming projectId is contract address
        ipfs_dataset_hash: this.extractDatasetHash(roCrateData),
        ipfs_model_hash: this.extractModelHash(roCrateData),
        ipfs_rocrate_hash: ipfsHashes.roCrateHash,
        ipfs_bundle_hash: ipfsHashes.bundleHash,
        configuration_phase: 'finalized' as const,
        project_type: this.extractProjectType(roCrateData),
        deployment_timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Submit orchestration request to server
   */
  private async submitToOrchestration(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const endpoint = `${this.config.orchestrationServerUrl}/api/projects/deploy`;
    
    console.log(`📡 Submitting to orchestration server: ${endpoint}`);
    console.log('📄 Request payload:', {
      project_id: request.project_id,
      workflow_size: request.cwl_workflow.length,
      inputs_count: Object.keys(request.inputs).length,
      metadata: request.metadata
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.deploymentTimeout);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Orchestration server error: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Orchestration deployment successful:', result);
      return result;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Deployment timeout - orchestration server did not respond in time');
      }
      throw error;
    }
  }

  /**
   * Check orchestration server health
   */
  private async checkOrchestrationHealth(): Promise<boolean> {
    try {
      const healthEndpoint = `${this.config.orchestrationServerUrl}/health`;
      const response = await fetch(healthEndpoint, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.warn('Orchestration server health check failed:', error);
      return false;
    }
  }

  /**
   * Extract AL configuration from RO-Crate
   */
  private extractALConfiguration(roCrateData: any): any {
    // Look for AL configuration in various places in the RO-Crate
    const graphs = roCrateData['@graph'] || [];
    
    // Check for AL-specific metadata in root dataset
    const rootDataset = graphs.find((item: any) => item['@id'] === './');
    if (rootDataset?.al_config) {
      return rootDataset.al_config;
    }

    // Check for AL workflow parameters
    const alWorkflows = graphs.filter((item: any) => 
      item['@type']?.includes?.('ComputationalWorkflow') && 
      (item.name?.toLowerCase().includes('active learning') || 
       item.description?.toLowerCase().includes('active learning'))
    );

    if (alWorkflows.length > 0) {
      return {
        detected_from: 'workflow',
        workflow_name: alWorkflows[0].name,
        workflow_description: alWorkflows[0].description
      };
    }

    return null;
  }

  /**
   * Create workflow inputs from RO-Crate data
   */
  private createWorkflowInputs(roCrateData: any, alConfig: any, ipfsHashes: any): Record<string, any> {
    const inputs: Record<string, any> = {};

    // Add IPFS hashes as inputs
    inputs.rocrate_hash = ipfsHashes.roCrateHash;
    inputs.bundle_hash = ipfsHashes.bundleHash;
    if (ipfsHashes.workflowHash) {
      inputs.workflow_hash = ipfsHashes.workflowHash;
    }

    // Extract datasets from RO-Crate
    const datasets = roCrateData['@graph']?.filter((item: any) => item['@type'] === 'Dataset') || [];
    if (datasets.length > 0) {
      inputs.datasets = datasets.map((ds: any) => ({
        id: ds['@id'],
        name: ds.name,
        url: ds.contentUrl,
        format: ds.encodingFormat
      }));
    }

    // Add AL-specific inputs if available
    if (alConfig) {
      inputs.al_config = alConfig;
    }

    return inputs;
  }

  /**
   * Extract dataset hash from RO-Crate (utility)
   */
  private extractDatasetHash(roCrateData: any): string | undefined {
    const datasets = roCrateData['@graph']?.filter((item: any) => item['@type'] === 'Dataset') || [];
    return datasets[0]?.contentUrl?.split('/').pop(); // Extract hash from IPFS URL
  }

  /**
   * Extract model hash from RO-Crate (utility)
   */
  private extractModelHash(roCrateData: any): string | undefined {
    const models = roCrateData['@graph']?.filter((item: any) => 
      item['@type']?.includes?.('SoftwareSourceCode') && 
      item.name?.toLowerCase().includes('model')
    ) || [];
    return models[0]?.contentUrl?.split('/').pop(); // Extract hash from IPFS URL
  }

  /**
   * Extract project type from RO-Crate (utility)
   */
  private extractProjectType(roCrateData: any): string {
    const rootDataset = roCrateData['@graph']?.find((item: any) => item['@id'] === './');
    
    // Check keywords for project type
    const keywords = rootDataset?.keywords || [];
    if (keywords.includes('active learning') || keywords.includes('AL')) {
      return 'active_learning';
    }
    if (keywords.includes('federated learning') || keywords.includes('FL')) {
      return 'federated_learning';
    }
    
    return 'general';
  }

  /**
   * Load all deployment statuses from localStorage
   */
  private loadAllDeploymentStatuses(): void {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.storagePrefix)) {
        try {
          const projectId = key.replace(`${this.storagePrefix}-`, '');
          const status = JSON.parse(localStorage.getItem(key)!);
          this.deploymentCache.set(projectId, status);
        } catch (error) {
          console.warn('Failed to load deployment status from localStorage:', key, error);
        }
      }
    }
  }

  /**
   * Monitor workflow status (optional polling)
   */
  async monitorWorkflowStatus(projectId: string): Promise<DeploymentStatus | null> {
    const currentStatus = this.getDeploymentStatus(projectId);
    if (!currentStatus?.orchestrationWorkflowId) {
      return currentStatus;
    }

    try {
      const statusEndpoint = `${this.config.orchestrationServerUrl}/api/workflows/${currentStatus.orchestrationWorkflowId}/status`;
      const response = await fetch(statusEndpoint);
      
      if (response.ok) {
        const workflowStatus = await response.json();
        
        // Map orchestration status to our deployment status
        const mappedStatus = this.mapOrchestrationStatus(workflowStatus.status);
        
        if (mappedStatus !== currentStatus.status) {
          this.updateDeploymentStatus(projectId, {
            status: mappedStatus,
            lastUpdated: new Date().toISOString()
          });
          
          return this.getDeploymentStatus(projectId);
        }
      }
    } catch (error) {
      console.warn('Failed to monitor workflow status:', error);
    }

    return currentStatus;
  }

  /**
   * Map orchestration server status to our deployment status
   */
  private mapOrchestrationStatus(orchestrationStatus: string): DeploymentStatus['status'] {
    switch (orchestrationStatus?.toLowerCase()) {
      case 'running':
      case 'executing':
        return 'running';
      case 'completed':
      case 'success':
        return 'deployed';
      case 'failed':
      case 'error':
        return 'failed';
      case 'pending':
      case 'queued':
        return 'deploying';
      default:
        return 'deployed'; // Default to deployed if unknown
    }
  }

  /**
   * Check if a project is deployed
   */
  isProjectDeployed(projectId: string): boolean {
    const status = this.getDeploymentStatus(projectId);
    return status?.status === 'deployed' || status?.status === 'running';
  }

  /**
   * Get orchestration URL for a project
   */
  getOrchestrationUrl(projectId: string): string | null {
    const status = this.getDeploymentStatus(projectId);
    return status?.orchestrationUrl || null;
  }
}

export const projectDeploymentService = ProjectDeploymentService.getInstance(); 