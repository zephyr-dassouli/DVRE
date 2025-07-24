/**
 * DVRE RO-Crate Client for DAL dApp
 * Provides interface to centralized DVRE RO-Crate management
 * Replaces local ROCrateManager with DVRE API integration
 */
/**
 * DVRE RO-Crate Client for DAL
 * Provides typed interface to DVRE's centralized RO-Crate system
 */
export class DVREROCrateClient {
    constructor() {
        this.dvreAPI = null;
        this.initializeDVREConnection();
    }
    static getInstance() {
        if (!DVREROCrateClient.instance) {
            DVREROCrateClient.instance = new DVREROCrateClient();
        }
        return DVREROCrateClient.instance;
    }
    /**
     * Initialize connection to DVRE RO-Crate API
     */
    initializeDVREConnection() {
        try {
            // Access DVRE RO-Crate API from global window object
            this.dvreAPI = window.roCrateAPI;
            if (!this.dvreAPI) {
                console.warn('DVRE RO-Crate API not found. Make sure DVRE core is loaded.');
            }
            else {
                console.log('DAL: Connected to DVRE RO-Crate API');
            }
        }
        catch (error) {
            console.error('DAL: Failed to connect to DVRE RO-Crate API:', error);
        }
    }
    /**
     * Check if DVRE API is available
     */
    ensureAPIConnection() {
        if (!this.dvreAPI) {
            this.initializeDVREConnection();
            if (!this.dvreAPI) {
                throw new Error('DVRE RO-Crate API not available. Ensure DVRE core is loaded.');
            }
        }
    }
    /**
     * Get DAL RO-Crate for a project
     */
    async getDALROCrate(projectId) {
        var _a, _b;
        try {
            this.ensureAPIConnection();
            // Get base RO-Crate from DVRE
            const baseROCrate = await this.dvreAPI.getProjectROCrate(projectId);
            if (!baseROCrate || !((_a = baseROCrate.extensions) === null || _a === void 0 ? void 0 : _a.dal)) {
                return null;
            }
            // Convert DVRE RO-Crate to DAL format
            const dalExtension = baseROCrate.extensions.dal;
            return {
                projectId,
                alConfig: dalExtension.alConfig || this.getDefaultALConfig(),
                workflow: dalExtension.workflow,
                datasets: dalExtension.datasets || [],
                models: dalExtension.models || [],
                status: ((_b = baseROCrate.project) === null || _b === void 0 ? void 0 : _b.status) || 'draft',
                ipfsHashes: baseROCrate.ipfs,
                lastModified: dalExtension.lastModified || new Date().toISOString()
            };
        }
        catch (error) {
            console.error('DAL: Failed to get RO-Crate:', error);
            return null;
        }
    }
    /**
     * Update DAL configuration in DVRE RO-Crate
     */
    async updateDALConfiguration(projectId, alConfig) {
        try {
            this.ensureAPIConnection();
            // Get current DAL extension or create new one
            const currentROCrate = await this.getDALROCrate(projectId);
            const currentConfig = (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.alConfig) || this.getDefaultALConfig();
            // Merge configurations
            const updatedConfig = { ...currentConfig, ...alConfig };
            // Update DVRE RO-Crate with new DAL extension
            const dalExtension = {
                alConfig: updatedConfig,
                workflow: currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.workflow,
                datasets: (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.datasets) || [],
                models: (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.models) || [],
                type: 'active_learning',
                version: '1.0',
                lastModified: new Date().toISOString()
            };
            await this.dvreAPI.updateROCrateExtension(projectId, 'dal', dalExtension);
            // Return updated DAL RO-Crate
            return await this.getDALROCrate(projectId);
        }
        catch (error) {
            console.error('DAL: Failed to update configuration:', error);
            throw error;
        }
    }
    /**
     * Add dataset to DAL RO-Crate
     */
    async addDataset(projectId, dataset) {
        try {
            const currentROCrate = await this.getDALROCrate(projectId);
            const datasets = (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.datasets) || [];
            // Add or update dataset
            const existingIndex = datasets.findIndex(d => d.name === dataset.name);
            if (existingIndex >= 0) {
                datasets[existingIndex] = dataset;
            }
            else {
                datasets.push(dataset);
            }
            // Update the extension
            const dalExtension = {
                alConfig: (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.alConfig) || this.getDefaultALConfig(),
                workflow: currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.workflow,
                datasets,
                models: (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.models) || [],
                type: 'active_learning',
                version: '1.0',
                lastModified: new Date().toISOString()
            };
            await this.dvreAPI.updateROCrateExtension(projectId, 'dal', dalExtension);
            return await this.getDALROCrate(projectId);
        }
        catch (error) {
            console.error('DAL: Failed to add dataset:', error);
            throw error;
        }
    }
    /**
     * Add workflow to DAL RO-Crate
     */
    async addWorkflow(projectId, workflow) {
        try {
            const currentROCrate = await this.getDALROCrate(projectId);
            const dalExtension = {
                alConfig: (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.alConfig) || this.getDefaultALConfig(),
                workflow,
                datasets: (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.datasets) || [],
                models: (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.models) || [],
                type: 'active_learning',
                version: '1.0',
                lastModified: new Date().toISOString()
            };
            await this.dvreAPI.updateROCrateExtension(projectId, 'dal', dalExtension);
            return await this.getDALROCrate(projectId);
        }
        catch (error) {
            console.error('DAL: Failed to add workflow:', error);
            throw error;
        }
    }
    /**
     * Add model to DAL RO-Crate
     */
    async addModel(projectId, model) {
        try {
            const currentROCrate = await this.getDALROCrate(projectId);
            const models = (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.models) || [];
            // Add or update model
            const existingIndex = models.findIndex(m => m.name === model.name);
            if (existingIndex >= 0) {
                models[existingIndex] = model;
            }
            else {
                models.push(model);
            }
            const dalExtension = {
                alConfig: (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.alConfig) || this.getDefaultALConfig(),
                workflow: currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.workflow,
                datasets: (currentROCrate === null || currentROCrate === void 0 ? void 0 : currentROCrate.datasets) || [],
                models,
                type: 'active_learning',
                version: '1.0',
                lastModified: new Date().toISOString()
            };
            await this.dvreAPI.updateROCrateExtension(projectId, 'dal', dalExtension);
            return await this.getDALROCrate(projectId);
        }
        catch (error) {
            console.error('DAL: Failed to add model:', error);
            throw error;
        }
    }
    /**
     * Finalize DAL project (upload to IPFS and submit to orchestrator)
     */
    async finalizeProject(projectId, contractAddress) {
        try {
            this.ensureAPIConnection();
            // Validate DAL configuration before finalization
            const dalROCrate = await this.getDALROCrate(projectId);
            if (!dalROCrate) {
                throw new Error('DAL RO-Crate not found');
            }
            const validation = this.validateDALConfiguration(dalROCrate);
            if (!validation.valid) {
                throw new Error(`DAL configuration invalid: ${validation.errors.join(', ')}`);
            }
            // Use DVRE's finalization process
            const result = await this.dvreAPI.finalizeProject(projectId, contractAddress);
            console.log('DAL: Project finalized via DVRE:', result);
            return {
                ...result,
                success: true
            };
        }
        catch (error) {
            console.error('DAL: Project finalization failed:', error);
            throw error;
        }
    }
    /**
     * Subscribe to RO-Crate updates for a project
     */
    subscribeToUpdates(projectId, callback) {
        try {
            this.ensureAPIConnection();
            return this.dvreAPI.onROCrateUpdate(projectId, async (updatedROCrate) => {
                // Convert DVRE RO-Crate to DAL format and notify
                const dalROCrate = await this.getDALROCrate(projectId);
                if (dalROCrate) {
                    callback(dalROCrate);
                }
            });
        }
        catch (error) {
            console.error('DAL: Failed to subscribe to updates:', error);
            return () => { }; // Return empty unsubscribe function
        }
    }
    /**
     * Export DAL RO-Crate metadata
     */
    async exportMetadata(projectId) {
        try {
            this.ensureAPIConnection();
            return await this.dvreAPI.exportMetadata(projectId);
        }
        catch (error) {
            console.error('DAL: Failed to export metadata:', error);
            throw error;
        }
    }
    /**
     * Validate DAL configuration
     */
    validateDALConfiguration(dalROCrate) {
        const errors = [];
        const warnings = [];
        // Check required AL configuration
        if (!dalROCrate.alConfig) {
            errors.push('Active Learning configuration is required');
        }
        else {
            if (!dalROCrate.alConfig.queryStrategy) {
                errors.push('Query strategy is required');
            }
            if (!dalROCrate.alConfig.labelingBudget || dalROCrate.alConfig.labelingBudget <= 0) {
                errors.push('Valid labeling budget is required');
            }
            if (!dalROCrate.alConfig.modelConfig) {
                errors.push('Model configuration is required');
            }
        }
        // Check datasets
        if (!dalROCrate.datasets || dalROCrate.datasets.length === 0) {
            errors.push('At least one dataset is required');
        }
        // Check workflow
        if (!dalROCrate.workflow) {
            warnings.push('No workflow specified - will use default template');
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Get default AL configuration
     */
    getDefaultALConfig() {
        return {
            queryStrategy: 'uncertainty_sampling',
            labelingBudget: 100,
            maxIterations: 10,
            modelConfig: {
                model_type: 'logistic_regression',
                parameters: {}
            },
            dataConfig: {
                trainingDataset: '',
                features: []
            }
        };
    }
}
// Export singleton instance
export const dvreROCrateClient = DVREROCrateClient.getInstance();
//# sourceMappingURL=DVREROCrateClient.js.map