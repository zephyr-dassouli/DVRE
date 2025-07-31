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
      if (sessionState && sessionState.phase === 'voting') {
        try {
          // Get DAL session from window context (temporary way to access it)
          const dalSession = (window as any).currentDALSession;
          if (dalSession) {
            const batch = await dalSession.getActiveBatch();
            setActiveBatch(batch);
            
            if (batch) {
              console.log(`🗳️ Loaded batch with ${batch.batchSize} samples for simultaneous voting`);
              // Reset batch votes
              setBatchVotes({});
            }
          }
        } catch (error) {
          console.error('Failed to load active batch:', error);
        }
      } else {
        setActiveBatch(null);
        setBatchVotes({});
      }
    };
    
    loadActiveBatch();
  }, [sessionState]);

  const handleSingleVote = async (label: string) => {
    if (!project.activeVoting) {
      onError('No active voting session');
      return;
    }
    
    try {
      await onVoteSubmission(project.activeVoting.sampleId, label);
    } catch (error) {
      console.error('❌ Failed to submit vote:', error);
      onError(error instanceof Error ? error.message : 'Failed to submit vote');
    }
  };

  const handleBatchVoteChange = (sampleId: string, label: string) => {
    setBatchVotes(prev => ({
      ...prev,
      [sampleId]: label
    }));
  };

  const handleSubmitBatchVote = async () => {
    if (!activeBatch) {
      onError('No active batch found');
      return;
    }

    // Check if all samples have votes
    const missingVotes = activeBatch.sampleIds.filter(id => !batchVotes[id]);
    if (missingVotes.length > 0) {
      onError(`Please vote on all samples. Missing votes for: ${missingVotes.join(', ')}`);
      return;
    }

    setIsSubmittingBatch(true);
    try {
      // Create mutable copies to avoid Ethers.js readonly array errors
      const sampleIds = [...activeBatch.sampleIds];
      const labels = sampleIds.map(id => batchVotes[id]);
      
      const batchType = sampleIds.length === 1 ? 'single-sample batch' : 'multi-sample batch';
      console.log(`🗳️ Submitting ${batchType} vote:`, sampleIds.map((id, i) => `${id}: ${labels[i]}`));
      
      // Use the new batch vote submission prop
      await onBatchVoteSubmission(sampleIds, labels);
      
      // Clear batch votes after successful submission
      setBatchVotes({});
      setActiveBatch(null);
      
      console.log(`✅ ${batchType} vote submitted successfully`);
      
    } catch (error) {
      console.error('❌ Failed to submit batch vote:', error);
      onError(error instanceof Error ? error.message : 'Failed to submit batch vote');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const renderSampleData = (sampleData: any) => {
    if (!sampleData) return null;

    // If the sample data is from AL-Engine (iris dataset), format it nicely
    if (typeof sampleData === 'object' && 'sepal length (cm)' in sampleData) {
      return (
        <div className="iris-sample-display">
          <h5>🌸 Iris Flower Sample</h5>
          <div className="sample-features">
            <div className="feature-grid">
              <div className="feature-item">
                <span className="feature-label">Sepal Length:</span>
                <span className="feature-value">{sampleData['sepal length (cm)']} cm</span>
              </div>
              <div className="feature-item">
                <span className="feature-label">Sepal Width:</span>
                <span className="feature-value">{sampleData['sepal width (cm)']} cm</span>
              </div>
              <div className="feature-item">
                <span className="feature-label">Petal Length:</span>
                <span className="feature-value">{sampleData['petal length (cm)']} cm</span>
              </div>
              <div className="feature-item">
                <span className="feature-label">Petal Width:</span>
                <span className="feature-value">{sampleData['petal width (cm)']} cm</span>
              </div>
            </div>
            {sampleData.original_index && (
              <div className="sample-metadata">
                <span className="metadata-label">Dataset Index:</span>
                <span className="metadata-value">#{sampleData.original_index}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Fallback to JSON display for other data types
    return (
      <div className="generic-sample-display">
        <h5>Sample Data</h5>
        <pre className="sample-json">{JSON.stringify(sampleData, null, 2)}</pre>
      </div>
    );
  };

  const renderLabelButtons = (labelOptions: string[], sampleId?: string) => {
    // Enhanced label buttons with descriptions for iris dataset
    const irisLabels = {
      'setosa': '🌺 Setosa (smaller, compact flowers)',
      'versicolor': '🌸 Versicolor (medium-sized flowers)', 
      'virginica': '🌼 Virginica (larger flowers)'
    };

    return (
      <div className="label-options-enhanced">
        {labelOptions.map(label => (
          <button
            key={label}
            className="label-button-enhanced"
            onClick={() => {
              if (sampleId) {
                // Batch voting mode
                handleBatchVoteChange(sampleId, label);
              } else {
                // Single voting mode
                handleSingleVote(label);
              }
            }}
            style={{
              padding: '16px 24px',
              margin: '8px',
              backgroundColor: sampleId && batchVotes[sampleId] === label ? '#10b981' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              minWidth: '200px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              if (!(sampleId && batchVotes[sampleId] === label)) {
                e.currentTarget.style.backgroundColor = '#2563eb';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!(sampleId && batchVotes[sampleId] === label)) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }
            }}
          >
            <div>{irisLabels[label as keyof typeof irisLabels] || label}</div>
            {irisLabels[label as keyof typeof irisLabels] && (
              <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>
                Click to classify as {label}
              </div>
            )}
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
              onClick={handleSubmitBatchVote}
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
      
      {/* Single sample voting (fallback when batch voting not available) */}
      {project.activeVoting && !activeBatch && (
        <div className="active-voting">
          <div className="sample-display" style={{ 
            border: '1px solid #d1d5db', 
            borderRadius: '8px', 
            padding: '20px', 
            marginBottom: '20px',
            backgroundColor: '#f9fafb'
          }}>
            <h4 style={{ marginBottom: '16px' }}>Current Sample: {project.activeVoting.sampleId}</h4>
            {renderSampleData(project.activeVoting.sampleData)}
          </div>
          
          <div className="voting-interface" style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '16px' }}>🏷️ Select Classification</h4>
            {renderLabelButtons(project.activeVoting.labelOptions)}
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
              ⏱️ Time remaining: {Math.floor(project.activeVoting.timeRemaining / 60)}m {project.activeVoting.timeRemaining % 60}s
            </div>
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