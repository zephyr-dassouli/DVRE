/**
 * DVRE RO-Crate Client for DAL dApp
 * Provides interface to centralized DVRE RO-Crate management
 * Replaces local ROCrateManager with DVRE API integration
 */
export interface DALConfiguration {
    queryStrategy: 'uncertainty_sampling' | 'diversity_sampling' | 'hybrid';
    labelingBudget: number;
    maxIterations: number;
    modelConfig: {
        model_type: 'logistic_regression' | 'neural_network' | 'random_forest' | 'svm';
        layers?: number[];
        parameters?: Record<string, any>;
    };
    dataConfig: {
        trainingDataset: string;
        labelingDataset?: string;
        testDataset?: string;
        features: string[];
    };
    sessionConfig?: {
        consensusThreshold?: number;
        minContributors?: number;
        maxLabelingTime?: number;
    };
}
export interface DALWorkflow {
    name: string;
    description?: string;
    programmingLanguage: 'cwl';
    steps: string[];
    cwlContent?: string;
    inputs?: any[];
    outputs?: any[];
}
export interface DALDataset {
    name: string;
    description?: string;
    type: 'training' | 'labeling' | 'test';
    format: 'csv' | 'json' | 'parquet';
    url?: string;
    ipfsHash?: string;
    columns?: Array<{
        name: string;
        dataType: 'string' | 'number' | 'boolean' | 'date';
        description?: string;
    }>;
    size?: number;
    recordCount?: number;
}
export interface DALModel {
    name: string;
    description?: string;
    algorithm: string;
    parameters: Record<string, any>;
    performance?: Record<string, number>;
    version?: string;
    trainingData?: string;
}
export interface DALROCrate {
    projectId: string;
    alConfig: DALConfiguration;
    workflow?: DALWorkflow;
    datasets: DALDataset[];
    models: DALModel[];
    status: 'draft' | 'configured' | 'ready' | 'active' | 'completed';
    ipfsHashes?: {
        roCrateHash?: string;
        workflowHash?: string;
        bundleHash?: string;
    };
    lastModified: string;
}
/**
 * DVRE RO-Crate Client for DAL
 * Provides typed interface to DVRE's centralized RO-Crate system
 */
export declare class DVREROCrateClient {
    private static instance;
    private dvreAPI;
    private constructor();
    static getInstance(): DVREROCrateClient;
    /**
     * Initialize connection to DVRE RO-Crate API
     */
    private initializeDVREConnection;
    /**
     * Check if DVRE API is available
     */
    private ensureAPIConnection;
    /**
     * Get DAL RO-Crate for a project
     */
    getDALROCrate(projectId: string): Promise<DALROCrate | null>;
    /**
     * Update DAL configuration in DVRE RO-Crate
     */
    updateDALConfiguration(projectId: string, alConfig: Partial<DALConfiguration>): Promise<DALROCrate | null>;
    /**
     * Add dataset to DAL RO-Crate
     */
    addDataset(projectId: string, dataset: DALDataset): Promise<DALROCrate | null>;
    /**
     * Add workflow to DAL RO-Crate
     */
    addWorkflow(projectId: string, workflow: DALWorkflow): Promise<DALROCrate | null>;
    /**
     * Add model to DAL RO-Crate
     */
    addModel(projectId: string, model: DALModel): Promise<DALROCrate | null>;
    /**
     * Finalize DAL project (upload to IPFS and submit to orchestrator)
     */
    finalizeProject(projectId: string, contractAddress: string): Promise<{
        ipfsHash: string;
        bundleHash: string;
        workflowHash?: string;
        success: boolean;
    }>;
    /**
     * Subscribe to RO-Crate updates for a project
     */
    subscribeToUpdates(projectId: string, callback: (dalROCrate: DALROCrate) => void): () => void;
    /**
     * Export DAL RO-Crate metadata
     */
    exportMetadata(projectId: string): Promise<string>;
    /**
     * Validate DAL configuration
     */
    private validateDALConfiguration;
    /**
     * Get default AL configuration
     */
    private getDefaultALConfig;
}
export declare const dvreROCrateClient: DVREROCrateClient;
