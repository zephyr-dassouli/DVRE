import React from 'react';
import { ModelUpdatesPanelProps } from './PanelTypes';

export const ModelUpdatesPanel: React.FC<ModelUpdatesPanelProps> = ({
  modelUpdates,
  isCoordinator
}) => {
  if (!isCoordinator) {
    return (
      <div className="model-updates-panel">
        <div className="panel-header">
          <h3>Model Updates History</h3>
          <p>Performance statistics and model updates information</p>
        </div>
        <div style={{ 
          textAlign: 'center', 
          padding: '60px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
          <h4>Contributor Access</h4>
          <p style={{ color: '#666', lineHeight: '1.6', maxWidth: '400px', margin: '0 auto' }}>
            Model updates are only available to project coordinators during active learning.
            <br /><br />
            After the project ends and final results are published, all model performance 
            data and updates will be visible and available in the project storage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="model-updates-panel">
      <div className="panel-header">
        <h3>Model Updates History</h3>
        <p>Performance statistics for each iteration (latest on top)</p>
      </div>
      <div className="updates-list">
        {modelUpdates.length > 0 ? (
          modelUpdates.map(update => (
            <div key={update.iterationNumber} className="update-item" style={{
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '16px',
              backgroundColor: 'white'
            }}>
              <div className="update-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <div className="iteration-info">
                  <h4>Iteration {update.iterationNumber}</h4>
                </div>
                <div className="samples-added" style={{
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  +{update.samplesAddedCount} samples
                </div>
              </div>
              <div className="performance-metrics" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '12px'
              }}>
                <div className="metric">
                  <span className="metric-label" style={{ color: '#666', fontSize: '12px' }}>Accuracy:</span>
                  <span className="metric-value" style={{ fontWeight: 'bold', marginLeft: '4px' }}>
                    {(update.performance.accuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label" style={{ color: '#666', fontSize: '12px' }}>Precision:</span>
                  <span className="metric-value" style={{ fontWeight: 'bold', marginLeft: '4px' }}>
                    {(update.performance.precision * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label" style={{ color: '#666', fontSize: '12px' }}>Recall:</span>
                  <span className="metric-value" style={{ fontWeight: 'bold', marginLeft: '4px' }}>
                    {(update.performance.recall * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label" style={{ color: '#666', fontSize: '12px' }}>F1-Score:</span>
                  <span className="metric-value" style={{ fontWeight: 'bold', marginLeft: '4px' }}>
                    {(update.performance.f1Score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              {update.notes && (
                <div className="update-notes" style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  {update.notes}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              No Model Updates Yet
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              Model performance data will appear here after active learning iterations begin.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelUpdatesPanel; 