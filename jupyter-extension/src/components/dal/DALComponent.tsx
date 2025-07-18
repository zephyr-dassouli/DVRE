import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface DALProject {
  id: string;
  name: string;
  contractAddress: string;
  status: 'active' | 'training' | 'completed';
  participants: number;
  accuracy: number;
  samples: number;
}

interface DALComponentProps {
  title?: string;
}

export const DALComponent: React.FC<DALComponentProps> = ({ 
  title = 'Decentralized Active Learning' 
}) => {
  const { account } = useAuth();
  const [projects, setProjects] = useState<DALProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DALProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alEngineUrl, setAlEngineUrl] = useState<string>('http://localhost:8001');
  const [connectionStatus, setConnectionStatus] = useState<{
    engine: boolean;
    blockchain: boolean;
  }>({ engine: false, blockchain: false });

  const checkConnections = useCallback(async () => {
    try {
      // Check AL Engine
      const engineResponse = await fetch(`${alEngineUrl}/health`);
      const engineStatus = engineResponse.ok;

      // Check Blockchain (using DVRE's existing connection)
      const blockchainStatus = !!account;

      setConnectionStatus({
        engine: engineStatus,
        blockchain: blockchainStatus
      });
    } catch (err) {
      setConnectionStatus({ engine: false, blockchain: false });
    }
  }, [alEngineUrl, account]);

  const loadUserProjects = useCallback(async () => {
    if (!account) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load projects from localStorage for now (in production, query from blockchain)
      const userProjectsKey = `dal_projects_${account}`;
      const savedProjects = localStorage.getItem(userProjectsKey);
      if (savedProjects) {
        setProjects(JSON.parse(savedProjects));
      }
    } catch (err) {
      setError('Failed to load DAL projects');
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  }, [account]);

  // Check connections on mount
  useEffect(() => {
    checkConnections();
    if (account) {
      loadUserProjects();
    }
  }, [account, checkConnections, loadUserProjects]);

  const createNewProject = useCallback(async () => {
    if (!account || !connectionStatus.engine) return;

    setLoading(true);
    setError(null);

    try {
      // Create new DAL project
      const projectData = {
        name: `DAL Project ${Date.now()}`,
        algorithm: 'uncertainty_sampling',
        model_type: 'RandomForestClassifier',
        dataset: 'wine'
      };

      const response = await fetch(`${alEngineUrl}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Create project record for UI
      const newProject: DALProject = {
        id: result.project_id || `dal_${Date.now()}`,
        name: projectData.name,
        contractAddress: '', // Will be set when deployed to blockchain
        status: 'active',
        participants: 1,
        accuracy: 0,
        samples: 0
      };

      // Save to localStorage and update state
      const updatedProjects = [...projects, newProject];
      const userProjectsKey = `dal_projects_${account}`;
      localStorage.setItem(userProjectsKey, JSON.stringify(updatedProjects));
      setProjects(updatedProjects);
      
      console.log('DAL project created:', newProject);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      console.error('Error creating project:', err);
    } finally {
      setLoading(false);
    }
  }, [account, connectionStatus.engine, alEngineUrl, projects]);

  const startTraining = useCallback(async (projectId: string) => {
    if (!connectionStatus.engine) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${alEngineUrl}/projects/${projectId}/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          iterations: 10,
          query_size: 5
        })
      });

      if (!response.ok) {
        throw new Error(`Training failed: ${response.statusText}`);
      }

      // Update project status
      const updatedProjects = projects.map(p => 
        p.id === projectId ? { ...p, status: 'training' as const } : p
      );
      setProjects(updatedProjects);
      
      const userProjectsKey = `dal_projects_${account}`;
      localStorage.setItem(userProjectsKey, JSON.stringify(updatedProjects));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training failed');
      console.error('Training error:', err);
    } finally {
      setLoading(false);
    }
  }, [connectionStatus.engine, alEngineUrl, projects, account]);

  const getProjectStatus = useCallback(async (projectId: string) => {
    if (!connectionStatus.engine) return;

    try {
      const response = await fetch(`${alEngineUrl}/projects/${projectId}/status`);
      if (response.ok) {
        const status = await response.json();
        
        // Update project with latest metrics
        const updatedProjects = projects.map(p => 
          p.id === projectId ? { 
            ...p, 
            accuracy: status.accuracy || p.accuracy,
            samples: status.labeled_samples || p.samples,
            status: status.status || p.status
          } : p
        );
        setProjects(updatedProjects);
        
        const userProjectsKey = `dal_projects_${account}`;
        localStorage.setItem(userProjectsKey, JSON.stringify(updatedProjects));
      }
    } catch (err) {
      console.error('Error getting project status:', err);
    }
  }, [connectionStatus.engine, alEngineUrl, projects, account]);

  const deleteProject = useCallback(async (projectId: string) => {
    if (!account) return;

    try {
      // Delete from AL engine if connected
      if (connectionStatus.engine) {
        await fetch(`${alEngineUrl}/projects/${projectId}`, {
          method: 'DELETE'
        });
      }

      // Remove from local storage
      const updatedProjects = projects.filter(p => p.id !== projectId);
      setProjects(updatedProjects);
      
      const userProjectsKey = `dal_projects_${account}`;
      localStorage.setItem(userProjectsKey, JSON.stringify(updatedProjects));
      
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      console.error('Delete error:', err);
    }
  }, [account, connectionStatus.engine, alEngineUrl, projects, selectedProject]);

  const renderConnectionStatus = () => (
    <div className="connection-status" style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
      <h4 style={{ margin: '0 0 8px 0' }}>Connection Status</h4>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: connectionStatus.engine ? '#4CAF50' : '#f44336' 
            }}
          />
          <span>AL Engine</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: connectionStatus.blockchain ? '#4CAF50' : '#f44336' 
            }}
          />
          <span>Blockchain</span>
        </div>
      </div>
      <div style={{ marginTop: '8px' }}>
        <input
          type="text"
          value={alEngineUrl}
          onChange={(e) => setAlEngineUrl(e.target.value)}
          placeholder="AL Engine URL"
          style={{ 
            padding: '4px 8px', 
            borderRadius: '4px', 
            border: '1px solid #ddd',
            marginRight: '8px',
            width: '200px'
          }}
        />
        <button 
          onClick={checkConnections}
          style={{ 
            padding: '4px 8px', 
            borderRadius: '4px', 
            border: '1px solid #ddd',
            backgroundColor: '#fff',
            cursor: 'pointer'
          }}
        >
          Test Connection
        </button>
      </div>
    </div>
  );

  const renderProjectList = () => (
    <div className="project-list">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>DAL Projects</h3>
        <button
          onClick={createNewProject}
          disabled={loading || !connectionStatus.engine || !account}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: loading || !connectionStatus.engine || !account ? 0.6 : 1
          }}
        >
          {loading ? 'Creating...' : 'New Project'}
        </button>
      </div>
      
      {projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#666' }}>
          No DAL projects yet. Create your first project to get started.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {projects.map((project) => (
            <div
              key={project.id}
              style={{
                padding: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: selectedProject?.id === project.id ? '#e3f2fd' : '#fff',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedProject(project)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px 0' }}>{project.name}</h4>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#666' }}>
                    <span>Status: <strong>{project.status}</strong></span>
                    <span>Participants: {project.participants}</span>
                    <span>Accuracy: {(project.accuracy * 100).toFixed(1)}%</span>
                    <span>Samples: {project.samples}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      getProjectStatus(project.id);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Refresh
                  </button>
                  {project.status === 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startTraining(project.id);
                      }}
                      disabled={!connectionStatus.engine}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: '#FF9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        opacity: !connectionStatus.engine ? 0.6 : 1
                      }}
                    >
                      Start Training
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject(project.id);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderProjectDetails = () => {
    if (!selectedProject) return null;

    return (
      <div className="project-details" style={{ marginTop: '24px' }}>
        <h3>Project Details: {selectedProject.name}</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h4>Project Information</h4>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div><strong>ID:</strong> {selectedProject.id}</div>
              <div><strong>Status:</strong> {selectedProject.status}</div>
              <div><strong>Contract Address:</strong> {selectedProject.contractAddress || 'Not deployed'}</div>
              <div><strong>Participants:</strong> {selectedProject.participants}</div>
              <div><strong>Current Accuracy:</strong> {(selectedProject.accuracy * 100).toFixed(2)}%</div>
              <div><strong>Labeled Samples:</strong> {selectedProject.samples}</div>
            </div>
          </div>
          
          {selectedProject.status === 'training' && (
            <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff3e0' }}>
              <h4>Training in Progress</h4>
              <p>The active learning algorithm is currently training. Check back for updates on accuracy and sample requirements.</p>
              <button
                onClick={() => getProjectStatus(selectedProject.id)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Check Progress
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!account) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h3>{title}</h3>
        <p>Please connect your wallet to access DAL functionality.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>{title}</h2>
      
      {error && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#ffebee', 
          border: '1px solid #f44336', 
          borderRadius: '4px', 
          marginBottom: '16px',
          color: '#d32f2f'
        }}>
          {error}
        </div>
      )}

      {renderConnectionStatus()}
      {renderProjectList()}
      {renderProjectDetails()}
    </div>
  );
};

export default DALComponent; 