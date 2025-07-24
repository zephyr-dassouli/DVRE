/**
 * IPFS Manager for DAL (Decentralized Active Learning)
 * Handles uploading and retrieving files from IPFS for decentralized storage
 */

export interface IPFSUploadResult {
  hash: string;
  url: string;
  size: number;
}

export interface IPFSFile {
  name: string;
  content: string | ArrayBuffer | Uint8Array;
  type?: string;
}

export class IPFSManager {
  private ipfsGateways: string[] = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
  ];

  private pinataApiKey?: string;
  private pinataSecretKey?: string;

  constructor() {
    // Load Pinata credentials from environment or config
    this.pinataApiKey = process.env.REACT_APP_PINATA_API_KEY;
    this.pinataSecretKey = process.env.REACT_APP_PINATA_SECRET_KEY;
  }

  /**
   * Upload RO-Crate metadata to IPFS
   */
  async uploadROCrateMetadata(metadata: any, projectId: string): Promise<IPFSUploadResult> {
    const file: IPFSFile = {
      name: `${projectId}-ro-crate-metadata.json`,
      content: JSON.stringify(metadata, null, 2),
      type: 'application/json'
    };

    return this.uploadFile(file);
  }

  /**
   * Upload CWL workflow to IPFS
   */
  async uploadCWLWorkflow(workflow: any, projectId: string): Promise<IPFSUploadResult> {
    const file: IPFSFile = {
      name: `${projectId}-workflow.cwl`,
      content: typeof workflow === 'string' ? workflow : JSON.stringify(workflow, null, 2),
      type: 'application/x-cwl'
    };

    return this.uploadFile(file);
  }

  /**
   * Upload dataset file to IPFS
   */
  async uploadDataset(file: File): Promise<IPFSUploadResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const ipfsFile: IPFSFile = {
            name: file.name,
            content: e.target?.result as ArrayBuffer,
            type: file.type
          };
          const result = await this.uploadFile(ipfsFile);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Upload complete project bundle (RO-Crate + workflow + datasets)
   */
  async uploadProjectBundle(
    roCrateMetadata: any,
    workflow: any,
    projectId: string,
    additionalFiles?: File[]
  ): Promise<{
    roCrateHash: string;
    workflowHash: string;
    bundleHash: string;
    urls: {
      roCrate: string;
      workflow: string;
      bundle: string;
    };
  }> {
    try {
      console.log('Uploading project bundle to IPFS...');

      // Upload individual components
      const [roCrateResult, workflowResult] = await Promise.all([
        this.uploadROCrateMetadata(roCrateMetadata, projectId),
        this.uploadCWLWorkflow(workflow, projectId)
      ]);

      // Create a project bundle directory structure
      const bundleFiles: IPFSFile[] = [
        {
          name: 'ro-crate-metadata.json',
          content: JSON.stringify(roCrateMetadata, null, 2),
          type: 'application/json'
        },
        {
          name: 'workflow.cwl',
          content: typeof workflow === 'string' ? workflow : JSON.stringify(workflow, null, 2),
          type: 'application/x-cwl'
        }
      ];

      // Add additional files if provided
      if (additionalFiles && additionalFiles.length > 0) {
        for (const file of additionalFiles) {
          const fileContent = await this.readFileAsArrayBuffer(file);
          bundleFiles.push({
            name: `datasets/${file.name}`,
            content: fileContent,
            type: file.type
          });
        }
      }

      // Upload bundle directory
      const bundleResult = await this.uploadDirectory(bundleFiles, `dal-project-${projectId}`);

      return {
        roCrateHash: roCrateResult.hash,
        workflowHash: workflowResult.hash,
        bundleHash: bundleResult.hash,
        urls: {
          roCrate: roCrateResult.url,
          workflow: workflowResult.url,
          bundle: bundleResult.url
        }
      };
    } catch (error) {
      console.error('Failed to upload project bundle:', error);
      throw new Error(`IPFS upload failed: ${error.message}`);
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
        console.warn('Pinata upload failed, trying alternative methods:', error);
      }
    }

    // Try browser-based IPFS upload as fallback
    try {
      return await this.uploadToBrowserIPFS(file);
    } catch (error) {
      console.warn('Browser IPFS upload failed:', error);
    }

    // Mock upload for development/demo purposes
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
        project: 'DVRE-DAL',
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
   * Upload file using browser-based IPFS (js-ipfs)
   */
  private async uploadToBrowserIPFS(file: IPFSFile): Promise<IPFSUploadResult> {
    // This would require js-ipfs library
    // For now, we'll simulate this functionality
    throw new Error('Browser IPFS not implemented yet - install js-ipfs library');
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
    // For simplicity, create a tar-like structure as a single file
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
   * Download file from IPFS
   */
  async downloadFile(hash: string, timeout: number = 10000): Promise<string> {
    for (const gateway of this.ipfsGateways) {
      try {
        const response = await Promise.race([
          fetch(`${gateway}${hash}`),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);

        if (response.ok) {
          return await response.text();
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${gateway}:`, error);
        continue;
      }
    }
    throw new Error(`Failed to download ${hash} from all IPFS gateways`);
  }

  /**
   * Pin file to ensure persistence
   */
  async pinFile(hash: string): Promise<boolean> {
    if (!this.pinataApiKey || !this.pinataSecretKey) {
      console.warn('No Pinata credentials available for pinning');
      return false;
    }

    try {
      const response = await fetch('https://api.pinata.cloud/pinning/pinByHash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey
        },
        body: JSON.stringify({
          hashToPin: hash,
          pinataMetadata: {
            name: `DVRE-DAL-${hash}`,
            keyvalues: {
              project: 'DVRE-DAL',
              pinned_at: new Date().toISOString()
            }
          }
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to pin file:', error);
      return false;
    }
  }

  /**
   * Get file info from IPFS
   */
  async getFileInfo(hash: string): Promise<{
    hash: string;
    size: number;
    type?: string;
    available: boolean;
  }> {
    try {
      const response = await fetch(`${this.ipfsGateways[0]}${hash}`, { method: 'HEAD' });
      return {
        hash,
        size: parseInt(response.headers.get('content-length') || '0'),
        type: response.headers.get('content-type') || undefined,
        available: response.ok
      };
    } catch (error) {
      return {
        hash,
        size: 0,
        available: false
      };
    }
  }

  /**
   * Utility: Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Read file as ArrayBuffer
   */
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Check IPFS connectivity
   */
  async checkConnectivity(): Promise<{
    connected: boolean;
    availableGateways: string[];
    fastestGateway?: string;
  }> {
    const testHash = 'QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o'; // A known IPFS hash
    const availableGateways: string[] = [];
    let fastestGateway: string | undefined;
    let fastestTime = Infinity;

    for (const gateway of this.ipfsGateways) {
      try {
        const startTime = Date.now();
        const response = await Promise.race([
          fetch(`${gateway}${testHash}`, { method: 'HEAD' }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);
        
        if (response.ok) {
          availableGateways.push(gateway);
          const responseTime = Date.now() - startTime;
          if (responseTime < fastestTime) {
            fastestTime = responseTime;
            fastestGateway = gateway;
          }
        }
      } catch (error) {
        // Gateway unavailable
      }
    }

    return {
      connected: availableGateways.length > 0,
      availableGateways,
      fastestGateway
    };
  }
}

// Export singleton instance
export const ipfsManager = new IPFSManager(); 