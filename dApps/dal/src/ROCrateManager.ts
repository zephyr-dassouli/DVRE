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
  // DAL-specific metadata
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

export class ROCrateManager {
  private baseIpfsGateway: string = 'https://ipfs.io/ipfs/';
  
  /**
   * Create a new RO-Crate for a DAL project
   */
  createDALROCrate(
    projectId: string,
    projectName: string,
    projectDescription: string,
    coordinatorWallet: string,
    alConfig: ALConfiguration
  ): DALROCrate {
    const now = new Date().toISOString();
    
    const project: ROCrateProject = {
      '@type': 'Project',
      '@id': `project-${projectId}`,
      name: projectName,
      description: projectDescription,
      projectType: 'DAL',
      status: 'draft',
      coordinator: coordinatorWallet,
      contributors: [],
      dateCreated: now,
      license: 'CC-BY-4.0', // Default research license
      keywords: ['Active Learning', 'Machine Learning', 'Decentralized', 'Collaborative Research']
    };

    const metadata: ROCrateMetadata = {
      '@context': 'https://w3id.org/ro/crate/1.1/context',
      '@graph': [
        {
          '@type': 'CreativeWork',
          '@id': 'ro-crate-metadata.json',
          conformsTo: { '@id': 'https://w3id.org/ro/crate/1.1' },
          about: { '@id': './' }
        },
        {
          '@type': 'Dataset',
          '@id': './',
          name: `DAL Project: ${projectName}`,
          description: `Decentralized Active Learning project for collaborative machine learning research`,
          creator: coordinatorWallet,
          dateCreated: now,
          license: 'CC-BY-4.0',
          hasPart: [
            { '@id': `project-${projectId}` }
          ]
        },
        project
      ]
    };

    return {
      metadata,
      project,
      datasets: {},
      alConfig,
      sessionData: {
        totalRounds: alConfig.maxIterations,
        currentRound: 0,
        labelingBudget: alConfig.labelingBudget,
        consensusThreshold: 0.7,
        queryStrategy: alConfig.queryStrategy,
        participantCount: alConfig.contributors.length
      }
    };
  }

  /**
   * Add training dataset to RO-Crate
   */
  addTrainingDataset(
    roCrate: DALROCrate,
    datasetInfo: {
      name: string;
      description?: string;
      url?: string;
      ipfsHash?: string;
      format?: string;
      size?: string;
      columns?: Array<{ name: string; dataType: string; description?: string }>;
    }
  ): DALROCrate {
    const dataset: ROCrateDataset = {
      '@type': 'Dataset',
      '@id': `training-dataset-${Date.now()}`,
      name: datasetInfo.name,
      description: datasetInfo.description || 'Training dataset for Active Learning',
      encodingFormat: datasetInfo.format || 'text/csv',
      contentSize: datasetInfo.size,
      url: datasetInfo.url,
      ipfsHash: datasetInfo.ipfsHash,
      license: 'CC-BY-4.0',
      creator: roCrate.project.coordinator,
      dateCreated: new Date().toISOString(),
      columns: datasetInfo.columns,
      variableMeasured: datasetInfo.columns?.map(col => col.name)
    };

    // Add to RO-Crate graph
    roCrate.metadata['@graph'].push(dataset);
    roCrate.datasets.training = dataset;

    // Update project to reference dataset
    const projectIndex = roCrate.metadata['@graph'].findIndex(
      item => item['@id'] === roCrate.project['@id']
    );
    if (projectIndex >= 0) {
      const project = roCrate.metadata['@graph'][projectIndex];
      if (!project.hasPart) project.hasPart = [];
      project.hasPart.push({ '@id': dataset['@id'] });
    }

    return roCrate;
  }

  /**
   * Add labeling dataset to RO-Crate
   */
  addLabelingDataset(
    roCrate: DALROCrate,
    datasetInfo: {
      name: string;
      description?: string;
      url?: string;
      ipfsHash?: string;
      format?: string;
      size?: string;
      labeledBy?: string[];
    }
  ): DALROCrate {
    const dataset: ROCrateDataset = {
      '@type': 'Dataset',
      '@id': `labeling-dataset-${Date.now()}`,
      name: datasetInfo.name,
      description: datasetInfo.description || 'Dataset for collaborative labeling in Active Learning',
      encodingFormat: datasetInfo.format || 'text/csv',
      contentSize: datasetInfo.size,
      url: datasetInfo.url,
      ipfsHash: datasetInfo.ipfsHash,
      license: 'CC-BY-4.0',
      creator: datasetInfo.labeledBy?.join(', ') || roCrate.project.coordinator,
      dateCreated: new Date().toISOString()
    };

    roCrate.metadata['@graph'].push(dataset);
    roCrate.datasets.labeling = dataset;

    return roCrate;
  }

