/**
 * RO-Crate Manager for DAL (Decentralized Active Learning)
 * Handles creation, management, and lifecycle of Research Object Crates
 * for reproducible, FAIR Active Learning projects
 */
import { ALConfiguration } from './CWLManager';
export interface ROCrateDataset {
    '@type': 'Dataset';
    '@id': string;
    name: string;
    description?: string;
    encodingFormat?: string;
    contentSize?: string;
    url?: string;
    ipfsHash?: string;
    license?: string;
    creator?: string;
    dateCreated?: string;
    variableMeasured?: string[];
    columns?: Array<{
        name: string;
        dataType: string;
        description?: string;
    }>;
}
export interface ROCrateWorkflow {
    '@type': ['File', 'SoftwareSourceCode', 'ComputationalWorkflow'];
    '@id': string;
    name: string;
    description?: string;
    programmingLanguage: 'cwl';
    url?: string;
    input?: any[];
    output?: any[];
    author?: string;
    version?: string;
    dateCreated?: string;
    ipfsHash?: string;
}
export interface ROCrateModel {
    '@type': ['File', 'SoftwareSourceCode'];
    '@id': string;
    name: string;
    description?: string;
    encodingFormat: string;
    algorithm?: string;
    modelType?: string;
    parameters?: Record<string, any>;
    performance?: Record<string, number>;
    url?: string;
    ipfsHash?: string;
}
export interface ROCrateProject {
    '@type': 'Project';
    '@id': string;
    name: string;
    description?: string;
    projectType: 'DAL' | 'Active Learning';
    status: 'draft' | 'configured' | 'ready' | 'active' | 'paused' | 'completed';
    coordinator: string;
    contributors?: string[];
    smartContractAddress?: string;
    blockchainNetwork?: string;
    dateCreated: string;
    dateModified?: string;
    license?: string;
    funding?: string[];
    keywords?: string[];
    ipfsHash?: string;
    ipfsUrl?: string;
}
export interface ROCrateMetadata {
    '@context': 'https://w3id.org/ro/crate/1.1/context';
    '@graph': Array<{
        '@type': string | string[];
        '@id': string;
        [key: string]: any;
    }>;
}
export interface DALROCrate {
    metadata: ROCrateMetadata;
    project: ROCrateProject;
    datasets: {
        training?: ROCrateDataset;
        labeling?: ROCrateDataset;
        validation?: ROCrateDataset;
    };
    workflow?: ROCrateWorkflow;
    model?: ROCrateModel;
    outputs?: {
        labeledData?: ROCrateDataset;
        trainedModel?: ROCrateModel;
        metrics?: any;
        reports?: any[];
    };
    alConfig: ALConfiguration;
    sessionData?: {
        totalRounds: number;
        currentRound: number;
        labelingBudget: number;
        consensusThreshold: number;
        queryStrategy: string;
        participantCount: number;
    };
}
export declare class ROCrateManager {
    private baseIpfsGateway;
    /**
     * Create a new RO-Crate for a DAL project
     */
    createDALROCrate(projectId: string, projectName: string, projectDescription: string, coordinatorWallet: string, alConfig: ALConfiguration): DALROCrate;
    /**
     * Add training dataset to RO-Crate
     */
    addTrainingDataset(roCrate: DALROCrate, datasetInfo: {
        name: string;
        description?: string;
        url?: string;
        ipfsHash?: string;
        format?: string;
        size?: string;
        columns?: Array<{
            name: string;
            dataType: string;
            description?: string;
        }>;
    }): DALROCrate;
    /**
     * Add labeling dataset to RO-Crate
     */
    addLabelingDataset(roCrate: DALROCrate, datasetInfo: {
        name: string;
        description?: string;
        url?: string;
        ipfsHash?: string;
        format?: string;
        size?: string;
        labeledBy?: string[];
    }): DALROCrate;
    /**
     * Add CWL workflow to RO-Crate
     */
    addWorkflow(roCrate: DALROCrate, workflowInfo: {
        name: string;
        description?: string;
        cwlContent: any;
        url?: string;
        version?: string;
    }): DALROCrate;
    /**
     * Add model configuration to RO-Crate
     */
    addModel(roCrate: DALROCrate, modelInfo: {
        name: string;
        description?: string;
        algorithm: string;
        modelType: string;
        parameters: Record<string, any>;
        performance?: Record<string, number>;
        url?: string;
        ipfsHash?: string;
    }): DALROCrate;
    /**
     * Update project status in RO-Crate
     */
    updateProjectStatus(roCrate: DALROCrate, status: ROCrateProject['status'], additionalMetadata?: Record<string, any>): DALROCrate;
    /**
     * Add contributors to RO-Crate
     */
    addContributors(roCrate: DALROCrate, contributors: string[]): DALROCrate;
    /**
     * Update Active Learning session progress
     */
    updateSessionProgress(roCrate: DALROCrate, progress: {
        currentRound?: number;
        accuracy?: number;
        labeledSamples?: number;
        consensusReached?: number;
    }): DALROCrate;
    /**
     * Finalize RO-Crate with outputs and results
     */
    finalizeROCrate(roCrate: DALROCrate, outputs: {
        labeledDataUrl?: string;
        labeledDataIpfsHash?: string;
        trainedModelUrl?: string;
        trainedModelIpfsHash?: string;
        metricsReport?: any;
        finalAccuracy?: number;
    }): DALROCrate;
    /**
     * Save RO-Crate to local storage
     */
    saveROCrate(projectId: string, roCrate: DALROCrate): void;
    /**
     * Load RO-Crate from local storage
     */
    loadROCrate(projectId: string): DALROCrate | null;
    /**
     * Export RO-Crate metadata as JSON-LD
     */
    exportMetadata(roCrate: DALROCrate): string;
    /**
     * Validate RO-Crate structure
     */
    validateROCrate(roCrate: DALROCrate): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    };
    /**
     * Generate RO-Crate preview/summary
     */
    generatePreview(roCrate: DALROCrate): {
        title: string;
        description: string;
        status: string;
        participants: number;
        datasets: number;
        hasWorkflow: boolean;
        lastModified: string;
    };
}
export declare const roCrateManager: ROCrateManager;
