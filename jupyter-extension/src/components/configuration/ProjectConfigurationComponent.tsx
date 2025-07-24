import React, { useState, useEffect, useCallback } from 'react';
import { DVREProjectConfiguration, projectConfigurationService } from '../../services/ProjectConfigurationService';
import { useAuth } from '../../hooks/useAuth';
import { useProjects } from '../../hooks/useProjects';
import WorkflowEditor from './WorkflowEditor';

interface ProjectConfigurationComponentProps {
  title?: string;
  projectId?: string;
  onConfigurationChange?: (config: DVREProjectConfiguration) => void;
}

export const ProjectConfigurationComponent: React.FC<ProjectConfigurationComponentProps> = ({
  title = 'Project Configuration',
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
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    if (!account || !userProjects || userProjects.length === 0) {
      setProjects([]);
      return;
    }

    setLoading(true);
    try {
      console.log(`Found ${userProjects.length} user projects from blockchain:`, userProjects.map(p => ({ id: p.address, name: p.projectData?.name || p.projectId })));
      
      const configurations: DVREProjectConfiguration[] = [];
      
      // For each user project, ensure it has a RO-Crate configuration
      for (const project of userProjects) {
        try {
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
            console.log(`Found existing RO-Crate for project ${project.address}`);
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
  }, [account, userProjects]);

  const loadProjectConfiguration = useCallback((projectId: string) => {
    if (!account) return;

    try {
      const config = projectConfigurationService.getProjectConfiguration(projectId);
      if (config) {
        // Verify user ownership before allowing access
        if (projectConfigurationService.isProjectOwner(projectId, account)) {
          setSelectedProject(config);
          onConfigurationChange?.(config);
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
  }, [account, onConfigurationChange]);

  // Load projects when blockchain projects change or component mounts
  useEffect(() => {
    if (!projectsLoading) { // Wait for blockchain projects to load first
      loadProjects();
    }
  }, [loadProjects, projectsLoading]);

  // Subscribe to configuration changes for selected project
  useEffect(() => {
    if (!selectedProject) return;

    const unsubscribe = projectConfigurationService.onConfigurationChange(
      selectedProject.projectId,
      (updatedConfig: DVREProjectConfiguration) => {
        setSelectedProject(updatedConfig);
        onConfigurationChange?.(updatedConfig);
      }
    );

    return unsubscribe;
  }, [selectedProject, onConfigurationChange]);

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

  const handlePublishToIPFS = async () => {
    if (!selectedProject || !account) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Publishing project to IPFS:', selectedProject.projectId);
      const result = await projectConfigurationService.publishToIPFS(selectedProject.projectId, account);

      if (result) {
        console.log('Successfully published to IPFS:', result);
        alert(`Project published to IPFS successfully!\n\nRO-Crate: ${result.roCrateHash}\nBundle: ${result.bundleHash}`);
        
        // Reload project to get updated configuration
        loadProjectConfiguration(selectedProject.projectId);
      } else {
        setError('Failed to publish to IPFS');
      }
    } catch (err) {
      console.error('Failed to publish to IPFS:', err);
      setError('Failed to publish to IPFS');
    } finally {
      setLoading(false);
    }
  };

  // Workflow management handlers
  const handleAddWorkflow = () => {
    if (!selectedProject || !account) return;

    const workflowName = prompt('Enter workflow name:');
    if (!workflowName) return;

    const workflowType = 'cwl'; // Default to CWL

    // Create basic CWL template
    const basicCWLTemplate = {
      cwlVersion: "v1.2",
      class: "Workflow",
      id: `${selectedProject.projectId}-workflow`,
      label: workflowName,
      inputs: {
        dataset: {
          type: "File",
          doc: "Input dataset for processing"
        }
      },
      outputs: {
        results: {
          type: "File",
          outputSource: "process_step/output"
        }
      },
      steps: {
        process_step: {
          run: "#process",
          in: {
            input_data: "dataset"
          },
          out: ["output"]
        }
      }
    };

    const workflow = {
      name: workflowName,
      description: `${workflowName} workflow for ${selectedProject.projectData?.name || 'project'}`,
      type: workflowType as 'cwl' | 'jupyter' | 'custom',
      content: JSON.stringify(basicCWLTemplate, null, 2),
      inputs: Object.keys(basicCWLTemplate.inputs),
      outputs: Object.keys(basicCWLTemplate.outputs),
      steps: Object.keys(basicCWLTemplate.steps)
    };

    projectConfigurationService.addWorkflow(
      selectedProject.projectId,
      `workflow-${Date.now()}`,
      workflow,
      account
    );
  };

  const handleRemoveWorkflow = (workflowId: string) => {
    if (!selectedProject || !account) return;

    const workflow = selectedProject.roCrate.workflows[workflowId];
    if (!workflow) return;

    const confirmed = confirm(`Are you sure you want to remove the workflow "${workflow.name}"?`);
    if (confirmed) {
      projectConfigurationService.removeWorkflow(
        selectedProject.projectId,
        workflowId,
        account
      );
    }
  };

  const handleExpandWorkflow = (workflowId: string) => {
    setExpandedWorkflow(expandedWorkflow === workflowId ? null : workflowId);
  };

  const handleWorkflowSave = (workflowId: string, workflow: any) => {
    // Workflow is auto-saved by the WorkflowEditor component
    console.log('Workflow saved:', workflowId, workflow);
  };

  // Dataset management handlers
  const handleAddDataset = () => {
    if (!selectedProject || !account) return;

    const datasetName = prompt('Enter dataset name:');
    if (!datasetName) return;

    const datasetFormat = prompt('Enter dataset format (csv, json, parquet, etc.):', 'csv');
    if (!datasetFormat) return;

    const datasetDescription = prompt('Enter dataset description (optional):') || '';

    const dataset = {
      name: datasetName,
      description: datasetDescription,
      format: datasetFormat,
      columns: []
    };

    projectConfigurationService.addDataset(
      selectedProject.projectId,
      `dataset-${Date.now()}`,
      dataset,
      account
    );
  };

  // Utility functions
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
          <p>Please connect your wallet to access project configuration.</p>
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
          {selectedProject && !selectedProject.ipfs && (
            <button 
              className="publish-button"
              onClick={handlePublishToIPFS}
              disabled={loading}
            >
              {loading ? 'Publishing...' : 'Publish to IPFS'}
            </button>
          )}
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
          <div className="config-section">
            <h4>Project Information</h4>
            <div className="project-info">
              <div className="info-item">
                <strong>Contract Address:</strong> {selectedProject.contractAddress || 'Not available'}
              </div>
              <div className="info-item">
                <strong>Owner:</strong> {selectedProject.owner}
              </div>
              <div className="info-item">
                <strong>Created:</strong> {new Date(selectedProject.created).toLocaleString()}
              </div>
              <div className="info-item">
                <strong>Last Modified:</strong> {new Date(selectedProject.lastModified).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Workflow Editor Section */}
          <div className="config-section">
            <div className="section-header">
              <h4>Workflow Configuration</h4>
              <button
                className="add-workflow-button"
                onClick={() => handleAddWorkflow()}
                disabled={loading}
              >
                + Add Workflow
              </button>
            </div>
            
            <div className="workflows-list">
              {Object.keys(selectedProject.roCrate.workflows).length === 0 ? (
                <div className="empty-workflows">
                  <p>No workflows configured yet.</p>
                  <p>Add a CWL workflow to define how your project should be executed.</p>
                </div>
              ) : (
                <div className="workflows-grid">
                  {Object.entries(selectedProject.roCrate.workflows).map(([id, workflow]) => (
                    <div key={id} className="workflow-card">
                      <div className="workflow-header">
                        <h5>{workflow.name}</h5>
                        <span className="workflow-type">{workflow.type.toUpperCase()}</span>
                      </div>
                      <p className="workflow-description">
                        {workflow.description || 'No description provided'}
                      </p>
                      <div className="workflow-actions">
                        <button
                          className="expand-workflow-button"
                          onClick={() => handleExpandWorkflow(id)}
                        >
                          {expandedWorkflow === id ? 'Collapse' : 'Expand'} Editor
                        </button>
                        <button
                          className="remove-workflow-button"
                          onClick={() => handleRemoveWorkflow(id)}
                        >
                          Remove
                        </button>
                      </div>
                      
                      {/* Expanded Workflow Editor */}
                      {expandedWorkflow === id && (
                        <div className="workflow-editor-container">
                          <WorkflowEditor
                            projectId={selectedProject.projectId}
                            workflowId={id}
                            workflow={workflow}
                            projectConfig={selectedProject}
                            onSave={(updatedWorkflow) => handleWorkflowSave(id, updatedWorkflow)}
                            onClose={() => setExpandedWorkflow(null)}
                            isExpanded={true}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dataset Management Section */}
          <div className="config-section">
            <div className="section-header">
              <h4>Dataset Configuration</h4>
              <button
                className="add-dataset-button"
                onClick={() => handleAddDataset()}
                disabled={loading}
              >
                + Add Dataset
              </button>
            </div>
            
            <div className="datasets-summary">
              {Object.keys(selectedProject.roCrate.datasets).length === 0 ? (
                <div className="empty-datasets">
                  <p>No datasets configured yet.</p>
                  <p>Add dataset metadata to document your project's data sources.</p>
                </div>
              ) : (
                <div className="datasets-grid">
                  {Object.entries(selectedProject.roCrate.datasets).map(([id, dataset]) => (
                    <div key={id} className="dataset-card">
                      <h5>{dataset.name}</h5>
                      <p>{dataset.description || 'No description'}</p>
                      <div className="dataset-meta">
                        <span>Format: {dataset.format}</span>
                        {dataset.size && <span>Size: {formatBytes(dataset.size)}</span>}
                        {dataset.columns && <span>Columns: {dataset.columns.length}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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

          {/* dApp Extensions Section */}
          {selectedProject.extensions && Object.keys(selectedProject.extensions).length > 0 && (
            <div className="config-section">
              <h4>dApp Extensions</h4>
              <div className="extensions-summary">
                {Object.entries(selectedProject.extensions).map(([dAppName, extensionData]) => (
                  <div key={dAppName} className="extension-item">
                    <strong>{dAppName.toUpperCase()}:</strong>
                    <pre>{JSON.stringify(extensionData, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}

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

export default ProjectConfigurationComponent; 