"use strict";
(self["webpackChunkjupyter_dvre_dal"] = self["webpackChunkjupyter_dvre_dal"] || []).push([["lib_index_js"],{

/***/ "./lib/CWLManager.js":
/*!***************************!*\
  !*** ./lib/CWLManager.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ClientCWLManager: () => (/* binding */ ClientCWLManager),
/* harmony export */   cwlManager: () => (/* binding */ cwlManager)
/* harmony export */ });
/**
 * Client-Side CWL Manager for DVRE DAL Extension
 * Handles local storage, auto-save, and validation of CWL workflows
 */
class ClientCWLManager {
    constructor() {
        this.storageKey = 'dvre-project-cwls';
        this.autoSaveCallbacks = new Map();
        // Clean up old auto-save entries on initialization
        this.cleanupOldEntries();
    }
    /**
     * Save CWL workflow locally (project creator only)
     */
    saveCWL(projectId, cwlWorkflow, metadata = {}) {
        const storage = this.getProjectCWLs();
        const existingData = storage[projectId];
        const updatedMetadata = {
            creator: this.getCurrentUser(),
            lastModified: new Date().toISOString(),
            version: existingData ? existingData.metadata.version + 1 : 1,
            autoSaved: metadata.autoSaved || false,
            status: metadata.status || 'draft',
            ...existingData === null || existingData === void 0 ? void 0 : existingData.metadata,
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
    loadCWL(projectId) {
        const storage = this.getProjectCWLs();
        const cwlData = storage[projectId];
        if (!cwlData)
            return null;
        // Verify user is the creator
        if (cwlData.metadata.creator !== this.getCurrentUser()) {
            throw new Error('Access denied: Only project creator can edit CWL');
        }
        return cwlData;
    }
    /**
     * Auto-save while editing
     */
    autoSave(projectId, cwlWorkflow) {
        this.saveCWL(projectId, cwlWorkflow, {
            autoSaved: true,
            status: 'draft'
        });
    }
    /**
     * Mark as finalized (ready for deployment)
     */
    finalizeCWL(projectId) {
        const cwlData = this.loadCWL(projectId);
        if (!cwlData)
            return false;
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
    markAsDeployed(projectId, workflowId) {
        const cwlData = this.loadCWL(projectId);
        if (!cwlData)
            return;
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
    canEdit(projectId) {
        try {
            const cwlData = this.loadCWL(projectId);
            return cwlData !== null;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get CWL status for project
     */
    getStatus(projectId) {
        const cwlData = this.loadCWL(projectId);
        return (cwlData === null || cwlData === void 0 ? void 0 : cwlData.metadata.status) || 'none';
    }
    /**
     * Validate CWL workflow structure
     */
    validateCWL(cwl) {
        try {
            // Check required fields
            if (!cwl.cwlVersion || !cwl.class)
                return false;
            // Validate CWL version
            if (!['v1.0', 'v1.1', 'v1.2'].includes(cwl.cwlVersion))
                return false;
            // Validate class
            if (!['Workflow', 'CommandLineTool', 'ExpressionTool'].includes(cwl.class))
                return false;
            // Check for inputs and outputs in workflows
            if (cwl.class === 'Workflow') {
                if (!cwl.inputs || !cwl.outputs || !cwl.steps)
                    return false;
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Create basic AL workflow template
     */
    createALTemplate(projectId, projectTitle, alConfig) {
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
    updateALConfiguration(projectId, alConfig) {
        const cwlData = this.loadCWL(projectId);
        if (!cwlData)
            return;
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
    setupAutoSave(projectId, getCWLCallback, intervalMs = 30000) {
        // Clear existing interval
        this.clearAutoSave(projectId);
        const autoSaveFunction = () => {
            try {
                const cwl = getCWLCallback();
                if (cwl) {
                    this.autoSave(projectId, cwl);
                }
            }
            catch (error) {
                console.warn(`Auto-save failed for project ${projectId}:`, error);
            }
        };
        const intervalId = setInterval(autoSaveFunction, intervalMs);
        this.autoSaveCallbacks.set(projectId, () => clearInterval(intervalId));
    }
    /**
     * Clear auto-save for a project
     */
    clearAutoSave(projectId) {
        const clearCallback = this.autoSaveCallbacks.get(projectId);
        if (clearCallback) {
            clearCallback();
            this.autoSaveCallbacks.delete(projectId);
        }
    }
    /**
     * Get all projects with CWL workflows
     */
    getAllProjects() {
        const storage = this.getProjectCWLs();
        return Object.keys(storage);
    }
    /**
     * Delete CWL for a project
     */
    deleteCWL(projectId) {
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
    getProjectCWLs() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        }
        catch (error) {
            console.error('Failed to parse stored CWL data:', error);
            return {};
        }
    }
    getCurrentUser() {
        // In a real implementation, this would get the user from auth system
        // For now, we'll use a simple identifier
        return localStorage.getItem('dvre-user-id') || 'anonymous';
    }
    notifyAutoSave(projectId) {
        // Dispatch custom event for UI components to listen to
        window.dispatchEvent(new CustomEvent('dvre-cwl-saved', {
            detail: { projectId, timestamp: new Date().toISOString() }
        }));
    }
    cleanupOldEntries(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
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
const cwlManager = new ClientCWLManager();


/***/ }),

/***/ "./lib/CWLWorkflowEditor.js":
/*!**********************************!*\
  !*** ./lib/CWLWorkflowEditor.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CWLWorkflowEditor: () => (/* binding */ CWLWorkflowEditor)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _CWLManager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./CWLManager */ "./lib/CWLManager.js");
/* harmony import */ var _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./OrchestrationAPI */ "./lib/OrchestrationAPI.js");
/* harmony import */ var _ContributorManager__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ContributorManager */ "./lib/ContributorManager.js");





const AutoSaveIndicator = ({ lastSaved, isAutoSaving }) => {
    if (isAutoSaving) {
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "autosave-indicator saving", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "dot-animation", children: "\u25CF" }), " Auto-saving..."] }));
    }
    if (lastSaved) {
        const timeAgo = new Date(lastSaved).toLocaleTimeString();
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "autosave-indicator saved", children: ["\u2713 Saved at ", timeAgo] }));
    }
    return null;
};
const ALConfigurationPanel = ({ config, onChange, disabled = false }) => {
    const updateConfig = (updates) => {
        onChange({ ...config, ...updates });
    };
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "al-config-panel", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Active Learning Configuration" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "config-grid", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "config-group", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "query-strategy", children: "Query Strategy:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("select", { id: "query-strategy", value: config.queryStrategy, onChange: (e) => updateConfig({ queryStrategy: e.target.value }), disabled: disabled, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: "uncertainty_sampling", children: "Uncertainty Sampling" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: "diversity_sampling", children: "Diversity Sampling" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: "query_by_committee", children: "Query by Committee" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: "expected_model_change", children: "Expected Model Change" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: "random_sampling", children: "Random Sampling" })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "config-group", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "labeling-budget", children: "Labeling Budget:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "labeling-budget", type: "number", min: "1", max: "10000", value: config.labelingBudget, onChange: (e) => updateConfig({ labelingBudget: parseInt(e.target.value) || 100 }), disabled: disabled })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "config-group", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "max-iterations", children: "Max Iterations:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "max-iterations", type: "number", min: "1", max: "100", value: config.maxIterations, onChange: (e) => updateConfig({ maxIterations: parseInt(e.target.value) || 10 }), disabled: disabled })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "config-group", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "validation-split", children: "Validation Split:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "validation-split", type: "number", min: "0.1", max: "0.5", step: "0.05", value: config.validationSplit || 0.2, onChange: (e) => updateConfig({ validationSplit: parseFloat(e.target.value) || 0.2 }), disabled: disabled })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "config-group", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("label", { children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { type: "checkbox", checked: config.isFederated, onChange: (e) => updateConfig({ isFederated: e.target.checked }), disabled: disabled }), "Enable Federated Learning"] }) }), config.isFederated && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "config-group", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "contributors", children: "Contributors (comma-separated):" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "contributors", type: "text", value: config.contributors.join(', '), onChange: (e) => updateConfig({
                            contributors: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                        }), placeholder: "alice@example.com, bob@example.com", disabled: disabled })] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "config-group", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "model-config", children: "Model Configuration (JSON):" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("textarea", { id: "model-config", value: JSON.stringify(config.modelConfig, null, 2), onChange: (e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                updateConfig({ modelConfig: parsed });
                            }
                            catch (error) {
                                // Invalid JSON, but still update to show user's input
                                updateConfig({ modelConfig: e.target.value });
                            }
                        }, rows: 8, disabled: disabled, placeholder: '{"model_type": "neural_network", "layers": [64, 32], "learning_rate": 0.001}' })] })] }));
};
const CWLCodeEditor = ({ cwl, onChange, disabled = false }) => {
    const [jsonText, setJsonText] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)('');
    const [isValid, setIsValid] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(true);
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        setJsonText(JSON.stringify(cwl, null, 2));
    }, [cwl]);
    const handleChange = (value) => {
        setJsonText(value);
        try {
            const parsed = JSON.parse(value);
            setIsValid(true);
            onChange(parsed);
        }
        catch (error) {
            setIsValid(false);
        }
    };
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "cwl-code-editor", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "CWL Workflow Definition" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: `editor-container ${!isValid ? 'invalid' : ''}`, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("textarea", { value: jsonText, onChange: (e) => handleChange(e.target.value), disabled: disabled, rows: 25, className: "cwl-textarea", spellCheck: false }), !isValid && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "validation-error", children: "Invalid JSON syntax. Please check your formatting." }))] })] }));
};
const WorkflowValidationPanel = ({ cwl }) => {
    const [validation, setValidation] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        const isValid = _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.validateCWL(cwl);
        // For now, just basic validation - could be enhanced
        setValidation({
            valid: isValid,
            errors: isValid ? [] : ['CWL validation failed'],
            warnings: []
        });
    }, [cwl]);
    if (!validation)
        return null;
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "validation-panel", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Validation Status" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: `validation-status ${validation.valid ? 'valid' : 'invalid'}`, children: [validation.valid ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "validation-success", children: "\u2713 Workflow is valid and ready for deployment" })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "validation-errors", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h4", { children: "Errors:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("ul", { children: validation.errors.map((error, index) => ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("li", { children: error }, index))) })] })), validation.warnings.length > 0 && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "validation-warnings", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h4", { children: "Warnings:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("ul", { children: validation.warnings.map((warning, index) => ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("li", { children: warning }, index))) })] }))] })] }));
};
const DeploymentPanel = ({ onDeploy, status, workflowId, canDeploy, isDeploying, error }) => {
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "deployment-panel", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Deployment" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "deployment-status", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: `status-badge ${status}`, children: status.toUpperCase() }), workflowId && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "workflow-id", children: ["Workflow ID: ", (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("code", { children: workflowId })] }))] }), error && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "deployment-error", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("strong", { children: "Deployment Error:" }), " ", error] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: onDeploy, disabled: !canDeploy || isDeploying, className: `deploy-button ${canDeploy ? 'ready' : 'disabled'}`, children: isDeploying ? 'Deploying...' : 'Deploy Workflow' }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "deployment-info", children: canDeploy ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Ready to deploy to orchestration server" })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Fix validation errors before deploying" })) })] }));
};
const CWLWorkflowEditor = ({ projectId, projectTitle, userWallet, projectData, onClose, onWorkflowDeployed }) => {
    const [cwlWorkflow, setCwlWorkflow] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [metadata, setMetadata] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [readOnly, setReadOnly] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [lastAutoSave, setLastAutoSave] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [isAutoSaving, setIsAutoSaving] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [deploymentStatus, setDeploymentStatus] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)('draft');
    const [workflowId, setWorkflowId] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [isDeploying, setIsDeploying] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [deploymentError, setDeploymentError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [alConfig, setAlConfig] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
        queryStrategy: 'uncertainty_sampling',
        modelConfig: {
            model_type: 'neural_network',
            layers: [64, 32],
            learning_rate: 0.001,
            batch_size: 32
        },
        labelingBudget: 100,
        maxIterations: 10,
        isFederated: false,
        contributors: [],
        validationSplit: 0.2
    });
    const autoSaveTimeoutRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)();
    // Load or create CWL workflow
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        loadOrCreateCWL();
        // Listen for auto-save events
        const handleAutoSave = (event) => {
            if (event.detail.projectId === projectId) {
                setLastAutoSave(event.detail.timestamp);
                setIsAutoSaving(false);
            }
        };
        window.addEventListener('dvre-cwl-saved', handleAutoSave);
        return () => {
            window.removeEventListener('dvre-cwl-saved', handleAutoSave);
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [projectId]);
    // Set up auto-save when CWL changes
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        if (cwlWorkflow && !readOnly) {
            // Clear existing timeout
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
            // Set new timeout for auto-save
            autoSaveTimeoutRef.current = setTimeout(() => {
                setIsAutoSaving(true);
                _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.autoSave(projectId, cwlWorkflow);
            }, 2000); // Auto-save after 2 seconds of inactivity
        }
    }, [cwlWorkflow, projectId, readOnly]);
    const loadOrCreateCWL = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
        try {
            const existingCWL = _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.loadCWL(projectId);
            if (existingCWL) {
                setCwlWorkflow(existingCWL.cwl);
                setMetadata(existingCWL.metadata);
                setDeploymentStatus(existingCWL.metadata.status);
                setWorkflowId(existingCWL.metadata.workflowId || null);
                // Load AL config if available
                if (existingCWL.metadata.alConfig) {
                    setAlConfig(existingCWL.metadata.alConfig);
                }
            }
            else {
                // Create new CWL from template
                createFromTemplate();
            }
        }
        catch (error) {
            if (error.message.includes('Access denied')) {
                setReadOnly(true);
                // Try to load read-only version
                const storage = JSON.parse(localStorage.getItem('dvre-project-cwls') || '{}');
                const cwlData = storage[projectId];
                if (cwlData) {
                    setCwlWorkflow(cwlData.cwl);
                    setMetadata(cwlData.metadata);
                    setDeploymentStatus(cwlData.metadata.status);
                }
            }
        }
    }, [projectId]);
    const createFromTemplate = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
        const template = _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.createALTemplate(projectId, projectTitle, alConfig);
        setCwlWorkflow(template);
        setDeploymentStatus('draft');
        // Save initial template
        _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.saveCWL(projectId, template, {
            projectTitle: projectTitle,
            alConfig: alConfig
        });
    }, [projectId, projectTitle, alConfig]);
    const updateALConfiguration = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((newConfig) => {
        setAlConfig(newConfig);
        if (cwlWorkflow && !readOnly) {
            _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.updateALConfiguration(projectId, newConfig);
            // Update local CWL with new configuration
            const updatedCWL = { ...cwlWorkflow };
            updatedCWL.inputs.query_strategy.default = newConfig.queryStrategy;
            updatedCWL.inputs.model_config.default = JSON.stringify(newConfig.modelConfig);
            updatedCWL.inputs.labeling_budget.default = newConfig.labelingBudget;
            updatedCWL.inputs.max_iterations.default = newConfig.maxIterations;
            setCwlWorkflow(updatedCWL);
        }
    }, [cwlWorkflow, projectId, readOnly]);
    const deployWorkflow = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        if (!cwlWorkflow || !userWallet) {
            setDeploymentError('User authentication required for workflow deployment');
            return;
        }
        try {
            setIsDeploying(true);
            setDeploymentError(null);
            // Finalize CWL locally
            const success = _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.finalizeCWL(projectId);
            if (!success)
                throw new Error('Failed to finalize CWL');
            // Create authenticated submission data with user context
            const submissionData = _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_3__.orchestrationAPI.createAuthenticatedSubmission(projectId, projectTitle, cwlWorkflow, alConfig, userWallet, projectData || {}, // Use project data for role determination
            {} // additional inputs
            );
            // Submit to orchestration server
            const response = await _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_3__.orchestrationAPI.submitProjectWorkflow(submissionData);
            // Update local status
            _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.markAsDeployed(projectId, response.workflow_id);
            setDeploymentStatus('deployed');
            setWorkflowId(response.workflow_id);
            if (onWorkflowDeployed) {
                onWorkflowDeployed(response.workflow_id);
            }
        }
        catch (error) {
            console.error('Deployment failed:', error);
            setDeploymentError(error.message);
        }
        finally {
            setIsDeploying(false);
        }
    }, [cwlWorkflow, projectId, projectTitle, alConfig, userWallet, projectData, onWorkflowDeployed]);
    if (readOnly) {
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "cwl-workflow-editor read-only", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "editor-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h2", { children: "CWL Workflow - Read Only" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Only the project creator can edit the CWL workflow" }), onClose && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: onClose, className: "close-button", children: "Close" }))] }), cwlWorkflow && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(CWLCodeEditor, { cwl: cwlWorkflow, onChange: () => { }, disabled: true }))] }));
    }
    const canDeploy = cwlWorkflow && _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.validateCWL(cwlWorkflow) && deploymentStatus !== 'deployed';
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "cwl-workflow-editor", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "editor-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("h2", { children: ["CWL Workflow Editor - ", projectTitle] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(AutoSaveIndicator, { lastSaved: lastAutoSave, isAutoSaving: isAutoSaving }), onClose && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: onClose, className: "close-button", children: "Close" }))] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "editor-content", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "left-panel", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(ALConfigurationPanel, { config: alConfig, onChange: updateALConfiguration, disabled: deploymentStatus === 'deployed' }), userWallet && projectData && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_ContributorManager__WEBPACK_IMPORTED_MODULE_4__.ContributorManager, { projectId: projectId, userWallet: userWallet, userRole: _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_3__.orchestrationAPI['getUserRole'] ? _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_3__.orchestrationAPI['getUserRole'](userWallet, projectData) : 'contributor', projectData: projectData, onContributorsChange: (contributors) => {
                                    console.log('Contributors updated:', contributors);
                                    // Optionally update AL config with contributor list
                                    const contributorWallets = contributors
                                        .filter(c => c.status === 'active' && c.wallet !== 'pending')
                                        .map(c => c.wallet);
                                    if (contributorWallets.length > 0) {
                                        updateALConfiguration({
                                            ...alConfig,
                                            contributors: contributorWallets
                                        });
                                    }
                                } })), cwlWorkflow && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(WorkflowValidationPanel, { cwl: cwlWorkflow }))] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "right-panel", children: [cwlWorkflow && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(CWLCodeEditor, { cwl: cwlWorkflow, onChange: setCwlWorkflow, disabled: deploymentStatus === 'deployed' })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(DeploymentPanel, { onDeploy: deployWorkflow, status: deploymentStatus, workflowId: workflowId, canDeploy: !!canDeploy, isDeploying: isDeploying, error: deploymentError })] })] })] }));
};


/***/ }),

/***/ "./lib/ContributorManager.js":
/*!***********************************!*\
  !*** ./lib/ContributorManager.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ContributorManager: () => (/* binding */ ContributorManager)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./OrchestrationAPI */ "./lib/OrchestrationAPI.js");



