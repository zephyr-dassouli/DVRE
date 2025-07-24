import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { dvreROCrateClient } from './DVREROCrateClient';
import { cwlManager } from './CWLManager';
export const ProjectSetupWizard = ({ projectId, projectData, userWallet, onComplete, onCancel }) => {
    const [currentStep, setCurrentStep] = useState('datasets');
    const [roCrate, setRoCrate] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Step-specific state
    const [datasetConfigs, setDatasetConfigs] = useState([]);
    const [modelConfig, setModelConfig] = useState({
        name: '',
        algorithm: 'logistic_regression',
        parameters: {}
    });
    const [workflowConfig, setWorkflowConfig] = useState({
        name: '',
        description: '',
        useTemplate: true
    });
    const [alConfig, setALConfig] = useState({
        queryStrategy: 'uncertainty_sampling',
        labelingBudget: 100,
        maxIterations: 10
    });
    // Initialize RO-Crate from DVRE
    const initializeROCrate = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            // Try to get existing DAL RO-Crate from DVRE
            let existingROCrate = await dvreROCrateClient.getDALROCrate(projectId);
            if (existingROCrate) {
                // Load existing configuration into the wizard
                setRoCrate(existingROCrate);
                // Populate form fields from existing RO-Crate
                if (existingROCrate.alConfig) {
                    setALConfig(existingROCrate.alConfig);
                }
                if (existingROCrate.datasets && existingROCrate.datasets.length > 0) {
                    const configs = existingROCrate.datasets.map(dataset => ({
                        name: dataset.name,
                        description: dataset.description || '',
                        ipfsHash: dataset.ipfsHash,
                        columns: (dataset.columns || []).map(col => ({
                            name: col.name,
                            dataType: col.dataType,
                            description: col.description || '' // Ensure description is always a string
                        }))
                    }));
                    setDatasetConfigs(configs);
                }
                if (existingROCrate.workflow) {
                    setWorkflowConfig({
                        name: existingROCrate.workflow.name,
                        description: existingROCrate.workflow.description || '',
                        customCWL: existingROCrate.workflow.cwlContent,
                        useTemplate: !existingROCrate.workflow.cwlContent
                    });
                }
                console.log('DAL: Loaded existing RO-Crate configuration');
            }
            else {
                // Initialize new DAL configuration in DVRE
                existingROCrate = await dvreROCrateClient.updateDALConfiguration(projectId, {
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
                });
                if (existingROCrate) {
                    setRoCrate(existingROCrate);
                    console.log('DAL: Initialized new RO-Crate configuration');
                }
            }
        }
        catch (error) {
            console.error('DAL: Failed to initialize RO-Crate:', error);
            setError('Failed to load project configuration');
        }
        finally {
            setLoading(false);
        }
    }, [projectId]);
    // Initialize on component mount
    useEffect(() => {
        initializeROCrate();
    }, [initializeROCrate]);
    const updateROCrate = useCallback(async (updater) => {
        if (roCrate) {
            try {
                setLoading(true);
                setError(null);
                const updated = await updater(roCrate);
                setRoCrate(updated);
                // Note: The updater should handle the DVRE API calls directly
                console.log('DAL: RO-Crate updated successfully');
            }
            catch (error) {
                console.error('DAL: Failed to update RO-Crate:', error);
                setError(`Failed to update project configuration: ${error.message}`);
            }
            finally {
                setLoading(false);
            }
        }
    }, [roCrate, projectId]);
    // Handle dataset upload (simplified version)
    const handleDatasetUpload = useCallback(async (file, type) => {
        if (!roCrate)
            return;
        try {
            setLoading(true);
            setError(null);
            // Simulate IPFS upload (replace with actual IPFS upload in production)
            const mockIpfsHash = `Qm${Math.random().toString(36).substr(2, 44)}`;
            const mockUrl = `https://ipfs.io/ipfs/${mockIpfsHash}`;
            const datasetInfo = {
                name: file.name,
                description: type === 'training' ? 'Training dataset' : 'Labeling dataset',
                type: type,
                format: 'csv',
                url: mockUrl,
                ipfsHash: mockIpfsHash,
                size: file.size,
                columns: [] // Will be populated when file is processed
            };
            // Add dataset using DVRE client
            const updatedROCrate = await dvreROCrateClient.addDataset(projectId, datasetInfo);
            if (updatedROCrate) {
                setRoCrate(updatedROCrate);
                console.log(`DAL: ${type} dataset uploaded successfully`);
            }
        }
        catch (error) {
            console.error('DAL: Dataset upload failed:', error);
            setError(`Failed to upload ${type} dataset: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    }, [roCrate, projectId]);
    // Generate workflow (simplified version)
    const generateWorkflow = useCallback(async () => {
        if (!roCrate)
            return;
        try {
            setLoading(true);
            setError(null);
            const cwlWorkflow = cwlManager.createALTemplate(projectId, workflowConfig.name || 'DAL Workflow', alConfig);
            const workflowInfo = {
                name: workflowConfig.name || 'DAL Workflow',
                description: workflowConfig.description || 'Generated Active Learning workflow',
                programmingLanguage: 'cwl',
                steps: ['train', 'query', 'label', 'evaluate'],
                cwlContent: workflowConfig.customCWL || cwlWorkflow.content,
                inputs: cwlWorkflow.inputs,
                outputs: cwlWorkflow.outputs
            };
            // Add workflow using DVRE client
            const updatedROCrate = await dvreROCrateClient.addWorkflow(projectId, workflowInfo);
            if (updatedROCrate) {
                setRoCrate(updatedROCrate);
                console.log('DAL: Workflow generated successfully');
            }
            // Also add model configuration
            const modelInfo = {
                name: modelConfig.name || 'DAL Model',
                algorithm: modelConfig.algorithm,
                parameters: modelConfig.parameters
            };
            const finalROCrate = await dvreROCrateClient.addModel(projectId, modelInfo);
            if (finalROCrate) {
                setRoCrate(finalROCrate);
                console.log('DAL: Model configuration added successfully');
            }
        }
        catch (error) {
            console.error('DAL: Workflow generation failed:', error);
            setError(`Failed to generate workflow: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    }, [roCrate, projectId, workflowConfig, alConfig, modelConfig]);
    // Finalize project (simplified version using DVRE finalization)
    const finalizeProject = useCallback(async () => {
        if (!roCrate)
            return;
        try {
            setLoading(true);
            setError(null);
            console.log('Starting project finalization...');
            // Update AL configuration first
            await dvreROCrateClient.updateDALConfiguration(projectId, alConfig);
            // Use DVRE's finalization process
            const finalizationResult = await dvreROCrateClient.finalizeProject(projectId, projectData.address);
            console.log('Project finalized successfully:', finalizationResult);
            if (finalizationResult.success) {
                // Update local state
                const finalizedROCrate = await dvreROCrateClient.getDALROCrate(projectId);
                if (finalizedROCrate) {
                    setRoCrate(finalizedROCrate);
                    onComplete(finalizedROCrate);
                }
            }
        }
        catch (error) {
            console.error('DAL: Project finalization failed:', error);
            setError(`Project finalization failed: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    }, [roCrate, projectId, projectData.address, alConfig, onComplete]);
    const renderDatasetsStep = () => {
        var _a, _b, _c, _d;
        return (_jsxs("div", { className: "setup-step", children: [_jsx("h3", { children: "Project Datasets" }), _jsx("p", { children: "Upload or link your training and labeling datasets for the Active Learning project." }), _jsxs("div", { className: "dataset-section", children: [_jsx("h4", { children: "Training Dataset" }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Dataset Name:" }), _jsx("input", { type: "text", value: ((_a = datasetConfigs[0]) === null || _a === void 0 ? void 0 : _a.name) || '', onChange: (e) => setDatasetConfigs(prev => prev.map((ds, index) => index === 0 ? { ...ds, name: e.target.value } : ds)), placeholder: "e.g., Medical Images Training Set" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Description:" }), _jsx("textarea", { value: ((_b = datasetConfigs[0]) === null || _b === void 0 ? void 0 : _b.description) || '', onChange: (e) => setDatasetConfigs(prev => prev.map((ds, index) => index === 0 ? { ...ds, description: e.target.value } : ds)), placeholder: "Describe your training dataset...", rows: 3 })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Upload Dataset File:" }), _jsx("input", { type: "file", accept: ".csv,.json,.tsv", onChange: (e) => {
                                        var _a;
                                        const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                                        if (file)
                                            handleDatasetUpload(file, 'training');
                                    } })] }), (roCrate === null || roCrate === void 0 ? void 0 : roCrate.datasets.training) && (_jsxs("div", { className: "dataset-preview", children: ["\u2713 Training dataset configured: ", roCrate.datasets.training.name] }))] }), _jsxs("div", { className: "dataset-section", children: [_jsx("h4", { children: "Labeling Dataset (Optional)" }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Dataset Name:" }), _jsx("input", { type: "text", value: ((_c = datasetConfigs[1]) === null || _c === void 0 ? void 0 : _c.name) || '', onChange: (e) => setDatasetConfigs(prev => prev.map((ds, index) => index === 1 ? { ...ds, name: e.target.value } : ds)), placeholder: "e.g., Unlabeled Samples for Annotation" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Description:" }), _jsx("textarea", { value: ((_d = datasetConfigs[1]) === null || _d === void 0 ? void 0 : _d.description) || '', onChange: (e) => setDatasetConfigs(prev => prev.map((ds, index) => index === 1 ? { ...ds, description: e.target.value } : ds)), placeholder: "Describe your labeling dataset...", rows: 3 })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Upload Dataset File:" }), _jsx("input", { type: "file", accept: ".csv,.json,.tsv", onChange: (e) => {
                                        var _a;
                                        const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                                        if (file)
                                            handleDatasetUpload(file, 'labeling');
                                    } })] }), (roCrate === null || roCrate === void 0 ? void 0 : roCrate.datasets.labeling) && (_jsxs("div", { className: "dataset-preview", children: ["\u2713 Labeling dataset configured: ", roCrate.datasets.labeling.name] }))] })] }));
    };
    const renderModelStep = () => {
        var _a;
        return (_jsxs("div", { className: "setup-step", children: [_jsx("h3", { children: "Model Configuration" }), _jsx("p", { children: "Configure the machine learning model for your Active Learning project." }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Model Name:" }), _jsx("input", { type: "text", value: modelConfig.name, onChange: (e) => setModelConfig(prev => ({ ...prev, name: e.target.value })), placeholder: "e.g., Medical Image Classifier" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Algorithm:" }), _jsxs("select", { value: modelConfig.algorithm, onChange: (e) => setModelConfig(prev => ({
                                ...prev,
                                algorithm: e.target.value
                            })), children: [_jsx("option", { value: "neural_network", children: "Neural Network" }), _jsx("option", { value: "logistic_regression", children: "Logistic Regression" }), _jsx("option", { value: "random_forest", children: "Random Forest" }), _jsx("option", { value: "svm", children: "Support Vector Machine" })] })] }), modelConfig.algorithm === 'neural_network' && (_jsxs("div", { className: "neural-network-config", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Hidden Layers (comma-separated):" }), _jsx("input", { type: "text", value: ((_a = modelConfig.parameters.layers) === null || _a === void 0 ? void 0 : _a.join(', ')) || '64, 32', onChange: (e) => {
                                        const layers = e.target.value.split(',').map(l => parseInt(l.trim())).filter(l => !isNaN(l));
                                        setModelConfig(prev => ({
                                            ...prev,
                                            parameters: { ...prev.parameters, layers }
                                        }));
                                    }, placeholder: "64, 32, 16" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Learning Rate:" }), _jsx("input", { type: "number", step: "0.0001", min: "0.0001", max: "1", value: modelConfig.parameters.learning_rate || 0.001, onChange: (e) => setModelConfig(prev => ({
                                        ...prev,
                                        parameters: { ...prev.parameters, learning_rate: parseFloat(e.target.value) }
                                    })) })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Batch Size:" }), _jsx("input", { type: "number", min: "1", max: "512", value: modelConfig.parameters.batch_size || 32, onChange: (e) => setModelConfig(prev => ({
                                        ...prev,
                                        parameters: { ...prev.parameters, batch_size: parseInt(e.target.value) }
                                    })) })] })] })), _jsxs("div", { className: "model-preview", children: [_jsx("h4", { children: "Model Summary:" }), _jsxs("div", { className: "model-details", children: [_jsxs("div", { children: [_jsx("strong", { children: "Algorithm:" }), " ", modelConfig.algorithm.replace('_', ' ').toUpperCase()] }), _jsxs("div", { children: [_jsx("strong", { children: "Parameters:" }), " ", JSON.stringify(modelConfig.parameters, null, 2)] })] })] })] }));
    };
    const renderWorkflowStep = () => (_jsxs("div", { className: "setup-step", children: [_jsx("h3", { children: "Workflow Configuration" }), _jsx("p", { children: "Configure the CWL workflow that will orchestrate your Active Learning process." }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Workflow Name:" }), _jsx("input", { type: "text", value: workflowConfig.name, onChange: (e) => setWorkflowConfig(prev => ({ ...prev, name: e.target.value })), placeholder: "e.g., Medical Image Active Learning Workflow" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Description:" }), _jsx("textarea", { value: workflowConfig.description, onChange: (e) => setWorkflowConfig(prev => ({ ...prev, description: e.target.value })), placeholder: "Describe your workflow...", rows: 3 })] }), _jsxs("div", { className: "form-group", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: workflowConfig.useTemplate, onChange: (e) => setWorkflowConfig(prev => ({ ...prev, useTemplate: e.target.checked })) }), "Use DAL Template Workflow"] }), _jsx("small", { children: "Generate a CWL workflow automatically based on your configuration" })] }), !workflowConfig.useTemplate && (_jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Custom CWL Workflow:" }), _jsx("textarea", { value: workflowConfig.customCWL || '', onChange: (e) => setWorkflowConfig(prev => ({ ...prev, customCWL: e.target.value })), placeholder: "Paste your CWL workflow definition here...", rows: 15, className: "cwl-editor" })] })), workflowConfig.useTemplate && (_jsxs("div", { className: "workflow-preview", children: [_jsx("h4", { children: "Generated Workflow Will Include:" }), _jsxs("ul", { children: [_jsx("li", { children: "Data preprocessing and validation" }), _jsx("li", { children: "Initial model training on labeled data" }), _jsx("li", { children: "Uncertainty-based sample selection" }), _jsx("li", { children: "Collaborative labeling interface" }), _jsx("li", { children: "Model retraining with new labels" }), _jsx("li", { children: "Performance evaluation and reporting" })] })] }))] }));
    const renderConfigurationStep = () => (_jsxs("div", { className: "setup-step", children: [_jsx("h3", { children: "Active Learning Configuration" }), _jsx("p", { children: "Configure the Active Learning parameters for your collaborative project." }), _jsxs("div", { className: "config-grid", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Query Strategy:" }), _jsxs("select", { value: alConfig.queryStrategy, onChange: (e) => setALConfig(prev => ({ ...prev, queryStrategy: e.target.value })), children: [_jsx("option", { value: "uncertainty_sampling", children: "Uncertainty Sampling" }), _jsx("option", { value: "diversity_sampling", children: "Diversity Sampling" }), _jsx("option", { value: "query_by_committee", children: "Query by Committee" }), _jsx("option", { value: "expected_model_change", children: "Expected Model Change" }), _jsx("option", { value: "random_sampling", children: "Random Sampling" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Labeling Budget:" }), _jsx("input", { type: "number", min: "10", max: "10000", value: alConfig.labelingBudget, onChange: (e) => setALConfig(prev => ({ ...prev, labelingBudget: parseInt(e.target.value) })) }), _jsx("small", { children: "Total number of samples to be labeled" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Max Iterations:" }), _jsx("input", { type: "number", min: "1", max: "100", value: alConfig.maxIterations, onChange: (e) => setALConfig(prev => ({ ...prev, maxIterations: parseInt(e.target.value) })) }), _jsx("small", { children: "Number of Active Learning rounds" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Validation Split:" }), _jsx("input", { type: "number", min: "0.1", max: "0.5", step: "0.05", value: alConfig.validationSplit, onChange: (e) => setALConfig(prev => ({ ...prev, validationSplit: parseFloat(e.target.value) })) }), _jsx("small", { children: "Fraction of data used for validation" })] })] }), _jsxs("div", { className: "form-group", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: alConfig.isFederated, onChange: (e) => setALConfig(prev => ({ ...prev, isFederated: e.target.checked })) }), "Enable Federated Learning"] }), _jsx("small", { children: "Allow distributed training across multiple nodes" })] }), _jsxs("div", { className: "al-summary", children: [_jsx("h4", { children: "Active Learning Summary:" }), _jsxs("div", { className: "summary-grid", children: [_jsxs("div", { children: ["Strategy: ", alConfig.queryStrategy.replace('_', ' ')] }), _jsxs("div", { children: ["Budget: ", alConfig.labelingBudget, " samples"] }), _jsxs("div", { children: ["Rounds: ", alConfig.maxIterations] }), _jsxs("div", { children: ["Federated: ", alConfig.isFederated ? 'Yes' : 'No'] })] })] })] }));
    const renderReviewStep = () => {
        const preview = roCrate ? dvreROCrateClient.generatePreview(roCrate) : null;
        const validation = roCrate ? dvreROCrateClient.validateROCrate(roCrate) : null;
        return (_jsxs("div", { className: "setup-step", children: [_jsx("h3", { children: "Review & Finalize" }), _jsx("p", { children: "Review your project configuration before finalizing the setup." }), preview && (_jsxs("div", { className: "project-summary", children: [_jsx("h4", { children: "Project Overview:" }), _jsxs("div", { className: "summary-grid", children: [_jsxs("div", { children: [_jsx("strong", { children: "Title:" }), " ", preview.title] }), _jsxs("div", { children: [_jsx("strong", { children: "Description:" }), " ", preview.description] }), _jsxs("div", { children: [_jsx("strong", { children: "Status:" }), " ", preview.status] }), _jsxs("div", { children: [_jsx("strong", { children: "Participants:" }), " ", preview.participants] }), _jsxs("div", { children: [_jsx("strong", { children: "Datasets:" }), " ", preview.datasets] }), _jsxs("div", { children: [_jsx("strong", { children: "Workflow:" }), " ", preview.hasWorkflow ? 'Configured' : 'Not configured'] })] })] })), validation && (_jsxs("div", { className: `validation-result ${validation.valid ? 'valid' : 'invalid'}`, children: [_jsx("h4", { children: "Validation Status:" }), validation.valid ? (_jsx("div", { className: "validation-success", children: "\u2713 Project configuration is valid and ready for deployment" })) : (_jsxs("div", { className: "validation-errors", children: [_jsx("h5", { children: "Errors to fix:" }), _jsx("ul", { children: validation.errors.map((error, index) => (_jsx("li", { children: error }, index))) })] })), validation.warnings.length > 0 && (_jsxs("div", { className: "validation-warnings", children: [_jsx("h5", { children: "Warnings:" }), _jsx("ul", { children: validation.warnings.map((warning, index) => (_jsx("li", { children: warning }, index))) })] }))] })), roCrate && (_jsxs("div", { className: "rocrate-export", children: [_jsx("h4", { children: "RO-Crate Metadata:" }), _jsx("button", { onClick: () => {
                                const metadata = dvreROCrateClient.exportMetadata(roCrate);
                                const blob = new Blob([metadata], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${projectId}-ro-crate-metadata.json`;
                                a.click();
                            }, className: "export-button", children: "Download RO-Crate Metadata" })] })), _jsxs("div", { className: "finalization-info", children: [_jsx("h4", { children: "What happens when you finalize:" }), _jsxs("div", { className: "finalization-steps", children: [_jsxs("div", { className: "fin-step", children: [_jsx("span", { className: "step-icon", children: "1" }), _jsxs("div", { children: [_jsx("strong", { children: "Validate Configuration" }), _jsx("p", { children: "Ensures all required fields are complete and valid" })] })] }), _jsxs("div", { className: "fin-step", children: [_jsx("span", { className: "step-icon", children: "2" }), _jsxs("div", { children: [_jsx("strong", { children: "Upload to IPFS" }), _jsx("p", { children: "Stores RO-Crate metadata and workflow on decentralized storage" })] })] }), _jsxs("div", { className: "fin-step", children: [_jsx("span", { className: "step-icon", children: "3" }), _jsxs("div", { children: [_jsx("strong", { children: "Submit to Orchestrator" }), _jsx("p", { children: "Registers workflow with the execution engine for Active Learning" })] })] }), _jsxs("div", { className: "fin-step", children: [_jsx("span", { className: "step-icon", children: "4" }), _jsxs("div", { children: [_jsx("strong", { children: "Update Smart Contract" }), _jsx("p", { children: "Records IPFS hashes and project status on blockchain" })] })] })] })] })] }));
    };
    const getStepIndex = (step) => {
        const steps = ['datasets', 'model', 'workflow', 'configuration', 'review'];
        return steps.indexOf(step);
    };
    const canProceed = () => {
        switch (currentStep) {
            case 'datasets':
                return !!(roCrate === null || roCrate === void 0 ? void 0 : roCrate.datasets.training);
            case 'model':
                return !!(modelConfig.name && modelConfig.algorithm);
            case 'workflow':
                return !!(workflowConfig.name && (workflowConfig.useTemplate || workflowConfig.customCWL));
            case 'configuration':
                return alConfig.labelingBudget > 0 && alConfig.maxIterations > 0;
            case 'review':
                return !!roCrate && dvreROCrateClient.validateROCrate(roCrate).valid;
            default:
                return false;
        }
    };
    const handleNext = () => {
        const steps = ['datasets', 'model', 'workflow', 'configuration', 'review'];
        const currentIndex = getStepIndex(currentStep);
        if (currentStep === 'workflow' && workflowConfig.useTemplate) {
            generateWorkflow();
        }
        if (currentIndex < steps.length - 1) {
            setCurrentStep(steps[currentIndex + 1]);
        }
    };
    const handlePrevious = () => {
        const steps = ['datasets', 'model', 'workflow', 'configuration', 'review'];
        const currentIndex = getStepIndex(currentStep);
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1]);
        }
    };
    if (!roCrate) {
        return (_jsx("div", { className: "setup-wizard loading", children: _jsxs("div", { className: "loading-indicator", children: [_jsx("div", { className: "spinner" }), _jsx("span", { children: "Initializing project setup..." })] }) }));
    }
    return (_jsxs("div", { className: "setup-wizard", children: [_jsxs("div", { className: "wizard-header", children: [_jsx("h2", { children: "DAL Project Setup" }), _jsx("div", { className: "step-indicator", children: ['datasets', 'model', 'workflow', 'configuration', 'review'].map((step, index) => (_jsxs("div", { className: `step ${currentStep === step ? 'active' : ''} ${getStepIndex(currentStep) > index ? 'completed' : ''}`, children: [_jsx("div", { className: "step-number", children: index + 1 }), _jsx("div", { className: "step-label", children: step.charAt(0).toUpperCase() + step.slice(1) })] }, step))) })] }), error && (_jsxs("div", { className: "error-message", children: [error, _jsx("button", { onClick: () => setError(null), children: "\u00D7" })] })), _jsxs("div", { className: "wizard-content", children: [currentStep === 'datasets' && renderDatasetsStep(), currentStep === 'model' && renderModelStep(), currentStep === 'workflow' && renderWorkflowStep(), currentStep === 'configuration' && renderConfigurationStep(), currentStep === 'review' && renderReviewStep()] }), _jsxs("div", { className: "wizard-footer", children: [_jsx("button", { onClick: onCancel, className: "cancel-button", disabled: loading, children: "Cancel" }), _jsxs("div", { className: "navigation-buttons", children: [_jsx("button", { onClick: handlePrevious, disabled: getStepIndex(currentStep) === 0 || loading, className: "nav-button previous", children: "Previous" }), currentStep === 'review' ? (_jsx("button", { onClick: finalizeProject, disabled: !canProceed() || loading, className: "finalize-button", children: loading ? 'Finalizing Project...' : 'Finalize & Upload to IPFS' })) : (_jsx("button", { onClick: handleNext, disabled: !canProceed() || loading, className: "nav-button next", children: "Next" }))] })] })] }));
};
//# sourceMappingURL=ProjectSetupWizard.js.map