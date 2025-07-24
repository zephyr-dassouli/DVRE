/**
 * DVRE RO-Crate Client for DAL dApp
 * Provides interface to centralized DVRE RO-Crate management
 * Replaces local ROCrateManager with DVRE API integration
 */

// Define DAL-specific types that extend DVRE RO-Crate
export interface DALConfiguration {
  queryStrategy: 'uncertainty_sampling' | 'diversity_sampling' | 'hybrid';
  labelingBudget: number;
  maxIterations: number;
  modelConfig: {
    model_type: 'logistic_regression' | 'neural_network' | 'random_forest' | 'svm';
    layers?: number[];
    parameters?: Record<string, any>;
  };
  dataConfig: {
    trainingDataset: string;
    labelingDataset?: string;
    testDataset?: string;
    features: string[];
  };
  sessionConfig?: {
    consensusThreshold?: number;
    minContributors?: number;
    maxLabelingTime?: number;
  };
}

export interface DALWorkflow {
  name: string;
  description?: string;
  programmingLanguage: 'cwl';
  steps: string[];
  cwlContent?: string;
  inputs?: any[];
  outputs?: any[];
}

export interface DALDataset {
  name: string;
  description?: string;
  type: 'training' | 'labeling' | 'test';
  format: 'csv' | 'json' | 'parquet';
  url?: string;
  ipfsHash?: string;
  columns?: Array<{
    name: string;
    dataType: 'string' | 'number' | 'boolean' | 'date';
    description?: string;
  }>;
  size?: number;
  recordCount?: number;
}

export interface DALModel {
  name: string;
  description?: string;
  algorithm: string;
  parameters: Record<string, any>;
  performance?: Record<string, number>;
  version?: string;
  trainingData?: string;
}

export interface DALROCrate {
  projectId: string;
  alConfig: DALConfiguration;
  workflow?: DALWorkflow;
  datasets: DALDataset[];
  models: DALModel[];
  status: 'draft' | 'configured' | 'ready' | 'active' | 'completed';
  ipfsHashes?: {
    roCrateHash?: string;
    workflowHash?: string;
    bundleHash?: string;
  };
  lastModified: string;
}

/**
 * DVRE RO-Crate Client for DAL
 * Provides typed interface to DVRE's centralized RO-Crate system
 */
export class DVREROCrateClient {
  private static instance: DVREROCrateClient;
  private dvreAPI: any = null;

  private constructor() {
    this.initializeDVREConnection();
  }

  static getInstance(): DVREROCrateClient {
    if (!DVREROCrateClient.instance) {
      DVREROCrateClient.instance = new DVREROCrateClient();
    }
    return DVREROCrateClient.instance;
  }

  /**
   * Initialize connection to DVRE RO-Crate API
   */
  private initializeDVREConnection(): void {
    try {
      // Access DVRE RO-Crate API from global window object
      this.dvreAPI = (window as any).roCrateAPI;
      
      if (!this.dvreAPI) {
        console.warn('DVRE RO-Crate API not found. Make sure DVRE core is loaded.');
      } else {
        console.log('DAL: Connected to DVRE RO-Crate API');
      }
    } catch (error) {
      console.error('DAL: Failed to connect to DVRE RO-Crate API:', error);
    }
  }

  /**
   * Check if DVRE API is available
   */
  private ensureAPIConnection(): void {
    if (!this.dvreAPI) {
      this.initializeDVREConnection();
      if (!this.dvreAPI) {
        throw new Error('DVRE RO-Crate API not available. Ensure DVRE core is loaded.');
      }
    }
  }

