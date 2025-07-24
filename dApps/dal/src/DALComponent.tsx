import React, { useState, useCallback, useEffect } from 'react';
import { CWLWorkflowEditor } from './CWLWorkflowEditor';
import { RuntimeOrchestrationPanel } from './RuntimeOrchestrationPanel';
import { cwlManager } from './CWLManager';
import { orchestrationAPI } from './OrchestrationAPI';
import { useDVREAuth, useActiveLearningProjects } from './integration/DVREIntegration';
// COMMENTED OUT RO-CRATE: import { dvreROCrateClient, DALROCrate } from './DVREROCrateClient';
// COMMENTED OUT RO-CRATE: import { ProjectSetupWizard } from './ProjectSetupWizardSimple';

interface DALProject {
  id: string;
  name: string;
  contractAddress: string;
  status: 'active' | 'training' | 'completed';
  participants: number;
  accuracy: number;
  currentRound: number;
  totalRounds: number;
  lastUpdated: Date;
  cwlStatus?: string;
  workflowId?: string;
  phase?: 'configuration' | 'runtime' | 'completed';
  // COMMENTED OUT RO-CRATE: dalROCrate?: DALROCrate; // Add RO-Crate data
}

interface DALComponentProps {
  title?: string;
}

const DALComponent: React.FC<DALComponentProps> = ({ 
  title = 'Decentralized Active Learning' 
}) => {
  // Use DVRE integration for authentication
  const { account, isLoading: authLoading, error: authError, connect } = useDVREAuth();
  
  // Use the integration to get Active Learning projects from DVRE's userProjects
  const { projects: alProjects, loading: projectsLoading, error: projectsError } = useActiveLearningProjects(account);
  
  const [selectedProject, setSelectedProject] = useState<DALProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCWLEditor, setShowCWLEditor] = useState(false);
  const [showRuntimePanel, setShowRuntimePanel] = useState(false);
  // COMMENTED OUT RO-CRATE: const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [serverHealthy, setServerHealthy] = useState(false);
  // COMMENTED OUT RO-CRATE: const [roCrateData, setROCrateData] = useState<Record<string, DALROCrate>>({});
  // COMMENTED OUT RO-CRATE: const [loadingROCrates, setLoadingROCrates] = useState(false);

  console.log('DAL: Component rendering, auth state:', { account, authLoading, authError });
  console.log('DAL: AL projects from DVRE userProjects:', alProjects?.length || 0);

  // COMMENTED OUT RO-CRATE: Load RO-Crate data for all AL projects
  const loadROCrateData = useCallback(async () => {
    if (!alProjects || alProjects.length === 0) return;

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
        } catch (error) {
          console.warn(`DAL: Failed to load RO-Crate for project ${project.address}:`, error);
        }
      }
      
      // setROCrateData(roCrateMap); // COMMENTED OUT RO-CRATE
    } catch (error) {
      console.error('DAL: Failed to load RO-Crate data:', error);
      setError('Failed to load project configurations');
    } finally {
      // setLoadingROCrates(false); // COMMENTED OUT RO-CRATE
    }
  }, [alProjects]);

  // COMMENTED OUT RO-CRATE: Load RO-Crate data when AL projects change
  useEffect(() => {
    // loadROCrateData(); // COMMENTED OUT RO-CRATE
  }, [loadROCrateData]);

  // Convert DVRE projects to DAL project format with RO-Crate data
  const dalProjects: DALProject[] = alProjects.map(project => {
    // const dalROCrate = roCrateData[project.address]; // COMMENTED OUT RO-CRATE
    
    return {
      id: project.address,
      name: project.objective || 'Unnamed AL Project',
      contractAddress: project.address,
      status: project.isActive ? 'active' : 'completed',
      participants: project.memberCount || 1,
      accuracy: project.projectData?.accuracy || 0,
      currentRound: project.projectData?.currentRound || 0,
      totalRounds: project.projectData?.maxRounds || 10,
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
    } catch (error) {
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
  const handleProjectSelect = (project: DALProject) => {
    setSelectedProject(project);
  };

  // Handle project setup
  const handleSetupProject = (project: DALProject) => {
    setSelectedProject(project);
    // setShowSetupWizard(true); // COMMENTED OUT RO-CRATE
  };

  // Handle CWL configuration
  const handleConfigureCWL = (project: DALProject) => {
    setSelectedProject(project);
    setShowCWLEditor(true);
  };

  // Handle runtime orchestration
  const handleShowRuntime = (project: DALProject) => {
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
  const handleWizardComplete = (roCrate: any) => { // COMMENTED OUT RO-CRATE
    console.log('DAL: Project setup completed:', roCrate);
    // setShowSetupWizard(false); // COMMENTED OUT RO-CRATE
    // Refresh RO-Crate data
    // loadROCrateData(); // COMMENTED OUT RO-CRATE
  };

  // Handle workflow deployment success
  const handleWorkflowDeployed = (workflowId: string) => {
    console.log('DAL: Workflow deployed successfully:', workflowId);
    // Optionally update project status or refresh data
    setShowCWLEditor(false);
    setShowRuntimePanel(true);
  };

  // Loading state
  if (authLoading) {
    console.log('DAL: Rendering loading state');
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '10px' }}>Loading authentication...</div>
        <div style={{ fontSize: '12px', color: 'gray' }}>DAL Extension v0.1.0</div>
      </div>
    );
  }

  // Authentication required
  if (!account) {
    console.log('DAL: Rendering auth required state');
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'var(--jp-warn-color3)',
          border: '1px solid var(--jp-warn-color1)',
          borderRadius: '4px',
          padding: '20px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h3 style={{ color: 'var(--jp-warn-color1)', margin: '0 0 10px 0' }}>
            Authentication Required
          </h3>
          <p style={{ color: 'var(--jp-ui-font-color1)', margin: '0 0 15px 0' }}>
            Please connect your wallet to access Decentralized Active Learning projects.
          </p>
          {authError && (
            <p style={{ color: 'var(--jp-error-color1)', fontSize: '12px', margin: '0 0 15px 0' }}>
              Error: {authError}
            </p>
          )}
          <button
            onClick={connect}
            style={{
              padding: '10px 20px',
              background: 'var(--jp-brand-color1)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Connect Wallet
          </button>
          <div style={{ fontSize: '12px', color: 'gray', marginTop: '10px' }}>
            DAL Extension v0.1.0
          </div>
        </div>
      </div>
    );
  }

  // Show CWL Editor
  if (showCWLEditor && selectedProject) {
    // Find the corresponding DVRE project data for authentication
    const correspondingProject = alProjects.find(p => p.address === selectedProject.contractAddress);
    
    return (
      <div style={{ 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px'
      }}>
        <CWLWorkflowEditor
          projectId={selectedProject.contractAddress}
          projectTitle={selectedProject.name}
          userWallet={account}
          projectData={correspondingProject}
          onClose={handleBackToMain}
          onWorkflowDeployed={handleWorkflowDeployed}
        />
      </div>
    );
  }

  // Show Runtime Panel
  if (showRuntimePanel && selectedProject) {
    return (
      <div style={{ 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px'
      }}>
        <RuntimeOrchestrationPanel
          projectId={selectedProject.contractAddress}
          projectTitle={selectedProject.name}
          workflowId={selectedProject.workflowId}
          onClose={handleBackToMain}
        />
      </div>
    );
  }

  // Show Setup Wizard
  if (false && selectedProject) { // COMMENTED OUT RO-CRATE
    return (
      <div style={{ 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px'
      }}>
        {/* COMMENTED OUT RO-CRATE
        <ProjectSetupWizard
          projectId={selectedProject.contractAddress}
          projectData={{ address: selectedProject.contractAddress, objective: selectedProject.name }}
          userWallet={account}
          onComplete={handleWizardComplete}
          onCancel={handleBackToMain}
        />
        */}
      </div>
    );
  }

  console.log('DAL: Rendering main interface');

  // Main interface
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'var(--jp-ui-font-family)',
      background: 'var(--jp-layout-color1)',
      minHeight: '400px'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h1>{title}</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ 
            padding: '4px 8px', 
            background: 'var(--jp-success-color3)', 
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            Connected: {account.slice(0, 6)}...{account.slice(-4)}
          </div>
          <div style={{ 
            padding: '4px 8px', 
            background: serverHealthy ? 'var(--jp-success-color3)' : 'var(--jp-warn-color3)', 
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            Server: {serverHealthy ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      {(error || projectsError) && (
        <div style={{
          background: 'var(--jp-error-color3)',
          border: '1px solid var(--jp-error-color1)',
          borderRadius: '4px',
          padding: '10px',
          marginBottom: '20px',
          color: 'var(--jp-error-color1)'
        }}>
          {error || projectsError}
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <h2>Active Learning Projects</h2>
        {projectsLoading ? (
          <div>Loading projects...</div>
        ) : dalProjects.length === 0 ? (
          <div style={{
            background: 'var(--jp-layout-color2)',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '4px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <p>No Active Learning projects found.</p>
            <p style={{ fontSize: '14px', color: 'var(--jp-ui-font-color2)' }}>
              Create an Active Learning project using the Project Collaboration extension to see it here.
            </p>
          </div>
        ) : (
          <div>
            {dalProjects.map(project => (
              <div key={project.id} style={{
                background: 'var(--jp-layout-color2)',
                border: '1px solid var(--jp-border-color1)',
                borderRadius: '4px',
                padding: '15px',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>{project.name}</h3>
                    <div style={{ fontSize: '14px', color: 'var(--jp-ui-font-color2)', marginBottom: '10px' }}>
                      <div>Status: {project.status}</div>
                      <div>Participants: {project.participants}</div>
                      <div>Contract: {project.contractAddress}</div>
                      <div>CWL Status: {project.cwlStatus || 'Not configured'}</div>
                      <div>Last Updated: {project.lastUpdated.toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '20px' }}>
                    <button
                      onClick={() => handleConfigureCWL(project)}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--jp-brand-color1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Configure Workflow
                    </button>
                    <button
                      onClick={() => handleShowRuntime(project)}
                      disabled={project.cwlStatus !== 'deployed'}
                      style={{
                        padding: '8px 16px',
                        background: project.cwlStatus === 'deployed' ? 'var(--jp-success-color1)' : 'var(--jp-layout-color3)',
                        color: project.cwlStatus === 'deployed' ? 'white' : 'var(--jp-ui-font-color3)',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: project.cwlStatus === 'deployed' ? 'pointer' : 'not-allowed',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Run Workflow
                    </button>
                    <button
                      onClick={() => handleSetupProject(project)}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--jp-info-color1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Setup Project
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2>Getting Started</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div style={{
            background: 'var(--jp-layout-color2)',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '4px',
            padding: '20px'
          }}>
            <h3>1. Create or Join Projects</h3>
            <p>To create a new Active Learning project or join an existing one, use the Project Collaboration extension.</p>
            <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)', marginTop: '10px' }}>
              Projects will appear above once they're created with the "Active Learning" template.
            </div>
          </div>
          
          <div style={{
            background: 'var(--jp-layout-color2)',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '4px',
            padding: '20px'
          }}>
            <h3>2. Configure Workflows</h3>
            <p>Define your Active Learning workflow using CWL (Common Workflow Language) including dataset preparation, model training, and query strategies.</p>
            <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)', marginTop: '10px' }}>
              Use the "Configure Workflow" button for each project.
            </div>
          </div>
          
          <div style={{
            background: 'var(--jp-layout-color2)',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '4px',
            padding: '20px'
          }}>
            <h3>3. Run Active Learning</h3>
            <p>Execute your configured workflows to start the Active Learning process with automated query selection, labeling, and model updates.</p>
            <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)', marginTop: '10px' }}>
              Available after workflow configuration is complete.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DALComponent; 