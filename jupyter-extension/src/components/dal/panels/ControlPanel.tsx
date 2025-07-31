import React from 'react';
import { ControlPanelProps } from './PanelTypes';

export const ControlPanel: React.FC<ControlPanelProps> = ({
  project,
  currentUser,
  isCoordinator,
  onStartNextIteration,
  onEndProject,
  onError,
  projectEndStatus
}) => {

  const handleStartNextIteration = async () => {
    try {
      await onStartNextIteration();
    } catch (error) {
      console.error('❌ Failed to start next iteration:', error);
      onError(error instanceof Error ? error.message : 'Failed to start iteration');
    }
  };

  const handleEndProject = async () => {
    const confirmed = window.confirm('Are you sure you want to end this project? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await onEndProject();
    } catch (error) {
      console.error('❌ Failed to end project:', error);
      onError(error instanceof Error ? error.message : 'Failed to end project');
    }
  };

  if (!isCoordinator) {
    return (
      <div className="control-panel">
        <div className="panel-header">
          <h3>Control Panel</h3>
          <p>Project management information</p>
        </div>
        
        {/* Explanatory text for contributors */}
        <div style={{ 
          backgroundColor: '#f0f9ff',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '24px' }}>ℹ️</span>
            <h4 style={{ margin: 0, color: '#1e40af' }}>Project Management Access</h4>
          </div>
          <p style={{ margin: 0, color: '#1e40af', lineHeight: '1.5' }}>
            Only the <strong>project coordinator</strong> has the ability to start new iterations and end the project. 
            As a contributor, you can view the project status below and participate in labeling when new samples are available.
          </p>
        </div>

        {/* Project Status Summary - same as coordinator view */}
        <div className="project-status-summary" style={{
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          padding: '24px',
          backgroundColor: '#f8fafc'
        }}>
          <h4 style={{ marginBottom: '16px', color: '#1f2937' }}>📊 Project Status Summary</h4>
          <div className="status-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px' 
          }}>
            <div className="status-item">
              <label style={{ 
                display: 'block', 
                fontSize: '12px', 
                fontWeight: 'bold', 
                color: '#6b7280', 
                marginBottom: '4px' 
              }}>
                Current Status:
              </label>
              <span className={`status-value ${project.status}`} style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                backgroundColor: project.status === 'active' ? '#dcfce7' : '#fef3c7',
                color: project.status === 'active' ? '#166534' : '#92400e'
              }}>
                {project.status.toUpperCase()}
              </span>
            </div>
            
            <div className="status-item">
              <label style={{ 
                display: 'block', 
                fontSize: '12px', 
                fontWeight: 'bold', 
                color: '#6b7280', 
                marginBottom: '4px' 
              }}>
                Active:
              </label>
              <span className={`status-value ${project.isActive ? 'active' : 'inactive'}`} style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                backgroundColor: project.isActive ? '#dcfce7' : '#fee2e2',
                color: project.isActive ? '#166534' : '#dc2626'
              }}>
                {project.isActive ? 'Yes' : 'No'}
              </span>
            </div>
            
            <div className="status-item">
              <label style={{ 
                display: 'block', 
                fontSize: '12px', 
                fontWeight: 'bold', 
                color: '#6b7280', 
                marginBottom: '4px' 
              }}>
                Progress:
              </label>
              <span className="status-value" style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#1f2937'
              }}>
                Round {project.currentRound} of {project.totalRounds} ({Math.round((project.currentRound / project.totalRounds) * 100)}%)
              </span>
            </div>
            
            <div className="status-item">
              <label style={{ 
                display: 'block', 
                fontSize: '12px', 
                fontWeight: 'bold', 
                color: '#6b7280', 
                marginBottom: '4px' 
              }}>
                Contract Address:
              </label>
              <span className="status-value" style={{
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#6b7280'
              }}>
                {project.contractAddress.slice(0, 10)}...{project.contractAddress.slice(-8)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="control-panel">
      <div className="panel-header">
        <h3>Control Panel</h3>
        <p>Coordinator controls for project management</p>
      </div>
      
      <div className="control-actions" style={{ 
        display: 'grid', 
        gap: '20px', 
        marginBottom: '30px' 
      }}>
        <div className="action-card" style={{
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          padding: '24px',
          backgroundColor: 'white'
        }}>
          <h4 style={{ marginBottom: '12px', color: '#1f2937' }}>🚀 Start Next Iteration</h4>
          
          {/* Show warning if project should end or max iterations reached */}
          {(projectEndStatus.shouldEnd || project.currentRound >= project.totalRounds) && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                color: '#92400e',
                marginBottom: '4px'
              }}>
                ⚠️ Cannot Start New Iteration
              </div>
              <div style={{ color: '#78350f', fontSize: '14px' }}>
                {project.currentRound >= project.totalRounds 
                  ? `Maximum iterations reached (${project.currentRound}/${project.totalRounds})`
                  : projectEndStatus.reason || 'Project should end'
                }
              </div>
            </div>
          )}
          
          <p style={{ color: '#666', marginBottom: '16px', lineHeight: '1.5' }}>
            Trigger a new Active Learning round. This will:
            <br />• Train the model with newly labeled samples
            <br />• Generate new samples for labeling  
            <br />• Start batch voting for the next round
          </p>
          <button 
            className="primary-btn"
            onClick={handleStartNextIteration}
            disabled={!project.isActive || projectEndStatus.shouldEnd || project.currentRound >= project.totalRounds}
            style={{
              padding: '12px 24px',
              backgroundColor: (project.isActive && !projectEndStatus.shouldEnd && project.currentRound < project.totalRounds) ? '#10b981' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (project.isActive && !projectEndStatus.shouldEnd && project.currentRound < project.totalRounds) ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (project.isActive && !projectEndStatus.shouldEnd && project.currentRound < project.totalRounds) {
                e.currentTarget.style.backgroundColor = '#059669';
              }
            }}
            onMouseLeave={(e) => {
              if (project.isActive && !projectEndStatus.shouldEnd && project.currentRound < project.totalRounds) {
                e.currentTarget.style.backgroundColor = '#10b981';
              }
            }}
          >
            {!project.isActive ? 'Project Inactive' : 
             (projectEndStatus.shouldEnd || project.currentRound >= project.totalRounds) ? 'Cannot Start (Project Should End)' :
             'Start Next Iteration'}
          </button>
          {!project.isActive && (
            <div style={{ 
              fontSize: '12px', 
              color: '#ef4444', 
              marginTop: '8px' 
            }}>
              Project must be active to start iterations
            </div>
          )}
        </div>
        
        <div className="action-card" style={{
          border: projectEndStatus.shouldEnd ? '2px solid #f59e0b' : '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '24px',
          backgroundColor: projectEndStatus.shouldEnd ? '#fffbeb' : '#fef2f2'
        }}>
          <h4 style={{ marginBottom: '12px', color: projectEndStatus.shouldEnd ? '#d97706' : '#dc2626' }}>
            {projectEndStatus.shouldEnd ? '🚨 Project Should End' : '🏁 End Project'}
          </h4>
          
          {projectEndStatus.shouldEnd && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                color: '#92400e',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>{(projectEndStatus.reason && projectEndStatus.reason.includes('Maximum iterations')) ? '🎯' : 
                        (projectEndStatus.reason && projectEndStatus.reason.includes('unlabeled samples')) ? '📊' : '🚨'}</span>
                <span>Automatic End Condition Triggered</span>
              </div>
              <div style={{ color: '#78350f', fontSize: '14px', lineHeight: '1.4' }}>
                <strong>Reason:</strong> {projectEndStatus.reason || 'Unknown reason'}
                <br />
                <strong>Current Round:</strong> {projectEndStatus.currentRound || 0} of {projectEndStatus.maxIterations || 0}
              </div>
            </div>
          )}
          
          <p style={{ color: '#666', marginBottom: '16px', lineHeight: '1.5' }}>
            {projectEndStatus.shouldEnd ? 
              'The system recommends ending this project. This will:' :
              'Manually end the project. This will:'
            }
            <br />• Deactivate the project permanently
            <br />• Finalize all voting sessions
            <br />• Trigger final results collection
            <br />• <strong>This action cannot be undone!</strong>
          </p>
          <button 
            className="danger-btn"
            onClick={handleEndProject}
            disabled={!project.isActive}
            style={{
              padding: '12px 24px',
              backgroundColor: project.isActive ? 
                (projectEndStatus.shouldEnd ? '#d97706' : '#dc2626') : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: project.isActive ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (project.isActive) {
                e.currentTarget.style.backgroundColor = projectEndStatus.shouldEnd ? '#b45309' : '#b91c1c';
              }
            }}
            onMouseLeave={(e) => {
              if (project.isActive) {
                e.currentTarget.style.backgroundColor = projectEndStatus.shouldEnd ? '#d97706' : '#dc2626';
              }
            }}
          >
            {!project.isActive ? 'Project Already Ended' : 
             projectEndStatus.shouldEnd ? 'End Project Now (Recommended)' : 'End Project'}
          </button>
        </div>
      </div>
      
      <div className="project-status-summary" style={{
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        padding: '24px',
        backgroundColor: '#f8fafc'
      }}>
        <h4 style={{ marginBottom: '16px', color: '#1f2937' }}>📊 Project Status Summary</h4>
        <div className="status-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px' 
        }}>
          <div className="status-item">
            <label style={{ 
              display: 'block', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Current Status:
            </label>
            <span className={`status-value ${project.status}`} style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              backgroundColor: project.status === 'active' ? '#dcfce7' : '#fef3c7',
              color: project.status === 'active' ? '#166534' : '#92400e'
            }}>
              {project.status.toUpperCase()}
            </span>
          </div>
          
          <div className="status-item">
            <label style={{ 
              display: 'block', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Active:
            </label>
            <span className={`status-value ${project.isActive ? 'active' : 'inactive'}`} style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              backgroundColor: project.isActive ? '#dcfce7' : '#fee2e2',
              color: project.isActive ? '#166534' : '#dc2626'
            }}>
              {project.isActive ? 'Yes' : 'No'}
            </span>
          </div>
          
          <div className="status-item">
            <label style={{ 
              display: 'block', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Progress:
            </label>
            <span className="status-value" style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              Round {project.currentRound} of {project.totalRounds} ({Math.round((project.currentRound / project.totalRounds) * 100)}%)
            </span>
          </div>
          
          <div className="status-item">
            <label style={{ 
              display: 'block', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Contract Address:
            </label>
            <span className="status-value" style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#6b7280'
            }}>
              {project.contractAddress.slice(0, 10)}...{project.contractAddress.slice(-8)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel; 