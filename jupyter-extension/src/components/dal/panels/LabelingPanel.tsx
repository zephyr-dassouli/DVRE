import React, { useState, useEffect } from 'react';
import { LabelingPanelProps } from './PanelTypes';

export const LabelingPanel: React.FC<LabelingPanelProps> = ({
  project,
  currentUser,
  isCoordinator,
  sessionState,
  batchProgress,
  iterationCompleted,
  iterationMessage,
  onVoteSubmission,
  onBatchVoteSubmission,
  onAcknowledgeCompletion,
  onError
}) => {

  // State for batch voting
  const [activeBatch, setActiveBatch] = useState<{
    sampleIds: string[];
    sampleData: any[];
    labelOptions: string[];
    timeRemaining: number;
    round: number;
    batchSize: number;
  } | null>(null);
  
  const [batchVotes, setBatchVotes] = useState<{ [sampleId: string]: string }>({});
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Load active batch when session state changes
  useEffect(() => {
    const loadActiveBatch = async () => {
      try {
        // Get DAL session from window context (temporary way to access it)
        const dalSession = (window as any).currentDALSession;
        if (dalSession) {
          const batch = await dalSession.getActiveBatch();
          
          if (batch) {
            console.log(`🗳️ Loaded batch with ${batch.batchSize} samples for simultaneous voting`);
            setActiveBatch(batch);
            // Reset batch votes when loading a new batch
            setBatchVotes({});
          } else {
            // Clear active batch if none found
            setActiveBatch(null);
            setBatchVotes({});
          }
        }
      } catch (error) {
        console.error('Failed to load active batch:', error);
      }
    };
    
    // Load batch immediately when session changes
    loadActiveBatch();
    
    // Also retry loading after a short delay if session is still initializing
    // This handles the case where session state hasn't been updated yet but voting is active
    const retryTimeout = setTimeout(() => {
      if (!activeBatch) {
        console.log('🔄 Retrying active batch load after session initialization...');
        loadActiveBatch();
      }
    }, 1000);
    
    return () => clearTimeout(retryTimeout);
  }, [sessionState]); // Keep dependency on sessionState
  
  // Additional effect to poll for active batches when component first mounts
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    // If we don't have an active batch initially, poll for it
    if (!activeBatch) {
      console.log('🔍 Starting polling for active voting sessions...');
      
      pollInterval = setInterval(async () => {
        try {
          const dalSession = (window as any).currentDALSession;
          if (dalSession) {
            const batch = await dalSession.getActiveBatch();
            if (batch) {
              console.log('✅ Found active batch during polling:', batch);
              setActiveBatch(batch);
              setBatchVotes({});
              clearInterval(pollInterval); // Stop polling once we find an active batch
            }
          }
        } catch (error) {
          console.error('Error during active batch polling:', error);
        }
      }, 2000); // Poll every 2 seconds
      
      // Stop polling after 30 seconds to avoid infinite polling
      const stopPollingTimeout = setTimeout(() => {
        console.log('⏰ Stopping active batch polling after timeout');
        clearInterval(pollInterval);
      }, 30000);
      
      return () => {
        clearInterval(pollInterval);
        clearTimeout(stopPollingTimeout);
      };
    }
  }, [activeBatch]); // Include activeBatch in dependencies

  const handleBatchVoteChange = (sampleId: string, label: string) => {
    setBatchVotes(prev => ({
      ...prev,
      [sampleId]: label
    }));
  };

  const handleBatchSubmit = async () => {
    if (!activeBatch || !onBatchVoteSubmission) return;
    
    // Validate all samples have votes
    const missingVotes = activeBatch.sampleIds.filter(id => !batchVotes[id]);
    if (missingVotes.length > 0) {
      onError?.(`Please vote on all samples. Missing votes: ${missingVotes.join(', ')}`);
      return;
    }
    
    setIsSubmittingBatch(true);
    try {
      // Convert batchVotes object to arrays expected by the interface
      const sampleIds = activeBatch.sampleIds;
      const labels = sampleIds.map(id => batchVotes[id]);
      
      await onBatchVoteSubmission(sampleIds, labels);
      setBatchVotes({});
    } catch (error) {
      console.error('Failed to submit batch votes:', error);
      onError?.('Failed to submit batch votes');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Helper function to render sample data in a readable format
  const renderSampleData = (sampleData: any) => {
    if (!sampleData) return <p>No sample data available</p>;
    
    if (typeof sampleData === 'string') {
      try {
        const parsed = JSON.parse(sampleData);
        return (
          <div className="sample-data">
            <pre style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '12px', 
              borderRadius: '4px',
              fontSize: '14px',
              whiteSpace: 'pre-wrap' 
            }}>
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </div>
        );
      } catch {
        return (
          <div className="sample-data">
            <p style={{ fontFamily: 'monospace' }}>{sampleData}</p>
          </div>
        );
      }
    }
    
    if (typeof sampleData === 'object') {
      return (
        <div className="sample-data">
          <pre style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '12px', 
            borderRadius: '4px',
            fontSize: '14px',
            whiteSpace: 'pre-wrap' 
          }}>
            {JSON.stringify(sampleData, null, 2)}
          </pre>
        </div>
      );
    }
    
    return <p>{String(sampleData)}</p>;
  };

  // Helper function to render label buttons
  const renderLabelButtons = (labelOptions: string[], sampleId: string) => {
    return (
      <div className="label-buttons" style={{ 
        display: 'flex', 
        gap: '12px', 
        flexWrap: 'wrap',
        marginBottom: '16px' 
      }}>
        {labelOptions.map((label) => (
          <button
            key={label}
            className={`label-button ${batchVotes[sampleId] === label ? 'selected' : ''}`}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: batchVotes[sampleId] === label ? '#3b82f6' : '#6366f1',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              minWidth: '80px',
              opacity: batchVotes[sampleId] === label ? 1 : 0.8,
              transform: batchVotes[sampleId] === label ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleBatchVoteChange(sampleId, label)}
            onMouseOver={(e) => {
              if (batchVotes[sampleId] !== label) {
                (e.target as HTMLButtonElement).style.transform = 'scale(1.05)';
                (e.target as HTMLButtonElement).style.opacity = '1';
              }
            }}
            onMouseOut={(e) => {
              if (batchVotes[sampleId] !== label) {
                (e.target as HTMLButtonElement).style.transform = 'scale(1)';
                (e.target as HTMLButtonElement).style.opacity = '0.8';
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="labeling-panel">
      <div className="panel-header">
        <h3>Sample Labeling</h3>
        <div className="iteration-info">
          {/* FIXED: Use synchronized round from batchProgress when available */}
          {batchProgress?.round ? (
            <div>
              AL Iteration Round: {batchProgress.round}
              <div className="batch-progress">
                {batchProgress.totalSamples === 1 
                  ? `Sample Status: ${batchProgress.completedSamples > 0 ? 'Completed' : 'In Progress'}`
                  : `Batch Progress: ${batchProgress.completedSamples}/${batchProgress.totalSamples} samples completed`
                }
              </div>
            </div>
          ) : (
            <div>
              AL Iteration Round: {project.currentRound || 'Not Set'}
              {batchProgress && (
                <div className="batch-progress">
                  {batchProgress.totalSamples === 1 
                    ? `Sample Status: ${batchProgress.completedSamples > 0 ? 'Completed' : 'In Progress'}`
                    : `Batch Progress: ${batchProgress.completedSamples}/${batchProgress.totalSamples} samples completed`
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Show iteration completion message */}
      {iterationCompleted && (
        <div className="iteration-completed">
          <div className="completion-message">
            <h4>✅ {iterationMessage}</h4>
            {isCoordinator ? (
              <p>You may start the next iteration or end the project in the Control Panel.</p>
            ) : (
              <p>Wait for the project Coordinator to start a new round.</p>
            )}
            <button 
              onClick={onAcknowledgeCompletion}
              style={{ 
                marginTop: '10px', 
                padding: '8px 16px', 
                backgroundColor: '#10b981', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
      
      {/* Batch voting in progress */}
      {activeBatch && (
        <div className="batch-voting">
          <div className="batch-header">
            <h4>
              Batch Voting - Round {activeBatch.round || project.currentRound}
            </h4>
            {activeBatch.batchSize > 1 && (
              <div className="progress-bar" style={{ 
                width: '100%', 
                height: '8px', 
                backgroundColor: '#e5e7eb', 
                borderRadius: '4px', 
                marginTop: '8px' 
              }}>
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${(activeBatch.batchSize / activeBatch.batchSize) * 100}%`,
                    height: '100%',
                    backgroundColor: '#10b981',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }}
                ></div>
              </div>
            )}
            <div className="progress-text" style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
              {activeBatch.batchSize === 1 
                ? `Sample voting in progress`
                : `Batch voting in progress`
              }
            </div>
          </div>
          
          {activeBatch.sampleIds.map((sampleId, index) => (
            <div key={sampleId} className="sample-display" style={{ 
              border: '1px solid #d1d5db', 
              borderRadius: '8px', 
              padding: '20px', 
              marginBottom: '20px',
              backgroundColor: '#f9fafb'
            }}>
              <h4 style={{ marginBottom: '16px' }}>Sample {index + 1}: {sampleId}</h4>
              {renderSampleData(activeBatch.sampleData[index])}
              <div className="voting-interface" style={{ marginTop: '20px' }}>
                <h4 style={{ marginBottom: '16px' }}>🏷️ Select Classification</h4>
                {renderLabelButtons(activeBatch.labelOptions, sampleId)}
              </div>
              <div className="live-voting" style={{ 
                border: '1px solid #d1d5db', 
                borderRadius: '8px', 
                padding: '16px',
                backgroundColor: '#f8fafc'
              }}>
                <h4 style={{ marginBottom: '12px' }}>📊 Live Voting Distribution</h4>
                <div className="vote-distribution" style={{ 
                  display: 'flex', 
                  gap: '16px', 
                  marginBottom: '12px' 
                }}>
                  {Object.entries(project.activeVoting?.currentVotes || {}).map(([label, count]) => (
                    <div key={label} className="vote-item" style={{
                      padding: '8px 12px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}>
                      <span className="vote-label" style={{ fontWeight: 'bold' }}>{label}:</span>
                      <span className="vote-count" style={{ marginLeft: '4px' }}>{count as number}</span>
                    </div>
                  ))}
                </div>
                <div className="time-remaining" style={{ fontSize: '14px', color: '#666' }}>
                  ⏱️ Time remaining: {Math.floor((project.activeVoting?.timeRemaining || 0) / 60)}m {(project.activeVoting?.timeRemaining || 0) % 60}s
                </div>
              </div>
            </div>
          ))}

          <div className="submit-batch-vote" style={{ marginTop: '20px' }}>
            <button 
              onClick={handleBatchSubmit}
              disabled={isSubmittingBatch}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#4f46e5', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#4f46e5';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              {isSubmittingBatch ? 'Submitting...' : 'Submit Batch Vote'}
            </button>
          </div>
        </div>
      )}
      
      {/* No active batch */}
      {!activeBatch && !iterationCompleted && (
        <div className="no-active-voting" style={{ 
          textAlign: 'center', 
          padding: '60px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>⏳</div>
          <h4 style={{ marginBottom: '16px' }}>No Active Voting</h4>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Waiting for the next AL iteration to begin...
          </p>
          {isCoordinator && (
            <p style={{ color: '#3b82f6', fontStyle: 'italic' }}>
              <em>As coordinator, you can start the next iteration from the Control Panel.</em>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LabelingPanel; 