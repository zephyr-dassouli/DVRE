/**
 * Project Configuration Service - Centralized configuration management for DVRE
 * Handles RO-Crates, CWL workflows, and templates for all dApps
 */

export interface DVREProjectConfiguration {
  // Core project metadata
  projectId: string;
  projectData: any; // From smart contract
  status: 'draft' | 'configured' | 'ready' | 'active' | 'completed';
  created: string;
  lastModified: string;
  
  // RO-Crate structure
  roCrate: {
    metadata: ROCrateMetadata;
    datasets: Record<string, ConfigurationDataset>;
    workflows: Record<string, ConfigurationWorkflow>;
    models: Record<string, ConfigurationModel>;
    outputs: Record<string, any>;
  };
  
  // dApp-specific extensions
  extensions: Record<string, any>; // e.g., { dal: ALConfiguration, federated: FLConfig }
  
  // IPFS hashes (only after publishing)
  ipfs?: {
    roCrateHash?: string;
    workflowHash?: string;
    bundleHash?: string;
    publishedAt?: string;
  };
}

export interface ConfigurationDataset {
  name: string;
  description?: string;
  format: string;
  url?: string;
  ipfsHash?: string;
  columns?: Array<{
    name: string;
    dataType: string;
    description?: string;
  }>;
}

export interface ConfigurationWorkflow {
  name: string;
  description?: string;
  type: 'cwl' | 'jupyter' | 'custom';
  content: string;
  inputs?: any[];
  outputs?: any[];
  steps?: string[];
}

export interface ConfigurationModel {
  name: string;
  algorithm: string;
  parameters: Record<string, any>;
  framework?: string;
}

export interface ROCrateMetadata {
  '@context': 'https://w3id.org/ro/crate/1.1/context';
  '@graph': any[];
  conformsTo: { '@id': 'https://w3id.org/ro/crate/1.1' };
}

export class ProjectConfigurationService {
  private static instance: ProjectConfigurationService;
  private storagePrefix = 'dvre-project-config';
  private eventListeners: Map<string, Set<(config: DVREProjectConfiguration) => void>> = new Map();
  
  static getInstance(): ProjectConfigurationService {
    if (!ProjectConfigurationService.instance) {
      ProjectConfigurationService.instance = new ProjectConfigurationService();
    }
    return ProjectConfigurationService.instance;
  }