  /**
   * Get DAL RO-Crate for a project
   */
  async getDALROCrate(projectId: string): Promise<DALROCrate | null> {
    try {
      this.ensureAPIConnection();
      
      // Get base RO-Crate from DVRE
      const baseROCrate = await this.dvreAPI.getProjectROCrate(projectId);
      
      if (!baseROCrate || !baseROCrate.extensions?.dal) {
        return null;
      }

      // Convert DVRE RO-Crate to DAL format
      const dalExtension = baseROCrate.extensions.dal;
      
      return {
        projectId,
        alConfig: dalExtension.alConfig || this.getDefaultALConfig(),
        workflow: dalExtension.workflow,
        datasets: dalExtension.datasets || [],
        models: dalExtension.models || [],
        status: baseROCrate.project?.status || 'draft',
        ipfsHashes: baseROCrate.ipfs,
        lastModified: dalExtension.lastModified || new Date().toISOString()
      };
    } catch (error) {
      console.error('DAL: Failed to get RO-Crate:', error);
      return null;
    }
  }

  /**
   * Update DAL configuration in DVRE RO-Crate
   */
  async updateDALConfiguration(
    projectId: string, 
    alConfig: Partial<DALConfiguration>
  ): Promise<DALROCrate | null> {
    try {
      this.ensureAPIConnection();

      // Get current DAL extension or create new one
      const currentROCrate = await this.getDALROCrate(projectId);
      const currentConfig = currentROCrate?.alConfig || this.getDefaultALConfig();

      // Merge configurations
      const updatedConfig = { ...currentConfig, ...alConfig };

      // Update DVRE RO-Crate with new DAL extension
      const dalExtension = {
        alConfig: updatedConfig,
        workflow: currentROCrate?.workflow,
        datasets: currentROCrate?.datasets || [],
        models: currentROCrate?.models || [],
        type: 'active_learning',
        version: '1.0',
        lastModified: new Date().toISOString()
      };

      await this.dvreAPI.updateROCrateExtension(projectId, 'dal', dalExtension);
      
      // Return updated DAL RO-Crate
      return await this.getDALROCrate(projectId);
    } catch (error) {
      console.error('DAL: Failed to update configuration:', error);
      throw error;
    }
  }

  /**
   * Add dataset to DAL RO-Crate
   */
  async addDataset(projectId: string, dataset: DALDataset): Promise<DALROCrate | null> {
    try {
      const currentROCrate = await this.getDALROCrate(projectId);
      const datasets = currentROCrate?.datasets || [];
      
      // Add or update dataset
      const existingIndex = datasets.findIndex(d => d.name === dataset.name);
      if (existingIndex >= 0) {
        datasets[existingIndex] = dataset;
      } else {
        datasets.push(dataset);
      }

      // Update the extension
      const dalExtension = {
        alConfig: currentROCrate?.alConfig || this.getDefaultALConfig(),
        workflow: currentROCrate?.workflow,
        datasets,
        models: currentROCrate?.models || [],
        type: 'active_learning',
        version: '1.0',
        lastModified: new Date().toISOString()
      };

      await this.dvreAPI.updateROCrateExtension(projectId, 'dal', dalExtension);
      return await this.getDALROCrate(projectId);
    } catch (error) {
      console.error('DAL: Failed to add dataset:', error);
      throw error;
    }
  }

  /**
   * Add workflow to DAL RO-Crate
   */
  async addWorkflow(projectId: string, workflow: DALWorkflow): Promise<DALROCrate | null> {
    try {
      const currentROCrate = await this.getDALROCrate(projectId);

      const dalExtension = {
        alConfig: currentROCrate?.alConfig || this.getDefaultALConfig(),
        workflow,
        datasets: currentROCrate?.datasets || [],
        models: currentROCrate?.models || [],
        type: 'active_learning',
        version: '1.0',
        lastModified: new Date().toISOString()
      };

      await this.dvreAPI.updateROCrateExtension(projectId, 'dal', dalExtension);
      return await this.getDALROCrate(projectId);
    } catch (error) {
      console.error('DAL: Failed to add workflow:', error);
      throw error;
    }
  }

