import config from '../config';

export interface IPFSFile {
  Hash: string;
  Name: string;
  Size: number;
  Type: number;
}

export interface IPFSListResponse {
  Keys: {
    [key: string]: {
      Type: string;
    };
  };
}

export interface IPFSAddResponse {
  Name: string;
  Hash: string;
  Size: string;
}

export class IPFSService {
  private readonly baseUrl = config.ipfs.baseUrl;
  private readonly publicUrl = config.ipfs.publicUrl;
  private readonly apiKey = config.ipfs.apiKey;
  private readonly healthUrl = config.ipfs.healthUrl;

  private getHeaders(): Record<string, string> {
    return {
      'X-API-Key': this.apiKey
    };
  }

  private getFormHeaders(): Record<string, string> {
    return {
      'X-API-Key': this.apiKey
      // Don't set Content-Type for FormData - let browser set it
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.healthUrl);
      return response.ok;
    } catch (error) {
      console.error('IPFS health check failed:', error);
      return false;
    }
  }

  async listFiles(): Promise<IPFSFile[]> {
    const response = await fetch(`${this.baseUrl}/pin/ls`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: IPFSListResponse = await response.json();
    
    // Convert the response to a more usable format
    return Object.entries(data.Keys || {}).map(([hash, info]) => ({
      Hash: hash,
      Name: hash, // IPFS doesn't store original filenames in pin/ls
      Size: 0, // Size not available in pin/ls response
      Type: info.Type === 'recursive' ? 1 : 0
    }));
  }

  async uploadFile(file: File): Promise<IPFSAddResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/add`, {
      method: 'POST',
      headers: this.getFormHeaders(),
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: IPFSAddResponse = await response.json();
    return data;
  }

  async downloadFile(hash: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/cat?arg=${hash}`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  getPublicUrl(hash: string): string {
    return `${this.publicUrl}/${hash}`;
  }

  async getFileContent(hash: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/cat?arg=${hash}`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.text();
  }
}

export const ipfsService = new IPFSService();
