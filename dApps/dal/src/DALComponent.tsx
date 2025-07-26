import React, { useState, useEffect } from 'react';
import { DALProject, DALComponentProps, ProjectStats } from './types';

/**
 * Clean DAL Component - Integrates with DVRE Core
 * Shows Active Learning projects and links to DVRE Project Configuration
 */
export const DALComponent: React.FC<DALComponentProps> = ({ 
  title = 'Decentralized Active Learning',
  onProjectSelect 
}) => {
  const [projects, setProjects] = useState<DALProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Integration point: Use DVRE core hooks (to be connected)
  useEffect(() => {
    const loadDALProjects = async () => {
      try {
        setLoading(true);
        
        // TODO: Connect to DVRE core useProjects hook
        // For now, mock some data to show the structure
        const mockProjects: DALProject[] = [
          {
            id: '0x123...abc',
            name: 'Medical Image Classification',
            contractAddress: '0x123...abc',
            status: 'configured',
            participants: 3,
            currentRound: 2,
            totalRounds: 10,
            lastUpdated: new Date(),
            workflowConfigured: true
          },
          {
            id: '0x456...def',
            name: 'Text Sentiment Analysis',
            contractAddress: '0x456...def', 
            status: 'running',
            participants: 5,
            currentRound: 7,
            totalRounds: 15,
            lastUpdated: new Date(),
            workflowConfigured: true
          }
        ];
        
        setProjects(mockProjects);
      } catch (err) {
        setError('Failed to load DAL projects');
        console.error('DAL: Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDALProjects();
  }, []);

  const handleConfigureWorkflow = (project: DALProject) => {
    // Integration: Open DVRE Project Configuration for this project
    const configUrl = `/lab/tree?project=${project.contractAddress}&tab=configuration`;
    window.open(configUrl, '_blank');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#f59e0b';
      case 'configured': return '#3b82f6';
      case 'running': return '#10b981';
      case 'completed': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getProgressPercentage = (current: number, total: number) => {
    return Math.round((current / total) * 100);
  };

  if (loading) {
    return (
      <div className="dal-container">
        <div className="dal-loading">
          <h3>{title}</h3>
          <p>Loading Active Learning projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dal-container">
        <div className="dal-error">
          <h3>{title}</h3>
          <p style={{ color: 'var(--jp-error-color1)' }}>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dal-container">
      <div className="dal-header">
        <h3>{title}</h3>
        <p>Collaborative machine learning with active learning strategies</p>
      </div>

      {projects.length === 0 ? (
        <div className="dal-empty">
          <h4>No Active Learning Projects</h4>
          <p>Create a new project in <strong>Project Collaboration</strong> to get started.</p>
          <p><em>Tip: Include "active learning" or "classification" in your project description.</em></p>
        </div>
      ) : (
        <div className="dal-projects">
          {projects.map((project) => (
            <div key={project.id} className="dal-project-card">
              <div className="project-header">
                <h4>{project.name}</h4>
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(project.status) }}
                >
                  {project.status.toUpperCase()}
                </span>
              </div>

              <div className="project-stats">
                <div className="stat">
                  <span className="label">Progress:</span>
                  <span className="value">
                    {project.currentRound}/{project.totalRounds} rounds 
                    ({getProgressPercentage(project.currentRound, project.totalRounds)}%)
                  </span>
                </div>
                <div className="stat">
                  <span className="label">Participants:</span>
                  <span className="value">{project.participants}</span>
                </div>
                <div className="stat">
                  <span className="label">Last Updated:</span>
                  <span className="value">{project.lastUpdated.toLocaleDateString()}</span>
                </div>
              </div>

              <div className="project-actions">
                <button 
                  className="configure-btn"
                  onClick={() => handleConfigureWorkflow(project)}
                  disabled={!project.workflowConfigured}
                >
                  {project.workflowConfigured ? 'Configure Workflow' : 'Setup Required'}
                </button>
                
                {project.status === 'running' && (
                  <button 
                    className="monitor-btn"
                    onClick={() => onProjectSelect?.(project)}
                  >
                    Monitor Progress
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dal-footer">
        <p>
          <strong>Integration:</strong> Workflow configuration uses DVRE Core AL Configuration Panel
        </p>
      </div>
    </div>
  );
};

export default DALComponent; 