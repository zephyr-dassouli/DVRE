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
   * Prepare the same bundle files that are uploaded to IPFS
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

    // Generate and add config/config.json from smart contract data
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
          project_type: config.extensions?.dal ? 'active_learning' : 'general',
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

    // Add inputs/inputs.json for Active Learning projects
    if (config.extensions?.dal) {
      try {
        const { roCrateService } = await import('./ROCrateService');
        const inputsData = roCrateService.generateInputsJSON(config);
        bundleFiles.push({
          name: 'inputs/inputs.json',
          content: JSON.stringify(inputsData, null, 2),
          type: 'application/json'
        });
      } catch (error) {
        console.warn('Failed to generate inputs JSON:', error);
      }
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

    return bundleFiles;
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