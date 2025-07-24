/**
 * Client-Side CWL Manager for DVRE DAL Extension
 * Handles local storage, auto-save, and validation of CWL workflows
 */

export interface ALConfiguration {
  queryStrategy: string;
  modelConfig: any;
  labelingBudget: number;
  maxIterations: number;
  isFederated: boolean;
  contributors: string[];
  dataset?: string;
  validationSplit?: number;
}

export interface CWLWorkflow {
  cwlVersion: string;
  class: string;
  id: string;
  label?: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  steps: Record<string, any>;
}

export interface CWLMetadata {
  creator: string;
  lastModified: string;
  version: number;
  autoSaved: boolean;
  status: 'draft' | 'finalized' | 'deployed';
  finalizedAt?: string;
  deployedAt?: string;
  workflowId?: string;
  projectTitle?: string;
  alConfig?: ALConfiguration;
}

export interface StoredCWL {
  cwl: CWLWorkflow;
  metadata: CWLMetadata;
}

export class ClientCWLManager {
  private storageKey = 'dvre-project-cwls';
  private autoSaveCallbacks: Map<string, () => void> = new Map();

  constructor() {
    // Clean up old auto-save entries on initialization
    this.cleanupOldEntries();
  }

  /**
   * Save CWL workflow locally (project creator only)
   */
  saveCWL(projectId: string, cwlWorkflow: CWLWorkflow, metadata: Partial<CWLMetadata> = {}): void {
    const storage = this.getProjectCWLs();
    const existingData = storage[projectId];
    
    const updatedMetadata: CWLMetadata = {
      creator: this.getCurrentUser(),
      lastModified: new Date().toISOString(),
      version: existingData ? existingData.metadata.version + 1 : 1,
      autoSaved: metadata.autoSaved || false,
      status: metadata.status || 'draft',
      ...existingData?.metadata,
      ...metadata
    };

    storage[projectId] = {
      cwl: cwlWorkflow,
      metadata: updatedMetadata
    };

    localStorage.setItem(this.storageKey, JSON.stringify(storage));
    this.notifyAutoSave(projectId);
  }

  /**
   * Load CWL workflow (only if user is project creator)
   */
  loadCWL(projectId: string): StoredCWL | null {
    const storage = this.getProjectCWLs();
    const cwlData = storage[projectId];

    if (!cwlData) return null;

    // Verify user is the creator
    if (cwlData.metadata.creator !== this.getCurrentUser()) {
      throw new Error('Access denied: Only project creator can edit CWL');
    }

    return cwlData;
  }

  /**
   * Auto-save while editing
   */
  autoSave(projectId: string, cwlWorkflow: CWLWorkflow): void {
    this.saveCWL(projectId, cwlWorkflow, {
      autoSaved: true,
      status: 'draft'
    });
  }

  /**
   * Mark as finalized (ready for deployment)
   */
  finalizeCWL(projectId: string): boolean {
    const cwlData = this.loadCWL(projectId);
    if (!cwlData) return false;

    // Validate CWL before finalizing
    if (!this.validateCWL(cwlData.cwl)) {
      throw new Error('CWL validation failed');
    }

    this.saveCWL(projectId, cwlData.cwl, {
      ...cwlData.metadata,
      status: 'finalized',
      finalizedAt: new Date().toISOString()
    });

    return true;
  }

  /**
   * Mark as deployed
   */
  markAsDeployed(projectId: string, workflowId: string): void {
    const cwlData = this.loadCWL(projectId);
    if (!cwlData) return;

    this.saveCWL(projectId, cwlData.cwl, {
      ...cwlData.metadata,
      status: 'deployed',
      deployedAt: new Date().toISOString(),
      workflowId: workflowId
    });
  }

