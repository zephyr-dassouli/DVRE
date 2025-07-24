import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { dvreROCrateClient } from './DVREROCrateClient';
export const ProjectSetupWizard = ({ projectId, projectData, userWallet, onComplete, onCancel }) => {
    const [currentStep, setCurrentStep] = useState('configuration');
    const [roCrate, setRoCrate] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Configuration state
    const [queryStrategy, setQueryStrategy] = useState('uncertainty_sampling');
    const [labelingBudget, setLabelingBudget] = useState(100);
    const [maxIterations, setMaxIterations] = useState(10);
    // Initialize RO-Crate from DVRE
    const initializeROCrate = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            // Try to get existing DAL RO-Crate from DVRE
            let existingROCrate = await dvreROCrateClient.getDALROCrate(projectId);
            if (existingROCrate) {
                setRoCrate(existingROCrate);
                // Load existing configuration
                if (existingROCrate.alConfig) {
                    setQueryStrategy(existingROCrate.alConfig.queryStrategy);
                    setLabelingBudget(existingROCrate.alConfig.labelingBudget);
                    setMaxIterations(existingROCrate.alConfig.maxIterations);
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
    // Update configuration
    const updateConfiguration = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const alConfig = {
                queryStrategy,
                labelingBudget,
                maxIterations,
                modelConfig: {
                    model_type: 'logistic_regression',
                    parameters: {}
                },
                dataConfig: {
                    trainingDataset: 'default-dataset',
                    features: ['feature1', 'feature2']
                }
            };
            const updatedROCrate = await dvreROCrateClient.updateDALConfiguration(projectId, alConfig);
            if (updatedROCrate) {
                setRoCrate(updatedROCrate);
                console.log('DAL: Configuration updated successfully');
                setCurrentStep('review');
            }
        }
        catch (error) {
            console.error('DAL: Failed to update configuration:', error);
            setError(`Failed to update configuration: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    }, [projectId, queryStrategy, labelingBudget, maxIterations]);
    // Finalize project
    const finalizeProject = useCallback(async () => {
        if (!roCrate)
            return;
        try {
            setLoading(true);
            setError(null);
            console.log('Starting project finalization...');
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
    }, [roCrate, projectId, projectData.address, onComplete]);
    const renderConfigurationStep = () => (_jsxs("div", { style: { padding: '20px' }, children: [_jsx("h3", { children: "Active Learning Configuration" }), _jsxs("div", { style: { marginBottom: '20px' }, children: [_jsx("label", { style: { display: 'block', marginBottom: '5px' }, children: "Query Strategy:" }), _jsxs("select", { value: queryStrategy, onChange: (e) => setQueryStrategy(e.target.value), style: { width: '100%', padding: '8px' }, children: [_jsx("option", { value: "uncertainty_sampling", children: "Uncertainty Sampling" }), _jsx("option", { value: "diversity_sampling", children: "Diversity Sampling" }), _jsx("option", { value: "hybrid", children: "Hybrid Approach" })] })] }), _jsxs("div", { style: { marginBottom: '20px' }, children: [_jsx("label", { style: { display: 'block', marginBottom: '5px' }, children: "Labeling Budget:" }), _jsx("input", { type: "number", min: "1", max: "10000", value: labelingBudget, onChange: (e) => setLabelingBudget(parseInt(e.target.value)), style: { width: '100%', padding: '8px' } }), _jsx("small", { children: "Total number of samples to be labeled" })] }), _jsxs("div", { style: { marginBottom: '20px' }, children: [_jsx("label", { style: { display: 'block', marginBottom: '5px' }, children: "Max Iterations:" }), _jsx("input", { type: "number", min: "1", max: "100", value: maxIterations, onChange: (e) => setMaxIterations(parseInt(e.target.value)), style: { width: '100%', padding: '8px' } }), _jsx("small", { children: "Number of Active Learning rounds" })] }), _jsxs("div", { style: { marginTop: '30px' }, children: [_jsx("button", { onClick: updateConfiguration, disabled: loading, style: {
                            padding: '10px 20px',
                            backgroundColor: '#007acc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            marginRight: '10px'
                        }, children: loading ? 'Updating...' : 'Save Configuration' }), _jsx("button", { onClick: onCancel, style: {
                            padding: '10px 20px',
                            backgroundColor: '#666',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px'
                        }, children: "Cancel" })] })] }));
    const renderReviewStep = () => (_jsxs("div", { style: { padding: '20px' }, children: [_jsx("h3", { children: "Review Configuration" }), roCrate && (_jsxs("div", { style: { marginBottom: '20px' }, children: [_jsx("h4", { children: "Project Details:" }), _jsxs("p", { children: [_jsx("strong", { children: "Project ID:" }), " ", roCrate.projectId] }), _jsxs("p", { children: [_jsx("strong", { children: "Status:" }), " ", roCrate.status] }), _jsx("h4", { children: "Active Learning Configuration:" }), _jsxs("p", { children: [_jsx("strong", { children: "Query Strategy:" }), " ", roCrate.alConfig.queryStrategy] }), _jsxs("p", { children: [_jsx("strong", { children: "Labeling Budget:" }), " ", roCrate.alConfig.labelingBudget] }), _jsxs("p", { children: [_jsx("strong", { children: "Max Iterations:" }), " ", roCrate.alConfig.maxIterations] }), _jsxs("p", { children: [_jsx("strong", { children: "Model Type:" }), " ", roCrate.alConfig.modelConfig.model_type] })] })), _jsxs("div", { style: { marginTop: '30px' }, children: [_jsx("button", { onClick: finalizeProject, disabled: loading, style: {
                            padding: '10px 20px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            marginRight: '10px'
                        }, children: loading ? 'Finalizing...' : 'Finalize Project' }), _jsx("button", { onClick: () => setCurrentStep('configuration'), style: {
                            padding: '10px 20px',
                            backgroundColor: '#007acc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            marginRight: '10px'
                        }, children: "Back to Configuration" }), _jsx("button", { onClick: onCancel, style: {
                            padding: '10px 20px',
                            backgroundColor: '#666',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px'
                        }, children: "Cancel" })] })] }));
    if (loading && !roCrate) {
        return (_jsx("div", { style: { padding: '20px', textAlign: 'center' }, children: _jsx("div", { children: "Loading project configuration..." }) }));
    }
    return (_jsxs("div", { style: {
            fontFamily: 'var(--jp-ui-font-family)',
            background: 'var(--jp-layout-color1)',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '4px',
            maxWidth: '600px',
            margin: '20px auto'
        }, children: [_jsxs("div", { style: {
                    padding: '10px 20px',
                    borderBottom: '1px solid var(--jp-border-color1)',
                    background: 'var(--jp-layout-color2)'
                }, children: [_jsx("h2", { children: "DAL Project Setup" }), _jsxs("div", { children: ["Step: ", currentStep === 'configuration' ? '1. Configuration' : '2. Review'] })] }), error && (_jsx("div", { style: {
                    padding: '10px',
                    margin: '10px',
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                    border: '1px solid #ffcdd2',
                    borderRadius: '4px'
                }, children: error })), currentStep === 'configuration' && renderConfigurationStep(), currentStep === 'review' && renderReviewStep()] }));
};
//# sourceMappingURL=ProjectSetupWizardSimple.js.map