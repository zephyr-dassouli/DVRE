"use strict";
(self["webpackChunkdal"] = self["webpackChunkdal"] || []).push([["lib_index_js"],{

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
const CWLWorkflowEditor = ({ projectId, projectTitle, onClose, onWorkflowDeployed }) => {
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
        if (!cwlWorkflow)
            return;
        try {
            setIsDeploying(true);
            setDeploymentError(null);
            // Finalize CWL locally
            const success = _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.finalizeCWL(projectId);
            if (!success)
                throw new Error('Failed to finalize CWL');
            // Create submission data
            const submissionData = _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_3__.orchestrationAPI.createSubmissionData(projectId, projectTitle, cwlWorkflow, alConfig, {}, // additional inputs
            (metadata === null || metadata === void 0 ? void 0 : metadata.creator) || 'anonymous');
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
    }, [cwlWorkflow, projectId, projectTitle, alConfig, metadata, onWorkflowDeployed]);
    if (readOnly) {
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "cwl-workflow-editor read-only", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "editor-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h2", { children: "CWL Workflow - Read Only" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Only the project creator can edit the CWL workflow" }), onClose && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: onClose, className: "close-button", children: "Close" }))] }), cwlWorkflow && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(CWLCodeEditor, { cwl: cwlWorkflow, onChange: () => { }, disabled: true }))] }));
    }
    const canDeploy = cwlWorkflow && _CWLManager__WEBPACK_IMPORTED_MODULE_2__.cwlManager.validateCWL(cwlWorkflow) && deploymentStatus !== 'deployed';
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "cwl-workflow-editor", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "editor-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("h2", { children: ["CWL Workflow Editor - ", projectTitle] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(AutoSaveIndicator, { lastSaved: lastAutoSave, isAutoSaving: isAutoSaving }), onClose && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: onClose, className: "close-button", children: "Close" }))] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "editor-content", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "left-panel", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(ALConfigurationPanel, { config: alConfig, onChange: updateALConfiguration, disabled: deploymentStatus === 'deployed' }), cwlWorkflow && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(WorkflowValidationPanel, { cwl: cwlWorkflow }))] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "right-panel", children: [cwlWorkflow && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(CWLCodeEditor, { cwl: cwlWorkflow, onChange: setCwlWorkflow, disabled: deploymentStatus === 'deployed' })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(DeploymentPanel, { onDeploy: deployWorkflow, status: deploymentStatus, workflowId: workflowId, canDeploy: !!canDeploy, isDeploying: isDeploying, error: deploymentError })] })] })] }));
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






const DALComponent = ({ title = 'Decentralized Active Learning' }) => {
    const [projects, setProjects] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([]);
    const [selectedProject, setSelectedProject] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [isConnected, setIsConnected] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [showCWLEditor, setShowCWLEditor] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [showRuntimePanel, setShowRuntimePanel] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [serverHealthy, setServerHealthy] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    // Simplified auth state - in a real implementation, this would connect to the auth system
    const [account, setAccount] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        // Simulate initial data loading
        loadProjects();
        checkServerHealth();
    }, []);
    const checkServerHealth = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        try {
            const healthy = await _OrchestrationAPI__WEBPACK_IMPORTED_MODULE_5__.orchestrationAPI.checkServerHealth();
            setServerHealthy(healthy);
        }
        catch (error) {
            setServerHealthy(false);
        }
    }, []);
    const loadProjects = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        setLoading(true);
        try {
            // Simulate loading projects from blockchain/backend
            await new Promise(resolve => setTimeout(resolve, 1000));
            const mockProjects = [
                {
                    id: '1',
                    name: 'Medical Image Classification',
                    contractAddress: '0x1234...5678',
                    status: 'active',
                    participants: 5,
                    accuracy: 0.87,
                    currentRound: 3,
                    totalRounds: 10,
                    lastUpdated: new Date(),
                    cwlStatus: _CWLManager__WEBPACK_IMPORTED_MODULE_4__.cwlManager.getStatus('1'),
                    workflowId: localStorage.getItem('project-1-workflow-id') || undefined,
                    phase: localStorage.getItem('project-1-workflow-id') ? 'runtime' : 'configuration'
                },
                {
                    id: '2',
                    name: 'Text Sentiment Analysis',
                    contractAddress: '0xabcd...efgh',
                    status: 'training',
                    participants: 8,
                    accuracy: 0.92,
                    currentRound: 7,
                    totalRounds: 15,
                    lastUpdated: new Date(),
                    cwlStatus: _CWLManager__WEBPACK_IMPORTED_MODULE_4__.cwlManager.getStatus('2'),
                    workflowId: localStorage.getItem('project-2-workflow-id') || undefined,
                    phase: localStorage.getItem('project-2-workflow-id') ? 'runtime' : 'configuration'
                }
            ];
            setProjects(mockProjects);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load projects');
        }
        finally {
            setLoading(false);
        }
    }, []);
    const connectWallet = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        try {
            if (typeof window !== 'undefined' && window.ethereum) {
                setLoading(true);
                // Simulate wallet connection
                await new Promise(resolve => setTimeout(resolve, 500));
                setAccount('0x1234567890abcdef');
                setIsConnected(true);
                // Set user ID for CWL manager
                localStorage.setItem('dvre-user-id', '0x1234567890abcdef');
            }
            else {
                setError('MetaMask not found. Please install MetaMask to continue.');
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect wallet');
        }
        finally {
            setLoading(false);
        }
    }, []);
    const startTraining = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async (projectId) => {
        setLoading(true);
        try {
            // Simulate starting training
            await new Promise(resolve => setTimeout(resolve, 2000));
            setProjects(prev => prev.map(p => p.id === projectId
                ? { ...p, status: 'training' }
                : p));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start training');
        }
        finally {
            setLoading(false);
        }
    }, []);
    // Phase 1: Configuration
    const openCWLEditor = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((project) => {
        setSelectedProject(project);
        setShowCWLEditor(true);
    }, []);
    const closeCWLEditor = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
        setShowCWLEditor(false);
        setSelectedProject(null);
        // Refresh project list to update CWL status
        loadProjects();
    }, [loadProjects]);
    const handleWorkflowDeployed = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((workflowId) => {
        if (selectedProject) {
            // Store workflow ID and update project phase
            localStorage.setItem(`project-${selectedProject.id}-workflow-id`, workflowId);
            // Update project status
            setProjects(prev => prev.map(p => p.id === selectedProject.id
                ? {
                    ...p,
                    cwlStatus: 'deployed',
                    workflowId: workflowId,
                    phase: 'runtime'
                }
                : p));
        }
        // Show success message
        alert(`Workflow deployed successfully! Project ready for runtime orchestration. Workflow ID: ${workflowId}`);
    }, [selectedProject]);
    // Phase 2: Runtime Orchestration
    const openRuntimePanel = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((project) => {
        if (!project.workflowId) {
            setError('No workflow deployed for this project. Please deploy a CWL workflow first.');
            return;
        }
        setSelectedProject(project);
        setShowRuntimePanel(true);
    }, []);
    const closeRuntimePanel = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
        setShowRuntimePanel(false);
        setSelectedProject(null);
        // Refresh project list
        loadProjects();
    }, [loadProjects]);
    const getCWLStatusDisplay = (status) => {
        switch (status) {
            case 'draft': return '📝 Draft';
            case 'finalized': return '✅ Ready';
            case 'deployed': return '🚀 Deployed';
            case 'none':
            default: return '❌ Not configured';
        }
    };
    const getPhaseDisplay = (phase, cwlStatus) => {
        if (phase === 'runtime' && cwlStatus === 'deployed') {
            return '🔄 Phase 2: Runtime';
        }
        else {
            return '⚙️ Phase 1: Configuration';
        }
    };
    if (showCWLEditor && selectedProject) {
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_CWLWorkflowEditor__WEBPACK_IMPORTED_MODULE_2__.CWLWorkflowEditor, { projectId: selectedProject.id, projectTitle: selectedProject.name, onClose: closeCWLEditor, onWorkflowDeployed: handleWorkflowDeployed }));
    }
    if (showRuntimePanel && selectedProject && selectedProject.workflowId) {
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_RuntimeOrchestrationPanel__WEBPACK_IMPORTED_MODULE_3__.RuntimeOrchestrationPanel, { projectId: selectedProject.id, workflowId: selectedProject.workflowId, projectTitle: selectedProject.name, onClose: closeRuntimePanel }));
    }
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "dal-container", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "dal-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h1", { children: title }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "connection-status", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: `status-indicator ${isConnected ? 'connected' : 'disconnected'}`, children: isConnected ? 'Connected' : 'Disconnected' }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: `server-status ${serverHealthy ? 'healthy' : 'unhealthy'}`, children: ["Orchestration Server: ", serverHealthy ? 'Online' : 'Offline'] }), !isConnected && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: connectWallet, className: "connect-button", disabled: loading, children: loading ? 'Connecting...' : 'Connect Wallet' })), account && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "account-info", children: ["Account: ", account.slice(0, 6), "...", account.slice(-4)] }))] })] }), error && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "error-message", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: error }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => setError(null), children: "\u2715" })] })), loading && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "loading-indicator", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "spinner" }), "Loading..."] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "projects-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "section-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h2", { children: "Active Learning Projects" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: loadProjects, className: "refresh-button", disabled: loading, children: "Refresh" })] }), projects.length === 0 ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "empty-state", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "No projects found. Create a new project to get started." }) })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "projects-grid", children: projects.map(project => ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "project-card", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "project-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: project.name }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: `status-badge ${project.status}`, children: project.status })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "project-details", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "detail-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Contract:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("code", { children: project.contractAddress })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "detail-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Participants:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: project.participants })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "detail-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Accuracy:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { children: [(project.accuracy * 100).toFixed(1), "%"] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "detail-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Progress:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { children: [project.currentRound, "/", project.totalRounds, " rounds"] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "detail-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Phase:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "phase-status", children: getPhaseDisplay(project.phase || 'configuration', project.cwlStatus || 'none') })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "detail-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "CWL Workflow:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "cwl-status", children: getCWLStatusDisplay(project.cwlStatus || 'none') })] }), project.workflowId && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "detail-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Workflow ID:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("code", { children: [project.workflowId.slice(0, 8), "..."] })] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "detail-row", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Last Updated:" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: project.lastUpdated.toLocaleDateString() })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "progress-bar", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "progress-fill", style: {
                                            width: `${(project.currentRound / project.totalRounds) * 100}%`
                                        } }) }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "project-actions", children: [(!project.phase || project.phase === 'configuration') && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => openCWLEditor(project), className: "action-button secondary", title: "Phase 1: Configure CWL Workflow", children: "\u2699\uFE0F Configure Workflow" })), project.phase === 'runtime' && project.workflowId && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => openRuntimePanel(project), className: "action-button primary", title: "Phase 2: Runtime Orchestration", children: "\uD83D\uDD04 Runtime Control" })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => startTraining(project.id), disabled: loading || project.status === 'training', className: "action-button secondary", children: project.status === 'training' ? 'Training...' : 'Start Training' })] })] }, project.id))) }))] }), isConnected && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "actions-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h2", { children: "Project Actions" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "action-cards", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "action-card", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Create New Project" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Set up a new active learning project with custom datasets and models." }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "action-button primary", children: "Create Project" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "action-card", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Join Existing Project" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Contribute to an existing federated learning project." }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "action-button secondary", children: "Join Project" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "action-card", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Manage Data" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Upload datasets and manage your contributions." }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "action-button secondary", children: "Manage Data" })] })] })] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "help-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h2", { children: "Two-Phase Active Learning Workflow" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "help-content", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "help-step", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "step-number", children: "1" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "step-content", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h4", { children: "Phase 1: Configuration & Setup" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Configure CWL workflows, deploy smart contracts, set up AL scenarios, and upload resources to IPFS. This phase finalizes all project settings." })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "help-step", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "step-number", children: "2" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "step-content", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h4", { children: "Phase 2: Runtime Orchestration" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Execute active learning sessions with real-time querying, training coordination, voting management, and result aggregation through the AL-engine." })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "help-step", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "step-number", children: "3" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "step-content", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h4", { children: "Interactive Control" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Use runtime controls to start/continue querying, prompt training, submit new labels, and manage the active learning lifecycle." })] })] })] })] })] }));
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
    constructor(baseUrl = 'http://145.100.135.97:8888') {
        this.defaultTimeout = 30000; // 30 seconds
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }
    /**
     * Submit a project workflow to the orchestration server (Phase 1)
     */
    async submitProjectWorkflow(data) {
        const response = await this.makeRequest('/streamflow/submit-project-workflow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
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
            timestamp: new Date().toISOString()
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
            timestamp: new Date().toISOString()
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
            timestamp: new Date().toISOString()
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
            timestamp: new Date().toISOString()
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
            timestamp: new Date().toISOString()
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
     * Check if orchestration server is available
     */
    async checkServerHealth() {
        try {
            const response = await this.makeRequest('/', { timeout: 5000 });
            return response.ok;
        }
        catch (error) {
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
     * Create a workflow submission from CWL and configuration (Phase 1)
     */
    createSubmissionData(projectId, projectTitle, cwlWorkflow, alConfig, inputs = {}, creator = 'anonymous') {
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
                creator: creator,
                project_title: projectTitle,
                al_config: alConfig,
                contributors: alConfig.contributors,
                // Phase 1 metadata
                configuration_phase: 'finalized',
                smart_contract_address: inputs.smart_contract_address,
                ipfs_dataset_hash: inputs.ipfs_dataset_hash,
                ipfs_model_hash: inputs.ipfs_model_hash
            }
        };
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

/***/ "./lib/index.js":
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_application__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/application */ "webpack/sharing/consume/default/@jupyterlab/application");
/* harmony import */ var _jupyterlab_application__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_application__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @jupyterlab/launcher */ "webpack/sharing/consume/default/@jupyterlab/launcher");
/* harmony import */ var _jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @jupyterlab/ui-components */ "webpack/sharing/consume/default/@jupyterlab/ui-components");
/* harmony import */ var _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _DALWidget__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./DALWidget */ "./lib/DALWidget.js");
/* harmony import */ var _style_index_css__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../style/index.css */ "./style/index.css");





