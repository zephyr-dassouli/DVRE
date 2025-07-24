/**
 * Smart Contract Integration for DAL Projects
 * Handles updating project contracts with IPFS hashes and status
 */

import { ethers } from 'ethers';

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface SmartContractUpdateData {
  projectId: string;
  contractAddress: string;
  ipfsRoCrateHash: string;
  ipfsWorkflowHash: string;
  ipfsBundleHash: string;
  status: 'configured' | 'ready' | 'active' | 'paused' | 'completed';
}

export interface ContractUpdateResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: string;
}

export class SmartContractIntegration {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;

  constructor() {
    this.initializeProvider();
  }

  /**
   * Initialize Web3 provider (MetaMask)
   */
  private async initializeProvider() {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
    }
  }

  /**
   * Update project contract with IPFS hashes and status
   */
  async updateProjectWithIPFS(data: SmartContractUpdateData): Promise<ContractUpdateResult> {
    try {
      if (!this.provider || !this.signer) {
        await this.initializeProvider();
        if (!this.provider || !this.signer) {
          throw new Error('Web3 provider not available');
        }
      }

      // This is a simplified contract interface
      // In practice, you'd load the actual project contract ABI
      const contractInterface = new ethers.Interface([
        "function updateProjectMetadata(string calldata ipfsRoCrateHash, string calldata ipfsWorkflowHash, string calldata ipfsBundleHash, uint8 status) external",
        "function setProjectStatus(uint8 status) external",
        "function getProjectMetadata() external view returns (string memory, string memory, string memory, uint8)"
      ]);

      const contract = new ethers.Contract(
        data.contractAddress,
        contractInterface,
        this.signer
      );

      // Convert status to uint8
      const statusMap = {
        'configured': 1,
        'ready': 2,
        'active': 3,
        'paused': 4,
        'completed': 5
      };

      const statusCode = statusMap[data.status] || 0;

      console.log('Updating smart contract with IPFS data:', {
        contract: data.contractAddress,
        roCrateHash: data.ipfsRoCrateHash,
        workflowHash: data.ipfsWorkflowHash,
        bundleHash: data.ipfsBundleHash,
        status: statusCode
      });

      // Call the contract method
      const transaction = await contract.updateProjectMetadata(
        data.ipfsRoCrateHash,
        data.ipfsWorkflowHash,
        data.ipfsBundleHash,
        statusCode
      );

      console.log('Transaction submitted:', transaction.hash);

      // Wait for confirmation
      const receipt = await transaction.wait();

      console.log('Transaction confirmed:', receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error: any) {
      console.error('Smart contract update failed:', error);
      
      return {
        success: false,
        error: error.message || 'Unknown contract error'
      };
    }
  }

  /**
   * Mock smart contract update for development
   */
  async mockUpdateProjectWithIPFS(data: SmartContractUpdateData): Promise<ContractUpdateResult> {
    console.log('Mock smart contract update:', data);
    
    // Simulate transaction delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    
    return {
      success: true,
      transactionHash: mockTxHash,
      gasUsed: '45000'
    };
  }

  /**
   * Update only project status (lighter transaction)
   */
  async updateProjectStatus(
    contractAddress: string, 
    status: SmartContractUpdateData['status']
  ): Promise<ContractUpdateResult> {
    try {
      if (!this.provider || !this.signer) {
        await this.initializeProvider();
        if (!this.provider || !this.signer) {
          throw new Error('Web3 provider not available');
        }
      }

      const contractInterface = new ethers.Interface([
        "function setProjectStatus(uint8 status) external"
      ]);

      const contract = new ethers.Contract(
        contractAddress,
        contractInterface,
        this.signer
      );

      const statusMap = {
        'configured': 1,
        'ready': 2,
        'active': 3,
        'paused': 4,
        'completed': 5
      };

      const statusCode = statusMap[status] || 0;

      const transaction = await contract.setProjectStatus(statusCode);
      const receipt = await transaction.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error: any) {
      console.error('Status update failed:', error);
      
      return {
        success: false,
        error: error.message || 'Unknown contract error'
      };
    }
  }

  /**
   * Read project metadata from contract
   */
  async getProjectMetadata(contractAddress: string): Promise<{
    ipfsRoCrateHash: string;
    ipfsWorkflowHash: string;
    ipfsBundleHash: string;
    status: number;
  } | null> {
    try {
      if (!this.provider) {
        await this.initializeProvider();
        if (!this.provider) {
          throw new Error('Web3 provider not available');
        }
      }

      const contractInterface = new ethers.Interface([
        "function getProjectMetadata() external view returns (string memory, string memory, string memory, uint8)"
      ]);

      const contract = new ethers.Contract(
        contractAddress,
        contractInterface,
        this.provider
      );

      const result = await contract.getProjectMetadata();

      return {
        ipfsRoCrateHash: result[0],
        ipfsWorkflowHash: result[1],
        ipfsBundleHash: result[2],
        status: result[3]
      };

    } catch (error: any) {
      console.error('Failed to read contract metadata:', error);
      return null;
    }
  }

  /**
   * Check if user is authorized to update contract
   */
  async checkUpdatePermission(contractAddress: string, userAddress: string): Promise<boolean> {
    try {
      if (!this.provider) {
        await this.initializeProvider();
        if (!this.provider) {
          return false;
        }
      }

      // This would check if the user is the project coordinator or has update permissions
      const contractInterface = new ethers.Interface([
        "function coordinator() external view returns (address)",
        "function hasUpdatePermission(address user) external view returns (bool)"
      ]);

      const contract = new ethers.Contract(
        contractAddress,
        contractInterface,
        this.provider
      );

      try {
        // Try to check if user is coordinator
        const coordinator = await contract.coordinator();
        if (coordinator.toLowerCase() === userAddress.toLowerCase()) {
          return true;
        }
      } catch (e) {
        // Method might not exist
      }

      try {
        // Try to check update permission
        const hasPermission = await contract.hasUpdatePermission(userAddress);
        return hasPermission;
      } catch (e) {
        // Method might not exist, assume false
        return false;
      }

    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  /**
   * Get estimated gas cost for contract update
   */
  async estimateUpdateGas(data: SmartContractUpdateData): Promise<{
    gasEstimate: string;
    gasPriceGwei: string;
    estimatedCostEth: string;
  } | null> {
    try {
      if (!this.provider || !this.signer) {
        await this.initializeProvider();
        if (!this.provider || !this.signer) {
          return null;
        }
      }

      const contractInterface = new ethers.Interface([
        "function updateProjectMetadata(string calldata ipfsRoCrateHash, string calldata ipfsWorkflowHash, string calldata ipfsBundleHash, uint8 status) external"
      ]);

      const contract = new ethers.Contract(
        data.contractAddress,
        contractInterface,
        this.signer
      );

      const statusMap = {
        'configured': 1,
        'ready': 2,
        'active': 3,
        'paused': 4,
        'completed': 5
      };

      const statusCode = statusMap[data.status] || 0;

      const gasEstimate = await contract.updateProjectMetadata.estimateGas(
        data.ipfsRoCrateHash,
        data.ipfsWorkflowHash,
        data.ipfsBundleHash,
        statusCode
      );

      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const estimatedCost = gasEstimate * gasPrice;

      return {
        gasEstimate: gasEstimate.toString(),
        gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
        estimatedCostEth: ethers.formatEther(estimatedCost)
      };

    } catch (error) {
      console.error('Gas estimation failed:', error);
      return null;
    }
  }

  /**
   * Check if Web3 is available and connected
   */
  async checkConnection(): Promise<{
    available: boolean;
    connected: boolean;
    account?: string;
    network?: string;
  }> {
    try {
      if (!window.ethereum) {
        return { available: false, connected: false };
      }

      await this.initializeProvider();
      
      if (!this.provider || !this.signer) {
        return { available: true, connected: false };
      }

      const account = await this.signer.getAddress();
      const network = await this.provider.getNetwork();

      return {
        available: true,
        connected: true,
        account,
        network: network.name
      };

    } catch (error) {
      console.error('Connection check failed:', error);
      return { available: true, connected: false };
    }
  }
}

// Export singleton instance
export const smartContractIntegration = new SmartContractIntegration(); 