const ContributorManager = ({ projectId, userWallet, userRole, projectData, onContributorsChange }) => {
    const [contributors, setContributors] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([]);
    const [invitations, setInvitations] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([]);
    const [showInviteModal, setShowInviteModal] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [newInviteEmail, setNewInviteEmail] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)('');
    const [newInviteWallet, setNewInviteWallet] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)('');
    const [newInviteMessage, setNewInviteMessage] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)('');
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    // Load existing contributors from project data
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        if (projectData === null || projectData === void 0 ? void 0 : projectData.participants) {
            const existingContributors = projectData.participants.map((p) => ({
                wallet: p.address || p.wallet,
                name: p.name,
                email: p.email,
                status: 'active',
                invitedAt: p.joinedAt || new Date().toISOString(),
                acceptedAt: p.joinedAt || new Date().toISOString(),
                samplesAssigned: 0,
                labelsSubmitted: 0,
                accuracyScore: 0
            }));
            setContributors(existingContributors);
        }
    }, [projectData]);
    // Load invitations and contributor stats from orchestration server
    const loadContributorData = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        if (userRole !== 'coordinator')
            return;
        try {
            setLoading(true);
            // Get session stats to update contributor performance
            const sessionStats = await _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_2__.orchestrationAPI.getMultiUserSessionStats(projectId, userWallet, projectData);
            if (sessionStats.contributors) {
                setContributors(prev => prev.map(contributor => {
                    const stats = sessionStats.contributors.find((c) => c.wallet.toLowerCase() === contributor.wallet.toLowerCase());
                    if (stats) {
                        return {
                            ...contributor,
                            samplesAssigned: stats.samples_assigned || 0,
                            labelsSubmitted: stats.labels_submitted || 0,
                            accuracyScore: stats.accuracy_score || 0,
                            lastActivity: stats.last_submission,
                            status: stats.status === 'active' ? 'active' : 'inactive'
                        };
                    }
                    return contributor;
                }));
            }
        }
        catch (error) {
            console.warn('Failed to load contributor stats:', error);
        }
        finally {
            setLoading(false);
        }
    }, [projectId, userWallet, userRole, projectData]);
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        loadContributorData();
    }, [loadContributorData]);
    // Send invitation
    const sendInvitation = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        if (!newInviteWallet && !newInviteEmail) {
            setError('Please provide either a wallet address or email');
            return;
        }
        try {
            setLoading(true);
            setError(null);
            // Create invitation
            const invitation = {
                id: `invite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                projectId,
                contributorWallet: newInviteWallet,
                contributorEmail: newInviteEmail,
                invitedBy: userWallet,
                status: 'pending',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                message: newInviteMessage
            };
            // Store invitation locally (in real implementation, send to server)
            const storedInvitations = JSON.parse(localStorage.getItem('dvre-dal-invitations') || '[]');
            storedInvitations.push(invitation);
            localStorage.setItem('dvre-dal-invitations', JSON.stringify(storedInvitations));
            setInvitations(prev => [...prev, invitation]);
            // Add as pending contributor
            const newContributor = {
                wallet: newInviteWallet || 'pending',
                email: newInviteEmail,
                status: 'invited',
                invitedAt: new Date().toISOString(),
                samplesAssigned: 0,
                labelsSubmitted: 0,
                accuracyScore: 0
            };
            setContributors(prev => [...prev, newContributor]);
            // Clear form
            setNewInviteEmail('');
            setNewInviteWallet('');
            setNewInviteMessage('');
            setShowInviteModal(false);
            // Notify parent component
            if (onContributorsChange) {
                onContributorsChange([...contributors, newContributor]);
            }
            // TODO: In real implementation, call orchestration server to send invitation
            // await orchestrationAPI.sendContributorInvitation(invitation);
        }
        catch (error) {
            setError(error.message);
        }
        finally {
            setLoading(false);
        }
    }, [newInviteWallet, newInviteEmail, newInviteMessage, projectId, userWallet, contributors, onContributorsChange]);
    // Remove contributor
    const removeContributor = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async (contributorWallet) => {
        if (userRole !== 'coordinator')
            return;
        try {
            setLoading(true);
            // Remove from local state
            setContributors(prev => prev.filter(c => c.wallet !== contributorWallet));
            // TODO: Call orchestration server to remove contributor from project
            // await orchestrationAPI.removeContributor(projectId, contributorWallet, userWallet, projectData);
            // Notify parent component
            if (onContributorsChange) {
                onContributorsChange(contributors.filter(c => c.wallet !== contributorWallet));
            }
        }
        catch (error) {
            setError(error.message);
        }
        finally {
            setLoading(false);
        }
    }, [userRole, projectId, userWallet, projectData, contributors, onContributorsChange]);
    if (userRole === 'observer') {
        return null; // Observers cannot see contributor management
    }
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "contributor-manager", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "contributor-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Project Contributors" }), userRole === 'coordinator' && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => setShowInviteModal(true), className: "invite-button", disabled: loading, children: "Invite Contributor" }))] }), error && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "error-message", children: [error, (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => setError(null), children: "\u00D7" })] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "contributors-list", children: contributors.length === 0 ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "empty-state", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "No contributors yet" }), userRole === 'coordinator' && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Invite contributors to start collaborative Active Learning" }))] })) : (contributors.map((contributor, index) => ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "contributor-item", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "contributor-info", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "contributor-identity", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("strong", { children: contributor.name || contributor.email || 'Anonymous' }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: `status-badge ${contributor.status}`, children: contributor.status })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "contributor-details", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { children: ["Wallet: ", contributor.wallet === 'pending' ? 'Pending acceptance' : `${contributor.wallet.slice(0, 6)}...${contributor.wallet.slice(-4)}`] }), contributor.email && (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { children: ["Email: ", contributor.email] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { children: ["Invited: ", new Date(contributor.invitedAt).toLocaleDateString()] }), contributor.lastActivity && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { children: ["Last Activity: ", new Date(contributor.lastActivity).toLocaleDateString()] }))] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "contributor-stats", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "stat", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "stat-value", children: contributor.samplesAssigned }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "stat-label", children: "Samples Assigned" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "stat", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "stat-value", children: contributor.labelsSubmitted }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "stat-label", children: "Labels Submitted" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "stat", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { className: "stat-value", children: [(contributor.accuracyScore * 100).toFixed(1), "%"] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "stat-label", children: "Accuracy" })] })] }), userRole === 'coordinator' && contributor.status !== 'invited' && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "contributor-actions", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => removeContributor(contributor.wallet), className: "remove-button", disabled: loading, children: "Remove" }) }))] }, contributor.wallet || index)))) }), showInviteModal && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "modal-overlay", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "modal", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "modal-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Invite Contributor" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => setShowInviteModal(false), className: "close-button", children: "\u00D7" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "modal-content", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "form-group", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "invite-email", children: "Email Address (optional):" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "invite-email", type: "email", value: newInviteEmail, onChange: (e) => setNewInviteEmail(e.target.value), placeholder: "contributor@example.com" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "form-group", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "invite-wallet", children: "Wallet Address (optional):" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "invite-wallet", type: "text", value: newInviteWallet, onChange: (e) => setNewInviteWallet(e.target.value), placeholder: "0x..." })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "form-group", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "invite-message", children: "Invitation Message (optional):" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("textarea", { id: "invite-message", value: newInviteMessage, onChange: (e) => setNewInviteMessage(e.target.value), placeholder: "Join our Active Learning project...", rows: 3 })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "modal-actions", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => setShowInviteModal(false), className: "cancel-button", children: "Cancel" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: sendInvitation, className: "send-button", disabled: loading || (!newInviteEmail && !newInviteWallet), children: loading ? 'Sending...' : 'Send Invitation' })] })] }) }))] }));
};


/***/ }),

/***/ "./lib/DALComponent.js":
/*!*****************************!*\
  !*** ./lib/DALComponent.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _CWLWorkflowEditor__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./CWLWorkflowEditor */ "./lib/CWLWorkflowEditor.js");
/* harmony import */ var _RuntimeOrchestrationPanel__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./RuntimeOrchestrationPanel */ "./lib/RuntimeOrchestrationPanel.js");
/* harmony import */ var _CWLManager__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./CWLManager */ "./lib/CWLManager.js");
/* harmony import */ var _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./OrchestrationAPI */ "./lib/OrchestrationAPI.js");
/* harmony import */ var _integration_DVREIntegration__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./integration/DVREIntegration */ "./lib/integration/DVREIntegration.js");







const DALComponent = ({ title = 'Decentralized Active Learning' }) => {
    // Use DVRE integration for authentication
    const { account, isLoading: authLoading, error: authError, connect } = (0,_integration_DVREIntegration__WEBPACK_IMPORTED_MODULE_6__.useDVREAuth)();
    // Use the integration to get Active Learning projects from DVRE's userProjects
    const { projects: alProjects, loading: projectsLoading, error: projectsError } = (0,_integration_DVREIntegration__WEBPACK_IMPORTED_MODULE_6__.useActiveLearningProjects)(account);
    const [selectedProject, setSelectedProject] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [showCWLEditor, setShowCWLEditor] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [showRuntimePanel, setShowRuntimePanel] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    // COMMENTED OUT RO-CRATE: const [showSetupWizard, setShowSetupWizard] = useState(false);
    const [serverHealthy, setServerHealthy] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    // COMMENTED OUT RO-CRATE: const [roCrateData, setROCrateData] = useState<Record<string, DALROCrate>>({});
    // COMMENTED OUT RO-CRATE: const [loadingROCrates, setLoadingROCrates] = useState(false);
    console.log('DAL: Component rendering, auth state:', { account, authLoading, authError });
    console.log('DAL: AL projects from DVRE userProjects:', (alProjects === null || alProjects === void 0 ? void 0 : alProjects.length) || 0);
    // COMMENTED OUT RO-CRATE: Load RO-Crate data for all AL projects
    const loadROCrateData = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        if (!alProjects || alProjects.length === 0)
            return;
        // setLoadingROCrates(true); // COMMENTED OUT RO-CRATE
        try {
            // const roCrateMap: Record<string, DALROCrate> = {}; // COMMENTED OUT RO-CRATE
            for (const project of alProjects) {
                try {
                    // Try to get existing DAL RO-Crate, or create default if none exists
                    // let dalROCrate = await dvreROCrateClient.getDALROCrate(project.address); // COMMENTED OUT RO-CRATE
                    // if (!dalROCrate) { // COMMENTED OUT RO-CRATE
                    //   // Initialize default DAL configuration for new projects // COMMENTED OUT RO-CRATE
                    //   console.log(`DAL: Initializing RO-Crate for project ${project.address}`); // COMMENTED OUT RO-CRATE
                    //   dalROCrate = await dvreROCrateClient.updateDALConfiguration(project.address, { // COMMENTED OUT RO-CRATE
                    //     queryStrategy: 'uncertainty_sampling', // COMMENTED OUT RO-CRATE
                    //     labelingBudget: 100, // COMMENTED OUT RO-CRATE
                    //     maxIterations: 10, // COMMENTED OUT RO-CRATE
                    //     modelConfig: { // COMMENTED OUT RO-CRATE
                    //       model_type: 'logistic_regression', // COMMENTED OUT RO-CRATE
                    //       parameters: {} // COMMENTED OUT RO-CRATE
                    //     }, // COMMENTED OUT RO-CRATE
                    //     dataConfig: { // COMMENTED OUT RO-CRATE
                    //       trainingDataset: '', // COMMENTED OUT RO-CRATE
                    //       features: [] // COMMENTED OUT RO-CRATE
                    //     } // COMMENTED OUT RO-CRATE
                    //   }); // COMMENTED OUT RO-CRATE
                    // } // COMMENTED OUT RO-CRATE
                    // if (dalROCrate) { // COMMENTED OUT RO-CRATE
                    //   roCrateMap[project.address] = dalROCrate; // COMMENTED OUT RO-CRATE
                    // } // COMMENTED OUT RO-CRATE
                }
                catch (error) {
                    console.warn(`DAL: Failed to load RO-Crate for project ${project.address}:`, error);
                }
            }
            // setROCrateData(roCrateMap); // COMMENTED OUT RO-CRATE
        }
        catch (error) {
            console.error('DAL: Failed to load RO-Crate data:', error);
            setError('Failed to load project configurations');
        }
        finally {
            // setLoadingROCrates(false); // COMMENTED OUT RO-CRATE
        }
    }, [alProjects]);
    // COMMENTED OUT RO-CRATE: Load RO-Crate data when AL projects change
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        // loadROCrateData(); // COMMENTED OUT RO-CRATE
    }, [loadROCrateData]);
    // Convert DVRE projects to DAL project format with RO-Crate data
    const dalProjects = alProjects.map(project => {
        // const dalROCrate = roCrateData[project.address]; // COMMENTED OUT RO-CRATE
        var _a, _b, _c;
        return {
            id: project.address,
            name: project.objective || 'Unnamed AL Project',
            contractAddress: project.address,
            status: project.isActive ? 'active' : 'completed',
            participants: project.memberCount || 1,
            accuracy: ((_a = project.projectData) === null || _a === void 0 ? void 0 : _a.accuracy) || 0,
            currentRound: ((_b = project.projectData) === null || _b === void 0 ? void 0 : _b.currentRound) || 0,
            totalRounds: ((_c = project.projectData) === null || _c === void 0 ? void 0 : _c.maxRounds) || 10,
            lastUpdated: new Date(project.lastModified * 1000),
            cwlStatus: _CWLManager__WEBPACK_IMPORTED_MODULE_4__.cwlManager.getStatus(project.address),
            phase: 'configuration',
            // dalROCrate: dalROCrate // COMMENTED OUT RO-CRATE Add RO-Crate data to the project
        };
    });
    // Simplified server health check
    const checkServerHealth = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        try {
            const healthy = await _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_5__.orchestrationAPI.checkServerHealth();
            setServerHealthy(healthy);
        }
        catch (error) {
            setServerHealthy(false);
        }
    }, []);
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        console.log('DAL: Effect running, account:', account);
        if (account) {
            checkServerHealth();
        }
    }, [account, checkServerHealth]);
    // Handle project selection
    const handleProjectSelect = (project) => {
        setSelectedProject(project);
    };
    // Handle project setup
    const handleSetupProject = (project) => {
        setSelectedProject(project);
        // setShowSetupWizard(true); // COMMENTED OUT RO-CRATE
    };
    // Handle CWL configuration
    const handleConfigureCWL = (project) => {
        setSelectedProject(project);
        setShowCWLEditor(true);
    };
    // Handle runtime orchestration
    const handleShowRuntime = (project) => {
        setSelectedProject(project);
        setShowRuntimePanel(true);
    };
    // Handle back to main view
    const handleBackToMain = () => {
        setSelectedProject(null);
        setShowCWLEditor(false);
        setShowRuntimePanel(false);
        // setShowSetupWizard(false); // COMMENTED OUT RO-CRATE
    };
    // Handle wizard completion
    const handleWizardComplete = (roCrate) => {
        console.log('DAL: Project setup completed:', roCrate);
        // setShowSetupWizard(false); // COMMENTED OUT RO-CRATE
        // Refresh RO-Crate data
        // loadROCrateData(); // COMMENTED OUT RO-CRATE
    };
    // Handle workflow deployment success
    const handleWorkflowDeployed = (workflowId) => {
        console.log('DAL: Workflow deployed successfully:', workflowId);
        // Optionally update project status or refresh data
        setShowCWLEditor(false);
        setShowRuntimePanel(true);
    };
    // Loading state
    if (authLoading) {
        console.log('DAL: Rendering loading state');
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: {
                padding: '20px',
                fontFamily: 'var(--jp-ui-font-family)',
                background: 'var(--jp-layout-color1)',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
            }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: { marginBottom: '10px' }, children: "Loading authentication..." }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: { fontSize: '12px', color: 'gray' }, children: "DAL Extension v0.1.0" })] }));
    }
    // Authentication required
    if (!account) {
        console.log('DAL: Rendering auth required state');
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: {
                padding: '20px',
                fontFamily: 'var(--jp-ui-font-family)',
                background: 'var(--jp-layout-color1)',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }, children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: {
                    background: 'var(--jp-warn-color3)',
                    border: '1px solid var(--jp-warn-color1)',
                    borderRadius: '4px',
                    padding: '20px',
                    textAlign: 'center',
                    maxWidth: '400px'
                }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { style: { color: 'var(--jp-warn-color1)', margin: '0 0 10px 0' }, children: "Authentication Required" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { style: { color: 'var(--jp-ui-font-color1)', margin: '0 0 15px 0' }, children: "Please connect your wallet to access Decentralized Active Learning projects." }), authError && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("p", { style: { color: 'var(--jp-error-color1)', fontSize: '12px', margin: '0 0 15px 0' }, children: ["Error: ", authError] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: connect, style: {
                            padding: '10px 20px',
                            background: 'var(--jp-brand-color1)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }, children: "Connect Wallet" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: { fontSize: '12px', color: 'gray', marginTop: '10px' }, children: "DAL Extension v0.1.0" })] }) }));
    }
    // Show CWL Editor
    if (showCWLEditor && selectedProject) {
        // Find the corresponding DVRE project data for authentication
        const correspondingProject = alProjects.find(p => p.address === selectedProject.contractAddress);
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: {
                fontFamily: 'var(--jp-ui-font-family)',
                background: 'var(--jp-layout-color1)',
                minHeight: '400px'
            }, children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_CWLWorkflowEditor__WEBPACK_IMPORTED_MODULE_2__.CWLWorkflowEditor, { projectId: selectedProject.contractAddress, projectTitle: selectedProject.name, userWallet: account, projectData: correspondingProject, onClose: handleBackToMain, onWorkflowDeployed: handleWorkflowDeployed }) }));
    }
    // Show Runtime Panel
    if (showRuntimePanel && selectedProject) {
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: {
                fontFamily: 'var(--jp-ui-font-family)',
                background: 'var(--jp-layout-color1)',
                minHeight: '400px'
            }, children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_RuntimeOrchestrationPanel__WEBPACK_IMPORTED_MODULE_3__.RuntimeOrchestrationPanel, { projectId: selectedProject.contractAddress, projectTitle: selectedProject.name, workflowId: selectedProject.workflowId, onClose: handleBackToMain }) }));
    }
    // Show Setup Wizard
    if (false) // removed by dead control flow
{}
    console.log('DAL: Rendering main interface');
    // Main interface
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: {
            padding: '20px',
            fontFamily: 'var(--jp-ui-font-family)',
            background: 'var(--jp-layout-color1)',
            minHeight: '400px'
        }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h1", { children: title }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: { display: 'flex', gap: '10px', alignItems: 'center' }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: {
                                    padding: '4px 8px',
                                    background: 'var(--jp-success-color3)',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }, children: ["Connected: ", account.slice(0, 6), "...", account.slice(-4)] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: {
                                    padding: '4px 8px',
                                    background: serverHealthy ? 'var(--jp-success-color3)' : 'var(--jp-warn-color3)',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }, children: ["Server: ", serverHealthy ? 'Online' : 'Offline'] })] })] }), (error || projectsError) && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: {
                    background: 'var(--jp-error-color3)',
                    border: '1px solid var(--jp-error-color1)',
                    borderRadius: '4px',
                    padding: '10px',
                    marginBottom: '20px',
                    color: 'var(--jp-error-color1)'
                }, children: error || projectsError })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: { marginBottom: '30px' }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h2", { children: "Active Learning Projects" }), projectsLoading ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { children: "Loading projects..." })) : dalProjects.length === 0 ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: {
                            background: 'var(--jp-layout-color2)',
                            border: '1px solid var(--jp-border-color1)',
                            borderRadius: '4px',
                            padding: '20px',
                            textAlign: 'center'
                        }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "No Active Learning projects found." }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { style: { fontSize: '14px', color: 'var(--jp-ui-font-color2)' }, children: "Create an Active Learning project using the Project Collaboration extension to see it here." })] })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { children: dalProjects.map(project => ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: {
                                background: 'var(--jp-layout-color2)',
                                border: '1px solid var(--jp-border-color1)',
                                borderRadius: '4px',
                                padding: '15px',
                                marginBottom: '10px'
                            }, children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: { flex: 1 }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { style: { margin: '0 0 10px 0' }, children: project.name }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: { fontSize: '14px', color: 'var(--jp-ui-font-color2)', marginBottom: '10px' }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { children: ["Status: ", project.status] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { children: ["Participants: ", project.participants] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { children: ["Contract: ", project.contractAddress] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { children: ["CWL Status: ", project.cwlStatus || 'Not configured'] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { children: ["Last Updated: ", project.lastUpdated.toLocaleDateString()] })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '20px' }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => handleConfigureCWL(project), style: {
                                                    padding: '8px 16px',
                                                    background: 'var(--jp-brand-color1)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap'
                                                }, children: "Configure Workflow" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => handleShowRuntime(project), disabled: project.cwlStatus !== 'deployed', style: {
                                                    padding: '8px 16px',
                                                    background: project.cwlStatus === 'deployed' ? 'var(--jp-success-color1)' : 'var(--jp-layout-color3)',
                                                    color: project.cwlStatus === 'deployed' ? 'white' : 'var(--jp-ui-font-color3)',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: project.cwlStatus === 'deployed' ? 'pointer' : 'not-allowed',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap'
                                                }, children: "Run Workflow" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => handleSetupProject(project), style: {
                                                    padding: '8px 16px',
                                                    background: 'var(--jp-info-color1)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap'
                                                }, children: "Setup Project" })] })] }) }, project.id))) }))] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h2", { children: "Getting Started" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: {
                                    background: 'var(--jp-layout-color2)',
                                    border: '1px solid var(--jp-border-color1)',
                                    borderRadius: '4px',
                                    padding: '20px'
                                }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "1. Create or Join Projects" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "To create a new Active Learning project or join an existing one, use the Project Collaboration extension." }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: { fontSize: '12px', color: 'var(--jp-ui-font-color2)', marginTop: '10px' }, children: "Projects will appear above once they're created with the \"Active Learning\" template." })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: {
                                    background: 'var(--jp-layout-color2)',
                                    border: '1px solid var(--jp-border-color1)',
                                    borderRadius: '4px',
                                    padding: '20px'
                                }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "2. Configure Workflows" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Define your Active Learning workflow using CWL (Common Workflow Language) including dataset preparation, model training, and query strategies." }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: { fontSize: '12px', color: 'var(--jp-ui-font-color2)', marginTop: '10px' }, children: "Use the \"Configure Workflow\" button for each project." })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { style: {
                                    background: 'var(--jp-layout-color2)',
                                    border: '1px solid var(--jp-border-color1)',
                                    borderRadius: '4px',
                                    padding: '20px'
                                }, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "3. Run Active Learning" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Execute your configured workflows to start the Active Learning process with automated query selection, labeling, and model updates." }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { style: { fontSize: '12px', color: 'var(--jp-ui-font-color2)', marginTop: '10px' }, children: "Available after workflow configuration is complete." })] })] })] })] }));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DALComponent);


/***/ }),

/***/ "./lib/DALWidget.js":
/*!**************************!*\
  !*** ./lib/DALWidget.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DALWidget: () => (/* binding */ DALWidget)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/ui-components */ "webpack/sharing/consume/default/@jupyterlab/ui-components");
/* harmony import */ var _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _DALComponent__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./DALComponent */ "./lib/DALComponent.js");



class DALWidget extends _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_1__.ReactWidget {
    constructor(title = 'Decentralized Active Learning') {
        super();
        this._title = title;
        this.addClass('dvre-widget');
        this.addClass('dvre-dal-widget');
        this.title.label = title;
        this.title.closable = true;
    }
    render() {
        return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_DALComponent__WEBPACK_IMPORTED_MODULE_2__["default"], { title: this._title });
    }
}


/***/ }),

/***/ "./lib/OrchestrationAPI.js":
/*!*********************************!*\
  !*** ./lib/OrchestrationAPI.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OrchestrationAPI: () => (/* binding */ OrchestrationAPI),
/* harmony export */   orchestrationAPI: () => (/* binding */ orchestrationAPI)
/* harmony export */ });
/**
 * Orchestration API Client for DVRE DAL Extension
 * Handles communication with the DVRE Orchestration Server
 */
class OrchestrationAPI {
    constructor(baseUrl = 'http://145.100.135.97:5004') {
        this.defaultTimeout = 30000; // 30 seconds
        this.developmentMode = false;
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }
    /**
     * Enable development mode with mock responses
     */
    enableDevelopmentMode() {
        this.developmentMode = true;
        console.log('DAL: Orchestration API running in development mode with mock responses');
    }
    /**
     * Determine user role based on DVRE project data
     */
    getUserRole(userWallet, projectData) {
        const userAddress = userWallet.toLowerCase();
        // Check if user is the project creator (coordinator)
        if (projectData.creator && projectData.creator.toLowerCase() === userAddress) {
            return 'coordinator';
        }
        // Check if user is in participants list (contributor)
        if (projectData.participants && Array.isArray(projectData.participants)) {
            const isParticipant = projectData.participants.some((p) => p.address && p.address.toLowerCase() === userAddress);
            if (isParticipant) {
                return 'contributor';
            }
        }
        // Check if user is a member (from DVRE integration)
        if (projectData.isMember || projectData.isOwner) {
            return projectData.isOwner ? 'coordinator' : 'contributor';
        }
        // Default to observer
        return 'observer';
    }
    /**
     * Create authenticated workflow submission with user context
     */
    createAuthenticatedSubmission(projectId, projectTitle, cwlWorkflow, alConfig, userWallet, projectData, inputs = {}) {
        const userRole = this.getUserRole(userWallet, projectData);
        return {
            project_id: projectId,
            cwl_workflow: cwlWorkflow,
            inputs: {
                dataset: inputs.dataset || 'default_dataset.csv',
                query_strategy: alConfig.queryStrategy,
                model_config: JSON.stringify(alConfig.modelConfig),
                labeling_budget: alConfig.labelingBudget,
                max_iterations: alConfig.maxIterations,
                validation_split: alConfig.validationSplit || 0.2,
                ...inputs
            },
            metadata: {
                creator: userWallet,
                project_title: projectTitle,
                al_config: alConfig,
                contributors: alConfig.contributors,
                // Phase 1 metadata
                configuration_phase: 'finalized',
                smart_contract_address: projectData.address || projectId,
                ipfs_dataset_hash: inputs.ipfs_dataset_hash,
                ipfs_model_hash: inputs.ipfs_model_hash,
                // User context
                submitted_by: userWallet,
                user_role: userRole,
                project_creator: projectData.creator,
                project_participants: projectData.participants || []
            },
            // User authentication
            user_wallet: userWallet,
            user_role: userRole,
            contract_address: projectData.address || projectId
        };
    }
    /**
     * Create authenticated AL engine command with user context
     */
    createAuthenticatedCommand(commandType, projectId, workflowId, userWallet, projectData, parameters = {}) {
        const userRole = this.getUserRole(userWallet, projectData);
        return {
            command_type: commandType,
            project_id: projectId,
            workflow_id: workflowId,
            parameters: parameters,
            timestamp: new Date().toISOString(),
            // User authentication
            user_wallet: userWallet,
            user_role: userRole,
            contract_address: projectData.address || projectId
        };
    }
    /**
     * Submit a project workflow to the orchestration server (Phase 1)
     */
    async submitProjectWorkflow(data) {
        if (this.developmentMode) {
            // Mock response for development
            const mockWorkflowId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
            return {
                workflow_id: mockWorkflowId,
                project_id: data.project_id,
                status: 'SUBMITTED',
                message: 'Workflow submitted successfully (development mode)'
            };
        }
        try {
            const response = await this.makeRequest('/streamflow/submit-project-workflow', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                if (response.status === 500) {
                    console.warn('DAL: Streamflow extension not available, enabling development mode');
                    this.enableDevelopmentMode();
                    return this.submitProjectWorkflow(data); // Retry with development mode
                }
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            if (error.message.includes('streamflow extension')) {
                throw error; // Re-throw our custom error
            }
            console.warn('DAL: Server error, enabling development mode:', error.message);
            this.enableDevelopmentMode();
            return this.submitProjectWorkflow(data); // Retry with development mode
        }
    }
    /**
     * Submit a basic workflow (backward compatibility)
     */
    async submitWorkflow(cwlWorkflow, inputs = {}) {
        const response = await this.makeRequest('/streamflow/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cwl_workflow: cwlWorkflow,
                inputs: inputs
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Get workflow status by ID
     */
    async getWorkflowStatus(workflowId) {
        if (this.developmentMode) {
            // Mock workflow status for development
            await new Promise(resolve => setTimeout(resolve, 500));
            if (workflowId.startsWith('mock-')) {
                return {
                    workflow_id: workflowId,
                    project_id: 'mock-project',
                    status: Math.random() > 0.5 ? 'COMPLETED' : 'RUNNING',
                    created_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
                    started_at: new Date(Date.now() - Math.random() * 1800000).toISOString(),
                    completed_at: Math.random() > 0.3 ? new Date().toISOString() : undefined,
                    output: 'Mock workflow execution completed successfully',
                    metadata: {
                        phase: 'configuration',
                        creator: 'development-user'
                    },
                    submitted_by: 'development-user',
                    accessible_to: ['development-user']
                };
            }
        }
        const response = await this.makeRequest(`/streamflow/status/${workflowId}`);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Workflow not found');
            }
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * List all workflows, optionally filtered by project
     */
    async listWorkflows(projectId) {
        const url = projectId
            ? `/streamflow/workflows?project_id=${encodeURIComponent(projectId)}`
            : '/streamflow/workflows';
        const response = await this.makeRequest(url);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Get all workflows for a specific project
     */
    async getProjectWorkflows(projectId) {
        const response = await this.makeRequest(`/streamflow/projects/${encodeURIComponent(projectId)}/workflows`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    // Phase 2: Runtime Orchestration Methods for AL-engine interaction
    /**
     * Start a new querying session (Phase 2)
     */
    async startQuerying(projectId, workflowId, parameters = {}) {
        const command = {
            command_type: 'start_querying',
            project_id: projectId,
            workflow_id: workflowId,
            parameters: parameters,
            timestamp: new Date().toISOString(),
            // User authentication for commands
            user_wallet: 'development-user',
            user_role: 'coordinator',
            contract_address: '0x0000000000000000000000000000000000000000' // Placeholder, replace with actual contract address
        };
        const response = await this.makeRequest('/al-engine/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(command),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Continue querying in an existing session
     */
    async continueQuerying(projectId, workflowId, sessionId) {
        const command = {
            command_type: 'continue_querying',
            project_id: projectId,
            workflow_id: workflowId,
            parameters: { session_id: sessionId },
            timestamp: new Date().toISOString(),
            // User authentication for commands
            user_wallet: 'development-user',
            user_role: 'coordinator',
            contract_address: '0x0000000000000000000000000000000000000000' // Placeholder, replace with actual contract address
        };
        const response = await this.makeRequest('/al-engine/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(command),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Prompt training with current labeled data
     */
    async promptTraining(projectId, workflowId, parameters) {
        const command = {
            command_type: 'prompt_training',
            project_id: projectId,
            workflow_id: workflowId,
            parameters: parameters,
            timestamp: new Date().toISOString(),
            // User authentication for commands
            user_wallet: 'development-user',
            user_role: 'coordinator',
            contract_address: '0x0000000000000000000000000000000000000000' // Placeholder, replace with actual contract address
        };
        const response = await this.makeRequest('/al-engine/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(command),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Submit new labels for queried samples
     */
    async submitLabels(projectId, workflowId, labels) {
        const command = {
            command_type: 'submit_labels',
            project_id: projectId,
            workflow_id: workflowId,
            parameters: labels,
            timestamp: new Date().toISOString(),
            // User authentication for commands
            user_wallet: 'development-user',
            user_role: 'coordinator',
            contract_address: '0x0000000000000000000000000000000000000000' // Placeholder, replace with actual contract address
        };
        const response = await this.makeRequest('/al-engine/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(command),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Get current querying session status
     */
    async getQueryingSession(projectId, sessionId) {
        const response = await this.makeRequest(`/al-engine/sessions/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * List all active querying sessions for a project
     */
    async listQueryingSessions(projectId) {
        const response = await this.makeRequest(`/al-engine/sessions/${encodeURIComponent(projectId)}`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return data.sessions || [];
    }
    /**
     * Terminate a project and clean up resources
     */
    async terminateProject(projectId, workflowId) {
        const command = {
            command_type: 'terminate_project',
            project_id: projectId,
            workflow_id: workflowId,
            parameters: {},
            timestamp: new Date().toISOString(),
            // User authentication for commands
            user_wallet: 'development-user',
            user_role: 'coordinator',
            contract_address: '0x0000000000000000000000000000000000000000' // Placeholder, replace with actual contract address
        };
        const response = await this.makeRequest('/al-engine/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(command),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Check if the orchestration server is healthy and responding
     */
    async checkServerHealth() {
        try {
            // Check Jupyter server API which should always be available
            const response = await this.makeRequest('/api', { timeout: 5000 });
            return response.ok;
        }
        catch (error) {
            console.warn('DAL: Server health check failed:', error);
            return false;
        }
    }
    /**
     * Get server information and API documentation
     */
    async getServerInfo() {
        const response = await this.makeRequest('/');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Poll workflow status until completion
     */
    async pollWorkflowUntilComplete(workflowId, intervalMs = 2000, maxAttempts = 150 // 5 minutes at 2-second intervals
    ) {
        let attempts = 0;
        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    attempts++;
                    const status = await this.getWorkflowStatus(workflowId);
                    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
                        resolve(status);
                        return;
                    }
                    if (attempts >= maxAttempts) {
                        reject(new Error(`Workflow polling timeout after ${maxAttempts} attempts`));
                        return;
                    }
                    // Continue polling
                    setTimeout(poll, intervalMs);
                }
                catch (error) {
                    reject(error);
                }
            };
            // Start polling
            poll();
        });
    }
    /**
     * Validate workflow inputs before submission
     */
    validateInputs(cwlWorkflow, inputs) {
        const errors = [];
        const warnings = [];
        if (!cwlWorkflow.inputs) {
            errors.push('CWL workflow has no inputs defined');
            return { valid: false, errors, warnings };
        }
        // Check required inputs
        for (const [inputName, inputDef] of Object.entries(cwlWorkflow.inputs)) {
            const hasDefault = inputDef.default !== undefined;
            const hasValue = inputs[inputName] !== undefined;
            if (!hasDefault && !hasValue) {
                errors.push(`Required input '${inputName}' is missing`);
            }
            // Type checking (basic)
            if (hasValue) {
                const expectedType = inputDef.type;
                const actualValue = inputs[inputName];
                if (expectedType === 'int' && !Number.isInteger(actualValue)) {
                    errors.push(`Input '${inputName}' should be an integer`);
                }
                else if (expectedType === 'float' && typeof actualValue !== 'number') {
                    errors.push(`Input '${inputName}' should be a number`);
                }
                else if (expectedType === 'string' && typeof actualValue !== 'string') {
                    errors.push(`Input '${inputName}' should be a string`);
                }
            }
        }
        // Check for extra inputs
        for (const inputName of Object.keys(inputs)) {
            if (!cwlWorkflow.inputs[inputName]) {
                warnings.push(`Input '${inputName}' is not defined in the CWL workflow`);
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Get multi-user session statistics for a project
     */
    async getMultiUserSessionStats(projectId, userWallet, projectData) {
        try {
            // Create authenticated command for session stats
            const response = await this.makeRequest(`/al-engine/session-stats/${encodeURIComponent(projectId)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Wallet': userWallet,
                    'X-User-Role': this.getUserRole(userWallet, projectData),
                    'X-Contract-Address': (projectData === null || projectData === void 0 ? void 0 : projectData.address) || projectId
                }
            });
            if (!response.ok) {
                if (response.status === 404) {
                    // No session found, return empty stats
                    return {
                        project_id: projectId,
                        contributors: [],
                        total_samples: 0,
                        consensus_samples: 0,
                        progress_percentage: 0
                    };
                }
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        }
        catch (error) {
            console.warn('Failed to get session stats:', error);
            // Return empty stats on error
            return {
                project_id: projectId,
                contributors: [],
                total_samples: 0,
                consensus_samples: 0,
                progress_percentage: 0
            };
        }
    }
    /**
     * Send invitation to a contributor (placeholder for future implementation)
     */
    async sendContributorInvitation(invitation, userWallet, projectData) {
        // TODO: Implement when server-side invitation system is ready
        const response = await this.makeRequest('/contributors/invite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...invitation,
                user_wallet: userWallet,
                user_role: this.getUserRole(userWallet, projectData),
                contract_address: (projectData === null || projectData === void 0 ? void 0 : projectData.address) || invitation.projectId
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Remove contributor from project (placeholder for future implementation)
     */
    async removeContributor(projectId, contributorWallet, userWallet, projectData) {
        // TODO: Implement when server-side contributor management is ready
        const response = await this.makeRequest('/contributors/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                project_id: projectId,
                contributor_wallet: contributorWallet,
                user_wallet: userWallet,
                user_role: this.getUserRole(userWallet, projectData),
                contract_address: (projectData === null || projectData === void 0 ? void 0 : projectData.address) || projectId
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    // Private methods
    async makeRequest(endpoint, options = {}) {
        const { timeout = this.defaultTimeout, ...fetchOptions } = options;
        const url = `${this.baseUrl}${endpoint}`;
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw error;
        }
    }
}
// Export singleton instance with remote VM configuration
const orchestrationAPI = new OrchestrationAPI();


/***/ }),

/***/ "./lib/RuntimeOrchestrationPanel.js":
/*!******************************************!*\
  !*** ./lib/RuntimeOrchestrationPanel.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RuntimeOrchestrationPanel: () => (/* binding */ RuntimeOrchestrationPanel)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./OrchestrationAPI */ "./lib/OrchestrationAPI.js");



const SessionControls = ({ session, onStartQuerying, onContinueQuerying, onPromptTraining, onSubmitLabels, onTerminateProject, isLoading }) => {
    var _a, _b, _c, _d;
    const [labelingMode, setLabelingMode] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [labels, setLabels] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([]);
    const handleSubmitLabels = () => {
        if (labels.length > 0) {
            onSubmitLabels(labels);
            setLabels([]);
            setLabelingMode(false);
        }
    };
    const addLabel = (sampleId) => {
        const label = prompt(`Enter label for sample ${sampleId}:`);
        if (label) {
            const confidence = parseFloat(prompt('Enter confidence (0-1):') || '1.0');
            setLabels(prev => [...prev, { sample_id: sampleId, label, confidence }]);
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'var(--jp-success-color1)';
            case 'waiting_for_labels': return 'var(--jp-warn-color1)';
            case 'training': return 'var(--jp-info-color1)';
            case 'completed': return 'var(--jp-layout-color3)';
            default: return 'var(--jp-ui-font-color2)';
        }
    };
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "session-controls", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "session-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("h4", { children: ["Session: ", session.session_id.slice(0, 8), "..."] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "session-status", style: { color: getStatusColor(session.status) }, children: session.status.toUpperCase() })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "session-info", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "info-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Round:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { children: [session.current_round, " / ", session.total_rounds] })] }), ((_a = session.accuracy_metrics) === null || _a === void 0 ? void 0 : _a.accuracy) && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "info-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Accuracy:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { children: [(session.accuracy_metrics.accuracy * 100).toFixed(1), "%"] })] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "info-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Queried Samples:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: ((_b = session.queried_samples) === null || _b === void 0 ? void 0 : _b.length) || 0 })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "session-actions", children: [session.status === 'active' && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: onContinueQuerying, disabled: isLoading, className: "action-btn primary", children: "Continue Querying" })), session.status === 'waiting_for_labels' && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, { children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => setLabelingMode(!labelingMode), className: "action-btn secondary", children: labelingMode ? 'Cancel Labeling' : 'Label Samples' }), labelingMode && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "labeling-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("h5", { children: ["Queried Samples (", ((_c = session.queried_samples) === null || _c === void 0 ? void 0 : _c.length) || 0, ")"] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "samples-list", children: (_d = session.queried_samples) === null || _d === void 0 ? void 0 : _d.slice(0, 5).map((sample) => {
                                            var _a;
                                            return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "sample-item", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "sample-id", children: sample.sample_id }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { className: "sample-uncertainty", children: ["Uncertainty: ", (_a = sample.uncertainty) === null || _a === void 0 ? void 0 : _a.toFixed(3)] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => addLabel(sample.sample_id), className: "label-btn", children: "Add Label" })] }, sample.sample_id));
                                        }) }), labels.length > 0 && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "labeled-samples", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("h6", { children: ["Labels Added (", labels.length, ")"] }), labels.map((label, idx) => ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "labeled-item", children: [label.sample_id, ": ", label.label, " (conf: ", label.confidence, ")"] }, idx))), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: handleSubmitLabels, className: "action-btn primary", children: "Submit Labels" })] }))] }))] })), (session.status === 'active' || session.status === 'waiting_for_labels') && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: onPromptTraining, disabled: isLoading, className: "action-btn secondary", children: "Prompt Training" }))] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "danger-zone", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: onTerminateProject, disabled: isLoading, className: "action-btn danger", children: "Terminate Project" }) })] }));
};
const RuntimeOrchestrationPanel = ({ projectId, workflowId, projectTitle, onClose }) => {
    const [sessions, setSessions] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([]);
    const [selectedSession, setSelectedSession] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [commandLog, setCommandLog] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([]);
    // Load sessions on mount
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        loadSessions();
        const interval = setInterval(loadSessions, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, [projectId]);
    const loadSessions = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        try {
            const sessionList = await _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_2__.orchestrationAPI.listQueryingSessions(projectId);
            setSessions(sessionList);
            // Update selected session if it exists
            if (selectedSession) {
                const updated = sessionList.find(s => s.session_id === selectedSession.session_id);
                if (updated) {
                    setSelectedSession(updated);
                }
            }
        }
        catch (err) {
            console.error('Failed to load sessions:', err);
        }
    }, [projectId, selectedSession]);
    const handleCommand = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async (commandType, parameters = {}) => {
        setLoading(true);
        setError(null);
        try {
            let response;
            switch (commandType) {
                case 'start_querying':
                    response = await _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_2__.orchestrationAPI.startQuerying(projectId, workflowId, parameters);
                    break;
                case 'continue_querying':
                    response = await _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_2__.orchestrationAPI.continueQuerying(projectId, workflowId, parameters.session_id);
                    break;
                case 'prompt_training':
                    response = await _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_2__.orchestrationAPI.promptTraining(projectId, workflowId, {
                        session_id: parameters.session_id,
                        training_config: parameters.training_config || {}
                    });
                    break;
                case 'submit_labels':
                    response = await _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_2__.orchestrationAPI.submitLabels(projectId, workflowId, {
                        session_id: parameters.session_id,
                        labeled_samples: parameters.labeled_samples
                    });
                    break;
                case 'terminate_project':
                    response = await _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_2__.orchestrationAPI.terminateProject(projectId, workflowId);
                    break;
                default:
                    throw new Error(`Unknown command type: ${commandType}`);
            }
            setCommandLog(prev => [response, ...prev.slice(0, 9)]); // Keep last 10 commands
            // Refresh sessions after command
            setTimeout(loadSessions, 1000);
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    }, [projectId, workflowId, loadSessions]);
    const startNewSession = () => {
        const queryCount = parseInt(prompt('Enter query count (default 10):') || '10');
        const strategy = prompt('Enter query strategy (default: uncertainty_sampling):') || 'uncertainty_sampling';
        handleCommand('start_querying', {
            query_count: queryCount,
            strategy_override: strategy,
            max_rounds: 10
        });
    };
    const continueQuerying = () => {
        if (selectedSession) {
            handleCommand('continue_querying', { session_id: selectedSession.session_id });
        }
    };
    const promptTraining = () => {
        if (selectedSession) {
            handleCommand('prompt_training', {
                session_id: selectedSession.session_id,
                training_config: {}
            });
        }
    };
    const submitLabels = (labels) => {
        if (selectedSession) {
            handleCommand('submit_labels', {
                session_id: selectedSession.session_id,
                labeled_samples: labels
            });
        }
    };
    const terminateProject = () => {
        if (confirm('Are you sure you want to terminate this project? This action cannot be undone.')) {
            handleCommand('terminate_project');
        }
    };
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "runtime-orchestration-panel", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "panel-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("h2", { children: ["Runtime Orchestration - ", projectTitle] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "header-info", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { children: ["Project: ", projectId] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { children: ["Workflow: ", workflowId.slice(0, 8), "..."] })] }), onClose && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: onClose, className: "close-button", children: "Close" }))] }), error && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "error-message", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: error }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => setError(null), children: "\u2715" })] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "panel-content", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "left-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "sessions-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "section-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Active Learning Sessions" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: startNewSession, disabled: loading, className: "action-btn primary", children: "Start New Session" })] }), sessions.length === 0 ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "empty-state", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "No active sessions. Start a new querying session to begin." }) })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "sessions-list", children: sessions.map(session => {
                                            var _a;
                                            return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: `session-item ${(selectedSession === null || selectedSession === void 0 ? void 0 : selectedSession.session_id) === session.session_id ? 'selected' : ''}`, onClick: () => setSelectedSession(session), children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "session-summary", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "session-title", children: ["Session ", session.session_id.slice(0, 8), "..."] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "session-meta", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: `status ${session.status}`, children: session.status }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { children: ["Round ", session.current_round, "/", session.total_rounds] })] }), ((_a = session.accuracy_metrics) === null || _a === void 0 ? void 0 : _a.accuracy) && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "accuracy", children: ["Accuracy: ", (session.accuracy_metrics.accuracy * 100).toFixed(1), "%"] }))] }) }, session.session_id));
                                        }) }))] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "command-log-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Command Log" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "command-log", children: commandLog.length === 0 ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "No commands executed yet." })) : (commandLog.map((cmd, idx) => {
                                            var _a;
                                            return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: `log-entry ${cmd.status}`, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "log-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { className: "command-id", children: [(_a = cmd.command_id) === null || _a === void 0 ? void 0 : _a.slice(0, 8), "..."] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "timestamp", children: new Date(cmd.timestamp).toLocaleTimeString() }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: `status ${cmd.status}`, children: cmd.status })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "log-message", children: cmd.message })] }, idx));
                                        })) })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "right-section", children: selectedSession ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(SessionControls, { session: selectedSession, onStartQuerying: startNewSession, onContinueQuerying: continueQuerying, onPromptTraining: promptTraining, onSubmitLabels: submitLabels, onTerminateProject: terminateProject, isLoading: loading })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "no-session-selected", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Select a Session" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Choose an active learning session from the left panel to view controls and details." })] })) })] })] }));
};


/***/ }),

/***/ "./lib/abis/FactoryRegistry.json":
/*!***************************************!*\
  !*** ./lib/abis/FactoryRegistry.json ***!
  \***************************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"_format":"hh-sol-artifact-1","contractName":"FactoryRegistry","sourceName":"contracts/FactoryRegistry.sol","abi":[{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"get","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"address","name":"factory","type":"address"}],"name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"}],"bytecode":"0x6080604052348015600f57600080fd5b5061022e8061001f6000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80631e59c5291461003b578063693ec85e14610050575b600080fd5b61004e610049366004610143565b61007f565b005b61006361005e3660046101a6565b6100c6565b6040516001600160a01b03909116815260200160405180910390f35b80600084846040516100929291906101e8565b90815260405190819003602001902080546001600160a01b03929092166001600160a01b0319909216919091179055505050565b60008083836040516100d99291906101e8565b908152604051908190036020019020546001600160a01b0316905092915050565b60008083601f84011261010c57600080fd5b50813567ffffffffffffffff81111561012457600080fd5b60208301915083602082850101111561013c57600080fd5b9250929050565b60008060006040848603121561015857600080fd5b833567ffffffffffffffff81111561016f57600080fd5b61017b868287016100fa565b90945092505060208401356001600160a01b038116811461019b57600080fd5b809150509250925092565b600080602083850312156101b957600080fd5b823567ffffffffffffffff8111156101d057600080fd5b6101dc858286016100fa565b90969095509350505050565b818382376000910190815291905056fea26469706673582212204b0030ff3eea382483ed0e6d3b96930f44cb3660ec7ed812b96068104a24269364736f6c634300081c0033","deployedBytecode":"0x608060405234801561001057600080fd5b50600436106100365760003560e01c80631e59c5291461003b578063693ec85e14610050575b600080fd5b61004e610049366004610143565b61007f565b005b61006361005e3660046101a6565b6100c6565b6040516001600160a01b03909116815260200160405180910390f35b80600084846040516100929291906101e8565b90815260405190819003602001902080546001600160a01b03929092166001600160a01b0319909216919091179055505050565b60008083836040516100d99291906101e8565b908152604051908190036020019020546001600160a01b0316905092915050565b60008083601f84011261010c57600080fd5b50813567ffffffffffffffff81111561012457600080fd5b60208301915083602082850101111561013c57600080fd5b9250929050565b60008060006040848603121561015857600080fd5b833567ffffffffffffffff81111561016f57600080fd5b61017b868287016100fa565b90945092505060208401356001600160a01b038116811461019b57600080fd5b809150509250925092565b600080602083850312156101b957600080fd5b823567ffffffffffffffff8111156101d057600080fd5b6101dc858286016100fa565b90969095509350505050565b818382376000910190815291905056fea26469706673582212204b0030ff3eea382483ed0e6d3b96930f44cb3660ec7ed812b96068104a24269364736f6c634300081c0033","linkReferences":{},"deployedLinkReferences":{}}');

/***/ }),

/***/ "./lib/abis/JSONProject.json":
/*!***********************************!*\
  !*** ./lib/abis/JSONProject.json ***!
  \***********************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"_format":"hh-sol-artifact-1","contractName":"JSONProject","sourceName":"contracts/JSONProject.sol","abi":[{"inputs":[{"internalType":"address","name":"_creator","type":"address"},{"internalType":"string","name":"_projectData","type":"string"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"requester","type":"address"},{"indexed":true,"internalType":"address","name":"approver","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"JoinRequestApproved","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"requester","type":"address"},{"indexed":true,"internalType":"address","name":"rejector","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"JoinRequestRejected","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"requester","type":"address"},{"indexed":false,"internalType":"string","name":"role","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"JoinRequestSubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"ProjectCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"ProjectDeactivated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"ProjectReactivated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"updater","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"ProjectUpdated","type":"event"},{"inputs":[{"internalType":"address","name":"_requester","type":"address"}],"name":"approveJoinRequest","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"createdAt","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"creator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"deactivateProject","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getAllRequesters","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCreator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getIsActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_requester","type":"address"}],"name":"getJoinRequest","outputs":[{"internalType":"address","name":"requester","type":"address"},{"internalType":"string","name":"role","type":"string"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"bool","name":"exists","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getProjectData","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getProjectStatus","outputs":[{"internalType":"bool","name":"active","type":"bool"},{"internalType":"uint256","name":"created","type":"uint256"},{"internalType":"uint256","name":"modified","type":"uint256"},{"internalType":"address","name":"projectCreator","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTimestamps","outputs":[{"internalType":"uint256","name":"created","type":"uint256"},{"internalType":"uint256","name":"modified","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"joinRequests","outputs":[{"internalType":"address","name":"requester","type":"address"},{"internalType":"string","name":"role","type":"string"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"bool","name":"exists","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastModified","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"projectData","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"reactivateProject","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_requester","type":"address"}],"name":"rejectJoinRequest","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"requesters","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_role","type":"string"}],"name":"submitJoinRequest","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_newProjectData","type":"string"}],"name":"updateProjectData","outputs":[],"stateMutability":"nonpayable","type":"function"}],"bytecode":"0x608060405234801561001057600080fd5b5060405161169c38038061169c83398101604081905261002f91610125565b60008151116100845760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d70747900000000604482015260640160405180910390fd5b600080546001600160a01b0319166001600160a01b03841617905560016100ab828261029a565b5042600281905560038190556004805460ff191660011790556040516001600160a01b038416917f20bfd29f3d906f96fc35742fac45a554b19cbd4e21f8c4c1d84cb58fdfc32c899161010091815260200190565b60405180910390a25050610358565b634e487b7160e01b600052604160045260246000fd5b6000806040838503121561013857600080fd5b82516001600160a01b038116811461014f57600080fd5b60208401519092506001600160401b0381111561016b57600080fd5b8301601f8101851361017c57600080fd5b80516001600160401b038111156101955761019561010f565b604051601f8201601f19908116603f011681016001600160401b03811182821017156101c3576101c361010f565b6040528181528282016020018710156101db57600080fd5b60005b828110156101fa576020818501810151838301820152016101de565b506000602083830101528093505050509250929050565b600181811c9082168061022557607f821691505b60208210810361024557634e487b7160e01b600052602260045260246000fd5b50919050565b601f82111561029557806000526020600020601f840160051c810160208510156102725750805b601f840160051c820191505b81811015610292576000815560010161027e565b50505b505050565b81516001600160401b038111156102b3576102b361010f565b6102c7816102c18454610211565b8461024b565b6020601f8211600181146102fb57600083156102e35750848201515b600019600385901b1c1916600184901b178455610292565b600084815260208120601f198516915b8281101561032b578785015182556020948501946001909201910161030b565b50848210156103495786840151600019600387901b60f8161c191681555b50505050600190811b01905550565b611335806103676000396000f3fe608060405234801561001057600080fd5b506004361061012c5760003560e01c80639c0768b3116100ad578063dfb748aa11610071578063dfb748aa14610274578063e7aa3afc14610287578063ef213106146102c2578063f7267cfd146102d5578063fba7cc79146102de57600080fd5b80639c0768b314610232578063b56864791461023a578063bbffd04c1461024d578063c3feda1714610255578063cf09e0d01461025d57600080fd5b806355b31b55116100f457806355b31b55146101c757806359abbfe4146101dc5780635e1a6c17146101f75780637847f1de1461020a57806384e077281461021d57600080fd5b806302d05d3f146101315780630ee2cb101461016157806310218f4d1461017257806322f3e2d414610187578063383e1a5e146101a4575b600080fd5b600054610144906001600160a01b031681565b6040516001600160a01b0390911681526020015b60405180910390f35b6000546001600160a01b0316610144565b610185610180366004610f29565b6102e9565b005b6004546101949060ff1681565b6040519015158152602001610158565b6101b76101b2366004610fe2565b610403565b6040516101589493929190611058565b6101cf610510565b6040516101589190611094565b60025460035460408051928352602083019190915201610158565b6101446102053660046110a7565b6105a2565b610185610218366004610f29565b6105cc565b61022561082c565b60405161015891906110c0565b6101cf6109b0565b610185610248366004610fe2565b610a3e565b610185610b5e565b610185610c22565b61026660025481565b604051908152602001610158565b610185610282366004610fe2565b610ce5565b6004546002546003546000546040805160ff909516151585526020850193909352918301526001600160a01b03166060820152608001610158565b6101b76102d0366004610fe2565b610dfe565b61026660035481565b60045460ff16610194565b6000546001600160a01b0316331461031c5760405162461bcd60e51b81526004016103139061110c565b60405180910390fd5b60045460ff166103665760405162461bcd60e51b815260206004820152601560248201527450726f6a656374206973206e6f742061637469766560581b6044820152606401610313565b60008151116103b75760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d707479000000006044820152606401610313565b60016103c382826111e1565b5042600381905560405190815233907fc1756fd99ac9a2b1b22b5e701ddb022b897a002144d045b77ac35ce46610fef6906020015b60405180910390a250565b6001600160a01b0380821660009081526005602090815260408083208151608081019092528054909416815260018401805493946060948694859485949093929184019161045090611158565b80601f016020809104026020016040519081016040528092919081815260200182805461047c90611158565b80156104c95780601f1061049e576101008083540402835291602001916104c9565b820191906000526020600020905b8154815290600101906020018083116104ac57829003601f168201915b5050509183525050600282015460208083019190915260039092015460ff161515604091820152825191830151908301516060909301519199909850919650945092505050565b60606001805461051f90611158565b80601f016020809104026020016040519081016040528092919081815260200182805461054b90611158565b80156105985780601f1061056d57610100808354040283529160200191610598565b820191906000526020600020905b81548152906001019060200180831161057b57829003601f168201915b5050505050905090565b600681815481106105b257600080fd5b6000918252602090912001546001600160a01b0316905081565b60045460ff166106165760405162461bcd60e51b815260206004820152601560248201527450726f6a656374206973206e6f742061637469766560581b6044820152606401610313565b6000546001600160a01b031633036106835760405162461bcd60e51b815260206004820152602a60248201527f50726f6a6563742063726561746f722063616e6e6f74207375626d6974206a6f6044820152691a5b881c995c5d595cdd60b21b6064820152608401610313565b3360009081526005602052604090206003015460ff16156106e65760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420616c72656164792065786973747300000000006044820152606401610313565b600081511161072e5760405162461bcd60e51b8152602060048201526014602482015273526f6c652063616e6e6f7420626520656d70747960601b6044820152606401610313565b6040805160808101825233808252602080830185815242848601526001606085018190526000938452600590925293909120825181546001600160a01b0319166001600160a01b0390911617815592519192919082019061078f90826111e1565b5060408281015160028301556060909201516003909101805460ff1916911515919091179055600680546001810182556000919091527ff652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f018054336001600160a01b0319909116811790915590517fe4d6c018abd0178d4bce0856089ef1876318617b97a1d700bb98506598ab0afc906103f890849042906112a0565b60606000805b600654811015610899576005600060068381548110610853576108536112c2565b60009182526020808320909101546001600160a01b0316835282019290925260400190206003015460ff1615610891578161088d816112d8565b9250505b600101610832565b5060008167ffffffffffffffff8111156108b5576108b5610f13565b6040519080825280602002602001820160405280156108de578160200160208202803683370190505b5090506000805b6006548110156109a7576005600060068381548110610906576109066112c2565b60009182526020808320909101546001600160a01b0316835282019290925260400190206003015460ff161561099f5760068181548110610949576109496112c2565b9060005260206000200160009054906101000a90046001600160a01b0316838381518110610979576109796112c2565b6001600160a01b03909216602092830291909101909101528161099b816112d8565b9250505b6001016108e5565b50909392505050565b600180546109bd90611158565b80601f01602080910402602001604051908101604052809291908181526020018280546109e990611158565b8015610a365780601f10610a0b57610100808354040283529160200191610a36565b820191906000526020600020905b815481529060010190602001808311610a1957829003601f168201915b505050505081565b6000546001600160a01b03163314610a685760405162461bcd60e51b81526004016103139061110c565b6001600160a01b03811660009081526005602052604090206003015460ff16610ad35760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420646f6573206e6f7420657869737400000000006044820152606401610313565b6001600160a01b038116600090815260056020526040812080546001600160a01b031916815590610b076001830182610ebd565b5060006002820155600301805460ff1916905560405142815233906001600160a01b038316907f1a69e67d1be897d0ca0cf1517b4d17e345b4272a80bc900f9fe8e96f261ca1db906020015b60405180910390a350565b6000546001600160a01b03163314610b885760405162461bcd60e51b81526004016103139061110c565b60045460ff16610bda5760405162461bcd60e51b815260206004820152601b60248201527f50726f6a65637420697320616c726561647920696e61637469766500000000006044820152606401610313565b6004805460ff1916905542600381905560405190815233907f17064d72ee4a5901e55dfa45024ea8f67cdb4895ba6364ab2f8e7223f642ad36906020015b60405180910390a2565b6000546001600160a01b03163314610c4c5760405162461bcd60e51b81526004016103139061110c565b60045460ff1615610c9f5760405162461bcd60e51b815260206004820152601960248201527f50726f6a65637420697320616c726561647920616374697665000000000000006044820152606401610313565b6004805460ff1916600117905542600381905560405133917fb351ba71ddc1d2bf39667cebde99fb92eb26b9f418d5049ba0200888ba81071591610c1891815260200190565b6000546001600160a01b03163314610d0f5760405162461bcd60e51b81526004016103139061110c565b6001600160a01b03811660009081526005602052604090206003015460ff16610d7a5760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420646f6573206e6f7420657869737400000000006044820152606401610313565b6001600160a01b038116600090815260056020526040812080546001600160a01b031916815590610dae6001830182610ebd565b5060006002820155600301805460ff1916905560405142815233906001600160a01b038316907f423eb00b6a18c3ecfc2170a0e40ef0bad995279070614ba2e4be1b94f67eb88890602001610b53565b600560205260009081526040902080546001820180546001600160a01b039092169291610e2a90611158565b80601f0160208091040260200160405190810160405280929190818152602001828054610e5690611158565b8015610ea35780601f10610e7857610100808354040283529160200191610ea3565b820191906000526020600020905b815481529060010190602001808311610e8657829003601f168201915b50505050600283015460039093015491929160ff16905084565b508054610ec990611158565b6000825580601f10610ed9575050565b601f016020900490600052602060002090810190610ef79190610efa565b50565b5b80821115610f0f5760008155600101610efb565b5090565b634e487b7160e01b600052604160045260246000fd5b600060208284031215610f3b57600080fd5b813567ffffffffffffffff811115610f5257600080fd5b8201601f81018413610f6357600080fd5b803567ffffffffffffffff811115610f7d57610f7d610f13565b604051601f8201601f19908116603f0116810167ffffffffffffffff81118282101715610fac57610fac610f13565b604052818152828201602001861015610fc457600080fd5b81602084016020830137600091810160200191909152949350505050565b600060208284031215610ff457600080fd5b81356001600160a01b038116811461100b57600080fd5b9392505050565b6000815180845260005b818110156110385760208185018101518683018201520161101c565b506000602082860101526020601f19601f83011685010191505092915050565b6001600160a01b038516815260806020820181905260009061107c90830186611012565b60408301949094525090151560609091015292915050565b60208152600061100b6020830184611012565b6000602082840312156110b957600080fd5b5035919050565b602080825282518282018190526000918401906040840190835b818110156111015783516001600160a01b03168352602093840193909201916001016110da565b509095945050505050565b6020808252602c908201527f4f6e6c792070726f6a6563742063726561746f722063616e20706572666f726d60408201526b103a3434b99030b1ba34b7b760a11b606082015260800190565b600181811c9082168061116c57607f821691505b60208210810361118c57634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156111dc57806000526020600020601f840160051c810160208510156111b95750805b601f840160051c820191505b818110156111d957600081556001016111c5565b50505b505050565b815167ffffffffffffffff8111156111fb576111fb610f13565b61120f816112098454611158565b84611192565b6020601f821160018114611243576000831561122b5750848201515b600019600385901b1c1916600184901b1784556111d9565b600084815260208120601f198516915b828110156112735787850151825560209485019460019092019101611253565b50848210156112915786840151600019600387901b60f8161c191681555b50505050600190811b01905550565b6040815260006112b36040830185611012565b90508260208301529392505050565b634e487b7160e01b600052603260045260246000fd5b6000600182016112f857634e487b7160e01b600052601160045260246000fd5b506001019056fea2646970667358221220bec9471bb23b6e25da9c64e7d34995b3e371c8436ddc9fd588e51486983342ff64736f6c634300081c0033","deployedBytecode":"0x608060405234801561001057600080fd5b506004361061012c5760003560e01c80639c0768b3116100ad578063dfb748aa11610071578063dfb748aa14610274578063e7aa3afc14610287578063ef213106146102c2578063f7267cfd146102d5578063fba7cc79146102de57600080fd5b80639c0768b314610232578063b56864791461023a578063bbffd04c1461024d578063c3feda1714610255578063cf09e0d01461025d57600080fd5b806355b31b55116100f457806355b31b55146101c757806359abbfe4146101dc5780635e1a6c17146101f75780637847f1de1461020a57806384e077281461021d57600080fd5b806302d05d3f146101315780630ee2cb101461016157806310218f4d1461017257806322f3e2d414610187578063383e1a5e146101a4575b600080fd5b600054610144906001600160a01b031681565b6040516001600160a01b0390911681526020015b60405180910390f35b6000546001600160a01b0316610144565b610185610180366004610f29565b6102e9565b005b6004546101949060ff1681565b6040519015158152602001610158565b6101b76101b2366004610fe2565b610403565b6040516101589493929190611058565b6101cf610510565b6040516101589190611094565b60025460035460408051928352602083019190915201610158565b6101446102053660046110a7565b6105a2565b610185610218366004610f29565b6105cc565b61022561082c565b60405161015891906110c0565b6101cf6109b0565b610185610248366004610fe2565b610a3e565b610185610b5e565b610185610c22565b61026660025481565b604051908152602001610158565b610185610282366004610fe2565b610ce5565b6004546002546003546000546040805160ff909516151585526020850193909352918301526001600160a01b03166060820152608001610158565b6101b76102d0366004610fe2565b610dfe565b61026660035481565b60045460ff16610194565b6000546001600160a01b0316331461031c5760405162461bcd60e51b81526004016103139061110c565b60405180910390fd5b60045460ff166103665760405162461bcd60e51b815260206004820152601560248201527450726f6a656374206973206e6f742061637469766560581b6044820152606401610313565b60008151116103b75760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d707479000000006044820152606401610313565b60016103c382826111e1565b5042600381905560405190815233907fc1756fd99ac9a2b1b22b5e701ddb022b897a002144d045b77ac35ce46610fef6906020015b60405180910390a250565b6001600160a01b0380821660009081526005602090815260408083208151608081019092528054909416815260018401805493946060948694859485949093929184019161045090611158565b80601f016020809104026020016040519081016040528092919081815260200182805461047c90611158565b80156104c95780601f1061049e576101008083540402835291602001916104c9565b820191906000526020600020905b8154815290600101906020018083116104ac57829003601f168201915b5050509183525050600282015460208083019190915260039092015460ff161515604091820152825191830151908301516060909301519199909850919650945092505050565b60606001805461051f90611158565b80601f016020809104026020016040519081016040528092919081815260200182805461054b90611158565b80156105985780601f1061056d57610100808354040283529160200191610598565b820191906000526020600020905b81548152906001019060200180831161057b57829003601f168201915b5050505050905090565b600681815481106105b257600080fd5b6000918252602090912001546001600160a01b0316905081565b60045460ff166106165760405162461bcd60e51b815260206004820152601560248201527450726f6a656374206973206e6f742061637469766560581b6044820152606401610313565b6000546001600160a01b031633036106835760405162461bcd60e51b815260206004820152602a60248201527f50726f6a6563742063726561746f722063616e6e6f74207375626d6974206a6f6044820152691a5b881c995c5d595cdd60b21b6064820152608401610313565b3360009081526005602052604090206003015460ff16156106e65760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420616c72656164792065786973747300000000006044820152606401610313565b600081511161072e5760405162461bcd60e51b8152602060048201526014602482015273526f6c652063616e6e6f7420626520656d70747960601b6044820152606401610313565b6040805160808101825233808252602080830185815242848601526001606085018190526000938452600590925293909120825181546001600160a01b0319166001600160a01b0390911617815592519192919082019061078f90826111e1565b5060408281015160028301556060909201516003909101805460ff1916911515919091179055600680546001810182556000919091527ff652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f018054336001600160a01b0319909116811790915590517fe4d6c018abd0178d4bce0856089ef1876318617b97a1d700bb98506598ab0afc906103f890849042906112a0565b60606000805b600654811015610899576005600060068381548110610853576108536112c2565b60009182526020808320909101546001600160a01b0316835282019290925260400190206003015460ff1615610891578161088d816112d8565b9250505b600101610832565b5060008167ffffffffffffffff8111156108b5576108b5610f13565b6040519080825280602002602001820160405280156108de578160200160208202803683370190505b5090506000805b6006548110156109a7576005600060068381548110610906576109066112c2565b60009182526020808320909101546001600160a01b0316835282019290925260400190206003015460ff161561099f5760068181548110610949576109496112c2565b9060005260206000200160009054906101000a90046001600160a01b0316838381518110610979576109796112c2565b6001600160a01b03909216602092830291909101909101528161099b816112d8565b9250505b6001016108e5565b50909392505050565b600180546109bd90611158565b80601f01602080910402602001604051908101604052809291908181526020018280546109e990611158565b8015610a365780601f10610a0b57610100808354040283529160200191610a36565b820191906000526020600020905b815481529060010190602001808311610a1957829003601f168201915b505050505081565b6000546001600160a01b03163314610a685760405162461bcd60e51b81526004016103139061110c565b6001600160a01b03811660009081526005602052604090206003015460ff16610ad35760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420646f6573206e6f7420657869737400000000006044820152606401610313565b6001600160a01b038116600090815260056020526040812080546001600160a01b031916815590610b076001830182610ebd565b5060006002820155600301805460ff1916905560405142815233906001600160a01b038316907f1a69e67d1be897d0ca0cf1517b4d17e345b4272a80bc900f9fe8e96f261ca1db906020015b60405180910390a350565b6000546001600160a01b03163314610b885760405162461bcd60e51b81526004016103139061110c565b60045460ff16610bda5760405162461bcd60e51b815260206004820152601b60248201527f50726f6a65637420697320616c726561647920696e61637469766500000000006044820152606401610313565b6004805460ff1916905542600381905560405190815233907f17064d72ee4a5901e55dfa45024ea8f67cdb4895ba6364ab2f8e7223f642ad36906020015b60405180910390a2565b6000546001600160a01b03163314610c4c5760405162461bcd60e51b81526004016103139061110c565b60045460ff1615610c9f5760405162461bcd60e51b815260206004820152601960248201527f50726f6a65637420697320616c726561647920616374697665000000000000006044820152606401610313565b6004805460ff1916600117905542600381905560405133917fb351ba71ddc1d2bf39667cebde99fb92eb26b9f418d5049ba0200888ba81071591610c1891815260200190565b6000546001600160a01b03163314610d0f5760405162461bcd60e51b81526004016103139061110c565b6001600160a01b03811660009081526005602052604090206003015460ff16610d7a5760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420646f6573206e6f7420657869737400000000006044820152606401610313565b6001600160a01b038116600090815260056020526040812080546001600160a01b031916815590610dae6001830182610ebd565b5060006002820155600301805460ff1916905560405142815233906001600160a01b038316907f423eb00b6a18c3ecfc2170a0e40ef0bad995279070614ba2e4be1b94f67eb88890602001610b53565b600560205260009081526040902080546001820180546001600160a01b039092169291610e2a90611158565b80601f0160208091040260200160405190810160405280929190818152602001828054610e5690611158565b8015610ea35780601f10610e7857610100808354040283529160200191610ea3565b820191906000526020600020905b815481529060010190602001808311610e8657829003601f168201915b50505050600283015460039093015491929160ff16905084565b508054610ec990611158565b6000825580601f10610ed9575050565b601f016020900490600052602060002090810190610ef79190610efa565b50565b5b80821115610f0f5760008155600101610efb565b5090565b634e487b7160e01b600052604160045260246000fd5b600060208284031215610f3b57600080fd5b813567ffffffffffffffff811115610f5257600080fd5b8201601f81018413610f6357600080fd5b803567ffffffffffffffff811115610f7d57610f7d610f13565b604051601f8201601f19908116603f0116810167ffffffffffffffff81118282101715610fac57610fac610f13565b604052818152828201602001861015610fc457600080fd5b81602084016020830137600091810160200191909152949350505050565b600060208284031215610ff457600080fd5b81356001600160a01b038116811461100b57600080fd5b9392505050565b6000815180845260005b818110156110385760208185018101518683018201520161101c565b506000602082860101526020601f19601f83011685010191505092915050565b6001600160a01b038516815260806020820181905260009061107c90830186611012565b60408301949094525090151560609091015292915050565b60208152600061100b6020830184611012565b6000602082840312156110b957600080fd5b5035919050565b602080825282518282018190526000918401906040840190835b818110156111015783516001600160a01b03168352602093840193909201916001016110da565b509095945050505050565b6020808252602c908201527f4f6e6c792070726f6a6563742063726561746f722063616e20706572666f726d60408201526b103a3434b99030b1ba34b7b760a11b606082015260800190565b600181811c9082168061116c57607f821691505b60208210810361118c57634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156111dc57806000526020600020601f840160051c810160208510156111b95750805b601f840160051c820191505b818110156111d957600081556001016111c5565b50505b505050565b815167ffffffffffffffff8111156111fb576111fb610f13565b61120f816112098454611158565b84611192565b6020601f821160018114611243576000831561122b5750848201515b600019600385901b1c1916600184901b1784556111d9565b600084815260208120601f198516915b828110156112735787850151825560209485019460019092019101611253565b50848210156112915786840151600019600387901b60f8161c191681555b50505050600190811b01905550565b6040815260006112b36040830185611012565b90508260208301529392505050565b634e487b7160e01b600052603260045260246000fd5b6000600182016112f857634e487b7160e01b600052601160045260246000fd5b506001019056fea2646970667358221220bec9471bb23b6e25da9c64e7d34995b3e371c8436ddc9fd588e51486983342ff64736f6c634300081c0033","linkReferences":{},"deployedLinkReferences":{}}');

/***/ }),

/***/ "./lib/abis/ProjectFactory.json":
/*!**************************************!*\
  !*** ./lib/abis/ProjectFactory.json ***!
  \**************************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"_format":"hh-sol-artifact-1","contractName":"ProjectFactory","sourceName":"contracts/ProjectFactory.sol","abi":[{"inputs":[{"internalType":"address","name":"_templateRegistry","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":true,"internalType":"address","name":"projectAddress","type":"address"},{"indexed":false,"internalType":"string","name":"projectType","type":"string"},{"indexed":false,"internalType":"uint256","name":"templateId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"ProjectCreated","type":"event"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"allProjects","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_projectData","type":"string"}],"name":"createCustomProject","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_templateId","type":"uint256"},{"internalType":"string","name":"_projectId","type":"string"},{"internalType":"string","name":"_objective","type":"string"},{"internalType":"address[]","name":"_participantAddresses","type":"address[]"},{"internalType":"string[]","name":"_participantRoles","type":"string[]"}],"name":"createProjectFromBasicInfo","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_templateId","type":"uint256"},{"internalType":"string","name":"_projectData","type":"string"}],"name":"createProjectFromTemplate","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getAllProjects","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_projectAddress","type":"address"}],"name":"getProjectData","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_projectAddress","type":"address"}],"name":"getProjectStatus","outputs":[{"internalType":"bool","name":"active","type":"bool"},{"internalType":"uint256","name":"created","type":"uint256"},{"internalType":"uint256","name":"modified","type":"uint256"},{"internalType":"address","name":"creator","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTemplateRegistry","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTotalProjects","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"getUserProjects","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isProject","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_projectAddress","type":"address"}],"name":"isValidProject","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"templateRegistry","outputs":[{"internalType":"contract ProjectTemplateRegistry","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_newTemplateRegistry","type":"address"}],"name":"updateTemplateRegistry","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"userProjects","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}],"bytecode":"0x608060405234801561001057600080fd5b50604051612fa5380380612fa583398101604081905261002f916100bf565b6001600160a01b03811661009a5760405162461bcd60e51b815260206004820152602860248201527f54656d706c61746520726567697374727920616464726573732063616e6e6f74604482015267206265207a65726f60c01b606482015260840160405180910390fd5b600080546001600160a01b0319166001600160a01b03929092169190911790556100ef565b6000602082840312156100d157600080fd5b81516001600160a01b03811681146100e857600080fd5b9392505050565b612ea7806100fe6000396000f3fe608060405234801561001057600080fd5b50600436106100f55760003560e01c806361eb383611610097578063a0af81f011610066578063a0af81f014610255578063da49f66114610268578063e32e723c1461027b578063eabec3a31461028e57600080fd5b806361eb3836146101d15780636a88a8e91461020f57806380d038291461022f578063812739a21461024457600080fd5b80632fa9c007116100d35780632fa9c0071461016c5780634780f7861461017f57806353b3194c146101925780635d0c3011146101a557600080fd5b806305c81408146100fa5780630882dfa0146101325780631cf5ec1914610147575b600080fd5b61011d610108366004610e99565b60026020526000908152604090205460ff1681565b60405190151581526020015b60405180910390f35b610145610140366004610e99565b6102a1565b005b6000546001600160a01b03165b6040516001600160a01b039091168152602001610129565b61015461017a366004610ebd565b61032f565b61015461018d366004610fac565b610367565b6101546101a0366004610ff2565b61058d565b61011d6101b3366004610e99565b6001600160a01b031660009081526002602052604090205460ff1690565b6101e46101df366004610e99565b6105b7565b6040805194151585526020850193909352918301526001600160a01b03166060820152608001610129565b61022261021d366004610e99565b610690565b604051610129919061105b565b61023761075b565b604051610129919061106e565b600354604051908152602001610129565b600054610154906001600160a01b031681565b610154610276366004611169565b6107bd565b610237610289366004610e99565b61098c565b61015461029c366004611291565b610a02565b6001600160a01b03811661030d5760405162461bcd60e51b815260206004820152602860248201527f54656d706c61746520726567697374727920616464726573732063616e6e6f74604482015267206265207a65726f60c01b60648201526084015b60405180910390fd5b600080546001600160a01b0319166001600160a01b0392909216919091179055565b6001602052816000526040600020818154811061034b57600080fd5b6000918252602090912001546001600160a01b03169150829050565b60008054604051630c550f3d60e21b815260048101859052829182916001600160a01b03909116906331543cf490602401600060405180830381865afa1580156103b5573d6000803e3d6000fd5b505050506040513d6000823e601f3d908101601f191682016040526103dd91908101906113a9565b95505050935050508061042b5760405162461bcd60e51b815260206004820152601660248201527554656d706c617465206973206e6f742061637469766560501b6044820152606401610304565b600084511161047c5760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d707479000000006044820152606401610304565b6000338560405161048c90610e74565b61049792919061149f565b604051809103906000f0801580156104b3573d6000803e3d6000fd5b50336000818152600160208181526040808420805480850182559085528285200180546001600160a01b0388166001600160a01b031991821681179092558186526002909352818520805460ff1916851790556003805494850181559094527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b9092018054909116831790555192935083929091907ff474a44bbf67e28a60e1e8977a0d7bdf30896d6b88b7c83710a32ad527611994906105799088908c9042906114c3565b60405180910390a393505050505b92915050565b6003818154811061059d57600080fd5b6000918252602090912001546001600160a01b0316905081565b6001600160a01b03811660009081526002602052604081205481908190819060ff1661061f5760405162461bcd60e51b8152602060048201526017602482015276496e76616c69642070726f6a656374206164647265737360481b6044820152606401610304565b846001600160a01b031663e7aa3afc6040518163ffffffff1660e01b8152600401608060405180830381865afa15801561065d573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061068191906114e8565b93509350935093509193509193565b6001600160a01b03811660009081526002602052604090205460609060ff166106f55760405162461bcd60e51b8152602060048201526017602482015276496e76616c69642070726f6a656374206164647265737360481b6044820152606401610304565b816001600160a01b03166355b31b556040518163ffffffff1660e01b8152600401600060405180830381865afa158015610733573d6000803e3d6000fd5b505050506040513d6000823e601f3d908101601f191682016040526105879190810190611532565b606060038054806020026020016040519081016040528092919081815260200182805480156107b357602002820191906000526020600020905b81546001600160a01b03168152600190910190602001808311610795575b5050505050905090565b6000815183511461081f5760405162461bcd60e51b815260206004820152602660248201527f5061727469636970616e747320616e6420726f6c6573206c656e677468206d696044820152650e6dac2e8c6d60d31b6064820152608401610304565b60008054604051630c550f3d60e21b81526004810189905282916001600160a01b0316906331543cf490602401600060405180830381865afa158015610869573d6000803e3d6000fd5b505050506040513d6000823e601f3d908101601f1916820160405261089191908101906113a9565b9550505093505050806108df5760405162461bcd60e51b815260206004820152601660248201527554656d706c617465206973206e6f742061637469766560501b6044820152606401610304565b60006108eb8686610b89565b90506000888489846040516020016109069493929190611582565b60408051601f19818403018152908290526323c07bc360e11b825291503090634780f7869061093b908d908590600401611679565b6020604051808303816000875af115801561095a573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061097e9190611692565b9a9950505050505050505050565b6001600160a01b0381166000908152600160209081526040918290208054835181840281018401909452808452606093928301828280156109f657602002820191906000526020600020905b81546001600160a01b031681526001909101906020018083116109d8575b50505050509050919050565b600080825111610a545760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d707479000000006044820152606401610304565b60003383604051610a6490610e74565b610a6f92919061149f565b604051809103906000f080158015610a8b573d6000803e3d6000fd5b50336000818152600160208181526040808420805480850182559085528285200180546001600160a01b0388166001600160a01b031991821681179092558186526002909352818520805460ff1916851790556003805494850181559094527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b9092018054909116831790555192935083929091907ff474a44bbf67e28a60e1e8977a0d7bdf30896d6b88b7c83710a32ad52761199490610b7a90620f423f904290606080825260069082015265637573746f6d60d01b60808201526020810192909252604082015260a00190565b60405180910390a39392505050565b60608251600003610bb357506040805180820190915260028152615b5d60f01b6020820152610587565b6040805180820190915260018152605b60f81b602082015260005b8451811015610c69578015610c005781604051602001610bee91906116af565b60405160208183030381529060405291505b81610c23868381518110610c1657610c166116d4565b6020026020010151610c93565b858381518110610c3557610c356116d4565b6020026020010151604051602001610c4f939291906116ea565b60408051601f198184030181529190529150600101610bce565b5080604051602001610c7b9190611770565b60405160208183030381529060405291505092915050565b604080518082018252601081526f181899199a1a9b1b9c1cb0b131b232b360811b60208201528151602a80825260608281019094526001600160a01b0385169291600091602082018180368337019050509050600360fc1b81600081518110610cfe57610cfe6116d4565b60200101906001600160f81b031916908160001a905350600f60fb1b81600181518110610d2d57610d2d6116d4565b60200101906001600160f81b031916908160001a90535060005b6014811015610e6b5782600485610d5f84600c6117ab565b60208110610d6f57610d6f6116d4565b1a60f81b6001600160f81b031916901c60f81c60ff1681518110610d9557610d956116d4565b01602001516001600160f81b03191682610db08360026117be565b610dbb9060026117ab565b81518110610dcb57610dcb6116d4565b60200101906001600160f81b031916908160001a9053508284610def83600c6117ab565b60208110610dff57610dff6116d4565b825191901a600f16908110610e1657610e166116d4565b01602001516001600160f81b03191682610e318360026117be565b610e3c9060036117ab565b81518110610e4c57610e4c6116d4565b60200101906001600160f81b031916908160001a905350600101610d47565b50949350505050565b61169c806117d683390190565b6001600160a01b0381168114610e9657600080fd5b50565b600060208284031215610eab57600080fd5b8135610eb681610e81565b9392505050565b60008060408385031215610ed057600080fd5b8235610edb81610e81565b946020939093013593505050565b634e487b7160e01b600052604160045260246000fd5b604051601f8201601f191681016001600160401b0381118282101715610f2757610f27610ee9565b604052919050565b60006001600160401b03821115610f4857610f48610ee9565b50601f01601f191660200190565b600082601f830112610f6757600080fd5b8135610f7a610f7582610f2f565b610eff565b818152846020838601011115610f8f57600080fd5b816020850160208301376000918101602001919091529392505050565b60008060408385031215610fbf57600080fd5b8235915060208301356001600160401b03811115610fdc57600080fd5b610fe885828601610f56565b9150509250929050565b60006020828403121561100457600080fd5b5035919050565b60005b8381101561102657818101518382015260200161100e565b50506000910152565b6000815180845261104781602086016020860161100b565b601f01601f19169290920160200192915050565b602081526000610eb6602083018461102f565b602080825282518282018190526000918401906040840190835b818110156110af5783516001600160a01b0316835260209384019390920191600101611088565b509095945050505050565b60006001600160401b038211156110d3576110d3610ee9565b5060051b60200190565b600082601f8301126110ee57600080fd5b81356110fc610f75826110ba565b8082825260208201915060208360051b86010192508583111561111e57600080fd5b602085015b8381101561115f5780356001600160401b0381111561114157600080fd5b611150886020838a0101610f56565b84525060209283019201611123565b5095945050505050565b600080600080600060a0868803121561118157600080fd5b8535945060208601356001600160401b0381111561119e57600080fd5b6111aa88828901610f56565b94505060408601356001600160401b038111156111c657600080fd5b6111d288828901610f56565b93505060608601356001600160401b038111156111ee57600080fd5b8601601f810188136111ff57600080fd5b803561120d610f75826110ba565b8082825260208201915060208360051b85010192508a83111561122f57600080fd5b6020840193505b8284101561125a57833561124981610e81565b825260209384019390910190611236565b945050505060808601356001600160401b0381111561127857600080fd5b611284888289016110dd565b9150509295509295909350565b6000602082840312156112a357600080fd5b81356001600160401b038111156112b957600080fd5b6112c584828501610f56565b949350505050565b600082601f8301126112de57600080fd5b81516112ec610f7582610f2f565b81815284602083860101111561130157600080fd5b6112c582602083016020870161100b565b600082601f83011261132357600080fd5b8151611331610f75826110ba565b8082825260208201915060208360051b86010192508583111561135357600080fd5b602085015b8381101561115f5780516001600160401b0381111561137657600080fd5b611385886020838a01016112cd565b84525060209283019201611358565b805180151581146113a457600080fd5b919050565b60008060008060008060c087890312156113c257600080fd5b86516001600160401b038111156113d857600080fd5b6113e489828a016112cd565b96505060208701516001600160401b0381111561140057600080fd5b61140c89828a016112cd565b95505060408701516001600160401b0381111561142857600080fd5b61143489828a016112cd565b94505060608701516001600160401b0381111561145057600080fd5b61145c89828a01611312565b93505060808701516001600160401b0381111561147857600080fd5b61148489828a016112cd565b92505061149360a08801611394565b90509295509295509295565b6001600160a01b03831681526040602082018190526000906112c59083018461102f565b6060815260006114d6606083018661102f565b60208301949094525060400152919050565b600080600080608085870312156114fe57600080fd5b61150785611394565b602086015160408701516060880151929650909450925061152781610e81565b939692955090935050565b60006020828403121561154457600080fd5b81516001600160401b0381111561155a57600080fd5b6112c5848285016112cd565b6000815161157881856020860161100b565b9290920192915050565b6e3d91383937b532b1ba2fb4b2111d1160891b815284516000906115ad81600f850160208a0161100b565b61088b60f21b600f9184019182015267113a3cb832911d1160c11b601182015285516115e0816019840160208a0161100b565b61088b60f21b601992909101918201526c1137b13532b1ba34bb32911d1160991b601b8201528451600f82019161161f9082906028016020890161100b565b61166d61166061165a61163f60198686010161088b60f21b815260020190565b6e113830b93a34b1b4b830b73a39911d60891b8152600f0190565b87611566565b607d60f81b815260010190565b98975050505050505050565b8281526040602082015260006112c5604083018461102f565b6000602082840312156116a457600080fd5b8151610eb681610e81565b600082516116c181846020870161100b565b600b60fa1b920191825250600101919050565b634e487b7160e01b600052603260045260246000fd5b600084516116fc81846020890161100b565b663d9134b2111d1160c91b908301908152845161172081600784016020890161100b565b61088b60f21b6007929091019182015267113937b632911d1160c11b6009820152835161175481601184016020880161100b565b61227d60f01b6011929091019182015260130195945050505050565b6000825161178281846020870161100b565b605d60f81b920191825250600101919050565b634e487b7160e01b600052601160045260246000fd5b8082018082111561058757610587611795565b80820281158282048414176105875761058761179556fe608060405234801561001057600080fd5b5060405161169c38038061169c83398101604081905261002f91610125565b60008151116100845760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d70747900000000604482015260640160405180910390fd5b600080546001600160a01b0319166001600160a01b03841617905560016100ab828261029a565b5042600281905560038190556004805460ff191660011790556040516001600160a01b038416917f20bfd29f3d906f96fc35742fac45a554b19cbd4e21f8c4c1d84cb58fdfc32c899161010091815260200190565b60405180910390a25050610358565b634e487b7160e01b600052604160045260246000fd5b6000806040838503121561013857600080fd5b82516001600160a01b038116811461014f57600080fd5b60208401519092506001600160401b0381111561016b57600080fd5b8301601f8101851361017c57600080fd5b80516001600160401b038111156101955761019561010f565b604051601f8201601f19908116603f011681016001600160401b03811182821017156101c3576101c361010f565b6040528181528282016020018710156101db57600080fd5b60005b828110156101fa576020818501810151838301820152016101de565b506000602083830101528093505050509250929050565b600181811c9082168061022557607f821691505b60208210810361024557634e487b7160e01b600052602260045260246000fd5b50919050565b601f82111561029557806000526020600020601f840160051c810160208510156102725750805b601f840160051c820191505b81811015610292576000815560010161027e565b50505b505050565b81516001600160401b038111156102b3576102b361010f565b6102c7816102c18454610211565b8461024b565b6020601f8211600181146102fb57600083156102e35750848201515b600019600385901b1c1916600184901b178455610292565b600084815260208120601f198516915b8281101561032b578785015182556020948501946001909201910161030b565b50848210156103495786840151600019600387901b60f8161c191681555b50505050600190811b01905550565b611335806103676000396000f3fe608060405234801561001057600080fd5b506004361061012c5760003560e01c80639c0768b3116100ad578063dfb748aa11610071578063dfb748aa14610274578063e7aa3afc14610287578063ef213106146102c2578063f7267cfd146102d5578063fba7cc79146102de57600080fd5b80639c0768b314610232578063b56864791461023a578063bbffd04c1461024d578063c3feda1714610255578063cf09e0d01461025d57600080fd5b806355b31b55116100f457806355b31b55146101c757806359abbfe4146101dc5780635e1a6c17146101f75780637847f1de1461020a57806384e077281461021d57600080fd5b806302d05d3f146101315780630ee2cb101461016157806310218f4d1461017257806322f3e2d414610187578063383e1a5e146101a4575b600080fd5b600054610144906001600160a01b031681565b6040516001600160a01b0390911681526020015b60405180910390f35b6000546001600160a01b0316610144565b610185610180366004610f29565b6102e9565b005b6004546101949060ff1681565b6040519015158152602001610158565b6101b76101b2366004610fe2565b610403565b6040516101589493929190611058565b6101cf610510565b6040516101589190611094565b60025460035460408051928352602083019190915201610158565b6101446102053660046110a7565b6105a2565b610185610218366004610f29565b6105cc565b61022561082c565b60405161015891906110c0565b6101cf6109b0565b610185610248366004610fe2565b610a3e565b610185610b5e565b610185610c22565b61026660025481565b604051908152602001610158565b610185610282366004610fe2565b610ce5565b6004546002546003546000546040805160ff909516151585526020850193909352918301526001600160a01b03166060820152608001610158565b6101b76102d0366004610fe2565b610dfe565b61026660035481565b60045460ff16610194565b6000546001600160a01b0316331461031c5760405162461bcd60e51b81526004016103139061110c565b60405180910390fd5b60045460ff166103665760405162461bcd60e51b815260206004820152601560248201527450726f6a656374206973206e6f742061637469766560581b6044820152606401610313565b60008151116103b75760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d707479000000006044820152606401610313565b60016103c382826111e1565b5042600381905560405190815233907fc1756fd99ac9a2b1b22b5e701ddb022b897a002144d045b77ac35ce46610fef6906020015b60405180910390a250565b6001600160a01b0380821660009081526005602090815260408083208151608081019092528054909416815260018401805493946060948694859485949093929184019161045090611158565b80601f016020809104026020016040519081016040528092919081815260200182805461047c90611158565b80156104c95780601f1061049e576101008083540402835291602001916104c9565b820191906000526020600020905b8154815290600101906020018083116104ac57829003601f168201915b5050509183525050600282015460208083019190915260039092015460ff161515604091820152825191830151908301516060909301519199909850919650945092505050565b60606001805461051f90611158565b80601f016020809104026020016040519081016040528092919081815260200182805461054b90611158565b80156105985780601f1061056d57610100808354040283529160200191610598565b820191906000526020600020905b81548152906001019060200180831161057b57829003601f168201915b5050505050905090565b600681815481106105b257600080fd5b6000918252602090912001546001600160a01b0316905081565b60045460ff166106165760405162461bcd60e51b815260206004820152601560248201527450726f6a656374206973206e6f742061637469766560581b6044820152606401610313565b6000546001600160a01b031633036106835760405162461bcd60e51b815260206004820152602a60248201527f50726f6a6563742063726561746f722063616e6e6f74207375626d6974206a6f6044820152691a5b881c995c5d595cdd60b21b6064820152608401610313565b3360009081526005602052604090206003015460ff16156106e65760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420616c72656164792065786973747300000000006044820152606401610313565b600081511161072e5760405162461bcd60e51b8152602060048201526014602482015273526f6c652063616e6e6f7420626520656d70747960601b6044820152606401610313565b6040805160808101825233808252602080830185815242848601526001606085018190526000938452600590925293909120825181546001600160a01b0319166001600160a01b0390911617815592519192919082019061078f90826111e1565b5060408281015160028301556060909201516003909101805460ff1916911515919091179055600680546001810182556000919091527ff652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f018054336001600160a01b0319909116811790915590517fe4d6c018abd0178d4bce0856089ef1876318617b97a1d700bb98506598ab0afc906103f890849042906112a0565b60606000805b600654811015610899576005600060068381548110610853576108536112c2565b60009182526020808320909101546001600160a01b0316835282019290925260400190206003015460ff1615610891578161088d816112d8565b9250505b600101610832565b5060008167ffffffffffffffff8111156108b5576108b5610f13565b6040519080825280602002602001820160405280156108de578160200160208202803683370190505b5090506000805b6006548110156109a7576005600060068381548110610906576109066112c2565b60009182526020808320909101546001600160a01b0316835282019290925260400190206003015460ff161561099f5760068181548110610949576109496112c2565b9060005260206000200160009054906101000a90046001600160a01b0316838381518110610979576109796112c2565b6001600160a01b03909216602092830291909101909101528161099b816112d8565b9250505b6001016108e5565b50909392505050565b600180546109bd90611158565b80601f01602080910402602001604051908101604052809291908181526020018280546109e990611158565b8015610a365780601f10610a0b57610100808354040283529160200191610a36565b820191906000526020600020905b815481529060010190602001808311610a1957829003601f168201915b505050505081565b6000546001600160a01b03163314610a685760405162461bcd60e51b81526004016103139061110c565b6001600160a01b03811660009081526005602052604090206003015460ff16610ad35760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420646f6573206e6f7420657869737400000000006044820152606401610313565b6001600160a01b038116600090815260056020526040812080546001600160a01b031916815590610b076001830182610ebd565b5060006002820155600301805460ff1916905560405142815233906001600160a01b038316907f1a69e67d1be897d0ca0cf1517b4d17e345b4272a80bc900f9fe8e96f261ca1db906020015b60405180910390a350565b6000546001600160a01b03163314610b885760405162461bcd60e51b81526004016103139061110c565b60045460ff16610bda5760405162461bcd60e51b815260206004820152601b60248201527f50726f6a65637420697320616c726561647920696e61637469766500000000006044820152606401610313565b6004805460ff1916905542600381905560405190815233907f17064d72ee4a5901e55dfa45024ea8f67cdb4895ba6364ab2f8e7223f642ad36906020015b60405180910390a2565b6000546001600160a01b03163314610c4c5760405162461bcd60e51b81526004016103139061110c565b60045460ff1615610c9f5760405162461bcd60e51b815260206004820152601960248201527f50726f6a65637420697320616c726561647920616374697665000000000000006044820152606401610313565b6004805460ff1916600117905542600381905560405133917fb351ba71ddc1d2bf39667cebde99fb92eb26b9f418d5049ba0200888ba81071591610c1891815260200190565b6000546001600160a01b03163314610d0f5760405162461bcd60e51b81526004016103139061110c565b6001600160a01b03811660009081526005602052604090206003015460ff16610d7a5760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420646f6573206e6f7420657869737400000000006044820152606401610313565b6001600160a01b038116600090815260056020526040812080546001600160a01b031916815590610dae6001830182610ebd565b5060006002820155600301805460ff1916905560405142815233906001600160a01b038316907f423eb00b6a18c3ecfc2170a0e40ef0bad995279070614ba2e4be1b94f67eb88890602001610b53565b600560205260009081526040902080546001820180546001600160a01b039092169291610e2a90611158565b80601f0160208091040260200160405190810160405280929190818152602001828054610e5690611158565b8015610ea35780601f10610e7857610100808354040283529160200191610ea3565b820191906000526020600020905b815481529060010190602001808311610e8657829003601f168201915b50505050600283015460039093015491929160ff16905084565b508054610ec990611158565b6000825580601f10610ed9575050565b601f016020900490600052602060002090810190610ef79190610efa565b50565b5b80821115610f0f5760008155600101610efb565b5090565b634e487b7160e01b600052604160045260246000fd5b600060208284031215610f3b57600080fd5b813567ffffffffffffffff811115610f5257600080fd5b8201601f81018413610f6357600080fd5b803567ffffffffffffffff811115610f7d57610f7d610f13565b604051601f8201601f19908116603f0116810167ffffffffffffffff81118282101715610fac57610fac610f13565b604052818152828201602001861015610fc457600080fd5b81602084016020830137600091810160200191909152949350505050565b600060208284031215610ff457600080fd5b81356001600160a01b038116811461100b57600080fd5b9392505050565b6000815180845260005b818110156110385760208185018101518683018201520161101c565b506000602082860101526020601f19601f83011685010191505092915050565b6001600160a01b038516815260806020820181905260009061107c90830186611012565b60408301949094525090151560609091015292915050565b60208152600061100b6020830184611012565b6000602082840312156110b957600080fd5b5035919050565b602080825282518282018190526000918401906040840190835b818110156111015783516001600160a01b03168352602093840193909201916001016110da565b509095945050505050565b6020808252602c908201527f4f6e6c792070726f6a6563742063726561746f722063616e20706572666f726d60408201526b103a3434b99030b1ba34b7b760a11b606082015260800190565b600181811c9082168061116c57607f821691505b60208210810361118c57634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156111dc57806000526020600020601f840160051c810160208510156111b95750805b601f840160051c820191505b818110156111d957600081556001016111c5565b50505b505050565b815167ffffffffffffffff8111156111fb576111fb610f13565b61120f816112098454611158565b84611192565b6020601f821160018114611243576000831561122b5750848201515b600019600385901b1c1916600184901b1784556111d9565b600084815260208120601f198516915b828110156112735787850151825560209485019460019092019101611253565b50848210156112915786840151600019600387901b60f8161c191681555b50505050600190811b01905550565b6040815260006112b36040830185611012565b90508260208301529392505050565b634e487b7160e01b600052603260045260246000fd5b6000600182016112f857634e487b7160e01b600052601160045260246000fd5b506001019056fea2646970667358221220bec9471bb23b6e25da9c64e7d34995b3e371c8436ddc9fd588e51486983342ff64736f6c634300081c0033a2646970667358221220f3440a32e031d1fe3eb74602635263cc1b237f8ffb977395866a1da4761e6bde64736f6c634300081c0033","deployedBytecode":"0x608060405234801561001057600080fd5b50600436106100f55760003560e01c806361eb383611610097578063a0af81f011610066578063a0af81f014610255578063da49f66114610268578063e32e723c1461027b578063eabec3a31461028e57600080fd5b806361eb3836146101d15780636a88a8e91461020f57806380d038291461022f578063812739a21461024457600080fd5b80632fa9c007116100d35780632fa9c0071461016c5780634780f7861461017f57806353b3194c146101925780635d0c3011146101a557600080fd5b806305c81408146100fa5780630882dfa0146101325780631cf5ec1914610147575b600080fd5b61011d610108366004610e99565b60026020526000908152604090205460ff1681565b60405190151581526020015b60405180910390f35b610145610140366004610e99565b6102a1565b005b6000546001600160a01b03165b6040516001600160a01b039091168152602001610129565b61015461017a366004610ebd565b61032f565b61015461018d366004610fac565b610367565b6101546101a0366004610ff2565b61058d565b61011d6101b3366004610e99565b6001600160a01b031660009081526002602052604090205460ff1690565b6101e46101df366004610e99565b6105b7565b6040805194151585526020850193909352918301526001600160a01b03166060820152608001610129565b61022261021d366004610e99565b610690565b604051610129919061105b565b61023761075b565b604051610129919061106e565b600354604051908152602001610129565b600054610154906001600160a01b031681565b610154610276366004611169565b6107bd565b610237610289366004610e99565b61098c565b61015461029c366004611291565b610a02565b6001600160a01b03811661030d5760405162461bcd60e51b815260206004820152602860248201527f54656d706c61746520726567697374727920616464726573732063616e6e6f74604482015267206265207a65726f60c01b60648201526084015b60405180910390fd5b600080546001600160a01b0319166001600160a01b0392909216919091179055565b6001602052816000526040600020818154811061034b57600080fd5b6000918252602090912001546001600160a01b03169150829050565b60008054604051630c550f3d60e21b815260048101859052829182916001600160a01b03909116906331543cf490602401600060405180830381865afa1580156103b5573d6000803e3d6000fd5b505050506040513d6000823e601f3d908101601f191682016040526103dd91908101906113a9565b95505050935050508061042b5760405162461bcd60e51b815260206004820152601660248201527554656d706c617465206973206e6f742061637469766560501b6044820152606401610304565b600084511161047c5760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d707479000000006044820152606401610304565b6000338560405161048c90610e74565b61049792919061149f565b604051809103906000f0801580156104b3573d6000803e3d6000fd5b50336000818152600160208181526040808420805480850182559085528285200180546001600160a01b0388166001600160a01b031991821681179092558186526002909352818520805460ff1916851790556003805494850181559094527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b9092018054909116831790555192935083929091907ff474a44bbf67e28a60e1e8977a0d7bdf30896d6b88b7c83710a32ad527611994906105799088908c9042906114c3565b60405180910390a393505050505b92915050565b6003818154811061059d57600080fd5b6000918252602090912001546001600160a01b0316905081565b6001600160a01b03811660009081526002602052604081205481908190819060ff1661061f5760405162461bcd60e51b8152602060048201526017602482015276496e76616c69642070726f6a656374206164647265737360481b6044820152606401610304565b846001600160a01b031663e7aa3afc6040518163ffffffff1660e01b8152600401608060405180830381865afa15801561065d573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061068191906114e8565b93509350935093509193509193565b6001600160a01b03811660009081526002602052604090205460609060ff166106f55760405162461bcd60e51b8152602060048201526017602482015276496e76616c69642070726f6a656374206164647265737360481b6044820152606401610304565b816001600160a01b03166355b31b556040518163ffffffff1660e01b8152600401600060405180830381865afa158015610733573d6000803e3d6000fd5b505050506040513d6000823e601f3d908101601f191682016040526105879190810190611532565b606060038054806020026020016040519081016040528092919081815260200182805480156107b357602002820191906000526020600020905b81546001600160a01b03168152600190910190602001808311610795575b5050505050905090565b6000815183511461081f5760405162461bcd60e51b815260206004820152602660248201527f5061727469636970616e747320616e6420726f6c6573206c656e677468206d696044820152650e6dac2e8c6d60d31b6064820152608401610304565b60008054604051630c550f3d60e21b81526004810189905282916001600160a01b0316906331543cf490602401600060405180830381865afa158015610869573d6000803e3d6000fd5b505050506040513d6000823e601f3d908101601f1916820160405261089191908101906113a9565b9550505093505050806108df5760405162461bcd60e51b815260206004820152601660248201527554656d706c617465206973206e6f742061637469766560501b6044820152606401610304565b60006108eb8686610b89565b90506000888489846040516020016109069493929190611582565b60408051601f19818403018152908290526323c07bc360e11b825291503090634780f7869061093b908d908590600401611679565b6020604051808303816000875af115801561095a573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061097e9190611692565b9a9950505050505050505050565b6001600160a01b0381166000908152600160209081526040918290208054835181840281018401909452808452606093928301828280156109f657602002820191906000526020600020905b81546001600160a01b031681526001909101906020018083116109d8575b50505050509050919050565b600080825111610a545760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d707479000000006044820152606401610304565b60003383604051610a6490610e74565b610a6f92919061149f565b604051809103906000f080158015610a8b573d6000803e3d6000fd5b50336000818152600160208181526040808420805480850182559085528285200180546001600160a01b0388166001600160a01b031991821681179092558186526002909352818520805460ff1916851790556003805494850181559094527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b9092018054909116831790555192935083929091907ff474a44bbf67e28a60e1e8977a0d7bdf30896d6b88b7c83710a32ad52761199490610b7a90620f423f904290606080825260069082015265637573746f6d60d01b60808201526020810192909252604082015260a00190565b60405180910390a39392505050565b60608251600003610bb357506040805180820190915260028152615b5d60f01b6020820152610587565b6040805180820190915260018152605b60f81b602082015260005b8451811015610c69578015610c005781604051602001610bee91906116af565b60405160208183030381529060405291505b81610c23868381518110610c1657610c166116d4565b6020026020010151610c93565b858381518110610c3557610c356116d4565b6020026020010151604051602001610c4f939291906116ea565b60408051601f198184030181529190529150600101610bce565b5080604051602001610c7b9190611770565b60405160208183030381529060405291505092915050565b604080518082018252601081526f181899199a1a9b1b9c1cb0b131b232b360811b60208201528151602a80825260608281019094526001600160a01b0385169291600091602082018180368337019050509050600360fc1b81600081518110610cfe57610cfe6116d4565b60200101906001600160f81b031916908160001a905350600f60fb1b81600181518110610d2d57610d2d6116d4565b60200101906001600160f81b031916908160001a90535060005b6014811015610e6b5782600485610d5f84600c6117ab565b60208110610d6f57610d6f6116d4565b1a60f81b6001600160f81b031916901c60f81c60ff1681518110610d9557610d956116d4565b01602001516001600160f81b03191682610db08360026117be565b610dbb9060026117ab565b81518110610dcb57610dcb6116d4565b60200101906001600160f81b031916908160001a9053508284610def83600c6117ab565b60208110610dff57610dff6116d4565b825191901a600f16908110610e1657610e166116d4565b01602001516001600160f81b03191682610e318360026117be565b610e3c9060036117ab565b81518110610e4c57610e4c6116d4565b60200101906001600160f81b031916908160001a905350600101610d47565b50949350505050565b61169c806117d683390190565b6001600160a01b0381168114610e9657600080fd5b50565b600060208284031215610eab57600080fd5b8135610eb681610e81565b9392505050565b60008060408385031215610ed057600080fd5b8235610edb81610e81565b946020939093013593505050565b634e487b7160e01b600052604160045260246000fd5b604051601f8201601f191681016001600160401b0381118282101715610f2757610f27610ee9565b604052919050565b60006001600160401b03821115610f4857610f48610ee9565b50601f01601f191660200190565b600082601f830112610f6757600080fd5b8135610f7a610f7582610f2f565b610eff565b818152846020838601011115610f8f57600080fd5b816020850160208301376000918101602001919091529392505050565b60008060408385031215610fbf57600080fd5b8235915060208301356001600160401b03811115610fdc57600080fd5b610fe885828601610f56565b9150509250929050565b60006020828403121561100457600080fd5b5035919050565b60005b8381101561102657818101518382015260200161100e565b50506000910152565b6000815180845261104781602086016020860161100b565b601f01601f19169290920160200192915050565b602081526000610eb6602083018461102f565b602080825282518282018190526000918401906040840190835b818110156110af5783516001600160a01b0316835260209384019390920191600101611088565b509095945050505050565b60006001600160401b038211156110d3576110d3610ee9565b5060051b60200190565b600082601f8301126110ee57600080fd5b81356110fc610f75826110ba565b8082825260208201915060208360051b86010192508583111561111e57600080fd5b602085015b8381101561115f5780356001600160401b0381111561114157600080fd5b611150886020838a0101610f56565b84525060209283019201611123565b5095945050505050565b600080600080600060a0868803121561118157600080fd5b8535945060208601356001600160401b0381111561119e57600080fd5b6111aa88828901610f56565b94505060408601356001600160401b038111156111c657600080fd5b6111d288828901610f56565b93505060608601356001600160401b038111156111ee57600080fd5b8601601f810188136111ff57600080fd5b803561120d610f75826110ba565b8082825260208201915060208360051b85010192508a83111561122f57600080fd5b6020840193505b8284101561125a57833561124981610e81565b825260209384019390910190611236565b945050505060808601356001600160401b0381111561127857600080fd5b611284888289016110dd565b9150509295509295909350565b6000602082840312156112a357600080fd5b81356001600160401b038111156112b957600080fd5b6112c584828501610f56565b949350505050565b600082601f8301126112de57600080fd5b81516112ec610f7582610f2f565b81815284602083860101111561130157600080fd5b6112c582602083016020870161100b565b600082601f83011261132357600080fd5b8151611331610f75826110ba565b8082825260208201915060208360051b86010192508583111561135357600080fd5b602085015b8381101561115f5780516001600160401b0381111561137657600080fd5b611385886020838a01016112cd565b84525060209283019201611358565b805180151581146113a457600080fd5b919050565b60008060008060008060c087890312156113c257600080fd5b86516001600160401b038111156113d857600080fd5b6113e489828a016112cd565b96505060208701516001600160401b0381111561140057600080fd5b61140c89828a016112cd565b95505060408701516001600160401b0381111561142857600080fd5b61143489828a016112cd565b94505060608701516001600160401b0381111561145057600080fd5b61145c89828a01611312565b93505060808701516001600160401b0381111561147857600080fd5b61148489828a016112cd565b92505061149360a08801611394565b90509295509295509295565b6001600160a01b03831681526040602082018190526000906112c59083018461102f565b6060815260006114d6606083018661102f565b60208301949094525060400152919050565b600080600080608085870312156114fe57600080fd5b61150785611394565b602086015160408701516060880151929650909450925061152781610e81565b939692955090935050565b60006020828403121561154457600080fd5b81516001600160401b0381111561155a57600080fd5b6112c5848285016112cd565b6000815161157881856020860161100b565b9290920192915050565b6e3d91383937b532b1ba2fb4b2111d1160891b815284516000906115ad81600f850160208a0161100b565b61088b60f21b600f9184019182015267113a3cb832911d1160c11b601182015285516115e0816019840160208a0161100b565b61088b60f21b601992909101918201526c1137b13532b1ba34bb32911d1160991b601b8201528451600f82019161161f9082906028016020890161100b565b61166d61166061165a61163f60198686010161088b60f21b815260020190565b6e113830b93a34b1b4b830b73a39911d60891b8152600f0190565b87611566565b607d60f81b815260010190565b98975050505050505050565b8281526040602082015260006112c5604083018461102f565b6000602082840312156116a457600080fd5b8151610eb681610e81565b600082516116c181846020870161100b565b600b60fa1b920191825250600101919050565b634e487b7160e01b600052603260045260246000fd5b600084516116fc81846020890161100b565b663d9134b2111d1160c91b908301908152845161172081600784016020890161100b565b61088b60f21b6007929091019182015267113937b632911d1160c11b6009820152835161175481601184016020880161100b565b61227d60f01b6011929091019182015260130195945050505050565b6000825161178281846020870161100b565b605d60f81b920191825250600101919050565b634e487b7160e01b600052601160045260246000fd5b8082018082111561058757610587611795565b80820281158282048414176105875761058761179556fe608060405234801561001057600080fd5b5060405161169c38038061169c83398101604081905261002f91610125565b60008151116100845760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d70747900000000604482015260640160405180910390fd5b600080546001600160a01b0319166001600160a01b03841617905560016100ab828261029a565b5042600281905560038190556004805460ff191660011790556040516001600160a01b038416917f20bfd29f3d906f96fc35742fac45a554b19cbd4e21f8c4c1d84cb58fdfc32c899161010091815260200190565b60405180910390a25050610358565b634e487b7160e01b600052604160045260246000fd5b6000806040838503121561013857600080fd5b82516001600160a01b038116811461014f57600080fd5b60208401519092506001600160401b0381111561016b57600080fd5b8301601f8101851361017c57600080fd5b80516001600160401b038111156101955761019561010f565b604051601f8201601f19908116603f011681016001600160401b03811182821017156101c3576101c361010f565b6040528181528282016020018710156101db57600080fd5b60005b828110156101fa576020818501810151838301820152016101de565b506000602083830101528093505050509250929050565b600181811c9082168061022557607f821691505b60208210810361024557634e487b7160e01b600052602260045260246000fd5b50919050565b601f82111561029557806000526020600020601f840160051c810160208510156102725750805b601f840160051c820191505b81811015610292576000815560010161027e565b50505b505050565b81516001600160401b038111156102b3576102b361010f565b6102c7816102c18454610211565b8461024b565b6020601f8211600181146102fb57600083156102e35750848201515b600019600385901b1c1916600184901b178455610292565b600084815260208120601f198516915b8281101561032b578785015182556020948501946001909201910161030b565b50848210156103495786840151600019600387901b60f8161c191681555b50505050600190811b01905550565b611335806103676000396000f3fe608060405234801561001057600080fd5b506004361061012c5760003560e01c80639c0768b3116100ad578063dfb748aa11610071578063dfb748aa14610274578063e7aa3afc14610287578063ef213106146102c2578063f7267cfd146102d5578063fba7cc79146102de57600080fd5b80639c0768b314610232578063b56864791461023a578063bbffd04c1461024d578063c3feda1714610255578063cf09e0d01461025d57600080fd5b806355b31b55116100f457806355b31b55146101c757806359abbfe4146101dc5780635e1a6c17146101f75780637847f1de1461020a57806384e077281461021d57600080fd5b806302d05d3f146101315780630ee2cb101461016157806310218f4d1461017257806322f3e2d414610187578063383e1a5e146101a4575b600080fd5b600054610144906001600160a01b031681565b6040516001600160a01b0390911681526020015b60405180910390f35b6000546001600160a01b0316610144565b610185610180366004610f29565b6102e9565b005b6004546101949060ff1681565b6040519015158152602001610158565b6101b76101b2366004610fe2565b610403565b6040516101589493929190611058565b6101cf610510565b6040516101589190611094565b60025460035460408051928352602083019190915201610158565b6101446102053660046110a7565b6105a2565b610185610218366004610f29565b6105cc565b61022561082c565b60405161015891906110c0565b6101cf6109b0565b610185610248366004610fe2565b610a3e565b610185610b5e565b610185610c22565b61026660025481565b604051908152602001610158565b610185610282366004610fe2565b610ce5565b6004546002546003546000546040805160ff909516151585526020850193909352918301526001600160a01b03166060820152608001610158565b6101b76102d0366004610fe2565b610dfe565b61026660035481565b60045460ff16610194565b6000546001600160a01b0316331461031c5760405162461bcd60e51b81526004016103139061110c565b60405180910390fd5b60045460ff166103665760405162461bcd60e51b815260206004820152601560248201527450726f6a656374206973206e6f742061637469766560581b6044820152606401610313565b60008151116103b75760405162461bcd60e51b815260206004820152601c60248201527f50726f6a65637420646174612063616e6e6f7420626520656d707479000000006044820152606401610313565b60016103c382826111e1565b5042600381905560405190815233907fc1756fd99ac9a2b1b22b5e701ddb022b897a002144d045b77ac35ce46610fef6906020015b60405180910390a250565b6001600160a01b0380821660009081526005602090815260408083208151608081019092528054909416815260018401805493946060948694859485949093929184019161045090611158565b80601f016020809104026020016040519081016040528092919081815260200182805461047c90611158565b80156104c95780601f1061049e576101008083540402835291602001916104c9565b820191906000526020600020905b8154815290600101906020018083116104ac57829003601f168201915b5050509183525050600282015460208083019190915260039092015460ff161515604091820152825191830151908301516060909301519199909850919650945092505050565b60606001805461051f90611158565b80601f016020809104026020016040519081016040528092919081815260200182805461054b90611158565b80156105985780601f1061056d57610100808354040283529160200191610598565b820191906000526020600020905b81548152906001019060200180831161057b57829003601f168201915b5050505050905090565b600681815481106105b257600080fd5b6000918252602090912001546001600160a01b0316905081565b60045460ff166106165760405162461bcd60e51b815260206004820152601560248201527450726f6a656374206973206e6f742061637469766560581b6044820152606401610313565b6000546001600160a01b031633036106835760405162461bcd60e51b815260206004820152602a60248201527f50726f6a6563742063726561746f722063616e6e6f74207375626d6974206a6f6044820152691a5b881c995c5d595cdd60b21b6064820152608401610313565b3360009081526005602052604090206003015460ff16156106e65760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420616c72656164792065786973747300000000006044820152606401610313565b600081511161072e5760405162461bcd60e51b8152602060048201526014602482015273526f6c652063616e6e6f7420626520656d70747960601b6044820152606401610313565b6040805160808101825233808252602080830185815242848601526001606085018190526000938452600590925293909120825181546001600160a01b0319166001600160a01b0390911617815592519192919082019061078f90826111e1565b5060408281015160028301556060909201516003909101805460ff1916911515919091179055600680546001810182556000919091527ff652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f018054336001600160a01b0319909116811790915590517fe4d6c018abd0178d4bce0856089ef1876318617b97a1d700bb98506598ab0afc906103f890849042906112a0565b60606000805b600654811015610899576005600060068381548110610853576108536112c2565b60009182526020808320909101546001600160a01b0316835282019290925260400190206003015460ff1615610891578161088d816112d8565b9250505b600101610832565b5060008167ffffffffffffffff8111156108b5576108b5610f13565b6040519080825280602002602001820160405280156108de578160200160208202803683370190505b5090506000805b6006548110156109a7576005600060068381548110610906576109066112c2565b60009182526020808320909101546001600160a01b0316835282019290925260400190206003015460ff161561099f5760068181548110610949576109496112c2565b9060005260206000200160009054906101000a90046001600160a01b0316838381518110610979576109796112c2565b6001600160a01b03909216602092830291909101909101528161099b816112d8565b9250505b6001016108e5565b50909392505050565b600180546109bd90611158565b80601f01602080910402602001604051908101604052809291908181526020018280546109e990611158565b8015610a365780601f10610a0b57610100808354040283529160200191610a36565b820191906000526020600020905b815481529060010190602001808311610a1957829003601f168201915b505050505081565b6000546001600160a01b03163314610a685760405162461bcd60e51b81526004016103139061110c565b6001600160a01b03811660009081526005602052604090206003015460ff16610ad35760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420646f6573206e6f7420657869737400000000006044820152606401610313565b6001600160a01b038116600090815260056020526040812080546001600160a01b031916815590610b076001830182610ebd565b5060006002820155600301805460ff1916905560405142815233906001600160a01b038316907f1a69e67d1be897d0ca0cf1517b4d17e345b4272a80bc900f9fe8e96f261ca1db906020015b60405180910390a350565b6000546001600160a01b03163314610b885760405162461bcd60e51b81526004016103139061110c565b60045460ff16610bda5760405162461bcd60e51b815260206004820152601b60248201527f50726f6a65637420697320616c726561647920696e61637469766500000000006044820152606401610313565b6004805460ff1916905542600381905560405190815233907f17064d72ee4a5901e55dfa45024ea8f67cdb4895ba6364ab2f8e7223f642ad36906020015b60405180910390a2565b6000546001600160a01b03163314610c4c5760405162461bcd60e51b81526004016103139061110c565b60045460ff1615610c9f5760405162461bcd60e51b815260206004820152601960248201527f50726f6a65637420697320616c726561647920616374697665000000000000006044820152606401610313565b6004805460ff1916600117905542600381905560405133917fb351ba71ddc1d2bf39667cebde99fb92eb26b9f418d5049ba0200888ba81071591610c1891815260200190565b6000546001600160a01b03163314610d0f5760405162461bcd60e51b81526004016103139061110c565b6001600160a01b03811660009081526005602052604090206003015460ff16610d7a5760405162461bcd60e51b815260206004820152601b60248201527f4a6f696e207265717565737420646f6573206e6f7420657869737400000000006044820152606401610313565b6001600160a01b038116600090815260056020526040812080546001600160a01b031916815590610dae6001830182610ebd565b5060006002820155600301805460ff1916905560405142815233906001600160a01b038316907f423eb00b6a18c3ecfc2170a0e40ef0bad995279070614ba2e4be1b94f67eb88890602001610b53565b600560205260009081526040902080546001820180546001600160a01b039092169291610e2a90611158565b80601f0160208091040260200160405190810160405280929190818152602001828054610e5690611158565b8015610ea35780601f10610e7857610100808354040283529160200191610ea3565b820191906000526020600020905b815481529060010190602001808311610e8657829003601f168201915b50505050600283015460039093015491929160ff16905084565b508054610ec990611158565b6000825580601f10610ed9575050565b601f016020900490600052602060002090810190610ef79190610efa565b50565b5b80821115610f0f5760008155600101610efb565b5090565b634e487b7160e01b600052604160045260246000fd5b600060208284031215610f3b57600080fd5b813567ffffffffffffffff811115610f5257600080fd5b8201601f81018413610f6357600080fd5b803567ffffffffffffffff811115610f7d57610f7d610f13565b604051601f8201601f19908116603f0116810167ffffffffffffffff81118282101715610fac57610fac610f13565b604052818152828201602001861015610fc457600080fd5b81602084016020830137600091810160200191909152949350505050565b600060208284031215610ff457600080fd5b81356001600160a01b038116811461100b57600080fd5b9392505050565b6000815180845260005b818110156110385760208185018101518683018201520161101c565b506000602082860101526020601f19601f83011685010191505092915050565b6001600160a01b038516815260806020820181905260009061107c90830186611012565b60408301949094525090151560609091015292915050565b60208152600061100b6020830184611012565b6000602082840312156110b957600080fd5b5035919050565b602080825282518282018190526000918401906040840190835b818110156111015783516001600160a01b03168352602093840193909201916001016110da565b509095945050505050565b6020808252602c908201527f4f6e6c792070726f6a6563742063726561746f722063616e20706572666f726d60408201526b103a3434b99030b1ba34b7b760a11b606082015260800190565b600181811c9082168061116c57607f821691505b60208210810361118c57634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156111dc57806000526020600020601f840160051c810160208510156111b95750805b601f840160051c820191505b818110156111d957600081556001016111c5565b50505b505050565b815167ffffffffffffffff8111156111fb576111fb610f13565b61120f816112098454611158565b84611192565b6020601f821160018114611243576000831561122b5750848201515b600019600385901b1c1916600184901b1784556111d9565b600084815260208120601f198516915b828110156112735787850151825560209485019460019092019101611253565b50848210156112915786840151600019600387901b60f8161c191681555b50505050600190811b01905550565b6040815260006112b36040830185611012565b90508260208301529392505050565b634e487b7160e01b600052603260045260246000fd5b6000600182016112f857634e487b7160e01b600052601160045260246000fd5b506001019056fea2646970667358221220bec9471bb23b6e25da9c64e7d34995b3e371c8436ddc9fd588e51486983342ff64736f6c634300081c0033a2646970667358221220f3440a32e031d1fe3eb74602635263cc1b237f8ffb977395866a1da4761e6bde64736f6c634300081c0033","linkReferences":{},"deployedLinkReferences":{}}');

/***/ }),

/***/ "./lib/index.js":
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/launcher */ "webpack/sharing/consume/default/@jupyterlab/launcher");
/* harmony import */ var _jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @jupyterlab/ui-components */ "webpack/sharing/consume/default/@jupyterlab/ui-components");
/* harmony import */ var _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _DALWidget__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./DALWidget */ "./lib/DALWidget.js");
/* harmony import */ var _style_index_css__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../style/index.css */ "./style/index.css");




// Import CSS

const dalIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_2__.LabIcon({
    name: 'dvre-dal:icon',
    svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v8M4 8h8" stroke="currentColor" stroke-width="1.5"/><path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1" opacity="0.7"/></svg>'
});
const plugin = {
    id: 'jupyter-dvre-dal:plugin',
    description: 'Decentralized Active Learning extension for DVRE',
    autoStart: true,
    requires: [_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.ICommandPalette],
    optional: [_jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_1__.ILauncher],
    activate: (app, palette, launcher) => {
        console.log('DVRE DAL extension is activated!');
        // NOTE: DVRE core registration removed due to TypeScript compatibility issues
        // The extension works standalone and will be discovered by DVRE core if available
        // Command for DAL
        const dalCommand = 'dvre-dal:open';
        app.commands.addCommand(dalCommand, {
            label: 'Active Learning',
            caption: 'Open Decentralized Active Learning interface',
            icon: dalIcon,
            execute: () => {
                const content = new _DALWidget__WEBPACK_IMPORTED_MODULE_3__.DALWidget('Decentralized Active Learning');
                const widget = new _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.MainAreaWidget({ content });
                widget.id = `dvre-dal-${Date.now()}`;
                widget.title.closable = true;
                widget.title.icon = dalIcon;
                app.shell.add(widget, 'main');
                app.shell.activateById(widget.id);
            }
        });
        // Add to command palette
        palette.addItem({ command: dalCommand, category: 'DVRE' });
        // Add to launcher if available
        if (launcher) {
            launcher.add({
                command: dalCommand,
                category: 'DVRE',
                rank: 10
            });
            console.log('DAL extension added to launcher successfully!');
        }
        else {
            console.log('Launcher not available - DAL extension only in command palette');
        }
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (plugin);


/***/ }),

/***/ "./lib/integration/DVREIntegration.js":
/*!********************************************!*\
  !*** ./lib/integration/DVREIntegration.js ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   useActiveLearningProjects: () => (/* binding */ useActiveLearningProjects),
/* harmony export */   useDVREAuth: () => (/* binding */ useDVREAuth),
/* harmony export */   useDVREProjects: () => (/* binding */ useDVREProjects),
/* harmony export */   useFactoryRegistry: () => (/* binding */ useFactoryRegistry)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _abis_ProjectFactory_json__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../abis/ProjectFactory.json */ "./lib/abis/ProjectFactory.json");
/* harmony import */ var _abis_JSONProject_json__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../abis/JSONProject.json */ "./lib/abis/JSONProject.json");
/* harmony import */ var _abis_FactoryRegistry_json__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../abis/FactoryRegistry.json */ "./lib/abis/FactoryRegistry.json");
// DVRE Integration Layer for DAL Extension
// This replicates DVRE's exact hook patterns for project loading

// Import contract ABIs (copied from main DVRE extension)



// Configuration matching main DVRE extension
const FACTORY_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000001000";
const RPC_URL = 'http://145.100.135.27:8550';
// Hook to replicate useAuth functionality
const useDVREAuth = () => {
    const [account, setAccount] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const [isLoading, setIsLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        console.log('DAL: Initializing auth...');
        const checkAuth = async () => {
            try {
                if (typeof window !== 'undefined' && window.ethereum) {
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts && accounts.length > 0) {
                        setAccount(accounts[0]);
                        console.log('DAL: Connected via MetaMask:', accounts[0]);
                    }
                }
            }
            catch (err) {
                console.error('DAL: Auth check failed:', err);
                setError(err.message);
            }
            finally {
                setIsLoading(false);
            }
        };
        checkAuth();
        // Listen for account changes
        if (typeof window !== 'undefined' && window.ethereum) {
            const handleAccountsChanged = (accounts) => {
                console.log('DAL: Account changed:', accounts);
                if (accounts && accounts.length > 0) {
                    setAccount(accounts[0]);
                }
                else {
                    setAccount(null);
                }
            };
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            return () => {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            };
        }
    }, []);
    const connect = async () => {
        try {
            setError(null);
            if (typeof window !== 'undefined' && window.ethereum) {
                const accounts = await window.ethereum.request({
                    method: 'eth_requestAccounts'
                });
                if (accounts && accounts.length > 0) {
                    setAccount(accounts[0]);
                }
            }
        }
        catch (err) {
            console.error('DAL: Connect failed:', err);
            setError(err.message);
        }
    };
    const disconnect = () => {
        setAccount(null);
    };
    return {
        account,
        isConnected: !!account,
        connect,
        disconnect,
        isLoading,
        error
    };
};
// Hook to replicate useFactoryRegistry functionality
const useFactoryRegistry = () => {
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    // Get a single factory address by name (exactly like DVRE)
    const getFactoryAddress = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (factoryName) => {
        if (!factoryName) {
            setError("Factory name is required");
            return null;
        }
        setLoading(true);
        setError(null);
        try {
            const { ethers } = await Promise.resolve(/*! import() */).then(__webpack_require__.t.bind(__webpack_require__, /*! ethers */ "webpack/sharing/consume/default/ethers/ethers", 23));
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const registryContract = new ethers.Contract(FACTORY_REGISTRY_ADDRESS, _abis_FactoryRegistry_json__WEBPACK_IMPORTED_MODULE_3__.abi, provider);
            const address = await registryContract.get(factoryName);
            // Check if address is zero address (not found)
            if (address === "0x0000000000000000000000000000000000000000") {
                setError(`Factory "${factoryName}" not found in registry`);
                return null;
            }
            setLoading(false);
            return address;
        }
        catch (err) {
            setError(`Failed to get factory address: ${err.message}`);
            setLoading(false);
            return null;
        }
    }, []);
    // Convenience method to get factory contract instance (exactly like DVRE)
    const getFactoryContract = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (factoryName, abi, signer) => {
        const address = await getFactoryAddress(factoryName);
        if (!address)
            return null;
        const { ethers } = await Promise.resolve(/*! import() */).then(__webpack_require__.t.bind(__webpack_require__, /*! ethers */ "webpack/sharing/consume/default/ethers/ethers", 23));
        const provider = signer || new ethers.JsonRpcProvider(RPC_URL);
        return new ethers.Contract(address, abi, provider);
    }, [getFactoryAddress]);
    return {
        loading,
        error,
        getFactoryAddress,
        getFactoryContract,
        clearError: () => setError(null)
    };
};
// Hook to replicate useProjects functionality
const useDVREProjects = () => {
    const [projects, setProjects] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [userProjects, setUserProjects] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const { getFactoryContract } = useFactoryRegistry();
    const { account } = useDVREAuth();
    const getProvider = () => {
        const { ethers } = __webpack_require__(/*! ethers */ "webpack/sharing/consume/default/ethers/ethers");
        return new ethers.JsonRpcProvider(RPC_URL);
    };
    // Get detailed project information (exactly like DVRE's implementation)
    const getProjectInfo = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (projectAddress) => {
        try {
            const provider = getProvider();
            const { ethers } = await Promise.resolve(/*! import() */).then(__webpack_require__.t.bind(__webpack_require__, /*! ethers */ "webpack/sharing/consume/default/ethers/ethers", 23));
            const projectContract = new ethers.Contract(projectAddress, _abis_JSONProject_json__WEBPACK_IMPORTED_MODULE_2__.abi, provider);
            // First, validate that this is a valid contract by checking if it has code
            const code = await provider.getCode(projectAddress);
            if (code === '0x') {
                console.warn(`DAL: No contract code at address ${projectAddress}`);
                return null;
            }
            // Try to call a simple read function first to validate the contract
            try {
                await projectContract.creator();
            }
            catch (err) {
                console.warn(`DAL: Address ${projectAddress} is not a valid JSONProject contract:`, err);
                return null;
            }
            const projectDataString = await projectContract.getProjectData();
            let projectData;
            try {
                projectData = JSON.parse(projectDataString);
            }
            catch (parseErr) {
                console.error(`DAL: Invalid JSON in project ${projectAddress}:`, parseErr);
                return null;
            }
            // Get project status (returns: active, created, modified, creator)
            const projectStatus = await projectContract.getProjectStatus();
            const projectInfo = {
                creator: projectStatus.projectCreator,
                isActive: projectStatus.active,
                created: Number(projectStatus.created),
                lastModified: Number(projectStatus.modified)
            };
            // Extract participants from project data (address and role)
            const participants = [];
            if (projectData.participants && Array.isArray(projectData.participants)) {
                participants.push(...projectData.participants);
            }
            // Get join requests from contract
            const joinRequests = [];
            try {
                const requesters = await projectContract.getAllRequesters();
                for (const requester of requesters) {
                    const request = await projectContract.getJoinRequest(requester);
                    if (request.exists) {
                        joinRequests.push({
                            requester: request.requester,
                            role: request.role,
                            timestamp: Number(request.timestamp)
                        });
                    }
                }
            }
            catch (err) {
                console.warn('DAL: Failed to get join requests:', err);
            }
            // Find the user's membership (might be owner or regular member)
            const userParticipant = participants.find(p => p.address.toLowerCase() === (account === null || account === void 0 ? void 0 : account.toLowerCase()));
            const isOwner = projectInfo.creator.toLowerCase() === (account === null || account === void 0 ? void 0 : account.toLowerCase());
            const isMember = !!userParticipant || isOwner;
            const hasPendingRequest = joinRequests.some(r => r.requester.toLowerCase() === (account === null || account === void 0 ? void 0 : account.toLowerCase()));
            // Count of participants in the project
            const memberCount = participants.length;
            return {
                address: projectAddress,
                projectId: projectData.project_id || projectData.projectId || 'Unknown',
                objective: projectData.objective || 'No objective specified',
                description: projectData.description,
                creator: projectInfo.creator,
                isActive: projectInfo.isActive,
                created: Number(projectInfo.created),
                lastModified: Number(projectInfo.lastModified),
                participants,
                joinRequests,
                projectData,
                isMember,
                isOwner,
                hasPendingRequest,
                memberCount
            };
        }
        catch (err) {
            console.error(`DAL: Failed to get project info for ${projectAddress}:`, err);
            return null;
        }
    }, [account]);
    // Load all projects (exactly like DVRE's implementation)
    const loadProjects = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
        if (!account)
            return;
        setLoading(true);
        setError(null);
        try {
            const factoryContract = await getFactoryContract("ProjectFactory", _abis_ProjectFactory_json__WEBPACK_IMPORTED_MODULE_1__.abi);
            if (!factoryContract) {
                throw new Error("ProjectFactory not found");
            }
            const projectAddresses = await factoryContract.getAllProjects();
            console.log(`DAL: Found ${projectAddresses.length} total projects`);
            const allProjects = [];
            for (let i = 0; i < projectAddresses.length; i++) {
                try {
                    const projectInfo = await getProjectInfo(projectAddresses[i]);
                    if (projectInfo) {
                        allProjects.push(projectInfo);
                    }
                }
                catch (err) {
                    console.warn(`DAL: Failed to load project at address ${projectAddresses[i]}:`, err);
                }
            }
            // Separate user projects from all projects (exactly like DVRE)
            const userProjectsList = allProjects.filter(p => p.isMember || p.isOwner);
            const availableProjectsList = allProjects.filter(p => !p.isMember && !p.isOwner);
            setUserProjects(userProjectsList);
            setProjects(availableProjectsList);
            setLoading(false);
            console.log(`DAL: Successfully loaded ${userProjectsList.length} user projects out of ${allProjects.length} total`);
        }
        catch (err) {
            setError(`Failed to load projects: ${err.message}`);
            setLoading(false);
        }
    }, [account, getFactoryContract, getProjectInfo]);
    // Initialize data on mount (exactly like DVRE)
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        if (account) {
            loadProjects();
        }
    }, [account, loadProjects]);
    return {
        // State
        projects,
        userProjects,
        loading,
        error,
        // Methods
        loadProjects,
        getProjectInfo,
        // Utility
        clearError: () => setError(null)
    };
};
// Filter projects to get only Active Learning projects
const useActiveLearningProjects = (account) => {
    const { userProjects, loading, error, loadProjects } = useDVREProjects();
    // Use the same filtering approach as Federated Learning
    const alProjects = userProjects.filter(project => { var _a; return ((_a = project.projectData) === null || _a === void 0 ? void 0 : _a.type) === 'active_learning'; });
    console.log('DAL: Total user projects:', userProjects.length, 'AL projects:', alProjects.length);
    if (userProjects.length > 0) {
        console.log('DAL: Project details:', userProjects.map(p => {
            var _a;
            return ({
                objective: p.objective,
                type: (_a = p.projectData) === null || _a === void 0 ? void 0 : _a.type,
                isMember: p.isMember,
                isOwner: p.isOwner
            });
        }));
    }
    return {
        projects: alProjects,
        loading,
        error,
        loadProjects
    };
};


/***/ })

}]);
//# sourceMappingURL=lib_index_js.bc7e13bb06b1c689a666.js.map