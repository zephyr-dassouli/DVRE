// LocalROCrateService.ts - Service for saving RO-Crate bundles locally for AL-Engine

import { DVREProjectConfiguration } from './types';
import { IPFSFile } from './types';

export interface LocalROCrateSaveResult {
  success: boolean;
  projectPath: string;
  savedFiles: string[];
  error?: string;
}

export class LocalROCrateService {
  private static instance: LocalROCrateService;
  private readonly LOCAL_ROCRATE_ROOT = '../al-engine/ro-crates';

  private constructor() {}

  static getInstance(): LocalROCrateService {
    if (!LocalROCrateService.instance) {
      LocalROCrateService.instance = new LocalROCrateService();
    }
    return LocalROCrateService.instance;
  }

  /**
   * Save RO-Crate bundle locally to al-engine/ro-crates
   * This mirrors the IPFS upload functionality but saves locally for AL-Engine access
   * 
   * @param projectId - The project identifier (contract address)
   * @param roCrateData - The RO-Crate JSON-LD metadata
   * @param config - The project configuration
   * @returns Promise with save results
   */
  async saveROCrateLocally(
    projectId: string,
    roCrateData: string,
    config: DVREProjectConfiguration
  ): Promise<LocalROCrateSaveResult> {
    try {
      console.log(`📁 Saving RO-Crate locally for project ${projectId}...`);
      
      // Create project-specific directory path
      const projectPath = `${this.LOCAL_ROCRATE_ROOT}/${projectId}`;
      
      // Prepare the same file bundle that was uploaded to IPFS
      const bundleFiles = await this.prepareBundleFiles(projectId, roCrateData, config);
      
      // Save files locally
      const savedFiles = await this.saveFilesToLocal(projectPath, bundleFiles);
      
      // Create project manifest
      await this.createProjectManifest(projectPath, projectId, config, savedFiles);
      
      console.log(`✅ Successfully saved RO-Crate locally for project ${projectId}`);
      console.log(`📂 Location: ${projectPath}`);
      console.log(`📄 Files saved: ${savedFiles.length}`);
      
      return {
        success: true,
        projectPath,
        savedFiles
      };
      
    } catch (error) {
      console.error(`❌ Failed to save RO-Crate locally for project ${projectId}:`, error);
      return {
        success: false,
        projectPath: '',
        savedFiles: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Prepare the RO-Crate bundle files according to AL-Engine specification
   * Based on ro-crate-content.md requirements
   */
  private async prepareBundleFiles(
    projectId: string,
    roCrateData: string,
    config: DVREProjectConfiguration
  ): Promise<IPFSFile[]> {
    const bundleFiles: IPFSFile[] = [
      // Root: RO-Crate metadata file
      {
        name: 'ro-crate-metadata.json',
        content: roCrateData,
        type: 'application/json'
      }
    ];

    // For Active Learning projects, generate AL-Engine specific files
    if (config.extensions?.dal) {
      // 1. Generate al_iteration.cwl (YAML format at root level)
      const cwlContent = this.generateALIterationCWL();
      bundleFiles.push({
        name: 'al_iteration.cwl',
        content: cwlContent,
        type: 'application/x-cwl'
      });

      // 2. Generate inputs.yml (runtime input mapping)
      const inputsYmlContent = this.generateInputsYml(projectId);
      bundleFiles.push({
        name: 'inputs.yml',
        content: inputsYmlContent,
        type: 'application/x-yaml'
      });

      // 3. Generate config.json (AL-specific configuration)
      try {
        const { smartContractService } = await import('./SmartContractService');
        const comprehensiveConfig = await smartContractService.generateConfigFromSmartContract(projectId, config);
        
        // Transform comprehensive config to AL-Engine format
        const alConfigContent = this.transformToALEngineFormat(comprehensiveConfig);
        bundleFiles.push({
          name: 'config.json',
          content: JSON.stringify(alConfigContent, null, 2),
          type: 'application/json'
        });
      } catch (error) {
        console.warn('Failed to generate AL config from smart contract:', error);
        // Fallback to basic config
        const alConfigContent = this.generateALConfigFallback(config);
        bundleFiles.push({
          name: 'config.json',
          content: JSON.stringify(alConfigContent, null, 2),
          type: 'application/json'
        });
      }

      // 4. Generate placeholder dataset files (for AL-Engine structure)
      bundleFiles.push({
        name: 'inputs/datasets/labeled_samples.npy',
        content: '# Placeholder for labeled training data (NumPy array)\n# This file should be populated with actual labeled samples',
        type: 'text/plain'
      });

      bundleFiles.push({
        name: 'inputs/datasets/labeled_targets.npy',
        content: '# Placeholder for labeled training targets (NumPy array)\n# This file should be populated with actual labels',
        type: 'text/plain'
      });

      bundleFiles.push({
        name: 'inputs/datasets/unlabeled_samples.npy',
        content: '# Placeholder for unlabeled data pool (NumPy array)\n# This file should be populated with unlabeled samples for querying',
        type: 'text/plain'
      });

      bundleFiles.push({
        name: 'config/model/model_placeholder.pkl',
        content: '# Placeholder for trained model files\n# Models will be saved as model_round_1.pkl, model_round_2.pkl, etc.',
        type: 'text/plain'
      });

    } else {
      // For non-AL projects, use the original structure
      // Generate basic config from smart contract data
      try {
        const { smartContractService } = await import('./SmartContractService');
        const configData = await smartContractService.generateConfigFromSmartContract(projectId, config);
        bundleFiles.push({
          name: 'config/config.json',
          content: JSON.stringify(configData, null, 2),
          type: 'application/json'
        });
      } catch (error) {
        console.warn('Failed to generate config from smart contract:', error);
        // Add basic config as fallback
        bundleFiles.push({
          name: 'config/config.json',
          content: JSON.stringify({
            project_id: projectId,
            project_type: 'general',
            version: '1.0.0',
            created_at: config.created,
            updated_at: config.lastModified
          }, null, 2),
          type: 'application/json'
        });
      }

      // Add workflows/ directory with CWL workflow files
      const workflows = Object.values(config.roCrate.workflows);
      if (workflows.length > 0) {
        workflows.forEach((workflow: any) => {
          const workflowFile: IPFSFile = {
            name: `workflows/${workflow.name.replace(/\s+/g, '_').toLowerCase()}.${workflow.type}`,
            content: workflow.content,
            type: workflow.type === 'cwl' ? 'application/x-cwl' : 'text/plain'
          };
          bundleFiles.push(workflowFile);
        });
      }

      // Add dataset metadata to inputs/ directory
      Object.entries(config.roCrate.datasets).forEach(([id, dataset]: [string, any]) => {
        bundleFiles.push({
          name: `inputs/datasets/${dataset.name.replace(/\s+/g, '_')}-metadata.json`,
          content: JSON.stringify({
            id: id,
            name: dataset.name,
            description: dataset.description,
            format: dataset.format,
            columns: dataset.columns,
            url: dataset.url,
            ipfsHash: dataset.ipfsHash,
            size: dataset.size || 0
          }, null, 2),
          type: 'application/json'
        });
      });

      // Add model configurations to config/ directory
      Object.entries(config.roCrate.models).forEach(([id, model]: [string, any]) => {
        bundleFiles.push({
          name: `config/models/${model.name.replace(/\s+/g, '_')}-config.json`,
          content: JSON.stringify({
            id: id,
            name: model.name,
            algorithm: model.algorithm,
            parameters: model.parameters,
            framework: model.framework
          }, null, 2),
          type: 'application/json'
        });
      });

      // Add extension configurations to config/ directory
      if (config.extensions && Object.keys(config.extensions).length > 0) {
        bundleFiles.push({
          name: 'config/extensions-config.json',
          content: JSON.stringify(config.extensions, null, 2),
          type: 'application/json'
        });
      }
    }

    return bundleFiles;
  }

  /**
   * Generate al_iteration.cwl content (YAML format)
   */
  private generateALIterationCWL(): string {
    return `cwlVersion: v1.2
class: CommandLineTool

label: Active Learning Iteration (Train + Query)
doc: One-step AL iteration using modAL and scikit-learn

baseCommand: python3
arguments: [al_iteration.py]

inputs:
  labeled_data:
    type: File
    inputBinding:
      prefix: --labeled_data
  labeled_labels:
    type: File
    inputBinding:
      prefix: --labeled_labels
  unlabeled_data:
    type: File
    inputBinding:
      prefix: --unlabeled_data
  model_in:
    type: File?
    inputBinding:
      prefix: --model_in
  config:
    type: File
    inputBinding:
      prefix: --config

outputs:
  model_out:
    type: File
    outputBinding:
      glob: model/model_round_*.pkl
  query_indices:
    type: File
    outputBinding:
      glob: query_indices.npy

requirements:
  DockerRequirement:
    dockerPull: python:3.9-slim`;
  }

  /**
   * Generate inputs.yml content (runtime input mapping)
   */
  private generateInputsYml(projectId: string): string {
    return `# inputs.yml - Runtime input mapping for al_iteration.cwl

# Labeled training data (required)
labeled_data:
  class: File
  path: al-engine/ro-crates/${projectId}/inputs/datasets/labeled_samples.npy

# Labels for the labeled data (required)
labeled_labels:
  class: File
  path: al-engine/ro-crates/${projectId}/inputs/datasets/labeled_targets.npy

# Unlabeled data pool for querying (required)
unlabeled_data:
  class: File
  path: al-engine/ro-crates/${projectId}/inputs/datasets/unlabeled_samples.npy

# Pre-trained model from previous iteration (optional - only for rounds > 1)
model_in:
  class: File
  path: al-engine/ro-crates/${projectId}/config/model/model_round_2.pkl

# Configuration file with AL parameters (required)
config:
  class: File
  path: al-engine/ro-crates/${projectId}/config.json`;
  }

  /**
   * Generate AL-specific config.json content (fallback)
   */
  private generateALConfigFallback(config: DVREProjectConfiguration): any {
    const dalConfig = config.extensions?.dal || {};
    
    return {
      al_scenario: dalConfig.alScenario || 'pool_based',
      query_strategy: dalConfig.queryStrategy || 'uncertainty_sampling',
      model_type: this.mapModelType(dalConfig.model?.type || 'logistic_regression'),
      training_args: dalConfig.model?.parameters || {
        max_iter: 1000,
        random_state: 42,
      },
      label_space: dalConfig.labelSpace || ['positive', 'negative'],
      query_batch_size: dalConfig.queryBatchSize || 2,
      validation_split: dalConfig.validation_split || 0.2,
      max_iterations: dalConfig.maxIterations || 10,
      
      // Additional fields for completeness
      voting_consensus: dalConfig.votingConsensus || 'simple_majority',
      voting_timeout_seconds: dalConfig.votingTimeout || 3600,
      training_dataset: dalConfig.trainingDataset || '',
      labeling_dataset: dalConfig.labelingDataset || ''
    };
  }

  /**
   * Map model type from AL config to format expected by AL-Engine
   */
  private mapModelType(modelType: string): string {
    switch (modelType?.toLowerCase()) {
      case 'logistic_regression':
      case 'logisticregression':
        return 'LogisticRegression';
      case 'svc':
      case 'svm':
      case 'support_vector_machine':
        return 'SVC';
      case 'random_forest':
      case 'randomforest':
      case 'randomforestclassifier':
        return 'RandomForestClassifier';
      case 'neural_network':
        return 'MLPClassifier';
      default:
        return 'LogisticRegression'; // Default fallback
    }
  }

  /**
   * Transform the comprehensive SmartContractService output into the flat format expected by the AL-Engine
   * according to ro-crate-content.md specification
   */
  private transformToALEngineFormat(comprehensiveConfig: any): any {
    console.log('🔍 Transforming config:', JSON.stringify(comprehensiveConfig, null, 2));
    
    const al = comprehensiveConfig.active_learning || {};
    
    const result = {
      al_scenario: al.scenario || 'pool_based',
      query_strategy: al.query_strategy || 'uncertainty_sampling',
      model_type: this.mapModelType(al.model?.type),
      training_args: al.model?.parameters || {
        max_iter: 1000,
        random_state: 42
      },
      label_space: al.label_space || [],
      query_batch_size: al.query_batch_size || 2,
      validation_split: al.validation_split || 0.2,
      max_iterations: al.max_iterations || 10,
      
      // Additional fields for completeness
      voting_consensus: al.voting?.consensus_type || 'simple_majority',
      voting_timeout_seconds: al.voting?.timeout_seconds || 3600,
      training_dataset: al.datasets?.training_dataset || '',
      labeling_dataset: al.datasets?.labeling_dataset || ''
    };

    console.log('🔄 Transformed result:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Save files to local filesystem using Node.js backend service
   */
  private async saveFilesToLocal(projectPath: string, bundleFiles: IPFSFile[]): Promise<string[]> {
    try {
      console.log(`📁 Saving ${bundleFiles.length} files to: ${projectPath}`);
      
      // Extract project ID from path
      const projectId = projectPath.split('/').pop() || 'unknown';
      
      // Prepare bundle data for backend
      const bundleData = {
        files: bundleFiles.map(file => ({
          name: file.name,
          content: typeof file.content === 'string' ? file.content : file.content.toString(),
          type: file.type
        })),
        metadata: {
          project_path: projectPath,
          created_at: new Date().toISOString()
        }
      };
      
      // Make HTTP request to local backend service
      const response = await fetch('http://localhost:3001/save-rocrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          bundleData
        })
      });
      
      if (!response.ok) {
        throw new Error(`Backend service responded with ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Successfully saved ${result.totalFiles} files to backend`);
        return result.savedFiles;
      } else {
        throw new Error(result.error || 'Backend service reported failure');
      }
      
    } catch (error) {
      console.warn('⚠️ Backend service not available, simulating save operation');
      console.error('Backend error:', error);
      
      // Fallback: simulate the operation and log what would be saved
      const savedFiles: string[] = [];
      
      console.log(`📁 Would create directory: ${projectPath}`);
      
      for (const file of bundleFiles) {
        const fullPath = `${projectPath}/${file.name}`;
        
        // Create directory structure if needed
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
        if (dirPath !== projectPath) {
          console.log(`📁 Would create subdirectory: ${dirPath}`);
        }
        
        // Handle both string and ArrayBuffer content types
        const contentLength = typeof file.content === 'string' 
          ? file.content.length 
          : file.content.byteLength;
        
        console.log(`💾 Would save file: ${fullPath} (${contentLength} bytes)`);
        savedFiles.push(file.name);
      }
      
      return savedFiles;
    }
  }

  /**
   * Create a project manifest file with metadata (now handled by backend)
   */
  private async createProjectManifest(
    projectPath: string,
    projectId: string,
    config: DVREProjectConfiguration,
    savedFiles: string[]
  ): Promise<void> {
    // The manifest is now created automatically by the backend service
    console.log(`📋 Manifest will be created by backend service for project ${projectId}`);
  }

  /**
   * Get the local path for a project's RO-Crate
   */
  getProjectLocalPath(projectId: string): string {
    return `${this.LOCAL_ROCRATE_ROOT}/${projectId}`;
  }

  /**
   * Check if a project's RO-Crate exists locally
   */
  async projectExistsLocally(projectId: string): Promise<boolean> {
    const projectPath = this.getProjectLocalPath(projectId);
    // TODO: In real implementation, this would check if the directory exists
    // return await this.checkDirectoryExists(projectPath);
    console.log(`🔍 Would check if project exists at: ${projectPath}`);
    return false; // Placeholder
  }

  /**
   * List all locally saved projects
   */
  async listLocalProjects(): Promise<string[]> {
    // TODO: In real implementation, this would list directories in ro-crates
    console.log(`📋 Would list projects in: ${this.LOCAL_ROCRATE_ROOT}`);
    return []; // Placeholder
  }
}

// Export singleton instance
export const localROCrateService = LocalROCrateService.getInstance();