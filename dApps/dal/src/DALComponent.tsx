import React, { useState, useCallback, useEffect } from 'react';

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
}

interface DALComponentProps {
  title?: string;
}

const DALComponent: React.FC<DALComponentProps> = ({ 
  title = 'Decentralized Active Learning' 
}) => {
  const [projects, setProjects] = useState<DALProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DALProject | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simplified auth state - in a real implementation, this would connect to the auth system
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    // Simulate initial data loading
    loadProjects();
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate loading projects from blockchain/backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockProjects: DALProject[] = [
        {
          id: '1',
          name: 'Medical Image Classification',
          contractAddress: '0x1234...5678',
          status: 'active',
          participants: 5,
          accuracy: 0.87,
          currentRound: 3,
          totalRounds: 10,
          lastUpdated: new Date()
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
          lastUpdated: new Date()
        }
      ];
      
      setProjects(mockProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        setLoading(true);
        // Simulate wallet connection
        await new Promise(resolve => setTimeout(resolve, 500));
        setAccount('0x1234567890abcdef');
        setIsConnected(true);
      } else {
        setError('MetaMask not found. Please install MetaMask to continue.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  const startTraining = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      // Simulate starting training
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setProjects(prev => prev.map(p => 
        p.id === projectId 
          ? { ...p, status: 'training' as const }
          : p
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start training');
    } finally {
      setLoading(false);
    }
  }, []);

  const submitLabels = useCallback(async (projectId: string, labels: any[]) => {
    setLoading(true);
    try {
      // Simulate label submission
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setProjects(prev => prev.map(p => 
        p.id === projectId 
          ? { ...p, currentRound: p.currentRound + 1, lastUpdated: new Date() }
          : p
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit labels');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="dal-container">
      <div className="dal-header">
        <h2>{title}</h2>
        <p>Decentralized Active Learning platform for collaborative machine learning</p>
      </div>

      {error && (
        <div className="dal-status error">
          {error}
          <button 
            className="dal-button" 
            onClick={() => setError(null)}
            style={{ marginLeft: '10px', padding: '4px 8px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="dal-content">
        {/* Connection Section */}
        <div className="dal-section">
          <h3>Wallet Connection</h3>
          {!isConnected ? (
            <div>
              <p>Connect your wallet to participate in active learning projects</p>
              <button 
                className="dal-button" 
                onClick={connectWallet}
                disabled={loading}
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          ) : (
            <div className="dal-status success">
              Connected: {account}
            </div>
          )}
        </div>

        {/* Projects Section */}
        <div className="dal-section">
          <h3>Active Learning Projects</h3>
          {loading && !error && (
            <div className="dal-status">Loading projects...</div>
          )}
          
          {projects.length === 0 && !loading ? (
            <div className="dal-status warning">
              No projects found. Create a new project or join an existing one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {projects.map(project => (
                <div 
                  key={project.id}
                  style={{
                    border: '1px solid var(--jp-border-color1)',
                    borderRadius: '4px',
                    padding: '12px',
                    background: selectedProject?.id === project.id ? 'var(--jp-layout-color2)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0 }}>{project.name}</h4>
                    <span 
                      className={`dal-status ${project.status}`}
                      style={{ 
                        padding: '2px 8px', 
                        fontSize: '0.8em',
                        background: project.status === 'active' ? 'var(--jp-success-color3)' : 
                                   project.status === 'training' ? 'var(--jp-warn-color3)' : 'var(--jp-layout-color3)'
                      }}
                    >
                      {project.status}
                    </span>
                  </div>
                  
                  <div style={{ margin: '8px 0', fontSize: '0.9em', color: 'var(--jp-ui-font-color2)' }}>
                    <div>Contract: {project.contractAddress}</div>
                    <div>Participants: {project.participants} | Accuracy: {(project.accuracy * 100).toFixed(1)}%</div>
                    <div>Round: {project.currentRound}/{project.totalRounds}</div>
                  </div>

                  <div className="dal-progress">
                    <div 
                      className="dal-progress-bar"
                      style={{ width: `${(project.currentRound / project.totalRounds) * 100}%` }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      className="dal-button"
                      onClick={() => setSelectedProject(project)}
                      style={{ padding: '4px 12px', fontSize: '0.8em' }}
                    >
                      {selectedProject?.id === project.id ? 'Selected' : 'Select'}
                    </button>
                    
                    {project.status === 'active' && isConnected && (
                      <button
                        className="dal-button"
                        onClick={() => startTraining(project.id)}
                        disabled={loading}
                        style={{ padding: '4px 12px', fontSize: '0.8em' }}
                      >
                        Start Round
                      </button>
                    )}
                    
                    {project.status === 'training' && isConnected && (
                      <button
                        className="dal-button"
                        onClick={() => submitLabels(project.id, [])}
                        disabled={loading}
                        style={{ padding: '4px 12px', fontSize: '0.8em' }}
                      >
                        Submit Labels
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Project Details */}
        {selectedProject && (
          <div className="dal-section">
            <h3>Project Details: {selectedProject.name}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <h4>Configuration</h4>
                <p><strong>Strategy:</strong> Uncertainty Sampling</p>
                <p><strong>Batch Size:</strong> 100 samples</p>
                <p><strong>Model:</strong> ResNet-50</p>
              </div>
              <div>
                <h4>Progress</h4>
                <p><strong>Current Round:</strong> {selectedProject.currentRound}/{selectedProject.totalRounds}</p>
                <p><strong>Accuracy:</strong> {(selectedProject.accuracy * 100).toFixed(1)}%</p>
                <p><strong>Last Updated:</strong> {selectedProject.lastUpdated.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="dal-section">
          <h3>Quick Actions</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button 
              className="dal-button"
              onClick={loadProjects}
              disabled={loading}
            >
              Refresh Projects
            </button>
            <button 
              className="dal-button"
              disabled={!isConnected}
            >
              Create Project
            </button>
            <button 
              className="dal-button"
              disabled={!isConnected}
            >
              Join Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DALComponent; 