  /**
   * Add CWL workflow to RO-Crate
   */
  addWorkflow(
    roCrate: DALROCrate,
    workflowInfo: {
      name: string;
      description?: string;
      cwlContent: any;
      url?: string;
      version?: string;
    }
  ): DALROCrate {
    const workflow: ROCrateWorkflow = {
      '@type': ['File', 'SoftwareSourceCode', 'ComputationalWorkflow'],
      '@id': `workflow-${Date.now()}.cwl`,
      name: workflowInfo.name,
      description: workflowInfo.description || 'CWL workflow for Decentralized Active Learning',
      programmingLanguage: 'cwl',
      url: workflowInfo.url,
      author: roCrate.project.coordinator,
      version: workflowInfo.version || '1.0',
      dateCreated: new Date().toISOString(),
      input: workflowInfo.cwlContent?.inputs ? Object.keys(workflowInfo.cwlContent.inputs) : [],
      output: workflowInfo.cwlContent?.outputs ? Object.keys(workflowInfo.cwlContent.outputs) : []
    };

    roCrate.metadata['@graph'].push(workflow);
    roCrate.workflow = workflow;

    return roCrate;
  }

  /**
   * Add model configuration to RO-Crate
   */
  addModel(
    roCrate: DALROCrate,
    modelInfo: {
      name: string;
      description?: string;
      algorithm: string;
      modelType: string;
      parameters: Record<string, any>;
      performance?: Record<string, number>;
      url?: string;
      ipfsHash?: string;
    }
  ): DALROCrate {
    const model: ROCrateModel = {
      '@type': ['File', 'SoftwareSourceCode'],
      '@id': `model-${Date.now()}`,
      name: modelInfo.name,
      description: modelInfo.description || 'Machine Learning model for Active Learning',
      encodingFormat: 'application/x-pickle', // Common for ML models
      algorithm: modelInfo.algorithm,
      modelType: modelInfo.modelType,
      parameters: modelInfo.parameters,
      performance: modelInfo.performance,
      url: modelInfo.url,
      ipfsHash: modelInfo.ipfsHash
    };

    roCrate.metadata['@graph'].push(model);
    roCrate.model = model;

    return roCrate;
  }

  /**
   * Update project status in RO-Crate
   */
  updateProjectStatus(
    roCrate: DALROCrate,
    status: ROCrateProject['status'],
    additionalMetadata?: Record<string, any>
  ): DALROCrate {
    roCrate.project.status = status;
    roCrate.project.dateModified = new Date().toISOString();

    // Update in metadata graph
    const projectIndex = roCrate.metadata['@graph'].findIndex(
      item => item['@id'] === roCrate.project['@id']
    );
    if (projectIndex >= 0) {
      roCrate.metadata['@graph'][projectIndex] = {
        ...roCrate.metadata['@graph'][projectIndex],
        status,
        dateModified: roCrate.project.dateModified,
        ...additionalMetadata
      };
    }

    return roCrate;
  }

  /**
   * Add contributors to RO-Crate
   */
  addContributors(roCrate: DALROCrate, contributors: string[]): DALROCrate {
    roCrate.project.contributors = [...(roCrate.project.contributors || []), ...contributors];
    roCrate.project.dateModified = new Date().toISOString();

    // Update session data
    if (roCrate.sessionData) {
      roCrate.sessionData.participantCount = roCrate.project.contributors.length;
    }

    // Update in metadata graph
    const projectIndex = roCrate.metadata['@graph'].findIndex(
      item => item['@id'] === roCrate.project['@id']
    );
    if (projectIndex >= 0) {
      roCrate.metadata['@graph'][projectIndex].contributors = roCrate.project.contributors;
      roCrate.metadata['@graph'][projectIndex].dateModified = roCrate.project.dateModified;
    }

    return roCrate;
  }

  /**
   * Update Active Learning session progress
   */
  updateSessionProgress(
    roCrate: DALROCrate,
    progress: {
      currentRound?: number;
      accuracy?: number;
      labeledSamples?: number;
      consensusReached?: number;
    }
  ): DALROCrate {
    if (!roCrate.sessionData) {
      roCrate.sessionData = {
        totalRounds: roCrate.alConfig.maxIterations,
        currentRound: 0,
        labelingBudget: roCrate.alConfig.labelingBudget,
        consensusThreshold: 0.7,
        queryStrategy: roCrate.alConfig.queryStrategy,
        participantCount: roCrate.project.contributors?.length || 0
      };
    }

    // Update session data
    if (progress.currentRound !== undefined) {
      roCrate.sessionData.currentRound = progress.currentRound;
    }

    // Add or update performance metrics
    const projectIndex = roCrate.metadata['@graph'].findIndex(
      item => item['@id'] === roCrate.project['@id']
    );
    if (projectIndex >= 0) {
      const project = roCrate.metadata['@graph'][projectIndex];
      if (!project.performance) project.performance = {};
      
      if (progress.accuracy !== undefined) {
        project.performance.accuracy = progress.accuracy;
      }
      if (progress.labeledSamples !== undefined) {
        project.performance.labeledSamples = progress.labeledSamples;
      }
      if (progress.consensusReached !== undefined) {
        project.performance.consensusReached = progress.consensusReached;
      }
      
      project.dateModified = new Date().toISOString();
    }

    return roCrate;
  }

