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
  deploymentTimeout: number; // milliseconds
  retryAttempts: number;
}

export interface OrchestrationRequest {
  project_id: string;
  cwl_workflow: string;
  inputs: Record<string, any>;
  metadata: {
    creator: string;
    project_title: string;
    al_config?: any;
    contributors?: string[];
    smart_contract_address: string;
    ipfs_dataset_hash?: string;
    ipfs_model_hash?: string;
    ipfs_rocrate_hash: string;
    ipfs_bundle_hash: string;
    configuration_phase: 'finalized';
    project_type?: string;
    deployment_timestamp: string;
  };
}

export interface OrchestrationResponse {
  workflow_id: string;
  project_id: string;
  status: 'SUBMITTED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  message: string;
  phase: 'configuration_complete';
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
      
      // Update deployment status with error
      this.updateDeploymentStatus(projectId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        lastUpdated: new Date().toISOString()
      });

      return false;
    }
  }

  /**
   * Get deployment status for a project
   */
  getDeploymentStatus(projectId: string): DeploymentStatus | null {
    return this.deploymentCache.get(projectId) || this.loadDeploymentStatus(projectId);
  }

  /**
   * Check if orchestration server is healthy
   */
  private async checkOrchestrationHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.orchestrationServerUrl}/`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.warn('Orchestration server health check failed:', error);
      return false;
    }
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
   * Submit request to orchestration server
   */
  private async submitToOrchestration(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const response = await fetch(`${this.config.orchestrationServerUrl}/streamflow/submit-project-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Orchestration server responded with ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Extract AL configuration from RO-Crate
   */
  private extractALConfiguration(roCrateData: any): any {
    // Look for AL configuration in the RO-Crate metadata
    const configFiles = roCrateData['@graph']?.filter((item: any) => 
      item['@id']?.includes?.('inputs.yaml') || 
      item.name?.toLowerCase?.().includes?.('configuration')
    ) || [];

    for (const configFile of configFiles) {
      if (configFile.text) {
        try {
          // Try to parse YAML or JSON configuration
          const config = JSON.parse(configFile.text);
          if (config.query_strategy || config.AL_scenario) {
            return config;
          }
        } catch (e) {
          // If not JSON, might be YAML - basic parsing
          const text = configFile.text;
          if (text.includes('query_strategy') || text.includes('AL_scenario')) {
            return { raw_config: text };
          }
        }
      }
    }

    return null;
  }

  /**
   * Create workflow inputs from RO-Crate
   */
  private createWorkflowInputs(
    roCrateData: any,
    alConfig: any,
    ipfsHashes: { roCrateHash: string; workflowHash?: string; bundleHash: string }
  ): Record<string, any> {
    const inputs: Record<string, any> = {
      // Core IPFS references
      rocrate_hash: ipfsHashes.roCrateHash,
      bundle_hash: ipfsHashes.bundleHash
    };

    // Add workflow hash if available
    if (ipfsHashes.workflowHash) {
      inputs.workflow_hash = ipfsHashes.workflowHash;
    }

    // Add AL configuration if present
    if (alConfig) {
      inputs.al_config = alConfig;
      
      // Extract specific AL parameters
      if (alConfig.query_strategy) inputs.query_strategy = alConfig.query_strategy;
      if (alConfig.AL_scenario) inputs.AL_scenario = alConfig.AL_scenario;
      if (alConfig.model) inputs.model = alConfig.model;
      if (alConfig.max_iterations) inputs.max_iterations = alConfig.max_iterations;
      if (alConfig.labeling_budget) inputs.labeling_budget = alConfig.labeling_budget;
    }

    // Extract dataset references from RO-Crate
    const datasets = roCrateData['@graph']?.filter((item: any) => 
      item['@type']?.includes?.('Dataset')
    ) || [];
    
    datasets.forEach((dataset: any, index: number) => {
      if (dataset.contentUrl || dataset['@id']) {
        inputs[`dataset_${index + 1}`] = dataset.contentUrl || dataset['@id'];
      }
    });

    return inputs;
  }

  /**
   * Extract project type from RO-Crate
   */
  private extractProjectType(roCrateData: any): string {
    const rootEntity = roCrateData['@graph']?.find((item: any) => item['@id'] === './') || {};
    
    // Check keywords for project type
    const keywords = rootEntity.keywords || [];
    if (keywords.some((k: string) => k.toLowerCase().includes('active learning'))) {
      return 'active_learning';
    }
    if (keywords.some((k: string) => k.toLowerCase().includes('federated'))) {
      return 'federated_learning';
    }
    
    return 'general';
  }

  /**
   * Extract dataset hash from RO-Crate
   */
  private extractDatasetHash(roCrateData: any): string | undefined {
    const datasets = roCrateData['@graph']?.filter((item: any) => 
      item['@type']?.includes?.('Dataset') && item.contentUrl
    ) || [];
    
    return datasets[0]?.contentUrl?.replace(/^.*\/ipfs\//, '');
  }

  /**
   * Extract model hash from RO-Crate
   */
  private extractModelHash(roCrateData: any): string | undefined {
    const models = roCrateData['@graph']?.filter((item: any) => 
      item['@id']?.includes?.('model') || item.name?.toLowerCase?.().includes?.('model')
    ) || [];
    
    return models[0]?.contentUrl?.replace(/^.*\/ipfs\//, '');
  }

  /**
   * Update deployment status
   */
  private updateDeploymentStatus(projectId: string, status: Partial<DeploymentStatus>): void {
    const current = this.deploymentCache.get(projectId) || {
      status: 'pending' as const,
      lastUpdated: new Date().toISOString()
    };

    const updated = { ...current, ...status };
    this.deploymentCache.set(projectId, updated);

    // Persist to localStorage
    localStorage.setItem(
      `${this.storagePrefix}-${projectId}`,
      JSON.stringify(updated)
    );
  }

  /**
   * Load deployment status from localStorage
   */
  private loadDeploymentStatus(projectId: string): DeploymentStatus | null {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}-${projectId}`);
      if (stored) {
        const status = JSON.parse(stored);
        this.deploymentCache.set(projectId, status);
        return status;
      }
    } catch (error) {
      console.error('Failed to load deployment status:', error);
    }
    return null;
  }

  /**
   * Monitor workflow status on orchestration server
   */
  async monitorWorkflowStatus(projectId: string): Promise<DeploymentStatus | null> {
    const deploymentStatus = this.getDeploymentStatus(projectId);
    if (!deploymentStatus?.orchestrationWorkflowId) {
      return null;
    }

    try {
      const response = await fetch(`${this.config.orchestrationServerUrl}/streamflow/status/${deploymentStatus.orchestrationWorkflowId}`);
      if (response.ok) {
        const workflowStatus = await response.json();
        
        // Update local status based on orchestration server response
        let newStatus: DeploymentStatus['status'] = deploymentStatus.status;
        if (workflowStatus.status === 'RUNNING') {
          newStatus = 'running';
        } else if (workflowStatus.status === 'COMPLETED') {
          newStatus = 'deployed';
        } else if (workflowStatus.status === 'FAILED') {
          newStatus = 'failed';
        }

        if (newStatus !== deploymentStatus.status) {
          this.updateDeploymentStatus(projectId, {
            status: newStatus,
            lastUpdated: new Date().toISOString()
          });
        }

        return this.getDeploymentStatus(projectId);
      }
    } catch (error) {
      console.error('Failed to monitor workflow status:', error);
    }

    return deploymentStatus;
  }

  /**
   * Get orchestration server URL for a project
   */
  getOrchestrationUrl(projectId: string): string | null {
    const status = this.getDeploymentStatus(projectId);
    return status?.orchestrationUrl || null;
  }

  /**
   * Check if a project is deployed and running
   */
  isProjectDeployed(projectId: string): boolean {
    const status = this.getDeploymentStatus(projectId);
    return status?.status === 'deployed' || status?.status === 'running';
  }
}

// Export singleton instance
export const projectDeploymentService = ProjectDeploymentService.getInstance(); 