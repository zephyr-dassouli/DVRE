import React, { useState, useEffect, useCallback } from 'react';
import {
  DVREProjectConfiguration,
  projectConfigurationService
} from '../../services/ProjectConfigurationService';

interface ProjectConfigurationComponentProps {
  title?: string;
  projectId?: string;
  onConfigurationChange?: (config: DVREProjectConfiguration) => void;
}

interface ProjectListItem {
  projectId: string;
  name: string;
  status: string;
  lastModified: string;
  dApps: string[];
}

export const ProjectConfigurationComponent: React.FC<ProjectConfigurationComponentProps> = ({
  title = 'Project Configuration',
  projectId: initialProjectId,
  onConfigurationChange
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId || null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<DVREProjectConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'configure' | 'publish'>('list');

  // Load all project configurations
  const loadProjects = useCallback(() => {
    const configs = projectConfigurationService.getAllProjectConfigurations();
    const projectItems: ProjectListItem[] = configs.map(config => ({
      projectId: config.projectId,
      name: config.projectData?.name || `Project ${config.projectId.slice(0, 8)}...`,
      status: config.status,
      lastModified: config.lastModified,
      dApps: Object.keys(config.extensions)
    }));
    
    setProjects(projectItems);
  }, []);

  // Load specific project configuration
  const loadProjectConfiguration = useCallback((projectId: string) => {
    const config = projectConfigurationService.getProjectConfiguration(projectId);
    setSelectedConfig(config);
    if (config) {
      onConfigurationChange?.(config);
    }
  }, [onConfigurationChange]);

  // Subscribe to configuration changes
  useEffect(() => {
    if (selectedProjectId) {
      const unsubscribe = projectConfigurationService.onConfigurationChange(
        selectedProjectId,
        (config) => {
          setSelectedConfig(config);
          onConfigurationChange?.(config);
          loadProjects(); // Refresh project list
        }
      );
      
      return unsubscribe;
    }
  }, [selectedProjectId, onConfigurationChange, loadProjects]);

  // Initial load
  useEffect(() => {
    loadProjects();
    if (initialProjectId) {
      loadProjectConfiguration(initialProjectId);
      setView('configure');
    }
  }, [initialProjectId, loadProjects, loadProjectConfiguration]);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    loadProjectConfiguration(projectId);
    setView('configure');
  };

  const handlePublishToIPFS = async () => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await projectConfigurationService.publishToIPFS(selectedProjectId);
      if (result) {
        alert(`Published to IPFS!\nRO-Crate Hash: ${result.roCrateHash}\nBundle Hash: ${result.bundleHash}`);
        loadProjectConfiguration(selectedProjectId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish to IPFS');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#fbbf24';
      case 'configured': return '#3b82f6';
      case 'ready': return '#10b981';
      case 'active': return '#8b5cf6';
      case 'completed': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const renderProjectList = () => (
    <div className="project-configuration-list">
      <div className="panel-header">
        <h2>{title}</h2>
        <p>Manage RO-Crates and workflows for all your DVRE projects</p>
      </div>
      
      {projects.length === 0 ? (
        <div className="empty-state">
          <p>No project configurations found.</p>
          <p>Create a project in the Collaboration tab to get started.</p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <div
              key={project.projectId}
              className="project-card"
              onClick={() => handleProjectSelect(project.projectId)}
            >
              <div className="project-header">
                <h3>{project.name}</h3>
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(project.status) }}
                >
                  {project.status}
                </span>
              </div>
              
              <div className="project-meta">
                <p>ID: {project.projectId.slice(0, 16)}...</p>
                <p>Modified: {new Date(project.lastModified).toLocaleDateString()}</p>
              </div>
              
              {project.dApps.length > 0 && (
                <div className="dapps-list">
                  <strong>Configured for:</strong>
                  <div className="dapp-tags">
                    {project.dApps.map(dApp => (
                      <span key={dApp} className="dapp-tag">{dApp}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderConfiguration = () => {
    if (!selectedConfig) return null;

    return (
      <div className="project-configuration-detail">
        <div className="panel-header">
          <button 
            className="back-button"
            onClick={() => setView('list')}
          >
            ← Back to Projects
          </button>
          <h2>{selectedConfig.projectData?.name || 'Project Configuration'}</h2>
          <div className="actions">
            {selectedConfig.status === 'configured' && (
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

        {error && <div className="error-banner">{error}</div>}

        <div className="configuration-tabs">
          <div className="tab-content">
            <div className="config-section">
              <h3>Project Overview</h3>
              <div className="config-grid">
                <div className="config-item">
                  <label>Status:</label>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(selectedConfig.status) }}
                  >
                    {selectedConfig.status}
                  </span>
                </div>
                <div className="config-item">
                  <label>Created:</label>
                  <span>{new Date(selectedConfig.created).toLocaleString()}</span>
                </div>
                <div className="config-item">
                  <label>Last Modified:</label>
                  <span>{new Date(selectedConfig.lastModified).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="config-section">
              <h3>Datasets ({Object.keys(selectedConfig.roCrate.datasets).length})</h3>
              {Object.keys(selectedConfig.roCrate.datasets).length === 0 ? (
                <p className="empty-message">No datasets configured</p>
              ) : (
                <div className="items-list">
                  {Object.entries(selectedConfig.roCrate.datasets).map(([id, dataset]) => (
                    <div key={id} className="item-card">
                      <h4>{dataset.name}</h4>
                      <p>{dataset.description || 'No description'}</p>
                      <div className="item-meta">
                        <span>Format: {dataset.format}</span>
                        {dataset.columns && <span>Columns: {dataset.columns.length}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="config-section">
              <h3>Workflows ({Object.keys(selectedConfig.roCrate.workflows).length})</h3>
              {Object.keys(selectedConfig.roCrate.workflows).length === 0 ? (
                <p className="empty-message">No workflows configured</p>
              ) : (
                <div className="items-list">
                  {Object.entries(selectedConfig.roCrate.workflows).map(([id, workflow]) => (
                    <div key={id} className="item-card">
                      <h4>{workflow.name}</h4>
                      <p>{workflow.description || 'No description'}</p>
                      <div className="item-meta">
                        <span>Type: {workflow.type}</span>
                        {workflow.steps && <span>Steps: {workflow.steps.length}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="config-section">
              <h3>Models ({Object.keys(selectedConfig.roCrate.models).length})</h3>
              {Object.keys(selectedConfig.roCrate.models).length === 0 ? (
                <p className="empty-message">No models configured</p>
              ) : (
                <div className="items-list">
                  {Object.entries(selectedConfig.roCrate.models).map(([id, model]) => (
                    <div key={id} className="item-card">
                      <h4>{model.name}</h4>
                      <div className="item-meta">
                        <span>Algorithm: {model.algorithm}</span>
                        {model.framework && <span>Framework: {model.framework}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="config-section">
              <h3>dApp Extensions</h3>
              {Object.keys(selectedConfig.extensions).length === 0 ? (
                <p className="empty-message">No dApp-specific configurations</p>
              ) : (
                <div className="extensions-list">
                  {Object.entries(selectedConfig.extensions).map(([dAppName, extension]) => (
                    <div key={dAppName} className="extension-card">
                      <h4>{dAppName.toUpperCase()} Configuration</h4>
                      <pre className="extension-data">
                        {JSON.stringify(extension, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedConfig.ipfs && (
              <div className="config-section">
                <h3>IPFS Publication</h3>
                <div className="ipfs-info">
                  <div className="ipfs-item">
                    <label>RO-Crate Hash:</label>
                    <code>{selectedConfig.ipfs.roCrateHash}</code>
                  </div>
                  {selectedConfig.ipfs.workflowHash && (
                    <div className="ipfs-item">
                      <label>Workflow Hash:</label>
                      <code>{selectedConfig.ipfs.workflowHash}</code>
                    </div>
                  )}
                  <div className="ipfs-item">
                    <label>Bundle Hash:</label>
                    <code>{selectedConfig.ipfs.bundleHash}</code>
                  </div>
                  <div className="ipfs-item">
                    <label>Published:</label>
                    <span>{new Date(selectedConfig.ipfs.publishedAt!).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="project-configuration-panel">
      {view === 'list' && renderProjectList()}
      {view === 'configure' && renderConfiguration()}
    </div>
  );
};

export default ProjectConfigurationComponent; 