/**
 * Smart Contract Integration for DAL Projects
 * Handles updating project contracts with IPFS hashes and status
 */
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
export declare class SmartContractIntegration {
    private provider;
    private signer;
    constructor();
    /**
     * Initialize Web3 provider (MetaMask)
     */
    private initializeProvider;
    /**
     * Update project contract with IPFS hashes and status
     */
    updateProjectWithIPFS(data: SmartContractUpdateData): Promise<ContractUpdateResult>;
    /**
     * Mock smart contract update for development
     */
    mockUpdateProjectWithIPFS(data: SmartContractUpdateData): Promise<ContractUpdateResult>;
    /**
     * Update only project status (lighter transaction)
     */
    updateProjectStatus(contractAddress: string, status: SmartContractUpdateData['status']): Promise<ContractUpdateResult>;
    /**
     * Read project metadata from contract
     */
    getProjectMetadata(contractAddress: string): Promise<{
        ipfsRoCrateHash: string;
        ipfsWorkflowHash: string;
        ipfsBundleHash: string;
        status: number;
    } | null>;
    /**
     * Check if user is authorized to update contract
     */
    checkUpdatePermission(contractAddress: string, userAddress: string): Promise<boolean>;
    /**
     * Get estimated gas cost for contract update
     */
    estimateUpdateGas(data: SmartContractUpdateData): Promise<{
        gasEstimate: string;
        gasPriceGwei: string;
        estimatedCostEth: string;
    } | null>;
    /**
     * Check if Web3 is available and connected
     */
    checkConnection(): Promise<{
        available: boolean;
        connected: boolean;
        account?: string;
        network?: string;
    }>;
}
export declare const smartContractIntegration: SmartContractIntegration;
