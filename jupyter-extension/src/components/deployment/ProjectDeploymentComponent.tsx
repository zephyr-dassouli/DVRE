import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { DVREProjectConfiguration, projectConfigurationService } from '../../services/ProjectConfigurationService';
import { useAuth } from '../../hooks/useAuth';
import { useProjects } from '../../hooks/useProjects';
import ProjectConfigurationPanel from './ProjectConfigurationPanel';
import ProjectInformationPanel from './ProjectInformationPanel';
import WorkflowsPanel from './WorkflowsPanel';
import UserList from './UserList';

// Import JSONProject ABI for smart contract interaction
import JSONProject from '../../abis/JSONProject.json';

interface ProjectDeploymentComponentProps {
  title?: string;
  projectId?: string;
  onConfigurationChange?: (config: DVREProjectConfiguration) => void;
}

export const ProjectDeploymentComponent: React.FC<ProjectDeploymentComponentProps> = ({
  title = 'Project Deployment',
  projectId: initialProjectId,
  onConfigurationChange
}) => {
  const { account } = useAuth(); // Get current user's wallet address
  const { userProjects, loading: projectsLoading } = useProjects(); // Load blockchain projects
  const [projects, setProjects] = useState<DVREProjectConfiguration[]>([]);
  const [selectedProject, setSelectedProject] = useState<DVREProjectConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'configure'>('list');

  // Use refs to prevent infinite re-renders
  const onConfigurationChangeRef = useRef(onConfigurationChange);
  const userProjectsRef = useRef(userProjects);
  
  // Update refs when values change
  useEffect(() => {
    onConfigurationChangeRef.current = onConfigurationChange;
  }, [onConfigurationChange]);
  
  useEffect(() => {
    userProjectsRef.current = userProjects;
  }, [userProjects]);

  // Helper functions for blockchain interaction
  const getProvider = () => {
    if (!(window as any).ethereum) {
      throw new Error('MetaMask not found');
    }
    return new ethers.BrowserProvider((window as any).ethereum);
  };

  const getSigner = async () => {
    const provider = getProvider();
    return await provider.getSigner();
  };

  const loadProjects = useCallback(async () => {
    const currentUserProjects = userProjectsRef.current;
    
    if (!account || !currentUserProjects || currentUserProjects.length === 0) {
      setProjects([]);
      return;
    }

    setLoading(true);
    try {
      console.log(`Found ${currentUserProjects.length} user projects from blockchain:`, currentUserProjects.map(p => ({ id: p.address, name: p.projectData?.name || p.projectId })));
      
      const configurations: DVREProjectConfiguration[] = [];
      
      // For each user project, ensure it has a RO-Crate configuration
      for (const project of currentUserProjects) {
        try {
          console.log(`🔍 Processing project ${project.address}:`, {
            projectId: project.projectId,
            projectData: project.projectData,
            hasTypeField: !!project.projectData?.type,
            typeValue: project.projectData?.type
          });
          
          // Check if RO-Crate already exists
          let config = projectConfigurationService.getProjectConfiguration(project.address);
          
          if (!config) {
            // Auto-create RO-Crate for existing projects that don't have one
            console.log(`Auto-creating RO-Crate for existing project: ${project.address}`);
            config = await projectConfigurationService.autoCreateProjectConfiguration(
              project.address,
              project.projectData,
              account
            );
            console.log(`Created RO-Crate for project ${project.address}:`, config);
          } else {
            console.log(`Found existing RO-Crate for project ${project.address}`, {
              configStatus: config.status,
              hasDALExtension: !!config.extensions?.dal,
              projectDataType: config.projectData?.type
            });
            
            // 🔧 TEMP FIX: Force-recreate RO-Crate if project has AL type but no DAL extension
            const shouldBeAL = project.projectData?.type === 'active_learning';
            const hasDALExtension = !!config.extensions?.dal;
            
            if (shouldBeAL && !hasDALExtension) {
              console.log(`🔧 Force-recreating RO-Crate for AL project without DAL extension: ${project.address}`);
              config = await projectConfigurationService.autoCreateProjectConfiguration(
                project.address,
                project.projectData,
                account
              );
              console.log(`✅ Recreated RO-Crate with DAL extension for project ${project.address}`);
            }
          }
          
          if (config) {
            configurations.push(config);
          }
        } catch (err) {
          console.error(`Failed to process project ${project.address}:`, err);
        }
      }
      
      console.log(`Successfully loaded ${configurations.length} project configurations`);
      setProjects(configurations);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [account]); // Only depend on account, not userProjects

  const loadProjectConfiguration = useCallback((projectId: string) => {
    if (!account) return;

    try {
      const config = projectConfigurationService.getProjectConfiguration(projectId);
      if (config) {
        // Verify user ownership before allowing access
        if (projectConfigurationService.isProjectOwner(projectId, account)) {
          setSelectedProject(config);
          const currentOnConfigurationChange = onConfigurationChangeRef.current;
          currentOnConfigurationChange?.(config);
        } else {
          setError('You can only configure projects that you own');
          setSelectedProject(null);
        }
      } else {
        setError('Project configuration not found');
        setSelectedProject(null);
      }
    } catch (err) {
      console.error('Failed to load project configuration:', err);
      setError('Failed to load project configuration');
      setSelectedProject(null);
    }
  }, [account]); // Only depend on account

  // Load projects when blockchain projects change or component mounts
  useEffect(() => {
    if (!projectsLoading && userProjects) { // Wait for blockchain projects to load first
      loadProjects();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, userProjects, projectsLoading]); // Don't include loadProjects to prevent infinite loop

  // Debug helper - expose data to console for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).dvreDebugData = {
        account,
        userProjects,
        projects,
        projectsLoading,
        error,
        timestamp: new Date().toISOString()
      };
      
      console.log('🔍 DVRE Debug Data Updated:', {
        account,
        userProjectsCount: userProjects?.length || 0,
        configuredProjectsCount: projects.length,
        loading: projectsLoading,
        error
      });
    }
  }, [account, userProjects, projects, projectsLoading, error]);

  // Subscribe to configuration changes for selected project
  useEffect(() => {
    if (!selectedProject) return;

    const unsubscribe = projectConfigurationService.onConfigurationChange(
      selectedProject.projectId,
      (updatedConfig: DVREProjectConfiguration) => {
        setSelectedProject(updatedConfig);
        const currentOnConfigurationChange = onConfigurationChangeRef.current;
        currentOnConfigurationChange?.(updatedConfig);
      }
    );

    return unsubscribe;
  }, [selectedProject]); // Remove onConfigurationChange dependency

  // Handle initial project selection
  useEffect(() => {
    if (initialProjectId && account) {
      loadProjectConfiguration(initialProjectId);
      setView('configure');
    }
  }, [initialProjectId, account, loadProjectConfiguration]);

  const handleProjectSelect = (projectId: string) => {
    loadProjectConfiguration(projectId);
    setView('configure');
  };

  // NEW: Simplified deploy function using DeploymentOrchestrator
  const handleDeployProject = async () => {
    if (!selectedProject || !account) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Deploying project:', selectedProject.projectId);
      
      // Use the centralized deployment orchestrator
      const { deploymentOrchestrator } = await import('./services/DeploymentOrchestrator');
      const result = await deploymentOrchestrator.deployProject(selectedProject.projectId, account);

      // Generate success message based on deployment results
      let deploymentMessage = `Project deployment completed!\n\n`;
      
      // Add step-by-step results
      if (result.steps.alContracts === 'success') {
        deploymentMessage += `✅ AL Smart Contracts: Deployed\n`;
      } else if (result.steps.alContracts === 'failed') {
        deploymentMessage += `⚠️ AL Smart Contracts: Failed\n`;
      }
      
      if (result.steps.ipfsUpload === 'success') {
        deploymentMessage += `✅ IPFS Upload: Success\n`;
        deploymentMessage += `🔗 RO-Crate Hash: ${result.roCrateHash}\n`;
        deploymentMessage += `📦 Bundle Hash: ${result.bundleHash}\n`;
      } else {
        deploymentMessage += `❌ IPFS Upload: Failed\n`;
      }
      
      if (result.steps.orchestrationDeploy === 'success') {
        deploymentMessage += `✅ Orchestration: Deployed\n`;
        if (result.orchestrationWorkflowId) {
          deploymentMessage += `🆔 Workflow ID: ${result.orchestrationWorkflowId}\n`;
          deploymentMessage += `🔗 Monitor at: http://145.100.135.97:5004\n`;
        }
      } else if (result.steps.orchestrationDeploy === 'failed') {
        deploymentMessage += `⚠️ Orchestration: Failed\n`;
      }
      
      if (result.steps.smartContractUpdate === 'success') {
        deploymentMessage += `✅ Smart Contract: Updated\n`;
      } else if (result.steps.smartContractUpdate === 'failed') {
        deploymentMessage += `⚠️ Smart Contract: Update Failed\n`;
      }

      // Overall status
      if (result.success) {
        deploymentMessage += `\n🎉 Overall Status: SUCCESS`;
      } else {
        deploymentMessage += `\n⚠️ Overall Status: PARTIAL (check individual steps)`;
      }

      if (result.error) {
        deploymentMessage += `\n❌ Error: ${result.error}`;
      }
      
      alert(deploymentMessage);
      
      // Reload project to get updated configuration
      loadProjectConfiguration(selectedProject.projectId);
    } catch (err) {
      console.error('Failed to deploy project:', err);
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  // REMOVED: deployALContracts function (now in DeploymentOrchestrator)

  // Handle user actions (approve, reject, remove)
  const handleUserAction = async (action: string, userAddress: string) => {
    if (!selectedProject || !account || !selectedProject.contractAddress) return;

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(
        selectedProject.contractAddress,
        JSONProject.abi,
        signer
      );

      switch (action) {
        case 'approve':
          console.log('Approving join request for:', userAddress);
          await projectContract.approveJoinRequest(userAddress);
          break;
        case 'reject':
          console.log('Rejecting join request for:', userAddress);
          await projectContract.rejectJoinRequest(userAddress);
          break;
        case 'remove':
          console.log('Removing user:', userAddress);
          // Note: This would need a removeParticipant method in the contract
          // await projectContract.removeParticipant(userAddress);
          console.warn('Remove user functionality not yet implemented in contract');
          break;
        default:
          console.warn('Unknown user action:', action);
      }

      // Reload project data to reflect changes
      loadProjectConfiguration(selectedProject.projectId);
    } catch (error) {
      console.error('Failed to perform user action:', error);
      setError(error instanceof Error ? error.message : 'User action failed');
    }
  };

  // Handle configuration changes from the panels
  const handleConfigurationChange = (updatedConfig: any) => {
    if (!selectedProject) return;
    
    // Update the selected project configuration
    const newConfig = { ...selectedProject, ...updatedConfig };
    setSelectedProject(newConfig);
  };

  const getProjectDescription = (project: DVREProjectConfiguration): string => {
    const baseDescription = project.projectData?.description || project.projectData?.objective || 'No description provided';
    const isALProject = project.extensions?.dal !== undefined;
    
    if (isALProject) {
      return `🤖 Active Learning Project - ${baseDescription}`;
    }
    
    return baseDescription;
  };

  const getProjectTypeLabel = (project: DVREProjectConfiguration): string => {
    if (project.extensions?.dal) {
      return 'Active Learning';
    }
    if (project.extensions?.federated) {
      return 'Federated Learning';
    }
    return 'General';
  };

  const handleCopyRoCrateJSON = () => {
    if (!selectedProject) return;

    const roCrateJSON = JSON.stringify(selectedProject.roCrate.metadata, null, 2);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roCrateJSON).then(() => {
        alert('RO-Crate JSON copied to clipboard!');
      }).catch(() => {
        // Fallback for older browsers
        fallbackCopy(roCrateJSON);
      });
    } else {
      fallbackCopy(roCrateJSON);
    }
  };

  const handleDownloadInputsYaml = () => {
    if (!selectedProject?.extensions?.dal) return;

    const inputsYaml = projectConfigurationService.generateDALInputsYaml(selectedProject.extensions.dal);
    
    // Create and download file
    const blob = new Blob([inputsYaml], { type: 'application/x-yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProject.projectData?.name || 'project'}-inputs.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyInputsYaml = () => {
    if (!selectedProject?.extensions?.dal) return;

    const inputsYaml = projectConfigurationService.generateDALInputsYaml(selectedProject.extensions.dal);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inputsYaml).then(() => {
        alert('inputs.yaml copied to clipboard!');
      }).catch(() => {
        fallbackCopy(inputsYaml);
      });
    } else {
      fallbackCopy(inputsYaml);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      alert('RO-Crate JSON copied to clipboard!');
    } catch (err) {
      alert('Failed to copy to clipboard. Please copy manually from the JSON viewer.');
    }
    document.body.removeChild(textArea);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#f59e0b';
      case 'configured': return '#3b82f6';
      case 'ready': return '#10b981';
      case 'active': return '#8b5cf6';
      case 'completed': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const isDALProject = () => {
    return selectedProject?.extensions?.dal !== undefined;
  };

  // Show authentication message if not connected
  if (!account) {
    return (
      <div className="project-configuration-panel">
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          color: 'var(--jp-ui-font-color2)'
        }}>
          <h3>{title}</h3>
          <p>Please connect your wallet to access project deployment.</p>
        </div>
      </div>
    );
  }

  // Show loading state while projects are being loaded from blockchain
  const isLoading = loading || projectsLoading;

  const renderProjectList = () => (
    <div className="project-list-view">
      <div className="panel-header">
        <h3>{title}</h3>
        <div className="header-actions">
          <span className="project-count">
            {projects.length} project{projects.length !== 1 ? 's' : ''} owned
          </span>
          <button 
            className="refresh-button"
            onClick={loadProjects}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: 'var(--jp-ui-font-color2)'
        }}>
          <p>Loading your projects and RO-Crate configurations...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <h4>No Projects Found</h4>
          <p>You don't own any projects yet.</p>
          <p>Create a new project in <strong>Project Collaboration</strong> to get started.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div 
              key={project.projectId}
              className="project-card"
              onClick={() => handleProjectSelect(project.projectId)}
            >
              <div className="project-header">
                <h4>{project.projectData?.name || project.projectData?.project_id || 'Unnamed Project'}</h4>
                <div className="project-badges">
                  <span className="project-type-badge">
                    {getProjectTypeLabel(project)}
                  </span>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(project.status) }}
                  >
                    {project.status}
                  </span>
                </div>
              </div>
              
              <p className="project-description">
                {getProjectDescription(project)}
              </p>
              
              <div className="project-stats">
                <div className="stat">
                  <span className="stat-label">Datasets:</span>
                  <span className="stat-value">{Object.keys(project.roCrate.datasets).length}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Workflows:</span>
                  <span className="stat-value">{Object.keys(project.roCrate.workflows).length}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Models:</span>
                  <span className="stat-value">{Object.keys(project.roCrate.models).length}</span>
                </div>
              </div>
              
              <div className="project-footer">
                <span className="last-modified">
                  Modified: {new Date(project.lastModified).toLocaleDateString()}
                </span>
                {project.ipfs && (
                  <span className="ipfs-status">📎 Published</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderConfiguration = () => (
    <div className="project-config-view">
      <div className="config-header">
        <button 
          className="back-button"
          onClick={() => setView('list')}
        >
          ← Back to Projects
        </button>
        <h3>{selectedProject?.projectData?.name || 'Project Configuration'}</h3>
        <div className="config-actions">
          <span 
            className="status-badge"
            style={{ backgroundColor: getStatusColor(selectedProject?.status || 'draft') }}
          >
            {selectedProject?.status || 'draft'}
          </span>
          <button 
            className="deploy-button"
            onClick={handleDeployProject}
            disabled={loading}
          >
            {loading ? 'Deploying...' : 'Deploy'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {selectedProject && (
        <div className="config-content">
          {/* Project Information Section */}
          <ProjectInformationPanel project={selectedProject} />

          {/* Project Configuration Panel */}
          <div className="config-section">
            <h4>Project Configuration</h4>
            <ProjectConfigurationPanel
              projectId={selectedProject.projectId}
              projectConfig={selectedProject}
              onConfigurationChange={(updatedConfig) => {
                setSelectedProject(updatedConfig);
                onConfigurationChangeRef.current?.(updatedConfig);
              }}
            />
          </div>

          {/* Workflows Panel */}
          <WorkflowsPanel project={selectedProject} />

          {/* User List Panel */}
          <UserList 
            project={selectedProject} 
            onUserAction={handleUserAction}
          />

          {/* RO-Crate JSON-LD Viewer */}
          <div className="config-section">
            <div className="section-header">
              <h4>RO-Crate JSON-LD</h4>
              <button
                className="copy-json-button"
                onClick={() => handleCopyRoCrateJSON()}
              >
                Copy JSON
              </button>
            </div>
            
            <div className="json-viewer">
              <pre className="json-content">
                {JSON.stringify(selectedProject.roCrate.metadata, null, 2)}
              </pre>
            </div>
          </div>

          {/* IPFS Publication Section */}
          {selectedProject.ipfs && (
            <div className="config-section">
              <h4>IPFS Publication</h4>
              <div className="ipfs-info">
                <div className="info-item">
                  <strong>Published:</strong> {new Date(selectedProject.ipfs.publishedAt || '').toLocaleString()}
                </div>
                <div className="info-item">
                  <strong>RO-Crate Hash:</strong> 
                  <code>{selectedProject.ipfs.roCrateHash}</code>
                </div>
                {selectedProject.ipfs.workflowHash && (
                  <div className="info-item">
                    <strong>Workflow Hash:</strong> 
                    <code>{selectedProject.ipfs.workflowHash}</code>
                  </div>
                )}
                <div className="info-item">
                  <strong>Bundle Hash:</strong> 
                  <code>{selectedProject.ipfs.bundleHash}</code>
                </div>
              </div>
            </div>
          )}

          {/* DAL Inputs YAML Section */}
          {isDALProject() && (
            <div className="config-section">
              <h4>DAL Inputs (inputs.yaml)</h4>
              <div className="dal-inputs-summary">
                <p>This section displays the inputs.yaml file for your DAL project. You can copy the content or download it.</p>
                <div className="dal-actions">
                  <button
                    className="copy-inputs-button"
                    onClick={handleCopyInputsYaml}
                    disabled={loading}
                  >
                    {loading ? 'Copying...' : 'Copy inputs.yaml'}
                  </button>
                  <button
                    className="download-inputs-button"
                    onClick={handleDownloadInputsYaml}
                    disabled={loading}
                  >
                    {loading ? 'Downloading...' : 'Download inputs.yaml'}
                  </button>
                </div>
              </div>
              <div className="json-viewer">
                <pre className="json-content">
                  {projectConfigurationService.generateDALInputsYaml(selectedProject.extensions.dal)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="project-configuration-panel">
      {view === 'list' && renderProjectList()}
      {view === 'configure' && renderConfiguration()}
    </div>
  );
};

export default ProjectDeploymentComponent; 