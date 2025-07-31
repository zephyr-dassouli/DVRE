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

  return (
    <div className="publish-results-panel">
      <div className="panel-header">
        <h3>Publish Final Results</h3>
        <p>Make your Active Learning project results publicly available</p>
      </div>

      <div className="panel-content">
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
          backgroundColor: '#fefce8',
          border: '1px solid #facc15',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h4 style={{ 
            marginTop: 0, 
            marginBottom: '8px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>📊</span>
            Current Project Status
          </h4>
          <div style={{ color: '#92400e', fontSize: '14px' }}>
            <p><strong>Project ID:</strong> {project.contractAddress}</p>
            <p><strong>Current Round:</strong> {project.currentRound || 0} / {project.totalRounds || 'Unknown'}</p>
            <p><strong>Status:</strong> {project.status || 'Active'}</p>
          </div>
        </div>

        {/* Warning Section */}
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

        {/* Action Button */}
        <div className="action-section" style={{ textAlign: 'center' }}>
          <button
            onClick={handlePublishFinalResults}
            disabled={isPublishing}
            style={{
              backgroundColor: isPublishing ? '#94a3b8' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 32px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isPublishing ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 auto'
            }}
            onMouseOver={(e) => {
              if (!isPublishing) {
                (e.target as HTMLElement).style.backgroundColor = '#047857';
              }
            }}
            onMouseOut={(e) => {
              if (!isPublishing) {
                (e.target as HTMLElement).style.backgroundColor = '#059669';
              }
            }}
          >
            <span style={{ fontSize: '18px' }}>
              {isPublishing ? '⏳' : '🚀'}
            </span>
            {isPublishing ? 'Publishing Final Results...' : 'Publish Final Results'}
          </button>
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