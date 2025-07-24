import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import { cwlManager } from './CWLManager';
import { orchestrationAPI } from './OrchestrationAPI';
import { ContributorManager } from './ContributorManager';
const AutoSaveIndicator = ({ lastSaved, isAutoSaving }) => {
    if (isAutoSaving) {
        return (_jsxs("div", { className: "autosave-indicator saving", children: [_jsx("span", { className: "dot-animation", children: "\u25CF" }), " Auto-saving..."] }));
    }
    if (lastSaved) {
        const timeAgo = new Date(lastSaved).toLocaleTimeString();
        return (_jsxs("div", { className: "autosave-indicator saved", children: ["\u2713 Saved at ", timeAgo] }));
    }
    return null;
};
const ALConfigurationPanel = ({ config, onChange, disabled = false }) => {
    const updateConfig = (updates) => {
        onChange({ ...config, ...updates });
    };
    return (_jsxs("div", { className: "al-config-panel", children: [_jsx("h3", { children: "Active Learning Configuration" }), _jsxs("div", { className: "config-grid", children: [_jsxs("div", { className: "config-group", children: [_jsx("label", { htmlFor: "query-strategy", children: "Query Strategy:" }), _jsxs("select", { id: "query-strategy", value: config.queryStrategy, onChange: (e) => updateConfig({ queryStrategy: e.target.value }), disabled: disabled, children: [_jsx("option", { value: "uncertainty_sampling", children: "Uncertainty Sampling" }), _jsx("option", { value: "diversity_sampling", children: "Diversity Sampling" }), _jsx("option", { value: "query_by_committee", children: "Query by Committee" }), _jsx("option", { value: "expected_model_change", children: "Expected Model Change" }), _jsx("option", { value: "random_sampling", children: "Random Sampling" })] })] }), _jsxs("div", { className: "config-group", children: [_jsx("label", { htmlFor: "labeling-budget", children: "Labeling Budget:" }), _jsx("input", { id: "labeling-budget", type: "number", min: "1", max: "10000", value: config.labelingBudget, onChange: (e) => updateConfig({ labelingBudget: parseInt(e.target.value) || 100 }), disabled: disabled })] }), _jsxs("div", { className: "config-group", children: [_jsx("label", { htmlFor: "max-iterations", children: "Max Iterations:" }), _jsx("input", { id: "max-iterations", type: "number", min: "1", max: "100", value: config.maxIterations, onChange: (e) => updateConfig({ maxIterations: parseInt(e.target.value) || 10 }), disabled: disabled })] }), _jsxs("div", { className: "config-group", children: [_jsx("label", { htmlFor: "validation-split", children: "Validation Split:" }), _jsx("input", { id: "validation-split", type: "number", min: "0.1", max: "0.5", step: "0.05", value: config.validationSplit || 0.2, onChange: (e) => updateConfig({ validationSplit: parseFloat(e.target.value) || 0.2 }), disabled: disabled })] })] }), _jsx("div", { className: "config-group", children: _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: config.isFederated, onChange: (e) => updateConfig({ isFederated: e.target.checked }), disabled: disabled }), "Enable Federated Learning"] }) }), config.isFederated && (_jsxs("div", { className: "config-group", children: [_jsx("label", { htmlFor: "contributors", children: "Contributors (comma-separated):" }), _jsx("input", { id: "contributors", type: "text", value: config.contributors.join(', '), onChange: (e) => updateConfig({
                            contributors: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                        }), placeholder: "alice@example.com, bob@example.com", disabled: disabled })] })), _jsxs("div", { className: "config-group", children: [_jsx("label", { htmlFor: "model-config", children: "Model Configuration (JSON):" }), _jsx("textarea", { id: "model-config", value: JSON.stringify(config.modelConfig, null, 2), onChange: (e) => {
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
    const [jsonText, setJsonText] = useState('');
    const [isValid, setIsValid] = useState(true);
    useEffect(() => {
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
    return (_jsxs("div", { className: "cwl-code-editor", children: [_jsx("h3", { children: "CWL Workflow Definition" }), _jsxs("div", { className: `editor-container ${!isValid ? 'invalid' : ''}`, children: [_jsx("textarea", { value: jsonText, onChange: (e) => handleChange(e.target.value), disabled: disabled, rows: 25, className: "cwl-textarea", spellCheck: false }), !isValid && (_jsx("div", { className: "validation-error", children: "Invalid JSON syntax. Please check your formatting." }))] })] }));
};
const WorkflowValidationPanel = ({ cwl }) => {
    const [validation, setValidation] = useState(null);
    useEffect(() => {
        const isValid = cwlManager.validateCWL(cwl);
        // For now, just basic validation - could be enhanced
        setValidation({
            valid: isValid,
            errors: isValid ? [] : ['CWL validation failed'],
            warnings: []
        });
    }, [cwl]);
    if (!validation)
        return null;
    return (_jsxs("div", { className: "validation-panel", children: [_jsx("h3", { children: "Validation Status" }), _jsxs("div", { className: `validation-status ${validation.valid ? 'valid' : 'invalid'}`, children: [validation.valid ? (_jsx("div", { className: "validation-success", children: "\u2713 Workflow is valid and ready for deployment" })) : (_jsxs("div", { className: "validation-errors", children: [_jsx("h4", { children: "Errors:" }), _jsx("ul", { children: validation.errors.map((error, index) => (_jsx("li", { children: error }, index))) })] })), validation.warnings.length > 0 && (_jsxs("div", { className: "validation-warnings", children: [_jsx("h4", { children: "Warnings:" }), _jsx("ul", { children: validation.warnings.map((warning, index) => (_jsx("li", { children: warning }, index))) })] }))] })] }));
};
const DeploymentPanel = ({ onDeploy, status, workflowId, canDeploy, isDeploying, error }) => {
    return (_jsxs("div", { className: "deployment-panel", children: [_jsx("h3", { children: "Deployment" }), _jsxs("div", { className: "deployment-status", children: [_jsx("span", { className: `status-badge ${status}`, children: status.toUpperCase() }), workflowId && (_jsxs("div", { className: "workflow-id", children: ["Workflow ID: ", _jsx("code", { children: workflowId })] }))] }), error && (_jsxs("div", { className: "deployment-error", children: [_jsx("strong", { children: "Deployment Error:" }), " ", error] })), _jsx("button", { onClick: onDeploy, disabled: !canDeploy || isDeploying, className: `deploy-button ${canDeploy ? 'ready' : 'disabled'}`, children: isDeploying ? 'Deploying...' : 'Deploy Workflow' }), _jsx("div", { className: "deployment-info", children: canDeploy ? (_jsx("p", { children: "Ready to deploy to orchestration server" })) : (_jsx("p", { children: "Fix validation errors before deploying" })) })] }));
};
export const CWLWorkflowEditor = ({ projectId, projectTitle, userWallet, projectData, onClose, onWorkflowDeployed }) => {
    const [cwlWorkflow, setCwlWorkflow] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [readOnly, setReadOnly] = useState(false);
    const [lastAutoSave, setLastAutoSave] = useState(null);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [deploymentStatus, setDeploymentStatus] = useState('draft');
    const [workflowId, setWorkflowId] = useState(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentError, setDeploymentError] = useState(null);
    const [alConfig, setAlConfig] = useState({
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
    const autoSaveTimeoutRef = useRef();
    // Load or create CWL workflow
    useEffect(() => {
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
    useEffect(() => {
        if (cwlWorkflow && !readOnly) {
            // Clear existing timeout
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
            // Set new timeout for auto-save
            autoSaveTimeoutRef.current = setTimeout(() => {
                setIsAutoSaving(true);
                cwlManager.autoSave(projectId, cwlWorkflow);
            }, 2000); // Auto-save after 2 seconds of inactivity
        }
    }, [cwlWorkflow, projectId, readOnly]);
    const loadOrCreateCWL = useCallback(() => {
        try {
            const existingCWL = cwlManager.loadCWL(projectId);
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
    const createFromTemplate = useCallback(() => {
        const template = cwlManager.createALTemplate(projectId, projectTitle, alConfig);
        setCwlWorkflow(template);
        setDeploymentStatus('draft');
        // Save initial template
        cwlManager.saveCWL(projectId, template, {
            projectTitle: projectTitle,
            alConfig: alConfig
        });
    }, [projectId, projectTitle, alConfig]);
    const updateALConfiguration = useCallback((newConfig) => {
        setAlConfig(newConfig);
        if (cwlWorkflow && !readOnly) {
            cwlManager.updateALConfiguration(projectId, newConfig);
            // Update local CWL with new configuration
            const updatedCWL = { ...cwlWorkflow };
            updatedCWL.inputs.query_strategy.default = newConfig.queryStrategy;
            updatedCWL.inputs.model_config.default = JSON.stringify(newConfig.modelConfig);
            updatedCWL.inputs.labeling_budget.default = newConfig.labelingBudget;
            updatedCWL.inputs.max_iterations.default = newConfig.maxIterations;
            setCwlWorkflow(updatedCWL);
        }
    }, [cwlWorkflow, projectId, readOnly]);
    const deployWorkflow = useCallback(async () => {
        if (!cwlWorkflow || !userWallet) {
            setDeploymentError('User authentication required for workflow deployment');
            return;
        }
        try {
            setIsDeploying(true);
            setDeploymentError(null);
            // Finalize CWL locally
            const success = cwlManager.finalizeCWL(projectId);
            if (!success)
                throw new Error('Failed to finalize CWL');
            // Create authenticated submission data with user context
            const submissionData = orchestrationAPI.createAuthenticatedSubmission(projectId, projectTitle, cwlWorkflow, alConfig, userWallet, projectData || {}, // Use project data for role determination
            {} // additional inputs
            );
            // Submit to orchestration server
            const response = await orchestrationAPI.submitProjectWorkflow(submissionData);
            // Update local status
            cwlManager.markAsDeployed(projectId, response.workflow_id);
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
        return (_jsxs("div", { className: "cwl-workflow-editor read-only", children: [_jsxs("div", { className: "editor-header", children: [_jsx("h2", { children: "CWL Workflow - Read Only" }), _jsx("p", { children: "Only the project creator can edit the CWL workflow" }), onClose && (_jsx("button", { onClick: onClose, className: "close-button", children: "Close" }))] }), cwlWorkflow && (_jsx(CWLCodeEditor, { cwl: cwlWorkflow, onChange: () => { }, disabled: true }))] }));
    }
    const canDeploy = cwlWorkflow && cwlManager.validateCWL(cwlWorkflow) && deploymentStatus !== 'deployed';
    return (_jsxs("div", { className: "cwl-workflow-editor", children: [_jsxs("div", { className: "editor-header", children: [_jsxs("h2", { children: ["CWL Workflow Editor - ", projectTitle] }), _jsx(AutoSaveIndicator, { lastSaved: lastAutoSave, isAutoSaving: isAutoSaving }), onClose && (_jsx("button", { onClick: onClose, className: "close-button", children: "Close" }))] }), _jsxs("div", { className: "editor-content", children: [_jsxs("div", { className: "left-panel", children: [_jsx(ALConfigurationPanel, { config: alConfig, onChange: updateALConfiguration, disabled: deploymentStatus === 'deployed' }), userWallet && projectData && (_jsx(ContributorManager, { projectId: projectId, userWallet: userWallet, userRole: orchestrationAPI['getUserRole'] ? orchestrationAPI['getUserRole'](userWallet, projectData) : 'contributor', projectData: projectData, onContributorsChange: (contributors) => {
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
                                } })), cwlWorkflow && (_jsx(WorkflowValidationPanel, { cwl: cwlWorkflow }))] }), _jsxs("div", { className: "right-panel", children: [cwlWorkflow && (_jsx(CWLCodeEditor, { cwl: cwlWorkflow, onChange: setCwlWorkflow, disabled: deploymentStatus === 'deployed' })), _jsx(DeploymentPanel, { onDeploy: deployWorkflow, status: deploymentStatus, workflowId: workflowId, canDeploy: !!canDeploy, isDeploying: isDeploying, error: deploymentError })] })] })] }));
};
//# sourceMappingURL=CWLWorkflowEditor.js.map