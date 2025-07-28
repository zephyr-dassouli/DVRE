import React, { useState } from 'react';
import { DALProject, DALComponentProps } from './types';
import DALProjectPage from './DALProjectPage';
import { useDALProject } from '../../hooks/useDALProject';
import { useAuth } from '../../hooks/useAuth';

/**
 * DAL Landing Page Component - Shows user's DAL projects
 * Implements the Landing Page functionality from the design document
 */
export const DALComponent: React.FC<DALComponentProps> = ({ 
  title = 'Decentralized Active Learning',
  onProjectSelect 
}) => {
  const [selectedView, setSelectedView] = useState<'all' | 'owned' | 'joined'>('all');
  const [selectedProject, setSelectedProject] = useState<DALProject | null>(null);

  // Use the real DAL hook from the jupyter-extension
  const { dalProjects, loading, error } = useDALProject();
  const { account } = useAuth();

  // Convert DALProjectInfo to DALProject format
  const convertToDALProject = (projectInfo: any): DALProject => {
    const isOwner = projectInfo.creator?.toLowerCase() === account?.toLowerCase();
    
    return {
      id: projectInfo.address,
      name: projectInfo.projectData?.name || projectInfo.objective,
      contractAddress: projectInfo.address,
      status: projectInfo.isActive ? 'running' : 'completed',
      participants: projectInfo.participants?.length || 0,
      currentRound: projectInfo.currentIteration || 1,
      totalRounds: projectInfo.alConfiguration?.maxIterations || 10,
      lastUpdated: new Date(projectInfo.lastModified * 1000),
      workflowConfigured: true,
      creator: projectInfo.creator,
      isActive: projectInfo.isActive,
      alConfiguration: projectInfo.alConfiguration,
      modelPerformance: projectInfo.modelPerformance,
      activeVoting: projectInfo.activeVoting,
      userRole: isOwner ? 'coordinator' : 'contributor',
      totalSamplesLabeled: projectInfo.totalSamplesLabeled,
      isDeployed: projectInfo.isDeployed,
      deploymentStatus: projectInfo.deploymentStatus
    };
  };

  // Convert projects and separate owned vs joined
  const allProjects = dalProjects.map(convertToDALProject);
  const ownedProjects = allProjects.filter(p => p.userRole === 'coordinator');
  const joinedProjects = allProjects.filter(p => p.userRole === 'contributor');

  const handleProjectSelect = (project: DALProject) => {
    // Only allow opening deployed projects
    if (project.isDeployed) {
      setSelectedProject(project);
      onProjectSelect?.(project);
    } else {
      // For non-deployed projects, show a message
      alert('This project needs to be deployed first. Please deploy it in Project Deployment before accessing Active Learning features.');
    }
  };

  const handleBackToLanding = () => {
    setSelectedProject(null);
  };

  // If a project is selected, show the project page
  if (selectedProject) {
    return (
      <DALProjectPage 
        project={selectedProject} 
        onBack={handleBackToLanding}
      />
    );
  }

  const getFilteredProjects = () => {
    switch (selectedView) {
      case 'owned': return ownedProjects;
      case 'joined': return joinedProjects;
      case 'all':
      default: return [...ownedProjects, ...joinedProjects];
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#f59e0b';
      case 'configured': return '#3b82f6';
      case 'running': return '#10b981';
      case 'completed': return '#6b7280';
      case 'terminated': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getProgressPercentage = (current: number, total: number) => {
    return Math.round((current / total) * 100);
  };

  const formatTimeRemaining = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Show authentication message if not connected
  if (!account) {
    return (
      <div className="dal-container">
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          color: 'var(--jp-ui-font-color2)'
        }}>
          <h3>{title}</h3>
          <p>Please connect your wallet to access Active Learning projects.</p>
        </div>
      </div>
    );
  }

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

  const filteredProjects = getFilteredProjects();

  return (
    <div className="dal-container">
      <div className="dal-header">
        <h3>{title}</h3>
        <p>Collaborative machine learning with active learning strategies</p>
        
        {/* Project Summary */}
        <div className="project-summary">
          <div className="summary-item">
            <span className="count">{ownedProjects.length}</span>
            <span className="label">Owned Projects</span>
          </div>
          <div className="summary-item">
            <span className="count">{joinedProjects.length}</span>
            <span className="label">Joined Projects</span>
          </div>
          <div className="summary-item">
            <span className="count">{ownedProjects.filter(p => p.isActive).length + joinedProjects.filter(p => p.isActive).length}</span>
            <span className="label">Active Projects</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="dal-filters">
        <button 
          className={`filter-tab ${selectedView === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedView('all')}
        >
          All Projects ({ownedProjects.length + joinedProjects.length})
        </button>
        <button 
          className={`filter-tab ${selectedView === 'owned' ? 'active' : ''}`}
          onClick={() => setSelectedView('owned')}
        >
          Owned ({ownedProjects.length})
        </button>
        <button 
          className={`filter-tab ${selectedView === 'joined' ? 'active' : ''}`}
          onClick={() => setSelectedView('joined')}
        >
          Joined ({joinedProjects.length})
        </button>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="dal-empty">
          <h4>No Active Learning Projects</h4>
          <p>Create a new Active Learning project to get started:</p>
          <ol style={{ textAlign: 'left', margin: '16px auto', maxWidth: '400px' }}>
            <li>Go to <strong>Project Collaboration</strong></li>
            <li>Create a new project using the <strong>Active Learning template</strong></li>
            <li>Configure and deploy it in <strong>Project Deployment</strong></li>
          </ol>
        </div>
      ) : (
        <div className="dal-projects">
          {filteredProjects.map((project) => (
            <div key={project.id} className="dal-project-card">
              <div className="project-header">
                <div className="project-title-row">
                  <h4>{project.name}</h4>
                  <div className="project-badges">
                    <span className="role-badge" data-role={project.userRole}>
                      {project.userRole === 'coordinator' ? 'COORDINATOR' : 'CONTRIBUTOR'}
                    </span>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(project.status) }}
                    >
                      {project.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                {project.alConfiguration && (
                  <div className="project-config-summary">
                    <span>Strategy: {project.alConfiguration.queryStrategy}</span>
                    <span>Model: {project.alConfiguration.model.type}</span>
                    <span>Batch: {project.alConfiguration.queryBatchSize}</span>
                  </div>
                )}
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
                  <span className="label">Status:</span>
                  <span className={`value ${project.isDeployed ? 'deployed' : 'not-deployed'}`}>
                    {project.isDeployed ? 'Deployed' : 'Not Deployed'}
                  </span>
                </div>
                {project.isDeployed && (
                  <>
                    {project.totalSamplesLabeled !== undefined && (
                      <div className="stat">
                        <span className="label">Samples Labeled:</span>
                        <span className="value">{project.totalSamplesLabeled}</span>
                      </div>
                    )}
                    {project.modelPerformance?.accuracy && (
                      <div className="stat">
                        <span className="label">Accuracy:</span>
                        <span className="value">{(project.modelPerformance.accuracy * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </>
                )}
                <div className="stat">
                  <span className="label">Last Updated:</span>
                  <span className="value">{project.lastUpdated.toLocaleDateString()}</span>
                </div>
              </div>

              {/* Active Voting Indicator */}
              {project.activeVoting && project.isActive && project.isDeployed && (
                <div className="active-voting-banner">
                  <div className="voting-info">
                    <span className="voting-status">Active Voting in Progress</span>
                    <span className="time-remaining">
                      Time remaining: {formatTimeRemaining(project.activeVoting.timeRemaining)}
                    </span>
                  </div>
                  <div className="voting-progress">
                    {Object.entries(project.activeVoting.currentVotes).map(([label, count]) => (
                      <span key={label} className="vote-count">
                        {label}: {count as number}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="project-actions">
                {project.isDeployed ? (
                  <button 
                    className="primary-btn"
                    onClick={() => handleProjectSelect(project)}
                  >
                    {project.isActive ? 'Open Project' : 'View Results'}
                  </button>
                ) : (
                  <div className="deployment-required">
                    <p className="deployment-message">
                      Deploy this project in <strong>Project Deployment</strong> to access Active Learning features.
                    </p>
                    <button 
                      className="deployment-btn"
                      onClick={() => handleProjectSelect(project)}
                      disabled
                    >
                      Not Deployed ({project.deploymentStatus || 'pending'})
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DALComponent; 