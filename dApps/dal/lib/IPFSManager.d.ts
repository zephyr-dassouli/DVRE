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
export declare class IPFSManager {
    private ipfsGateways;
    private pinataApiKey?;
    private pinataSecretKey?;
    constructor();
    /**
     * Upload RO-Crate metadata to IPFS
     */
    uploadROCrateMetadata(metadata: any, projectId: string): Promise<IPFSUploadResult>;
    /**
     * Upload CWL workflow to IPFS
     */
    uploadCWLWorkflow(workflow: any, projectId: string): Promise<IPFSUploadResult>;
    /**
     * Upload dataset file to IPFS
     */
    uploadDataset(file: File): Promise<IPFSUploadResult>;
    /**
     * Upload complete project bundle (RO-Crate + workflow + datasets)
     */
    uploadProjectBundle(roCrateMetadata: any, workflow: any, projectId: string, additionalFiles?: File[]): Promise<{
        roCrateHash: string;
        workflowHash: string;
        bundleHash: string;
        urls: {
            roCrate: string;
            workflow: string;
            bundle: string;
        };
    }>;
    /**
     * Upload a single file to IPFS
     */
    private uploadFile;
    /**
     * Upload file to Pinata (managed IPFS service)
     */
    private uploadToPinata;
    /**
     * Upload file using browser-based IPFS (js-ipfs)
     */
    private uploadToBrowserIPFS;
    /**
     * Mock IPFS upload for development/testing
     */
    private mockIPFSUpload;
    /**
     * Upload directory structure to IPFS
     */
    private uploadDirectory;
    /**
     * Download file from IPFS
     */
    downloadFile(hash: string, timeout?: number): Promise<string>;
    /**
     * Pin file to ensure persistence
     */
    pinFile(hash: string): Promise<boolean>;
    /**
     * Get file info from IPFS
     */
    getFileInfo(hash: string): Promise<{
        hash: string;
        size: number;
        type?: string;
        available: boolean;
    }>;
    /**
     * Utility: Convert ArrayBuffer to base64
     */
    private arrayBufferToBase64;
    /**
     * Utility: Read file as ArrayBuffer
     */
    private readFileAsArrayBuffer;
    /**
     * Check IPFS connectivity
     */
    checkConnectivity(): Promise<{
        connected: boolean;
        availableGateways: string[];
        fastestGateway?: string;
    }>;
}
export declare const ipfsManager: IPFSManager;