// Import CSS

const dalIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_3__.LabIcon({
    name: 'dvre-dal:icon',
    svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v8M4 8h8" stroke="currentColor" stroke-width="1.5"/><path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1" opacity="0.7"/></svg>'
});
/**
 * The command IDs used by the extension.
 */
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.open = 'dvre-dal:open';
})(CommandIDs || (CommandIDs = {}));
/**
 * Initialization data for the jupyter-dvre-dal extension.
 */
const plugin = {
    id: 'jupyter-dvre-dal:plugin',
    description: 'A JupyterLab extension for decentralized active learning.',
    autoStart: true,
    requires: [_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.ICommandPalette],
    optional: [_jupyterlab_launcher__WEBPACK_IMPORTED_MODULE_2__.ILauncher, _jupyterlab_application__WEBPACK_IMPORTED_MODULE_0__.ILabShell],
    activate: (app, palette, launcher) => {
        console.log('DVRE DAL extension is activated!');
        // Register DAL extension with DVRE core if available
        // Try to access the DVRE core extension through the application registry
        const dvreCoreTokenId = '@dvre/core:IExtensionRegistry';
        // Use a more robust method to check for DVRE core
        try {
            // Check if DVRE core is available in app plugins
            const plugins = app._plugins || new Map();
            const dvreCorePlugin = plugins.get('jupyter-dvre:plugin');
            if (dvreCorePlugin) {
                console.log('Found DVRE core plugin, registering DAL extension');
                // Register this extension with the main DVRE extension
                // This would need to be implemented properly with the actual DVRE core API
            }
            else {
                console.log('DVRE core not found, DAL extension running independently');
            }
        }
        catch (error) {
            console.log('Could not register with DVRE core:', error);
            console.log('DAL extension running independently');
        }
        // Register the command
        const command = CommandIDs.open;
        app.commands.addCommand(command, {
            label: 'Open Decentralized Active Learning',
            caption: 'Open the Decentralized Active Learning interface',
            execute: () => {
                // Create a new widget
                const content = new _DALWidget__WEBPACK_IMPORTED_MODULE_4__.DALWidget();
                const widget = new _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_1__.MainAreaWidget({ content });
                widget.title.label = 'Decentralized Active Learning';
                widget.title.icon = dalIcon; // Use the properly defined icon
                // Add the widget to the main area
                if (!widget.isAttached) {
                    app.shell.add(widget, 'main');
                }
                app.shell.activateById(widget.id);
            }
        });
        // Add the command to the command palette
        palette.addItem({ command, category: 'DVRE Extensions' });
        // Add to launcher if available
        if (launcher) {
            launcher.add({
                command,
                category: 'DVRE Extensions',
                rank: 1
            });
        }
        console.log('DVRE DAL extension commands registered');
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (plugin);


/***/ })

}]);
//# sourceMappingURL=lib_index_js.8a8da1124d016046f383.js.map