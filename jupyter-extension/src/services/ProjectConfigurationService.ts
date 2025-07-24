/**
 * Project Configuration Service - Centralized configuration management for DVRE
 * Handles RO-Crates, CWL workflows, and templates for all dApps
 */

export interface DVREProjectConfiguration {
  // Core project metadata
  projectId: string;
  contractAddress?: string; // Smart contract address
  projectData: any; // From smart contract
  status: 'draft' | 'configured' | 'ready' | 'active' | 'completed';
  created: string;
  lastModified: string;
  
  // Owner information
  owner: string; // Wallet address of project owner
  
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
  size?: number;
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
  ipfsHash?: string;
}

export interface ConfigurationModel {
  name: string;
  algorithm: string;
  parameters: Record<string, any>;
  framework?: string;
  ipfsHash?: string;
}

export interface ROCrateMetadata {
  '@context': 'https://w3id.org/ro/crate/1.1/context';
  '@graph': any[];
  conformsTo: { '@id': 'https://w3id.org/ro/crate/1.1' };
}

// IPFS Upload interfaces (migrated from DAL)
export interface IPFSUploadResult {
  hash: string;
  url: string;
  size: number;
}

export interface IPFSFile {
  name: string;
  content: string | ArrayBuffer;
  type: string;
}

export class ProjectConfigurationService {
  private static instance: ProjectConfigurationService;
  private storagePrefix = 'dvre-project-config';
  private eventListeners: Map<string, Set<(config: DVREProjectConfiguration) => void>> = new Map();
  
