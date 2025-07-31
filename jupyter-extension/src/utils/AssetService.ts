import { ethers, BrowserProvider, Signer } from 'ethers';
import AssetFactoryABI from '../abis/AssetFactory.json';
import AssetABI from '../abis/Asset.json';
import config from '../config';
import { getFactoryAddressFromRegistry } from './registryClient.js';

export interface AssetInfo {
  address: string;
  owner: string;
  name: string;
  assetType: string;
  ipfsHash: string;
  created: number;
  updated: number;
}

export class AssetService {
  private provider: BrowserProvider | null = null;
  private signer: Signer | null = null;
  private assetFactoryAddress: string;
  private isInitialized: boolean = false;

  constructor() {
    this.assetFactoryAddress = config.blockchain.assetFactoryAddress;
    this.initializeProvider();
    this.initializeAssetFactory();
  }

  private async initializeProvider() {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        this.provider = new BrowserProvider((window as any).ethereum);
        
        // Check if MetaMask is unlocked
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          this.signer = await this.provider.getSigner();
          console.log('AssetService: Provider initialized with connected account');
        } else {
          console.log('AssetService: Provider initialized but no account connected');
        }
      } else {
        console.warn('AssetService: MetaMask not available');
      }
    } catch (error) {
      console.warn('AssetService: Failed to initialize Web3 provider:', error);
    }
  }

  private async initializeAssetFactory() {
    try {
      const registryAddress = await getFactoryAddressFromRegistry('AssetFactory');
      if (registryAddress) {
        this.assetFactoryAddress = registryAddress;
        console.log('AssetService: AssetFactory address loaded from registry:', registryAddress);
      } else {
        console.warn('AssetService: AssetFactory not found in registry, using config fallback:', this.assetFactoryAddress);
      }
    } catch (error) {
      console.warn('AssetService: Failed to get AssetFactory from registry, using config fallback:', error);
    }
    this.isInitialized = true;
  }

  isConfigured(): boolean {
    if (!this.isInitialized) {
      return false;
    }
    const configured = this.assetFactoryAddress !== '0x0000000000000000000000000000000000000000';
    return configured;
  }

  isMetaMaskAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).ethereum;
  }

  async connectWallet(): Promise<string> {
    if (!this.isMetaMaskAvailable()) {
      throw new Error('MetaMask is not installed. Please install MetaMask extension to use this application.');
    }

    try {
      // Use the legacy request method for better compatibility
      const accounts = await (window as any).ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask and try again.');
      }

      const account = accounts[0];
      
      // Update provider and signer
      this.provider = new BrowserProvider((window as any).ethereum);
      this.signer = await this.provider.getSigner();
      
      console.log('AssetService: Connected to account:', account);
      return account;
    } catch (error: any) {
      console.error('AssetService: Connection failed:', error);
      
      if (error.code === 4001) {
        throw new Error('Connection rejected by user. Please approve the connection in MetaMask.');
      } else if (error.code === -32002) {
        throw new Error('Connection request already pending. Please check MetaMask.');
      } else if (error.message?.includes("User rejected")) {
        throw new Error('Connection rejected. Please approve the connection in MetaMask.');
      } else if (error.message?.includes("setAccountsCallback")) {
        throw new Error('MetaMask compatibility issue. Please try refreshing the page and connecting again.');
      } else {
        throw new Error(`Connection failed: ${error.message || "Unknown error"}`);
      }
    }
  }

  async createAsset(name: string, assetType: string, ipfsHash: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected. Please connect your MetaMask wallet first.');
    }

    if (!this.isConfigured()) {
      throw new Error('Asset factory not configured. Please check your blockchain configuration.');
    }

    try {
      const factory = new ethers.Contract(
        this.assetFactoryAddress,
        AssetFactoryABI.abi,
        this.signer
      );

      console.log('AssetService: Creating asset with name:', name, 'type:', assetType, 'hash:', ipfsHash);
      const tx = await factory.createAsset(name, assetType, ipfsHash);
      console.log('AssetService: Transaction sent, waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log('AssetService: Transaction confirmed:', receipt.hash);

      // Extract the asset address from the event - Updated for ethers.js v6
      let assetAddress = null;
      
      console.log('AssetService: Parsing transaction receipt with', receipt.logs.length, 'logs');
      
      // Try to find the event in logs
      for (const log of receipt.logs) {
        try {
          const parsedLog = factory.interface.parseLog(log);
          console.log('AssetService: Parsed log:', parsedLog?.name);
          if (parsedLog && parsedLog.name === 'AssetCreated') {
            assetAddress = parsedLog.args.assetAddress;
            console.log('AssetService: Found AssetCreated event with address:', assetAddress);
            break;
          }
        } catch (e) {
          // This log doesn't belong to our contract or has parsing issues, continue silently
          continue;
        }
      }
      
      if (!assetAddress) {
        console.log('AssetService: No AssetCreated event found, trying fallback method');
        // Fallback: try the old method for compatibility
        try {
          const event = receipt.events?.find((e: any) => e.event === 'AssetCreated');
          assetAddress = event?.args?.assetAddress;
          if (assetAddress) {
            console.log('AssetService: Found asset address via fallback method:', assetAddress);
          }
        } catch (fallbackError) {
          console.log('AssetService: Fallback method also failed:', fallbackError);
        }
      }
      
      if (!assetAddress) {
        console.warn('AssetService: Could not extract asset address from events, but transaction succeeded');
        console.log('AssetService: Transaction hash:', receipt.hash);
        console.log('AssetService: Transaction status:', receipt.status);
        // Return a success indicator instead of throwing - the transaction succeeded
        return 'SUCCESS_NO_ADDRESS';
      }
      
      console.log('AssetService: Asset created at address:', assetAddress);
      return assetAddress;
    } catch (error: any) {
      console.error('AssetService: Failed to create asset:', error);
      
      if (error.message?.includes("insufficient funds")) {
        throw new Error('Insufficient funds for transaction. Please ensure your wallet has enough ETH for gas fees.');
      } else if (error.message?.includes("user rejected")) {
        throw new Error('Transaction rejected by user. Please approve the transaction in MetaMask.');
      } else {
        throw new Error(`Failed to create asset: ${error.message || "Unknown error"}`);
      }
    }
  }

  async getUserAssets(userAddress: string): Promise<AssetInfo[]> {
    if (!this.provider) {
      throw new Error('Provider not available. Please ensure MetaMask is installed and connected.');
    }

    if (!this.isConfigured()) {
      throw new Error('Asset factory not configured. Please check your blockchain configuration.');
    }

    try {
      const factory = new ethers.Contract(
        this.assetFactoryAddress,
        AssetFactoryABI.abi,
        this.provider
      );

      const assetAddresses = await factory.getUserAssets(userAddress);
      const assets: AssetInfo[] = [];

      for (const address of assetAddresses) {
        try {
          const assetInfo = await this.getAssetInfo(address);
          assets.push(assetInfo);
        } catch (error) {
          console.error(`AssetService: Failed to get info for asset ${address}:`, error);
        }
      }

      console.log(`AssetService: Retrieved ${assets.length} assets for user ${userAddress}`);
      return assets;
    } catch (error: any) {
      console.error('AssetService: Failed to get user assets:', error);
      throw new Error(`Failed to get user assets: ${error.message || "Unknown error"}`);
    }
  }

  async getAllAssets(): Promise<AssetInfo[]> {
    if (!this.provider) {
      throw new Error('Provider not available. Please ensure MetaMask is installed and connected.');
    }

    if (!this.isConfigured()) {
      throw new Error('Asset factory not configured. Please check your blockchain configuration.');
    }

    try {
      const factory = new ethers.Contract(
        this.assetFactoryAddress,
        AssetFactoryABI.abi,
        this.provider
      );

      const assetAddresses = await factory.getAllAssets();
      const assets: AssetInfo[] = [];

      for (const address of assetAddresses) {
        try {
          const assetInfo = await this.getAssetInfo(address);
          assets.push(assetInfo);
        } catch (error) {
          console.error(`AssetService: Failed to get info for asset ${address}:`, error);
        }
      }

      console.log(`AssetService: Retrieved ${assets.length} total assets`);
      return assets;
    } catch (error: any) {
      console.error('AssetService: Failed to get all assets:', error);
      throw new Error(`Failed to get all assets: ${error.message || "Unknown error"}`);
    }
  }

  async getAssetInfo(assetAddress: string): Promise<AssetInfo> {
    if (!this.provider) {
      throw new Error('Provider not available. Please ensure MetaMask is installed and connected.');
    }

    try {
      const asset = new ethers.Contract(
        assetAddress,
        AssetABI.abi,
        this.provider
      );

      const [owner, name, assetType, ipfsHash, created, updated] = await asset.getAssetInfo();

      return {
        address: assetAddress,
        owner,
        name,
        assetType,
        ipfsHash,
        created: Number(created),
        updated: Number(updated)
      };
    } catch (error: any) {
      console.error(`AssetService: Failed to get asset info for ${assetAddress}:`, error);
      throw new Error(`Failed to get asset info: ${error.message || "Unknown error"}`);
    }
  }

  async updateAssetHash(assetAddress: string, newIpfsHash: string): Promise<void> {
    if (!this.signer) {
      throw new Error('Wallet not connected. Please connect your MetaMask wallet first.');
    }

    try {
      const asset = new ethers.Contract(
        assetAddress,
        AssetABI.abi,
        this.signer
      );

      console.log('AssetService: Updating asset hash for:', assetAddress, 'to:', newIpfsHash);
      const tx = await asset.updateIpfsHash(newIpfsHash);
      console.log('AssetService: Update transaction sent, waiting for confirmation...');
      
      await tx.wait();
      console.log('AssetService: Asset hash updated successfully');
    } catch (error: any) {
      console.error('AssetService: Failed to update asset hash:', error);
      
      if (error.message?.includes("insufficient funds")) {
        throw new Error('Insufficient funds for transaction. Please ensure your wallet has enough ETH for gas fees.');
      } else if (error.message?.includes("user rejected")) {
        throw new Error('Transaction rejected by user. Please approve the transaction in MetaMask.');
      } else {
        throw new Error(`Failed to update asset hash: ${error.message || "Unknown error"}`);
      }
    }
  }
}

export const assetService = new AssetService();