  /**
   * Finalize RO-Crate with outputs and results
   */
  finalizeROCrate(
    roCrate: DALROCrate,
    outputs: {
      labeledDataUrl?: string;
      labeledDataIpfsHash?: string;
      trainedModelUrl?: string;
      trainedModelIpfsHash?: string;
      metricsReport?: any;
      finalAccuracy?: number;
    }
  ): DALROCrate {
    const now = new Date().toISOString();

    // Add labeled data output
    if (outputs.labeledDataUrl || outputs.labeledDataIpfsHash) {
      const labeledData: ROCrateDataset = {
        '@type': 'Dataset',
        '@id': `labeled-output-${Date.now()}`,
        name: 'Final Labeled Dataset',
        description: 'Collaboratively labeled dataset from Active Learning process',
        encodingFormat: 'text/csv',
        url: outputs.labeledDataUrl,
        ipfsHash: outputs.labeledDataIpfsHash,
        creator: roCrate.project.contributors?.join(', ') || roCrate.project.coordinator,
        dateCreated: now,
        license: 'CC-BY-4.0'
      };
      
      roCrate.metadata['@graph'].push(labeledData);
      if (!roCrate.outputs) roCrate.outputs = {};
      roCrate.outputs.labeledData = labeledData;
    }

    // Add trained model output
    if (outputs.trainedModelUrl || outputs.trainedModelIpfsHash) {
      const trainedModel: ROCrateModel = {
        '@type': ['File', 'SoftwareSourceCode'],
        '@id': `trained-model-${Date.now()}`,
        name: 'Trained Active Learning Model',
        description: 'Final trained model from collaborative Active Learning',
        encodingFormat: 'application/x-pickle',
        algorithm: roCrate.alConfig.modelConfig.model_type || 'neural_network',
        modelType: 'classification',
        parameters: roCrate.alConfig.modelConfig,
        url: outputs.trainedModelUrl,
        ipfsHash: outputs.trainedModelIpfsHash
      };

      if (outputs.finalAccuracy !== undefined) {
        trainedModel.performance = { accuracy: outputs.finalAccuracy };
      }

      roCrate.metadata['@graph'].push(trainedModel);
      if (!roCrate.outputs) roCrate.outputs = {};
      roCrate.outputs.trainedModel = trainedModel;
    }

    // Add metrics report
    if (outputs.metricsReport) {
      if (!roCrate.outputs) roCrate.outputs = {};
      roCrate.outputs.metrics = outputs.metricsReport;
    }

    // Update project status to completed
    this.updateProjectStatus(roCrate, 'completed', {
      completedAt: now,
      finalMetrics: outputs.metricsReport
    });

    return roCrate;
  }

  /**
   * Save RO-Crate to local storage
   */
  saveROCrate(projectId: string, roCrate: DALROCrate): void {
    const storageKey = `dvre-dal-rocrate-${projectId}`;
    localStorage.setItem(storageKey, JSON.stringify(roCrate, null, 2));
    
    // Emit event for other components
    window.dispatchEvent(new CustomEvent('dvre-rocrate-saved', {
      detail: { projectId, timestamp: new Date().toISOString() }
    }));
  }

  /**
   * Load RO-Crate from local storage
   */
  loadROCrate(projectId: string): DALROCrate | null {
    const storageKey = `dvre-dal-rocrate-${projectId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse stored RO-Crate:', error);
        return null;
      }
    }
    
    return null;
  }

  /**
   * Export RO-Crate metadata as JSON-LD
   */
  exportMetadata(roCrate: DALROCrate): string {
    return JSON.stringify(roCrate.metadata, null, 2);
  }

  /**
   * Validate RO-Crate structure
   */
  validateROCrate(roCrate: DALROCrate): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!roCrate.metadata || !roCrate.metadata['@context']) {
      errors.push('Missing required @context in metadata');
    }

    if (!roCrate.project || !roCrate.project.name) {
      errors.push('Missing required project name');
    }

    if (!roCrate.project?.coordinator) {
      errors.push('Missing project coordinator');
    }

    if (!roCrate.alConfig) {
      errors.push('Missing Active Learning configuration');
    }

    // Check for datasets
    if (!roCrate.datasets?.training) {
      warnings.push('No training dataset specified');
    }

    if (!roCrate.workflow) {
      warnings.push('No CWL workflow specified');
    }

    // Check project status progression
    if (roCrate.project?.status === 'ready' && !roCrate.workflow) {
      errors.push('Cannot mark project as ready without workflow');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

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
  } {
    return {
      title: roCrate.project.name,
      description: roCrate.project.description || 'No description provided',
      status: roCrate.project.status,
      participants: (roCrate.project.contributors?.length || 0) + 1, // +1 for coordinator
      datasets: Object.keys(roCrate.datasets).length,
      hasWorkflow: !!roCrate.workflow,
      lastModified: roCrate.project.dateModified || roCrate.project.dateCreated
    };
  }
}

// Export singleton instance
export const roCrateManager = new ROCrateManager(); 