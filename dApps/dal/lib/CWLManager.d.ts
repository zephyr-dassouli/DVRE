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
export declare class ClientCWLManager {
    private storageKey;
    private autoSaveCallbacks;
    constructor();
    /**
     * Save CWL workflow locally (project creator only)
     */
    saveCWL(projectId: string, cwlWorkflow: CWLWorkflow, metadata?: Partial<CWLMetadata>): void;
    /**
     * Load CWL workflow (only if user is project creator)
     */
    loadCWL(projectId: string): StoredCWL | null;
    /**
     * Auto-save while editing
     */
    autoSave(projectId: string, cwlWorkflow: CWLWorkflow): void;
    /**
     * Mark as finalized (ready for deployment)
     */
    finalizeCWL(projectId: string): boolean;
    /**
     * Mark as deployed
     */
    markAsDeployed(projectId: string, workflowId: string): void;
    /**
     * Check if user can edit CWL for this project
     */
    canEdit(projectId: string): boolean;
    /**
     * Get CWL status for project
     */
    getStatus(projectId: string): string;
    /**
     * Validate CWL workflow structure
     */
    validateCWL(cwl: CWLWorkflow): boolean;
    /**
     * Create basic AL workflow template
     */
    createALTemplate(projectId: string, projectTitle: string, alConfig: ALConfiguration): CWLWorkflow;
    /**
     * Update CWL with new AL configuration
     */
    updateALConfiguration(projectId: string, alConfig: ALConfiguration): void;
    /**
     * Set up auto-save for a project
     */
    setupAutoSave(projectId: string, getCWLCallback: () => CWLWorkflow, intervalMs?: number): void;
    /**
     * Clear auto-save for a project
     */
    clearAutoSave(projectId: string): void;
    /**
     * Get all projects with CWL workflows
     */
    getAllProjects(): string[];
    /**
     * Delete CWL for a project
     */
    deleteCWL(projectId: string): boolean;
    private getProjectCWLs;
    private getCurrentUser;
    private notifyAutoSave;
    private cleanupOldEntries;
}
export declare const cwlManager: ClientCWLManager;
