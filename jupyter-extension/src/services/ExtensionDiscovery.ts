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
  backend?: {
    dockerfile: string;
    port: number;
  };
  compute?: {
    dockerfile: string;
    volumes: string[];
  };
  workflows?: string;
  permissions: string[];
  dependencies: Record<string, string>;
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
      // For now, we'll use a simple file-based discovery
      // In a real implementation, this would use proper file system APIs
      const knownExtensions = ['dal']; // We'll expand this dynamically later

      for (const extensionName of knownExtensions) {
        const extensionPath = PathExt.join(this._dAppsPath, extensionName);

        try {
          // In a real implementation, we'd read the actual file
          // For now, we'll simulate the DAL extension
          if (extensionName === 'dal') {
            const manifest: IExtensionManifest = {
              name: 'dal',
              displayName: 'Decentralized Active Learning',
              version: '1.0.0',
              description: 'Active Learning dApp for DVRE',
              author: 'DVRE Team',
              entrypoint: 'extension/index.js',
              backend: {
                dockerfile: 'backend/Dockerfile',
                port: 8001
              },
              compute: {
                dockerfile: 'al-engine/Dockerfile',
                volumes: ['/dal_data']
              },
              workflows: 'workflows/',
              permissions: [
                'blockchain:read',
                'blockchain:write',
                'storage:read',
                'storage:write'
              ],
              dependencies: {
                '@dvre/core': '>=1.0.0'
              }
            };

            extensions.push({
              name: extensionName,
              path: extensionPath,
              manifest
            });
          }
        } catch (error) {
          console.warn(`Failed to load extension ${extensionName}:`, error);
        }
      }
    } catch (error) {
      console.warn('Error discovering extensions:', error);
    }

    return extensions;
  }

  async loadExtension(extensionInfo: IExtensionInfo): Promise<any> {
    try {
      console.log(`Loading dApp extension: ${extensionInfo.manifest.displayName}`);
      
      // For now, we'll return the extension info
      // In a real implementation, this would dynamically import the extension module
      return extensionInfo;
    } catch (error) {
      console.error(`Failed to load extension ${extensionInfo.name}:`, error);
      throw error;
    }
  }
} 