  // IPFS Configuration (migrated from DAL)
  private ipfsGateways: string[] = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
  ];
  private pinataApiKey?: string;
  private pinataSecretKey?: string;
  
  constructor() {
    // Load Pinata credentials from environment if available
    this.pinataApiKey = (window as any).__DVRE_CONFIG__?.PINATA_API_KEY;
    this.pinataSecretKey = (window as any).__DVRE_CONFIG__?.PINATA_SECRET_KEY;
  }
  
  static getInstance(): ProjectConfigurationService {
    if (!ProjectConfigurationService.instance) {
      ProjectConfigurationService.instance = new ProjectConfigurationService();
    }
    return ProjectConfigurationService.instance;
  }

  /**
   * Auto-create RO-Crate when project is created (called after smart contract creation)
   */
  async autoCreateProjectConfiguration(
    contractAddress: string,
    projectData: any,
    owner: string
  ): Promise<DVREProjectConfiguration> {
    const projectId = contractAddress;
    
    // Check if this is a DAL project based on project data
    const isDALProject = this.isDALProject(projectData);
    
    if (isDALProject) {
      console.log('Creating DAL template for project:', projectId);
      const config = this.createDALTemplate(projectId, projectData, owner);
      this.saveConfiguration(config);
      this.emitConfigurationUpdate(projectId, config);
      return config;
    }

    // Default general-purpose template
    const now = new Date().toISOString();
    const config: DVREProjectConfiguration = {
      projectId,
      contractAddress,
      owner,
      projectData,
      status: 'draft',
      created: now,
      lastModified: now,
      roCrate: {
        metadata: this.createBaseROCrateMetadata(projectId, projectData, owner),
        datasets: {},
        workflows: {},
        models: {},
        outputs: {}
      },
      extensions: {}
    };

    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);

    return config;
  }

  /**
   * Check if a project should use DAL template
   */
  private isDALProject(projectData: any): boolean {
    if (!projectData) return false;
    
    // Check project data for DAL indicators
    const indicators = [
      'active learning', 'al', 'dal', 'machine learning', 'annotation', 'labeling',
      'query strategy', 'uncertainty sampling', 'model training'
    ];
    
    const projectText = (
      (projectData.name || '') + ' ' + 
      (projectData.description || '') + ' ' +
      (projectData.objective || '') + ' ' +
      (projectData.project_type || '')
    ).toLowerCase();
    
    return indicators.some(indicator => projectText.includes(indicator));
  }

  /**
   * Generate inputs.yaml content for DAL workflow
   */
  generateDALInputsYaml(dalConfig: any): string {
    return `# DAL Project Inputs Configuration
# Generated by DVRE Project Configuration
query_strategy: ${dalConfig.queryStrategy}
AL_scenario: ${dalConfig.AL_scenario}
model: |
  ${JSON.stringify(dalConfig.model, null, 2).split('\n').join('\n  ')}
max_iterations: ${dalConfig.max_iterations}
labeling_budget: ${dalConfig.labeling_budget}
validation_split: ${dalConfig.validation_split}

# Dataset configuration
dataset:
  location: "./dataset.csv"
  format: "csv"
  features: []
  target_column: "label"
  
# Optional: Model outputs and metrics
outputs:
  model_path: "./outputs/trained_model.pkl"
  metrics_path: "./outputs/learning_curve.json"
  samples_path: "./outputs/selected_samples.csv"
  log_path: "./outputs/annotation_log.csv"

# Execution configuration
execution:
  backend: "local"  # or "kubernetes", "slurm"
  resources:
    cpu: 2
    memory: "4Gi"
    gpu: 0
`;
  }

  /**
   * Create DAL (Decentralized Active Learning) template
   */
  createDALTemplate(
    projectId: string, 
    projectData: any, 
    owner: string
  ): DVREProjectConfiguration {
    const now = new Date().toISOString();

    // DAL-specific configuration
    const dalConfig = {
      queryStrategy: 'uncertainty_sampling',
      AL_scenario: 'single_annotator',
      model: {
        type: 'logistic_regression',
        parameters: {
          max_iter: 1000,
          random_state: 42
        }
      },
      max_iterations: 10,
      labeling_budget: 100,
      validation_split: 0.2
    };

    // Create CWL workflow for DAL
    const dalWorkflow = {
      cwlVersion: "v1.2",
      class: "Workflow",
      id: `${projectId}-dal-workflow`,
      label: `DAL Workflow - ${projectData?.name || 'Active Learning Project'}`,
      doc: "Decentralized Active Learning workflow for collaborative machine learning",
      inputs: {
        dataset: {
          type: "File",
          doc: "Training dataset for active learning (CSV format)",
          format: "http://edamontology.org/format_3752"
        },
        query_strategy: {
          type: "string",
          default: dalConfig.queryStrategy,
          doc: "Active learning query strategy",
          enum: ["uncertainty_sampling", "diversity_sampling", "query_by_committee", "expected_model_change", "random_sampling"]
        },
        AL_scenario: {
          type: "string", 
          default: dalConfig.AL_scenario,
          doc: "Active Learning scenario type",
          enum: ["single_annotator", "multi_annotator", "federated", "collaborative"]
        },
        model: {
          type: "string",
          default: JSON.stringify(dalConfig.model),
          doc: "Model configuration in JSON format"
        },
        max_iterations: {
          type: "int",
          default: dalConfig.max_iterations,
          doc: "Maximum number of active learning iterations"
        },
        labeling_budget: {
          type: "int", 
          default: dalConfig.labeling_budget,
          doc: "Number of samples to label per iteration"
        },
        validation_split: {
          type: "float",
          default: dalConfig.validation_split,
          doc: "Fraction of data to use for validation"
        }
      },
      outputs: {
        trained_model: {
          type: "File",
          outputSource: "active_learning_pipeline/final_model",
          doc: "Final trained model after active learning"
        },
        learning_curve: {
          type: "File", 
          outputSource: "active_learning_pipeline/metrics",
          doc: "Learning curve and performance metrics"
        },
        selected_samples: {
          type: "File",
          outputSource: "active_learning_pipeline/query_results", 
          doc: "Samples selected by the query strategy"
        },
        annotation_log: {
          type: "File",
          outputSource: "active_learning_pipeline/annotations",
          doc: "Log of all annotations and labeling decisions"
        }
      },
      steps: {
        data_preprocessing: {
          run: "#data_preprocessing_step",
          in: {
            raw_dataset: "dataset",
            validation_ratio: "validation_split"
          },
          out: ["processed_data", "validation_data"]
        },
        active_learning_pipeline: {
          run: "#active_learning_step", 
          in: {
            training_data: "data_preprocessing/processed_data",
            validation_data: "data_preprocessing/validation_data",
            strategy: "query_strategy",
            scenario: "AL_scenario",
            model_config: "model",
            budget: "labeling_budget",
            iterations: "max_iterations"
          },
          out: ["final_model", "metrics", "query_results", "annotations"]
        }
      }
    };

    // Create comprehensive RO-Crate metadata
    const roCrateMetadata: ROCrateMetadata = {
      '@context': 'https://w3id.org/ro/crate/1.1/context',
      'conformsTo': { '@id': 'https://w3id.org/ro/crate/1.1' },
      '@graph': [
        {
          "@type": "CreativeWork",
          "@id": "ro-crate-metadata.json",
          "conformsTo": { "@id": "https://w3id.org/ro/crate/1.1" },
          "about": { "@id": "./" },
          "description": "RO-Crate metadata file for this dataset"
        },
        {
          "@type": ["Dataset", "SoftwareApplication"],
          "@id": "./",
          "name": projectData?.name || "Decentralized Active Learning Project",
          "description": projectData?.description || projectData?.objective || "A decentralized active learning project for collaborative machine learning",
          "creator": {
            "@type": "Person",
            "@id": owner,
            "name": owner
          },
          "dateCreated": now,
          "datePublished": now,
          "version": "1.0.0",
          "license": "MIT",
          "keywords": ["active learning", "machine learning", "decentralized", "collaborative", "CWL"],
          "programmingLanguage": "CWL",
          "applicationCategory": "Machine Learning",
          "operatingSystem": "Any",
          "softwareRequirements": [
            "Python 3.8+",
            "scikit-learn",
            "CWL runner"
          ],
          "hasPart": [
            { "@id": "workflow.cwl" },
            { "@id": "inputs.yaml" },
            { "@id": "dataset.csv" },
            { "@id": "outputs/" }
          ]
        },
        {
          "@type": ["File", "SoftwareSourceCode"],
          "@id": "workflow.cwl",
          "name": "DAL CWL Workflow",
          "description": "Common Workflow Language definition for Decentralized Active Learning",
          "encodingFormat": "application/x-cwl",
          "programmingLanguage": "CWL",
          "dateCreated": now,
          "creator": { "@id": owner },
          "contentSize": JSON.stringify(dalWorkflow, null, 2).length,
          "text": JSON.stringify(dalWorkflow, null, 2)
        },
        {
          "@type": "File",
          "@id": "inputs.yaml", 
          "name": "DAL Input Configuration",
          "description": "YAML configuration file containing Active Learning parameters",
          "encodingFormat": "application/x-yaml",
          "dateCreated": now,
          "creator": { "@id": owner }
        },
        {
          "@type": "Dataset",
          "@id": "dataset.csv",
          "name": "Training Dataset",
          "description": "Training and labeling dataset for active learning (placeholder)",
          "encodingFormat": "text/csv",
          "dateCreated": now,
          "creator": { "@id": owner },
          "contentSize": 0
        },
        {
          "@type": "Dataset", 
          "@id": "outputs/",
          "name": "Model Outputs",
          "description": "Directory containing trained models, metrics, and analysis results",
          "dateCreated": now,
          "creator": { "@id": owner },
          "hasPart": [
            { "@id": "outputs/trained_model.pkl" },
            { "@id": "outputs/learning_curve.json" },
            { "@id": "outputs/selected_samples.csv" },
            { "@id": "outputs/annotation_log.csv" }
          ]
        }
      ]
    };

    const config: DVREProjectConfiguration = {
      projectId,
      contractAddress: projectId,
      owner,
      projectData,
      status: 'configured',
      created: now,
      lastModified: now,
      roCrate: {
        metadata: roCrateMetadata,
        datasets: {
          'dataset-main': {
            name: 'Training Dataset',
            description: 'Training and labeling dataset for active learning',
            format: 'csv',
            columns: [],
            size: 0
          }
        },
        workflows: {
          'dal-workflow': {
            name: 'DAL CWL Workflow',
            description: 'Decentralized Active Learning workflow',
            type: 'cwl',
            content: JSON.stringify(dalWorkflow, null, 2),
            inputs: Object.keys(dalWorkflow.inputs),
            outputs: Object.keys(dalWorkflow.outputs),
            steps: Object.keys(dalWorkflow.steps)
          }
        },
        models: {
          'dal-model': {
            name: 'Active Learning Model',
            algorithm: dalConfig.model.type,
            parameters: dalConfig.model.parameters,
            framework: 'scikit-learn'
          }
        },
        outputs: {}
      },
      extensions: {
        dal: dalConfig
      }
    };

    return config;
  }

  /**
   * Check if current user is the owner of a project
   */
  isProjectOwner(projectId: string, userAddress: string): boolean {
    const config = this.getProjectConfiguration(projectId);
    return config?.owner?.toLowerCase() === userAddress?.toLowerCase();
  }

  /**
   * Create new project configuration from template (manual creation)
   */
  async createProjectConfiguration(
    projectId: string,
    projectData: any,
    owner: string,
    templateId?: number
  ): Promise<DVREProjectConfiguration> {
    const config: DVREProjectConfiguration = {
      projectId,
      projectData,
      owner,
      status: 'draft',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      roCrate: {
        metadata: this.createBaseROCrateMetadata(projectId, projectData, owner),
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
    extensionData: any,
    userAddress: string
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can modify configurations');
      return null;
    }

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
   * Add dataset to configuration (owner only)
   */
  addDataset(
    projectId: string,
    datasetId: string,
    dataset: ConfigurationDataset,
    userAddress: string
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can modify configurations');
      return null;
    }

    config.roCrate.datasets[datasetId] = dataset;
    config.lastModified = new Date().toISOString();
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Add workflow to configuration (owner only)
   */
  addWorkflow(
    projectId: string,
    workflowId: string,
    workflow: ConfigurationWorkflow,
    userAddress: string
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can modify configurations');
      return null;
    }

    config.roCrate.workflows[workflowId] = workflow;
    config.lastModified = new Date().toISOString();
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Add model to configuration (owner only)
   */
  addModel(
    projectId: string,
    modelId: string,
    model: ConfigurationModel,
    userAddress: string
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can modify configurations');
      return null;
    }

    config.roCrate.models[modelId] = model;
    config.lastModified = new Date().toISOString();
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Remove workflow from configuration (owner only)
   */
  removeWorkflow(
    projectId: string,
    workflowId: string,
    userAddress: string
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can modify configurations');
      return null;
    }

    // Check if workflow exists
    if (!config.roCrate.workflows[workflowId]) {
      console.error('Workflow not found:', workflowId);
      return null;
    }

    // Remove workflow
    delete config.roCrate.workflows[workflowId];
    config.lastModified = new Date().toISOString();
    
    // Update status if no workflows remain
    if (Object.keys(config.roCrate.workflows).length === 0) {
      config.status = 'draft';
    }
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Publish configuration to IPFS (owner only)
   */
  async publishToIPFS(projectId: string, userAddress: string): Promise<{
    roCrateHash: string;
    workflowHash?: string;
    bundleHash: string;
  } | null> {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can publish configurations');
      return null;
    }

    try {
      console.log('Publishing RO-Crate to IPFS...', projectId);
      
      // Create RO-Crate bundle
      const roCrateData = this.generateROCrateJSON(config);
      
      // Upload to IPFS using the migrated IPFS functionality
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
      
      console.log('Successfully published to IPFS:', ipfsResults);
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

  /**
   * Get projects owned by specific user
   */
  getUserOwnedProjects(userAddress: string): DVREProjectConfiguration[] {
    return this.getAllProjectConfigurations().filter(config => 
      config.owner?.toLowerCase() === userAddress?.toLowerCase()
    );
  }

  // Private methods

  private createBaseROCrateMetadata(projectId: string, projectData: any, owner: string): ROCrateMetadata {
    return {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@type": "CreativeWork",
          "@id": "ro-crate-metadata.json",
          "conformsTo": {"@id": "https://w3id.org/ro/crate/1.1"},
          "about": {"@id": "./"}
        },
        {
          "@type": "Dataset",
          "@id": "./",
          "name": projectData.name || projectData.project_id || `DVRE Project ${projectId}`,
          "description": projectData.description || projectData.objective || "DVRE research project",
          "creator": {
            "@type": "Person",
            "@id": owner,
            "name": owner,
            "identifier": owner
          },
          "dateCreated": new Date().toISOString(),
          "dateModified": new Date().toISOString(),
          "hasPart": [],
          "keywords": ["DVRE", "research", "collaboration"],
          "license": {"@id": "https://creativecommons.org/licenses/by/4.0/"},
          "publisher": {
            "@type": "Organization",
            "name": "DVRE Platform"
          }
        }
      ],
      "conformsTo": { "@id": "https://w3id.org/ro/crate/1.1" }
    };
  }

  private async applyTemplate(config: DVREProjectConfiguration, templateId: number): Promise<void> {
    // TODO: Integrate with ProjectTemplateRegistry to apply template
    // This would populate default datasets, workflows, and extension configurations
    console.log('Applying template', templateId, 'to configuration:', config.projectId);
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
          "name": dataset.name,
          "description": dataset.description,
          "encodingFormat": dataset.format,
          "contentUrl": dataset.url,
          "contentSize": dataset.size,
          "variableMeasured": dataset.columns?.map(col => ({
            "@type": "PropertyValue",
            "name": col.name,
            "description": col.description,
            "dataType": col.dataType
          }))
        })),
        ...Object.entries(config.roCrate.workflows).map(([id, workflow]) => ({
          "@type": ["File", "SoftwareSourceCode", "ComputationalWorkflow"],
          "@id": id,
          "name": workflow.name,
          "description": workflow.description,
          "programmingLanguage": workflow.type === 'cwl' ? 'CWL' : workflow.type,
          "text": workflow.content,
          "input": workflow.inputs,
          "output": workflow.outputs
        })),
        ...Object.entries(config.roCrate.models).map(([id, model]) => ({
          "@type": ["File", "SoftwareSourceCode"],
          "@id": id,
          "name": model.name,
          "description": `${model.algorithm} model`,
          "programmingLanguage": model.framework,
          "runtimePlatform": model.framework,
          "codeRepository": model.algorithm
        }))
      ]
    };
    
    return JSON.stringify(roCrate, null, 2);
  }

  // IPFS Upload Methods (migrated from DAL)

  private async uploadToIPFS(
    projectId: string,
    roCrateData: string,
    config: DVREProjectConfiguration
  ): Promise<{
    roCrateHash: string;
    workflowHash?: string;
    bundleHash: string;
  }> {
    console.log('Starting IPFS upload for project:', projectId);
    
    try {
      // Upload RO-Crate metadata
      const roCrateFile: IPFSFile = {
        name: 'ro-crate-metadata.json',
        content: roCrateData,
        type: 'application/json'
      };
      
      const roCrateResult = await this.uploadFile(roCrateFile);
      console.log('RO-Crate uploaded:', roCrateResult);
      
      let workflowResult: IPFSUploadResult | null = null;
      
      // Upload main workflow if exists
      const workflows = Object.values(config.roCrate.workflows);
      if (workflows.length > 0) {
        const mainWorkflow = workflows[0]; // Use first workflow as main
        const workflowFile: IPFSFile = {
          name: `${projectId}-workflow.${mainWorkflow.type}`,
          content: mainWorkflow.content,
          type: mainWorkflow.type === 'cwl' ? 'application/x-cwl' : 'text/plain'
        };
        
        workflowResult = await this.uploadFile(workflowFile);
        console.log('Workflow uploaded:', workflowResult);
      }
      
      // Create project bundle
      const bundleFiles: IPFSFile[] = [
        roCrateFile
      ];
      
      if (workflowResult) {
        bundleFiles.push({
          name: `workflow.${workflows[0].type}`,
          content: workflows[0].content,
          type: workflows[0].type === 'cwl' ? 'application/x-cwl' : 'text/plain'
        });
      }
      
      // Add dataset metadata (not actual data files)
      Object.entries(config.roCrate.datasets).forEach(([id, dataset]) => {
        bundleFiles.push({
          name: `datasets/${dataset.name}-metadata.json`,
          content: JSON.stringify({
            name: dataset.name,
            description: dataset.description,
            format: dataset.format,
            columns: dataset.columns,
            url: dataset.url,
            ipfsHash: dataset.ipfsHash
          }, null, 2),
          type: 'application/json'
        });
      });
      
      const bundleResult = await this.uploadDirectory(bundleFiles, `dvre-project-${projectId}`);
      console.log('Bundle uploaded:', bundleResult);
      
      return {
        roCrateHash: roCrateResult.hash,
        workflowHash: workflowResult?.hash,
        bundleHash: bundleResult.hash
      };
      
    } catch (error) {
      console.error('IPFS upload failed:', error);
      throw new Error(`IPFS upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Upload a single file to IPFS
   */
  private async uploadFile(file: IPFSFile): Promise<IPFSUploadResult> {
    // Try Pinata first if credentials are available
    if (this.pinataApiKey && this.pinataSecretKey) {
      try {
        return await this.uploadToPinata(file);
      } catch (error) {
        console.warn('Pinata upload failed, trying fallback:', error);
      }
    }

    // Use mock upload for development/demo purposes
    return this.mockIPFSUpload(file);
  }

  /**
   * Upload file to Pinata (managed IPFS service)
   */
  private async uploadToPinata(file: IPFSFile): Promise<IPFSUploadResult> {
    const formData = new FormData();
    
    let blob: Blob;
    if (typeof file.content === 'string') {
      blob = new Blob([file.content], { type: file.type || 'text/plain' });
    } else {
      blob = new Blob([file.content], { type: file.type || 'application/octet-stream' });
    }
    
    formData.append('file', blob, file.name);
    
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        project: 'DVRE-Core',
        type: file.type || 'unknown'
      }
    });
    formData.append('pinataMetadata', metadata);

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': this.pinataApiKey!,
        'pinata_secret_api_key': this.pinataSecretKey!
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Pinata upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      hash: result.IpfsHash,
      url: `${this.ipfsGateways[0]}${result.IpfsHash}`,
      size: result.PinSize
    };
  }

  /**
   * Mock IPFS upload for development/testing
   */
  private mockIPFSUpload(file: IPFSFile): IPFSUploadResult {
    // Generate a mock IPFS hash
    const mockHash = `Qm${Math.random().toString(36).substr(2, 44)}`;
    const size = typeof file.content === 'string' 
      ? new Blob([file.content]).size 
      : file.content.byteLength;

    console.log(`Mock IPFS upload: ${file.name} -> ${mockHash}`);
    
    return {
      hash: mockHash,
      url: `${this.ipfsGateways[0]}${mockHash}`,
      size
    };
  }

  /**
   * Upload directory structure to IPFS
   */
  private async uploadDirectory(files: IPFSFile[], dirName: string): Promise<IPFSUploadResult> {
    // Create a directory structure as a single JSON file for simplicity
    const directoryStructure = {
      name: dirName,
      type: 'directory',
      files: files.map(f => ({
        name: f.name,
        content: typeof f.content === 'string' ? f.content : this.arrayBufferToBase64(f.content),
        type: f.type,
        encoding: typeof f.content === 'string' ? 'utf8' : 'base64'
      }))
    };

    const directoryFile: IPFSFile = {
      name: `${dirName}.json`,
      content: JSON.stringify(directoryStructure, null, 2),
      type: 'application/json'
    };

    return this.uploadFile(directoryFile);
  }

  /**
   * Utility: Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export const projectConfigurationService = ProjectConfigurationService.getInstance(); 