  /**
   * Create new project configuration from template
   */
  async createProjectConfiguration(
    projectId: string,
    projectData: any,
    templateId?: number
  ): Promise<DVREProjectConfiguration> {
    const config: DVREProjectConfiguration = {
      projectId,
      projectData,
      status: 'draft',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      roCrate: {
        metadata: this.createBaseROCrateMetadata(projectId, projectData),
        datasets: {},
        workflows: {},
        models: {},
        outputs: {}
      },
      extensions: {}
    };

    // Apply template if provided
    if (templateId !== undefined) {
      await this.applyTemplate(config, templateId);
    }

    // Save to local storage
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Get project configuration from local storage
   */
  getProjectConfiguration(projectId: string): DVREProjectConfiguration | null {
    try {
      const storageKey = `${this.storagePrefix}-${projectId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load project configuration:', error);
    }
    
    return null;
  }

  /**
   * Update dApp-specific extension configuration
   */
  updateExtensionConfiguration(
    projectId: string,
    dAppName: string,
    extensionData: any
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Update extension data
    config.extensions[dAppName] = {
      ...config.extensions[dAppName],
      ...extensionData,
      lastModified: new Date().toISOString()
    };
    
    config.lastModified = new Date().toISOString();
    
    // Save and notify
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Add dataset to configuration
   */
  addDataset(
    projectId: string,
    datasetId: string,
    dataset: ConfigurationDataset
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    config.roCrate.datasets[datasetId] = dataset;
    config.lastModified = new Date().toISOString();
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Add workflow to configuration
   */
  addWorkflow(
    projectId: string,
    workflowId: string,
    workflow: ConfigurationWorkflow
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    config.roCrate.workflows[workflowId] = workflow;
    config.lastModified = new Date().toISOString();
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Add model to configuration
   */
  addModel(
    projectId: string,
    modelId: string,
    model: ConfigurationModel
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    config.roCrate.models[modelId] = model;
    config.lastModified = new Date().toISOString();
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Publish configuration to IPFS (optional)
   */
  async publishToIPFS(projectId: string): Promise<{
    roCrateHash: string;
    workflowHash?: string;
    bundleHash: string;
  } | null> {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    try {
      // Create RO-Crate bundle
      const roCrateData = this.generateROCrateJSON(config);
      
      // Upload to IPFS (implement based on your existing IPFSManager)
      const ipfsResults = await this.uploadToIPFS(projectId, roCrateData, config);
      
      // Update configuration with IPFS hashes
      config.ipfs = {
        ...ipfsResults,
        publishedAt: new Date().toISOString()
      };
      
      config.status = 'ready';
      config.lastModified = new Date().toISOString();
      
      this.saveConfiguration(config);
      this.emitConfigurationUpdate(projectId, config);
      
      return ipfsResults;
    } catch (error) {
      console.error('Failed to publish to IPFS:', error);
      return null;
    }
  }

  /**
   * Subscribe to configuration changes
   */
  onConfigurationChange(
    projectId: string,
    callback: (config: DVREProjectConfiguration) => void
  ): () => void {
    if (!this.eventListeners.has(projectId)) {
      this.eventListeners.set(projectId, new Set());
    }
    
    this.eventListeners.get(projectId)!.add(callback);
    
    return () => {
      this.eventListeners.get(projectId)?.delete(callback);
    };
  }

  /**
   * Get all project configurations (for listing)
   */
  getAllProjectConfigurations(): DVREProjectConfiguration[] {
    const configs: DVREProjectConfiguration[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.storagePrefix)) {
        try {
          const config = JSON.parse(localStorage.getItem(key)!);
          configs.push(config);
        } catch (error) {
          console.warn('Failed to parse configuration:', key, error);
        }
      }
    }
    
    return configs.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  }

  // Private methods

  private createBaseROCrateMetadata(projectId: string, projectData: any): ROCrateMetadata {
    return {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@type": "CreativeWork",
          "@id": "ro-crate-metadata.json",
          "conformsTo": {"@id": "https://w3id.org/ro/crate/1.1"}
        },
        {
          "@type": "Dataset",
          "@id": "./",
          "name": projectData.name || `DVRE Project ${projectId}`,
          "description": projectData.description || "DVRE research project",
          "creator": projectData.creator,
          "dateCreated": new Date().toISOString(),
          "hasPart": []
        }
      ],
      "conformsTo": { "@id": "https://w3id.org/ro/crate/1.1" }
    };
  }

  private async applyTemplate(config: DVREProjectConfiguration, templateId: number): Promise<void> {
    // TODO: Integrate with ProjectTemplateRegistry to apply template
    // This would populate default datasets, workflows, and extension configurations
  }

  private saveConfiguration(config: DVREProjectConfiguration): void {
    const storageKey = `${this.storagePrefix}-${config.projectId}`;
    localStorage.setItem(storageKey, JSON.stringify(config, null, 2));
  }

  private emitConfigurationUpdate(projectId: string, config: DVREProjectConfiguration): void {
    // Emit to internal listeners
    this.eventListeners.get(projectId)?.forEach(callback => callback(config));
    
    // Emit global event for backward compatibility
    window.dispatchEvent(new CustomEvent('dvre-configuration-updated', {
      detail: { projectId, config, timestamp: new Date().toISOString() }
    }));
  }

  private generateROCrateJSON(config: DVREProjectConfiguration): string {
    // Generate complete RO-Crate JSON-LD structure
    const roCrate = {
      ...config.roCrate.metadata,
      "@graph": [
        ...config.roCrate.metadata["@graph"],
        // Add datasets, workflows, models to the graph
        ...Object.entries(config.roCrate.datasets).map(([id, dataset]) => ({
          "@type": "Dataset",
          "@id": id,
          ...dataset
        })),
        ...Object.entries(config.roCrate.workflows).map(([id, workflow]) => ({
          "@type": ["File", "SoftwareSourceCode", "ComputationalWorkflow"],
          "@id": id,
          ...workflow
        })),
        ...Object.entries(config.roCrate.models).map(([id, model]) => ({
          "@type": ["File", "SoftwareSourceCode"],
          "@id": id,
          ...model
        }))
      ]
    };
    
    return JSON.stringify(roCrate, null, 2);
  }

  private async uploadToIPFS(
    projectId: string,
    roCrateData: string,
    config: DVREProjectConfiguration
  ): Promise<{
    roCrateHash: string;
    workflowHash?: string;
    bundleHash: string;
  }> {
    // TODO: Implement IPFS upload using your existing IPFSManager
    // This should create a bundle with:
    // - ro-crate-metadata.json
    // - workflows/ directory
    // - datasets/ directory (metadata only, not actual data)
    
    throw new Error('IPFS upload not implemented yet');
  }
}

export const projectConfigurationService = ProjectConfigurationService.getInstance(); 