import React, { useState } from 'react';
import { PublishFinalResultsPanelProps } from './PanelTypes';

export const PublishFinalResultsPanel: React.FC<PublishFinalResultsPanelProps> = ({
  project,
  currentUser,
  isCoordinator,
  onPublishFinalResults,
  onError
}) => {
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishFinalResults = async () => {
    // Check if project has ended before allowing publication
    if (project?.isActive) {
      onError('Cannot publish final results while project is still active. Please end the project first.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to publish the final results?\n\n' +
      'This will:\n' +
      '• Upload the updated RO-Crate with all AL iterations to IPFS\n' +
      '• Make the final results publicly available\n' +
      '• Update the project contract with the final RO-Crate hash\n\n' +
      'This action cannot be undone.'
    );
    
    if (!confirmed) return;

    try {
      setIsPublishing(true);
      await onPublishFinalResults();
    } catch (error) {
      console.error('❌ Failed to publish final results:', error);
      onError(error instanceof Error ? error.message : 'Failed to publish final results');
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isCoordinator) {
    return (
      <div className="publish-results-panel">
        <div className="panel-header">
          <h3>Publish Final Results</h3>
          <p>Access restricted to project coordinators</p>
        </div>
        <div style={{ 
          textAlign: 'center', 
          padding: '60px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h4>Coordinator Access Required</h4>
          <p style={{ color: '#666' }}>
            Only project coordinators can publish final results.
          </p>
        </div>
      </div>
    );
  }

  // Check if project is still active (not ended)
  const projectIsActive = project?.isActive !== false;
  const canPublish = !projectIsActive;

  return (
    <div className="publish-results-panel">
      <div className="panel-header">
        <h3>Publish Final Results</h3>
        <p>Make your Active Learning project results publicly available</p>
      </div>

      <div className="panel-content">
        {/* Project Status Check */}
        {projectIsActive && (
          <div className="warning-section" style={{
            backgroundColor: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h4 style={{ 
              marginTop: 0, 
              marginBottom: '12px',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              Project Still Active
            </h4>
            <p style={{ margin: '0 0 12px 0', color: '#92400e', fontSize: '16px', fontWeight: 'bold' }}>
              Cannot publish final results while the project is still active.
            </p>
            <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>
              Please end the project first using the "End Project" button in the Control Panel, then return here to publish the final results.
            </p>
          </div>
        )}

        {/* Information Section */}
        <div className="info-section" style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h4 style={{ 
            marginTop: 0, 
            marginBottom: '16px',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '20px' }}>📋</span>
            What happens when you publish?
          </h4>
          
          <ul style={{ 
            margin: 0, 
            paddingLeft: '20px',
            lineHeight: '1.6',
            color: '#475569'
          }}>
            <li><strong>RO-Crate Collection:</strong> The complete project RO-Crate including all AL iterations, models, and performance metrics will be collected from the AL-Engine</li>
            <li><strong>IPFS Upload:</strong> The updated RO-Crate will be uploaded to IPFS, making it permanently accessible</li>
            <li><strong>Blockchain Update:</strong> The project smart contract will be updated with the final RO-Crate hash</li>
            <li><strong>Public Access:</strong> The final results will be discoverable and downloadable by anyone</li>
          </ul>
        </div>

        {/* Project Status */}
        <div className="project-status" style={{
          backgroundColor: projectIsActive ? '#fef3c7' : '#f0fdf4',
          border: `1px solid ${projectIsActive ? '#facc15' : '#22c55e'}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h4 style={{ 
            marginTop: 0, 
            marginBottom: '8px',
            color: projectIsActive ? '#92400e' : '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>{projectIsActive ? '🟡' : '🟢'}</span>
            Current Project Status
          </h4>
          <div style={{ color: projectIsActive ? '#92400e' : '#166534', fontSize: '14px' }}>
            <p><strong>Project ID:</strong> {project.contractAddress}</p>
            <p><strong>Current Round:</strong> {project.currentRound || 0} / {project.totalRounds || 'Unknown'}</p>
            <p><strong>Status:</strong> {projectIsActive ? 'Active (Running)' : 'Ended (Ready for Publishing)'}</p>
            {projectIsActive && (
              <p style={{ fontWeight: 'bold', marginTop: '8px' }}>
                ⚠️ Project must be ended before publishing final results
              </p>
            )}
          </div>
        </div>

        {/* Warning Section for Non-Active Projects */}
        {!projectIsActive && (
          <div className="warning-section" style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '32px'
          }}>
            <h4 style={{ 
              marginTop: 0, 
              marginBottom: '8px',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              Important Note
            </h4>
            <p style={{ margin: 0, color: '#dc2626', fontSize: '14px' }}>
              This action cannot be undone. Make sure your Active Learning project is complete and you're ready to share the final results.
            </p>
          </div>
        )}

        {/* Action Button */}
        <div className="action-section" style={{ textAlign: 'center' }}>
          <button
            onClick={handlePublishFinalResults}
            disabled={isPublishing || !canPublish}
            style={{
              backgroundColor: (!canPublish || isPublishing) ? '#94a3b8' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 32px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: (!canPublish || isPublishing) ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 auto',
              opacity: !canPublish ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (canPublish && !isPublishing) {
                (e.target as HTMLElement).style.backgroundColor = '#047857';
              }
            }}
            onMouseOut={(e) => {
              if (canPublish && !isPublishing) {
                (e.target as HTMLElement).style.backgroundColor = '#059669';
              }
            }}
          >
            <span style={{ fontSize: '18px' }}>
              {isPublishing ? '⏳' : !canPublish ? '🔒' : '🚀'}
            </span>
            {isPublishing ? 'Publishing Final Results...' : 
             !canPublish ? 'Project Must Be Ended First' : 
             'Publish Final Results'}
          </button>
          
          {!canPublish && (
            <p style={{ 
              marginTop: '12px', 
              fontSize: '14px', 
              color: '#6b7280',
              fontStyle: 'italic'
            }}>
              End the project in the Control Panel to enable publishing
            </p>
          )}
        </div>

        {/* Additional Information */}
        <div className="additional-info" style={{
          marginTop: '32px',
          padding: '16px',
          backgroundColor: '#f1f5f9',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#64748b'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Need help?</strong> Check the documentation for more information about publishing AL project results.
          </p>
          <p style={{ margin: 0 }}>
            The published RO-Crate will include all iterations, model weights, performance metrics, and labeled datasets from your Active Learning project.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublishFinalResultsPanel; 