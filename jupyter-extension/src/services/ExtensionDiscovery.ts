import { PathExt } from '@jupyterlab/coreutils';
import { Token } from '@lumino/coreutils';
import * as path from 'path';

export interface IExtensionManifest {
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  entrypoint: string;
  category?: string;
  backend?: {
    dockerfile: string;
    port: number;
    endpoints?: string[];
  };
  compute?: {
    dockerfile: string;
    volumes: string[];
    capabilities?: string[];
  };
  workflows?: string;
  permissions: string[];
  dependencies: Record<string, string>;
  metadata?: {
    category?: string;
    tags?: string[];
    homepage?: string;
    repository?: string;
    license?: string;
  };
}

export interface IExtensionInfo {
  name: string;
  path: string;
  manifest: IExtensionManifest;
}

export interface IExtensionDiscovery {
  discoverExtensions(): Promise<IExtensionInfo[]>;
  loadExtension(extensionInfo: IExtensionInfo): Promise<any>;
}

export const IExtensionDiscovery = new Token<IExtensionDiscovery>(
  '@dvre/core:IExtensionDiscovery'
);

export class ExtensionDiscovery implements IExtensionDiscovery {
  private readonly _dAppsPath: string;

  constructor(basePath?: string) {
    // Try to find the dApps folder by looking in the current directory and parent directories
    const currentDir = basePath || process.cwd();
    
    // Check if dApps exists in current directory
    let dAppsPath = PathExt.join(currentDir, 'dApps');
    
    // If not found and we're in jupyter-extension, look one level up
    if (currentDir.includes('jupyter-extension')) {
      const parentDir = path.dirname(currentDir);
      dAppsPath = PathExt.join(parentDir, 'dApps');
    }
    
    this._dAppsPath = dAppsPath;
    console.log(`ExtensionDiscovery: Looking for dApps in: ${this._dAppsPath}`);
  }

  async discoverExtensions(): Promise<IExtensionInfo[]> {
    const extensions: IExtensionInfo[] = [];

    try {
      // In a browser environment, we need to use fetch to read files
      // For now, we'll check for known extensions, but this could be made dynamic
      const knownExtensions = ['dal']; 

      for (const extensionName of knownExtensions) {
        try {
          // Try to fetch the manifest.json file
          const manifestPath = `../dApps/${extensionName}/manifest.json`;
          const response = await fetch(manifestPath);
          
          if (response.ok) {
            const manifest: IExtensionManifest = await response.json();
            
            extensions.push({
              name: extensionName,
              path: PathExt.join(this._dAppsPath, extensionName),
              manifest
            });
            
            console.log(`Discovered dApp extension: ${manifest.displayName}`);
          } else {
            console.warn(`Could not load manifest for ${extensionName}: ${response.statusText}`);
          }
        } catch (error) {
          console.warn(`Failed to load extension ${extensionName}:`, error);
          
          // Fallback to hardcoded manifest for DAL if file reading fails
          if (extensionName === 'dal') {
            const fallbackManifest: IExtensionManifest = {
              name: 'dal',
              displayName: 'Decentralized Active Learning',
              version: '1.0.0',
              description: 'Active Learning dApp for DVRE platform with CWL-orchestrated backend and AL engine',
              author: 'DVRE Team',
              entrypoint: 'extension/index.js',
              backend: {
                dockerfile: 'backend/Dockerfile',
                port: 8001,
                endpoints: [
                  "/api/projects/{project_id}/start-workflow",
                  "/api/projects/{project_id}/status",
                  "/api/projects/{project_id}/submit-labels"
                ]
              },
              compute: {
                dockerfile: 'al-engine/Dockerfile',
                volumes: ['/dal_data'],
                capabilities: [
                  "uncertainty_sampling",
                  "entropy_sampling", 
                  "random_sampling",
                  "model_training"
                ]
              },
              workflows: 'workflows/',
              permissions: [
                'blockchain:read',
                'blockchain:write',
                'storage:read',
                'storage:write',
                'dvre:project_access',
                'dvre:cwl_execution'
              ],
              dependencies: {
                '@dvre/core': '>=1.0.0',
                'ethers': '^6.x.x',
                'react': '^18.x.x'
              },
              metadata: {
                category: 'Machine Learning',
                tags: ['active-learning', 'machine-learning', 'decentralized'],
                license: 'MIT'
              }
            };

            extensions.push({
              name: extensionName,
              path: PathExt.join(this._dAppsPath, extensionName),
              manifest: fallbackManifest
            });
            
            console.log(`Using fallback manifest for ${extensionName}`);
          }
        }
      }
    } catch (error) {
      console.warn('Error discovering extensions:', error);
    }

    console.log(`Discovered ${extensions.length} dApp extension(s)`);
    return extensions;
  }

  async loadExtension(extensionInfo: IExtensionInfo): Promise<any> {
    try {
      console.log(`Loading dApp extension: ${extensionInfo.manifest.displayName}`);
      
      // For now, we'll return the extension info
      // In a real implementation, this would dynamically import the extension module
      // and create the appropriate widget components
      return extensionInfo;
    } catch (error) {
      console.error(`Failed to load extension ${extensionInfo.name}:`, error);
      throw error;
    }
  }
} 