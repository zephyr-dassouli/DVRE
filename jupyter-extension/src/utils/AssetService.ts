import { ethers, BrowserProvider, Signer } from 'ethers';
import AssetFactoryABI from '../abis/AssetFactory.json';
import AssetABI from '../abis/Asset.json';
import config from '../config';
import { useFactoryRegistry } from '../hooks/useFactoryRegistry';

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

  constructor() {
    this.assetFactoryAddress = config.blockchain.assetFactoryAddress;
    this.initializeProvider();
    this.initializeAssetFactory();
  }

  private async initializeProvider() {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        this.provider = new BrowserProvider((window as any).ethereum);
        this.signer = await this.provider.getSigner();
      }
    } catch (error) {
      console.warn('Failed to initialize Web3 provider:', error);
    }
  }

  private async initializeAssetFactory() {
    const { getFactoryAddress } = useFactoryRegistry();
    try {
      const registryAddress = await getFactoryAddress('AssetFactory');
      if (registryAddress) {
        this.assetFactoryAddress = registryAddress;
        console.log('AssetFactory address loaded from registry:', registryAddress);
      } else {
        console.warn('AssetFactory not found in registry, using config fallback:', this.assetFactoryAddress);
      }
    } catch (error) {
      console.warn('Failed to get AssetFactory from registry, using config fallback:', error);
    }
  }

  isConfigured(): boolean {
    return this.assetFactoryAddress !== '0x0000000000000000000000000000000000000000';
  }

  async connectWallet(): Promise<string> {
    if (!this.provider) {
      throw new Error('MetaMask not found');
    }

    const accounts = await this.provider.send('eth_requestAccounts', []);
    return accounts[0];
  }

  async createAsset(name: string, assetType: string, ipfsHash: string): Promise<string> {
    if (!this.signer || !this.isConfigured()) {
      throw new Error('Wallet not connected or factory address not configured');
    }

    const factory = new ethers.Contract(
      this.assetFactoryAddress,
      AssetFactoryABI.abi,
      this.signer
    );

    const tx = await factory.createAsset(name, assetType, ipfsHash);
    const receipt = await tx.wait();

    // Extract the asset address from the event
    const event = receipt.events?.find((e: any) => e.event === 'AssetCreated');
    return event?.args?.assetAddress;
  }

  async getUserAssets(userAddress: string): Promise<AssetInfo[]> {
    if (!this.provider || !this.isConfigured()) {
      throw new Error('Provider not available or factory address not configured');
    }

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
        console.error(`Failed to get info for asset ${address}:`, error);
      }
    }

    return assets;
  }

  async getAllAssets(): Promise<AssetInfo[]> {
    if (!this.provider || !this.isConfigured()) {
      throw new Error('Provider not available or factory address not configured');
    }

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
        console.error(`Failed to get info for asset ${address}:`, error);
      }
    }

    return assets;
  }

  async getAssetInfo(assetAddress: string): Promise<AssetInfo> {
    if (!this.provider) {
      throw new Error('Provider not available');
    }

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
      created: created.toNumber(),
      updated: updated.toNumber()
    };
  }

  async updateAssetHash(assetAddress: string, newIpfsHash: string): Promise<void> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const asset = new ethers.Contract(
      assetAddress,
      AssetABI.abi,
      this.signer
    );

    const tx = await asset.updateIpfsHash(newIpfsHash);
    await tx.wait();
  }
}

export const assetService = new AssetService();
