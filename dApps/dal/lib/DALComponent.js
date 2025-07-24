import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from 'react';
import { CWLWorkflowEditor } from './CWLWorkflowEditor';
import { RuntimeOrchestrationPanel } from './RuntimeOrchestrationPanel';
import { cwlManager } from './CWLManager';
import { orchestrationAPI } from './OrchestrationAPI';
import { useDVREAuth, useActiveLearningProjects } from './integration/DVREIntegration';
const DALComponent = ({ title = 'Decentralized Active Learning' }) => {
    // Use DVRE integration for authentication
    const { account, isLoading: authLoading, error: authError, connect } = useDVREAuth();
    // Use the integration to get Active Learning projects from DVRE's userProjects
    const { projects: alProjects, loading: projectsLoading, error: projectsError } = useActiveLearningProjects(account);
    const [selectedProject, setSelectedProject] = useState(null);
    const [error, setError] = useState(null);
    const [showCWLEditor, setShowCWLEditor] = useState(false);
    const [showRuntimePanel, setShowRuntimePanel] = useState(false);
    // COMMENTED OUT RO-CRATE: const [showSetupWizard, setShowSetupWizard] = useState(false);
    const [serverHealthy, setServerHealthy] = useState(false);
    // COMMENTED OUT RO-CRATE: const [roCrateData, setROCrateData] = useState<Record<string, DALROCrate>>({});
    // COMMENTED OUT RO-CRATE: const [loadingROCrates, setLoadingROCrates] = useState(false);
    console.log('DAL: Component rendering, auth state:', { account, authLoading, authError });
    console.log('DAL: AL projects from DVRE userProjects:', (alProjects === null || alProjects === void 0 ? void 0 : alProjects.length) || 0);
    // COMMENTED OUT RO-CRATE: Load RO-Crate data for all AL projects
    const loadROCrateData = useCallback(async () => {
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
    useEffect(() => {
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
            cwlStatus: cwlManager.getStatus(project.address),
            phase: 'configuration',
            // dalROCrate: dalROCrate // COMMENTED OUT RO-CRATE Add RO-Crate data to the project
        };
    });
    // Simplified server health check
    const checkServerHealth = useCallback(async () => {
        try {
            const healthy = await orchestrationAPI.checkServerHealth();
            setServerHealthy(healthy);
        }
        catch (error) {
            setServerHealthy(false);
        }
    }, []);
    useEffect(() => {
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
        return (_jsxs("div", { style: {
                padding: '20px',
                fontFamily: 'var(--jp-ui-font-family)',
                background: 'var(--jp-layout-color1)',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
            }, children: [_jsx("div", { style: { marginBottom: '10px' }, children: "Loading authentication..." }), _jsx("div", { style: { fontSize: '12px', color: 'gray' }, children: "DAL Extension v0.1.0" })] }));
    }
    // Authentication required
    if (!account) {
        console.log('DAL: Rendering auth required state');
        return (_jsx("div", { style: {
                padding: '20px',
                fontFamily: 'var(--jp-ui-font-family)',
                background: 'var(--jp-layout-color1)',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }, children: _jsxs("div", { style: {
                    background: 'var(--jp-warn-color3)',
                    border: '1px solid var(--jp-warn-color1)',
                    borderRadius: '4px',
                    padding: '20px',
                    textAlign: 'center',
                    maxWidth: '400px'
                }, children: [_jsx("h3", { style: { color: 'var(--jp-warn-color1)', margin: '0 0 10px 0' }, children: "Authentication Required" }), _jsx("p", { style: { color: 'var(--jp-ui-font-color1)', margin: '0 0 15px 0' }, children: "Please connect your wallet to access Decentralized Active Learning projects." }), authError && (_jsxs("p", { style: { color: 'var(--jp-error-color1)', fontSize: '12px', margin: '0 0 15px 0' }, children: ["Error: ", authError] })), _jsx("button", { onClick: connect, style: {
                            padding: '10px 20px',
                            background: 'var(--jp-brand-color1)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }, children: "Connect Wallet" }), _jsx("div", { style: { fontSize: '12px', color: 'gray', marginTop: '10px' }, children: "DAL Extension v0.1.0" })] }) }));
    }
    // Show CWL Editor
    if (showCWLEditor && selectedProject) {
        // Find the corresponding DVRE project data for authentication
        const correspondingProject = alProjects.find(p => p.address === selectedProject.contractAddress);
        return (_jsx("div", { style: {
                fontFamily: 'var(--jp-ui-font-family)',
                background: 'var(--jp-layout-color1)',
                minHeight: '400px'
            }, children: _jsx(CWLWorkflowEditor, { projectId: selectedProject.contractAddress, projectTitle: selectedProject.name, userWallet: account, projectData: correspondingProject, onClose: handleBackToMain, onWorkflowDeployed: handleWorkflowDeployed }) }));
    }
    // Show Runtime Panel
    if (showRuntimePanel && selectedProject) {
        return (_jsx("div", { style: {
                fontFamily: 'var(--jp-ui-font-family)',
                background: 'var(--jp-layout-color1)',
                minHeight: '400px'
            }, children: _jsx(RuntimeOrchestrationPanel, { projectId: selectedProject.contractAddress, projectTitle: selectedProject.name, workflowId: selectedProject.workflowId, onClose: handleBackToMain }) }));
    }
    // Show Setup Wizard
    if (false && selectedProject) { // COMMENTED OUT RO-CRATE
        return (_jsx("div", { style: {
                fontFamily: 'var(--jp-ui-font-family)',
                background: 'var(--jp-layout-color1)',
                minHeight: '400px'
            } }));
    }
    console.log('DAL: Rendering main interface');
    // Main interface
    return (_jsxs("div", { style: {
            padding: '20px',
            fontFamily: 'var(--jp-ui-font-family)',
            background: 'var(--jp-layout-color1)',
            minHeight: '400px'
        }, children: [_jsxs("div", { style: { marginBottom: '20px' }, children: [_jsx("h1", { children: title }), _jsxs("div", { style: { display: 'flex', gap: '10px', alignItems: 'center' }, children: [_jsxs("div", { style: {
                                    padding: '4px 8px',
                                    background: 'var(--jp-success-color3)',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }, children: ["Connected: ", account.slice(0, 6), "...", account.slice(-4)] }), _jsxs("div", { style: {
                                    padding: '4px 8px',
                                    background: serverHealthy ? 'var(--jp-success-color3)' : 'var(--jp-warn-color3)',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }, children: ["Server: ", serverHealthy ? 'Online' : 'Offline'] })] })] }), (error || projectsError) && (_jsx("div", { style: {
                    background: 'var(--jp-error-color3)',
                    border: '1px solid var(--jp-error-color1)',
                    borderRadius: '4px',
                    padding: '10px',
                    marginBottom: '20px',
                    color: 'var(--jp-error-color1)'
                }, children: error || projectsError })), _jsxs("div", { style: { marginBottom: '30px' }, children: [_jsx("h2", { children: "Active Learning Projects" }), projectsLoading ? (_jsx("div", { children: "Loading projects..." })) : dalProjects.length === 0 ? (_jsxs("div", { style: {
                            background: 'var(--jp-layout-color2)',
                            border: '1px solid var(--jp-border-color1)',
                            borderRadius: '4px',
                            padding: '20px',
                            textAlign: 'center'
                        }, children: [_jsx("p", { children: "No Active Learning projects found." }), _jsx("p", { style: { fontSize: '14px', color: 'var(--jp-ui-font-color2)' }, children: "Create an Active Learning project using the Project Collaboration extension to see it here." })] })) : (_jsx("div", { children: dalProjects.map(project => (_jsx("div", { style: {
                                background: 'var(--jp-layout-color2)',
                                border: '1px solid var(--jp-border-color1)',
                                borderRadius: '4px',
                                padding: '15px',
                                marginBottom: '10px'
                            }, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("h3", { style: { margin: '0 0 10px 0' }, children: project.name }), _jsxs("div", { style: { fontSize: '14px', color: 'var(--jp-ui-font-color2)', marginBottom: '10px' }, children: [_jsxs("div", { children: ["Status: ", project.status] }), _jsxs("div", { children: ["Participants: ", project.participants] }), _jsxs("div", { children: ["Contract: ", project.contractAddress] }), _jsxs("div", { children: ["CWL Status: ", project.cwlStatus || 'Not configured'] }), _jsxs("div", { children: ["Last Updated: ", project.lastUpdated.toLocaleDateString()] })] })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '20px' }, children: [_jsx("button", { onClick: () => handleConfigureCWL(project), style: {
                                                    padding: '8px 16px',
                                                    background: 'var(--jp-brand-color1)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap'
                                                }, children: "Configure Workflow" }), _jsx("button", { onClick: () => handleShowRuntime(project), disabled: project.cwlStatus !== 'deployed', style: {
                                                    padding: '8px 16px',
                                                    background: project.cwlStatus === 'deployed' ? 'var(--jp-success-color1)' : 'var(--jp-layout-color3)',
                                                    color: project.cwlStatus === 'deployed' ? 'white' : 'var(--jp-ui-font-color3)',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: project.cwlStatus === 'deployed' ? 'pointer' : 'not-allowed',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap'
                                                }, children: "Run Workflow" }), _jsx("button", { onClick: () => handleSetupProject(project), style: {
                                                    padding: '8px 16px',
                                                    background: 'var(--jp-info-color1)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap'
                                                }, children: "Setup Project" })] })] }) }, project.id))) }))] }), _jsxs("div", { children: [_jsx("h2", { children: "Getting Started" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }, children: [_jsxs("div", { style: {
                                    background: 'var(--jp-layout-color2)',
                                    border: '1px solid var(--jp-border-color1)',
                                    borderRadius: '4px',
                                    padding: '20px'
                                }, children: [_jsx("h3", { children: "1. Create or Join Projects" }), _jsx("p", { children: "To create a new Active Learning project or join an existing one, use the Project Collaboration extension." }), _jsx("div", { style: { fontSize: '12px', color: 'var(--jp-ui-font-color2)', marginTop: '10px' }, children: "Projects will appear above once they're created with the \"Active Learning\" template." })] }), _jsxs("div", { style: {
                                    background: 'var(--jp-layout-color2)',
                                    border: '1px solid var(--jp-border-color1)',
                                    borderRadius: '4px',
                                    padding: '20px'
                                }, children: [_jsx("h3", { children: "2. Configure Workflows" }), _jsx("p", { children: "Define your Active Learning workflow using CWL (Common Workflow Language) including dataset preparation, model training, and query strategies." }), _jsx("div", { style: { fontSize: '12px', color: 'var(--jp-ui-font-color2)', marginTop: '10px' }, children: "Use the \"Configure Workflow\" button for each project." })] }), _jsxs("div", { style: {
                                    background: 'var(--jp-layout-color2)',
                                    border: '1px solid var(--jp-border-color1)',
                                    borderRadius: '4px',
                                    padding: '20px'
                                }, children: [_jsx("h3", { children: "3. Run Active Learning" }), _jsx("p", { children: "Execute your configured workflows to start the Active Learning process with automated query selection, labeling, and model updates." }), _jsx("div", { style: { fontSize: '12px', color: 'var(--jp-ui-font-color2)', marginTop: '10px' }, children: "Available after workflow configuration is complete." })] })] })] })] }));
};
export default DALComponent;
//# sourceMappingURL=DALComponent.js.map