  /**
   * Add model to DAL RO-Crate
   */
  async addModel(projectId: string, model: DALModel): Promise<DALROCrate | null> {
    try {
      const currentROCrate = await this.getDALROCrate(projectId);
      const models = currentROCrate?.models || [];
      
      // Add or update model
      const existingIndex = models.findIndex(m => m.name === model.name);
      if (existingIndex >= 0) {
        models[existingIndex] = model;
      } else {
        models.push(model);
      }

      const dalExtension = {
        alConfig: currentROCrate?.alConfig || this.getDefaultALConfig(),
        workflow: currentROCrate?.workflow,
        datasets: currentROCrate?.datasets || [],
        models,
        type: 'active_learning',
        version: '1.0',
        lastModified: new Date().toISOString()
      };

      await this.dvreAPI.updateROCrateExtension(projectId, 'dal', dalExtension);
      return await this.getDALROCrate(projectId);
    } catch (error) {
      console.error('DAL: Failed to add model:', error);
      throw error;
    }
  }

  /**
   * Finalize DAL project (upload to IPFS and submit to orchestrator)
   */
  async finalizeProject(
    projectId: string,
    contractAddress: string
  ): Promise<{
    ipfsHash: string;
    bundleHash: string;
    workflowHash?: string;
    success: boolean;
  }> {
    try {
      this.ensureAPIConnection();

      // Validate DAL configuration before finalization
      const dalROCrate = await this.getDALROCrate(projectId);
      if (!dalROCrate) {
        throw new Error('DAL RO-Crate not found');
      }

      const validation = this.validateDALConfiguration(dalROCrate);
      if (!validation.valid) {
        throw new Error(`DAL configuration invalid: ${validation.errors.join(', ')}`);
      }

      // Use DVRE's finalization process
      const result = await this.dvreAPI.finalizeProject(projectId, contractAddress);
      
      console.log('DAL: Project finalized via DVRE:', result);
      
      return {
        ...result,
        success: true
      };
    } catch (error) {
      console.error('DAL: Project finalization failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to RO-Crate updates for a project
   */
  subscribeToUpdates(
    projectId: string, 
    callback: (dalROCrate: DALROCrate) => void
  ): () => void {
    try {
      this.ensureAPIConnection();
      
      return this.dvreAPI.onROCrateUpdate(projectId, async (updatedROCrate: any) => {
        // Convert DVRE RO-Crate to DAL format and notify
        const dalROCrate = await this.getDALROCrate(projectId);
        if (dalROCrate) {
          callback(dalROCrate);
        }
      });
    } catch (error) {
      console.error('DAL: Failed to subscribe to updates:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }

  /**
   * Export DAL RO-Crate metadata
   */
  async exportMetadata(projectId: string): Promise<string> {
    try {
      this.ensureAPIConnection();
      return await this.dvreAPI.exportMetadata(projectId);
    } catch (error) {
      console.error('DAL: Failed to export metadata:', error);
      throw error;
    }
  }

  /**
   * Validate DAL configuration
   */
  private validateDALConfiguration(dalROCrate: DALROCrate): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required AL configuration
    if (!dalROCrate.alConfig) {
      errors.push('Active Learning configuration is required');
    } else {
      if (!dalROCrate.alConfig.queryStrategy) {
        errors.push('Query strategy is required');
      }
      if (!dalROCrate.alConfig.labelingBudget || dalROCrate.alConfig.labelingBudget <= 0) {
        errors.push('Valid labeling budget is required');
      }
      if (!dalROCrate.alConfig.modelConfig) {
        errors.push('Model configuration is required');
      }
    }

    // Check datasets
    if (!dalROCrate.datasets || dalROCrate.datasets.length === 0) {
      errors.push('At least one dataset is required');
    }

    // Check workflow
    if (!dalROCrate.workflow) {
      warnings.push('No workflow specified - will use default template');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get default AL configuration
   */
  private getDefaultALConfig(): DALConfiguration {
    return {
      queryStrategy: 'uncertainty_sampling',
      labelingBudget: 100,
      maxIterations: 10,
      modelConfig: {
        model_type: 'logistic_regression',
        parameters: {}
      },
      dataConfig: {
        trainingDataset: '',
        features: []
      }
    };
  }
}

// Export singleton instance
export const dvreROCrateClient = DVREROCrateClient.getInstance(); 