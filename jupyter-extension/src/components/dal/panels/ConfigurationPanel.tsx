import React from 'react';
import { ConfigurationPanelProps } from './PanelTypes';

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  project,
  onRefresh
}) => {
  return (
    <div className="configuration-panel">
      <div className="panel-header">
        <h3>Project Configuration</h3>
      </div>
      {project.alConfiguration ? (
        <div className="config-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '16px' 
        }}>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>AL Scenario:</label>
            <span style={{ marginLeft: '8px' }}>{project.alConfiguration.scenario}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Query Strategy:</label>
            <span style={{ marginLeft: '8px' }}>{project.alConfiguration.queryStrategy}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Model:</label>
            <span style={{ marginLeft: '8px' }}>{project.alConfiguration.model.type}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Query Batch Size:</label>
            <span style={{ marginLeft: '8px' }}>{project.alConfiguration.queryBatchSize}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Max Iterations:</label>
            <span style={{ marginLeft: '8px' }}>{project.alConfiguration.maxIterations}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Voting Consensus:</label>
            <span style={{ marginLeft: '8px' }}>{project.alConfiguration.votingConsensus}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Voting Timeout:</label>
            <span style={{ marginLeft: '8px' }}>{project.alConfiguration.votingTimeout}s</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Label Space:</label>
            <span style={{ marginLeft: '8px' }}>{project.alConfiguration.labelSpace?.join(', ') || 'Not configured'}</span>
          </div>
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚙️</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            No Configuration Available
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>
            This project doesn't have Active Learning configuration data available.
            <br />
            <button 
              onClick={onRefresh}
              style={{ 
                marginTop: '16px',
                padding: '10px 20px', 
                backgroundColor: '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔄 Refresh Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigurationPanel; 