  /**
   * Check if user can edit CWL for this project
   */
  canEdit(projectId: string): boolean {
    try {
      const cwlData = this.loadCWL(projectId);
      return cwlData !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get CWL status for project
   */
  getStatus(projectId: string): string {
    const cwlData = this.loadCWL(projectId);
    return cwlData?.metadata.status || 'none';
  }

  /**
   * Validate CWL workflow structure
   */
  validateCWL(cwl: CWLWorkflow): boolean {
    try {
      // Check required fields
      if (!cwl.cwlVersion || !cwl.class) return false;

      // Validate CWL version
      if (!['v1.0', 'v1.1', 'v1.2'].includes(cwl.cwlVersion)) return false;

      // Validate class
      if (!['Workflow', 'CommandLineTool', 'ExpressionTool'].includes(cwl.class)) return false;

      // Check for inputs and outputs in workflows
      if (cwl.class === 'Workflow') {
        if (!cwl.inputs || !cwl.outputs || !cwl.steps) return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create basic AL workflow template
   */
  createALTemplate(projectId: string, projectTitle: string, alConfig: ALConfiguration): CWLWorkflow {
    return {
      cwlVersion: "v1.0",
      class: "Workflow",
      id: projectId,
      label: `Active Learning Workflow - ${projectTitle}`,
      inputs: {
        dataset: {
          type: "File",
          doc: "Training dataset for active learning"
        },
        query_strategy: {
          type: "string",
          default: alConfig.queryStrategy,
          doc: "Active learning query strategy"
        },
        model_config: {
          type: "string",
          default: JSON.stringify(alConfig.modelConfig),
          doc: "Model configuration JSON"
        },
        labeling_budget: {
          type: "int",
          default: alConfig.labelingBudget,
          doc: "Number of samples to label per iteration"
        },
        max_iterations: {
          type: "int",
          default: alConfig.maxIterations,
          doc: "Maximum AL iterations"
        },
        validation_split: {
          type: "float",
          default: alConfig.validationSplit || 0.2,
          doc: "Validation data split ratio"
        }
      },
      outputs: {
        trained_model: {
          type: "File",
          outputSource: "active_learning/final_model"
        },
        learning_curve: {
          type: "File",
          outputSource: "active_learning/metrics"
        },
        selected_samples: {
          type: "File",
          outputSource: "active_learning/queries"
        }
      },
      steps: {
        data_preprocessing: {
          run: "data_preprocessing.cwl",
          in: {
            raw_dataset: "dataset",
            validation_ratio: "validation_split"
          },
          out: ["clean_data", "validation_split"]
        },
        active_learning: {
          run: "active_learning_pipeline.cwl",
          in: {
            training_data: "data_preprocessing/clean_data",
            validation_data: "data_preprocessing/validation_split",
            strategy: "query_strategy",
            model: "model_config",
            budget: "labeling_budget",
            iterations: "max_iterations"
          },
          out: ["final_model", "metrics", "queries"]
        }
      }
    };
  }

  /**
   * Update CWL with new AL configuration
   */
  updateALConfiguration(projectId: string, alConfig: ALConfiguration): void {
    const cwlData = this.loadCWL(projectId);
    if (!cwlData) return;

    const updatedCWL = { ...cwlData.cwl };

    // Update inputs based on AL configuration
    updatedCWL.inputs.query_strategy.default = alConfig.queryStrategy;
    updatedCWL.inputs.model_config.default = JSON.stringify(alConfig.modelConfig);
    updatedCWL.inputs.labeling_budget.default = alConfig.labelingBudget;
    updatedCWL.inputs.max_iterations.default = alConfig.maxIterations;

    // Add contributor-specific inputs if federated
    if (alConfig.isFederated) {
      updatedCWL.inputs.contributors = {
        type: "string[]",
        default: alConfig.contributors,
        doc: "List of federated learning contributors"
      };

      // Add federated learning step
      updatedCWL.steps.federated_coordination = {
        run: "federated_coordination.cwl",
        in: {
          contributors: "contributors",
          model_updates: "active_learning/model_updates"
        },
        out: ["aggregated_model", "coordination_log"]
      };
    }

    this.saveCWL(projectId, updatedCWL, {
      ...cwlData.metadata,
      alConfig: alConfig
    });
  }

  /**
   * Set up auto-save for a project
   */
  setupAutoSave(projectId: string, getCWLCallback: () => CWLWorkflow, intervalMs: number = 30000): void {
    // Clear existing interval
    this.clearAutoSave(projectId);

    const autoSaveFunction = () => {
      try {
        const cwl = getCWLCallback();
        if (cwl) {
          this.autoSave(projectId, cwl);
        }
      } catch (error) {
        console.warn(`Auto-save failed for project ${projectId}:`, error);
      }
    };

    const intervalId = setInterval(autoSaveFunction, intervalMs);
    this.autoSaveCallbacks.set(projectId, () => clearInterval(intervalId));
  }

  /**
   * Clear auto-save for a project
   */
  clearAutoSave(projectId: string): void {
    const clearCallback = this.autoSaveCallbacks.get(projectId);
    if (clearCallback) {
      clearCallback();
      this.autoSaveCallbacks.delete(projectId);
    }
  }

  /**
   * Get all projects with CWL workflows
   */
  getAllProjects(): string[] {
    const storage = this.getProjectCWLs();
    return Object.keys(storage);
  }

  /**
   * Delete CWL for a project
   */
  deleteCWL(projectId: string): boolean {
    const storage = this.getProjectCWLs();
    if (storage[projectId]) {
      delete storage[projectId];
      localStorage.setItem(this.storageKey, JSON.stringify(storage));
      this.clearAutoSave(projectId);
      return true;
    }
    return false;
  }

  // Private methods

  private getProjectCWLs(): Record<string, StoredCWL> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to parse stored CWL data:', error);
      return {};
    }
  }

  private getCurrentUser(): string {
    // In a real implementation, this would get the user from auth system
    // For now, we'll use a simple identifier
    return localStorage.getItem('dvre-user-id') || 'anonymous';
  }

  private notifyAutoSave(projectId: string): void {
    // Dispatch custom event for UI components to listen to
    window.dispatchEvent(new CustomEvent('dvre-cwl-saved', {
      detail: { projectId, timestamp: new Date().toISOString() }
    }));
  }

  private cleanupOldEntries(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    // Clean up entries older than 7 days by default
    const storage = this.getProjectCWLs();
    const now = new Date().getTime();
    let hasChanges = false;

    for (const [projectId, data] of Object.entries(storage)) {
      const lastModified = new Date(data.metadata.lastModified).getTime();
      if (now - lastModified > maxAgeMs && data.metadata.status === 'draft') {
        delete storage[projectId];
        hasChanges = true;
      }
    }

    if (hasChanges) {
      localStorage.setItem(this.storageKey, JSON.stringify(storage));
    }
  }
}

// Export singleton instance
export const cwlManager = new ClientCWLManager(); 