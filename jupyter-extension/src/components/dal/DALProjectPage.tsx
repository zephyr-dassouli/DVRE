import React, { useState, useEffect } from 'react';
import {
  DALProjectPageProps,
  ModelUpdate,
  VotingRecord,
  UserContribution
} from './types';
import { useDALProject } from '../../hooks/useDALProject';
import { useAuth } from '../../hooks/useAuth';
import { alContractService } from './services/ALContractService';
import { createDALProjectSession, type DALProjectSession, type SessionState } from './services/DALProjectSession';

/**
 * DAL Project Page Component
 * Implements the complete project page with all panels from the design document
 */
export const DALProjectPage: React.FC<DALProjectPageProps> = ({ project, onBack }) => {
  const [activeTab, setActiveTab] = useState<string>('labeling');
  const [modelUpdates, setModelUpdates] = useState<ModelUpdate[]>([]);
  const [votingHistory, setVotingHistory] = useState<VotingRecord[]>([]);
  const [userContributions, setUserContributions] = useState<UserContribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DAL Project Session - Bridge between smart contracts and AL-Engine
  const [dalSession, setDalSession] = useState<DALProjectSession | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);

  // New state for batch voting
  const [batchProgress, setBatchProgress] = useState<{
    round: number;
    isActive: boolean;
    totalSamples: number;
    completedSamples: number;
    sampleIds: string[];
    currentSampleIndex: number;
  } | null>(null);
  const [iterationCompleted, setIterationCompleted] = useState(false);
  const [iterationMessage, setIterationMessage] = useState<string>('');

  // Use the real hooks
  const { startNextIteration, endProject, submitVote } = useDALProject(project.contractAddress);
  const { account } = useAuth();

  // Mock current user - in real implementation, this would come from useAuth
  const isCoordinator = project.userRole === 'coordinator';
  const currentUser = account || '0x742d35Cc6434C532532';

  // Load project data from smart contracts
  useEffect(() => {
    // Initialize DAL Project Session
    if (currentUser && !dalSession) {
      console.log('🔗 Initializing DAL Project Session bridge');
      const session = createDALProjectSession(project.contractAddress, currentUser);
      setDalSession(session);

      // Set up session event listeners
      session.on('state-changed', (newState: SessionState) => {
        console.log('📊 Session state changed:', newState);
        setSessionState(newState);
        
        // Update batch progress from session state
        if (newState.batchProgress) {
          setBatchProgress({
            round: project.currentRound, // Get round from project data, not session
            isActive: newState.isActive,
            totalSamples: newState.batchProgress.totalSamples,
            completedSamples: newState.batchProgress.completedSamples,
            sampleIds: newState.batchProgress.sampleIds,
            currentSampleIndex: newState.batchProgress.currentSampleIndex
          });
        } else {
          setBatchProgress(null);
        }
      });

      session.on('iteration-completed', (iteration: number, samplesLabeled: number) => {
        console.log(`🎉 Iteration ${iteration} completed with ${samplesLabeled} samples`);
        setIterationCompleted(true);
        setIterationMessage(`AL Iteration ${iteration} completed successfully! ${samplesLabeled} samples were labeled.`);
        
        // Reload project data to reflect updates
        loadProjectData();
      });

      session.on('error', (errorMessage: string) => {
        console.error('❌ DAL Session error:', errorMessage);
        setError(`Session Error: ${errorMessage}`);
      });

      // Check AL-Engine health
      session.checkALEngineHealth().catch(err => {
        console.warn('⚠️ AL-Engine health check failed:', err);
        setError('AL-Engine is not responsive. Please ensure it is running on localhost:5050');
      });
    }

    loadProjectData();
    setupBatchEventListeners();
    
    // Cleanup event listeners on unmount
    return () => {
      cleanupBatchEventListeners();
      if (dalSession) {
        dalSession.removeAllListeners();
        dalSession.endSession().catch(console.error);
      }
    };
  }, [project.id, currentUser]);

  // Set up event listeners for batch voting progress
  const setupBatchEventListeners = () => {
    // Listen for sample completion events
    const handleSampleCompleted = (event: CustomEvent) => {
      const { sampleId, finalLabel, remaining, total } = event.detail;
      console.log(`Sample ${sampleId} completed:`, finalLabel);
      
      setBatchProgress(prev => prev ? {
        ...prev,
        completedSamples: total - remaining,
        currentSampleIndex: prev.currentSampleIndex + 1
      } : null);
    };

    // Listen for iteration completion events
    const handleIterationCompleted = (event: CustomEvent) => {
      const { round, labeledSamples, message } = event.detail;
      console.log(`Iteration ${round} completed with ${labeledSamples} samples`);
      
      setIterationCompleted(true);
      setIterationMessage(message);
      setBatchProgress(null);
      
      // Reload project data to reflect updates
      loadProjectData();
    };

    window.addEventListener('dal-sample-completed', handleSampleCompleted as EventListener);
    window.addEventListener('dal-iteration-completed', handleIterationCompleted as EventListener);
  };

  const cleanupBatchEventListeners = () => {
    window.removeEventListener('dal-sample-completed', () => {});
    window.removeEventListener('dal-iteration-completed', () => {});
  };

  const loadProjectData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Loading real AL project data for:', project.contractAddress);
      
      // Load all data in parallel for better performance
      const [votingData, contributionData, modelData, projectStatus] = await Promise.all([
        alContractService.getVotingHistory(project.contractAddress),
        alContractService.getUserContributions(project.contractAddress),
        alContractService.getModelUpdates(project.contractAddress),
        alContractService.getProjectStatus(project.contractAddress)
      ]);

      console.log('Loaded real data:', {
        votingRecords: votingData.length,
        contributors: contributionData.length,
        modelUpdates: modelData.length,
        currentIteration: projectStatus.currentIteration,
        hasActiveVoting: !!projectStatus.activeVoting
      });

      setVotingHistory(votingData);
      setUserContributions(contributionData.map(user => ({
        ...user,
        role: user.role as 'coordinator' | 'contributor'
      })));
      setModelUpdates(modelData);

      // Update project data with current status
      if (projectStatus.activeVoting) {
        // Update the project object with active voting data
        (project as any).activeVoting = projectStatus.activeVoting;
        (project as any).currentRound = projectStatus.currentIteration;
        (project as any).totalRounds = projectStatus.maxIterations;
        (project as any).isActive = projectStatus.isActive;
      }

      // If no real data is available, show appropriate messages
      if (votingData.length === 0 && contributionData.length === 0) {
        console.log('ℹNo smart contract data found - project may be newly deployed');
      }

    } catch (err) {
      console.error('Failed to load project data from smart contracts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project data');
      
      // Set empty arrays instead of mock data
      setVotingHistory([]);
      setUserContributions([]);
      setModelUpdates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNextIteration = async () => {
    if (!isCoordinator) {
      setError('Only coordinators can start iterations');
      return;
    }

    if (!dalSession) {
      setError('DAL Session not initialized');
      return;
    }

    try {
      setError(null);
      setIterationCompleted(false);
      console.log('🚀 Starting next AL iteration via DAL Session bridge');
      
      // Use the DAL Session bridge to orchestrate the complete workflow
      await dalSession.startIteration();
      
      console.log('✅ AL iteration workflow started successfully via DAL Session');
      
    } catch (error) {
      console.error('❌ Failed to start next AL iteration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start iteration';
      setError(errorMessage);
    }
  };

  // Load current batch progress from smart contracts
  const loadBatchProgress = async () => {
    try {
      // Use existing project data instead of accessing private methods
      // In a real implementation, this would be exposed through a public API
      
      // For now, simulate batch progress based on project state
      if (project.currentRound > 0) {
        const mockProgress = {
          round: project.currentRound,
          isActive: true,
          totalSamples: 2, // From query batch size configuration
          completedSamples: 0,
          sampleIds: [`sample_${project.currentRound}_1`, `sample_${project.currentRound}_2`],
          currentSampleIndex: 0
        };
        
        setBatchProgress(mockProgress);
        console.log('📊 Batch progress loaded:', mockProgress);
      }
      
    } catch (error) {
      console.error('Failed to load batch progress:', error);
    }
  };

  const handleEndProject = async () => {
    if (!isCoordinator) {
      setError('Only coordinators can end projects');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to end this project? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setError(null);
      console.log('🏁 Ending project from UI');
      
      await endProject(project.contractAddress);
      
      // Reload project data to show updated state
      await loadProjectData();
      
      // Show success message
      alert('Project ended successfully!');
      
    } catch (error) {
      console.error('❌ Failed to end project:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to end project';
      setError(errorMessage);
      alert(`Failed to end project: ${errorMessage}`);
    }
  };

  const handleVoteSubmission = async (sampleId: string, label: string) => {
    if (!dalSession) {
      setError('DAL Session not initialized');
      return;
    }

    try {
      setError(null);
      console.log('🗳️ Submitting vote via DAL Session bridge');
      
      // Use the DAL Session bridge for vote submission
      await dalSession.submitVote(sampleId, label);
      
      // Reload project data to show updated voting state
      await loadProjectData();
      
      console.log('✅ Vote submitted successfully via DAL Session');
      
    } catch (error) {
      console.error('❌ Failed to submit vote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit vote';
      setError(errorMessage);
    }
  };

  const handleSubmitVote = async (label: string) => {
    if (!project.activeVoting) {
      setError('No active voting session');
      return;
    }
    
    await handleVoteSubmission(project.activeVoting.sampleId, label);
  };

  const handleRefreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Refreshing all project data from smart contracts...');
      
      // Reload all project data from smart contracts
      await loadProjectData();
      
      console.log('✅ Project data refreshed successfully');
    } catch (err) {
      console.error('❌ Failed to refresh project data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh project data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dal-project-page">
        <div className="project-header">
          <button className="back-button" onClick={onBack}>← Back to Projects</button>
          <h1>{project.name}</h1>
        </div>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div>🔄 Loading project data from smart contracts...</div>
          <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            This may take a few moments as we fetch voting history, user contributions, and model updates.
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dal-project-page">
        <div className="project-header">
          <button className="back-button" onClick={onBack}>← Back to Projects</button>
          <h1>{project.name}</h1>
        </div>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: '#ef4444' }}>❌ Error loading project data</div>
          <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            {error}
          </div>
          <button 
            onClick={loadProjectData}
            style={{ 
              marginTop: '20px', 
              padding: '10px 20px', 
              backgroundColor: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px' 
            }}
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="dal-project-page">
      {/* Header */}
      <div className="project-header">
        <div className="header-top" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '10px' 
        }}>
          <button className="back-button" onClick={onBack}>
            ← Back to Projects
          </button>
          <div className="header-actions" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px' 
          }}>
            <button
              onClick={handleRefreshData}
              disabled={loading}
              className="refresh-button"
            >
              {loading ? 'Loading...' : 'Refresh'}
          </button>
          <div className="project-status">
            <span className={`status-indicator ${project.status}`}></span>
            {project.status.toUpperCase()}
            </div>
          </div>
        </div>
        <h1>{project.name}</h1>
        <div className="project-meta">
          <span>Round {project.currentRound} of {project.totalRounds}</span>
          <span>•</span>
          <span>{Math.max(project.participants, userContributions.length)} participants</span>
          <span>•</span>
          <span>Last updated: {formatTimeAgo(project.lastUpdated)}</span>
          <span>•</span>
          <span style={{ color: '#10b981', fontWeight: 'bold' }}>
            🔗 Smart Contract Data ({votingHistory.length + userContributions.length + modelUpdates.length} records)
          </span>
          {sessionState && (
            <>
              <span>•</span>
              <span style={{ 
                color: sessionState.phase === 'error' ? '#ef4444' : '#10b981', 
                fontWeight: 'bold' 
              }}>
                🤖 AL-Engine: {sessionState.phase.replace('_', ' ').toUpperCase()}
                {sessionState.phase === 'voting' && sessionState.batchProgress && 
                  ` (${sessionState.batchProgress.completedSamples}/${sessionState.batchProgress.totalSamples})`
                }
              </span>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="project-tabs">
        <button 
          className={`tab ${activeTab === 'labeling' ? 'active' : ''}`}
          onClick={() => setActiveTab('labeling')}
        >
          Labeling
        </button>
        <button 
          className={`tab ${activeTab === 'configuration' ? 'active' : ''}`}
          onClick={() => setActiveTab('configuration')}
        >
          Configuration
        </button>
        {isCoordinator && (
          <button 
            className={`tab ${activeTab === 'control' ? 'active' : ''}`}
            onClick={() => setActiveTab('control')}
          >
            Control Panel
          </button>
        )}
        {isCoordinator && (
          <button 
            className={`tab ${activeTab === 'model-updates' ? 'active' : ''}`}
            onClick={() => setActiveTab('model-updates')}
          >
            Model Updates
          </button>
        )}
        <button 
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Dashboard
        </button>
        <button 
          className={`tab ${activeTab === 'voting-history' ? 'active' : ''}`}
          onClick={() => setActiveTab('voting-history')}
        >
          Voting History
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Enhanced Labeling Panel with Batch Support */}
        {activeTab === 'labeling' && (
          <div className="labeling-panel">
            <div className="panel-header">
              <h3>Sample Labeling</h3>
              <div className="iteration-info">
                AL Iteration Round: {project.currentRound}
                {batchProgress && (
                  <div className="batch-progress">
                    {batchProgress.totalSamples === 1 
                      ? `Sample Status: ${batchProgress.completedSamples > 0 ? 'Completed' : 'In Progress'}`
                      : `Batch Progress: ${batchProgress.completedSamples}/${batchProgress.totalSamples} samples completed`
                    }
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
                    onClick={() => setIterationCompleted(false)}
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
            {batchProgress && batchProgress.isActive && !iterationCompleted && (
              <div className="batch-voting">
                <div className="batch-header">
                  <h4>
                    {batchProgress.totalSamples === 1 
                      ? `Sample Voting - Round ${batchProgress.round}` 
                      : `Batch Voting - Round ${batchProgress.round}`
                    }
                  </h4>
                  {batchProgress.totalSamples > 1 && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${(batchProgress.completedSamples / batchProgress.totalSamples) * 100}%`,
                          height: '8px',
                          backgroundColor: '#10b981',
                          borderRadius: '4px',
                          transition: 'width 0.3s ease'
                        }}
                      ></div>
                    </div>
                  )}
                  <div className="progress-text">
                    {batchProgress.totalSamples === 1 
                      ? `Sample voting in progress`
                      : `Sample ${batchProgress.currentSampleIndex + 1} of ${batchProgress.totalSamples}`
                    }
              </div>
            </div>
            
            {project.activeVoting ? (
              <div className="active-voting">
                <div className="sample-display">
                      <h4>Current Sample: {project.activeVoting.sampleId}</h4>
                  <div className="sample-content">
                    <pre>{JSON.stringify(project.activeVoting.sampleData, null, 2)}</pre>
                  </div>
                </div>
                
                <div className="voting-interface">
                  <h4>Select Label</h4>
                  <div className="label-options">
                    {project.activeVoting.labelOptions.map(label => (
                      <button
                        key={label}
                        className="label-button"
                        onClick={() => handleSubmitVote(label)}
                            style={{
                              padding: '12px 24px',
                              margin: '8px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: 'bold'
                            }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="live-voting">
                  <h4>Live Voting Distribution</h4>
                  <div className="vote-distribution">
                    {Object.entries(project.activeVoting.currentVotes).map(([label, count]) => (
                      <div key={label} className="vote-item">
                        <span className="vote-label">{label}:</span>
                        <span className="vote-count">{count as number}</span>
                      </div>
                    ))}
                  </div>
                  <div className="time-remaining">
                    Time remaining: {Math.floor(project.activeVoting.timeRemaining / 60)}m {project.activeVoting.timeRemaining % 60}s
                  </div>
                </div>
              </div>
            ) : (
                  <div className="waiting-for-next-sample">
                    <h4>🔄 Processing {batchProgress.totalSamples === 1 ? 'Sample' : 'Previous Sample'}</h4>
                    <p>
                      {batchProgress.totalSamples === 1 
                        ? 'Finalizing vote aggregation and consensus...'
                        : 'Waiting for the next sample in this batch...'
                      }
                    </p>
                    {batchProgress.totalSamples > 1 && (
                      <div className="remaining-samples">
                        Remaining samples: {batchProgress.totalSamples - batchProgress.completedSamples}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* No active batch */}
            {!batchProgress && !iterationCompleted && (
              <div className="no-active-voting">
                <h4>No Active Voting</h4>
                <p>Waiting for the next AL iteration to begin...</p>
                {isCoordinator && (
                  <p><em>As coordinator, you can start the next iteration from the Control Panel.</em></p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Project Configuration Panel */}
        {activeTab === 'configuration' && (
          <div className="configuration-panel">
            <div className="panel-header">
              <h3>Project Configuration</h3>
            </div>
            {project.alConfiguration ? (
              <div className="config-grid">
                <div className="config-item">
                  <label>AL Scenario:</label>
                  <span>{project.alConfiguration.scenario}</span>
                </div>
                <div className="config-item">
                  <label>Query Strategy:</label>
                  <span>{project.alConfiguration.queryStrategy}</span>
                </div>
                <div className="config-item">
                  <label>Model:</label>
                  <span>{project.alConfiguration.model.type}</span>
                </div>
                <div className="config-item">
                  <label>Query Batch Size:</label>
                  <span>{project.alConfiguration.queryBatchSize}</span>
                </div>
                <div className="config-item">
                  <label>Max Iteration Rounds:</label>
                  <span>{project.alConfiguration.maxIterations}</span>
                </div>
                <div className="config-item">
                  <label>Voting Consensus:</label>
                  <span>{project.alConfiguration.votingConsensus}</span>
                </div>
                <div className="config-item">
                  <label>Voting Timeout:</label>
                  <span>{project.alConfiguration.votingTimeout}s</span>
                </div>
                <div className="config-item">
                  <label>Label Space:</label>
                  <span>{project.alConfiguration.labelSpace?.join(', ') || 'Not configured'}</span>
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
                  <strong>Possible reasons:</strong>
                  <br />
                  • The project hasn't been configured with AL parameters yet
                  <br />
                  • AL metadata hasn't been set on the smart contract
                  <br />
                  • The project needs to be properly deployed first
                  <br />
                  <br />
                  <strong>Contract Address:</strong> {project.contractAddress?.slice(0, 10)}...
                  <br />
                  <strong>Data source:</strong> Smart Contract getProjectMetadata() method
                  <br />
                  <em>Check browser console for detailed logs</em>
                  <br />
                  <br />
                  <button 
                    onClick={loadProjectData}
                    style={{ 
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
        )}

        {/* Control Panel (Coordinator Only) */}
        {activeTab === 'control' && isCoordinator && (
          <div className="control-panel">
            <div className="panel-header">
              <h3>Control Panel</h3>
              <p>Coordinator controls for project management</p>
            </div>
            <div className="control-actions">
              <div className="action-card">
                <h4>Start Next Iteration</h4>
                <p>Trigger a new Active Learning round. This sends a signal to the smart contract and orchestrator.</p>
                <button 
                  className="primary-btn"
                  onClick={handleStartNextIteration}
                  disabled={!project.isActive}
                >
                  Start Next Iteration
                </button>
              </div>
              <div className="action-card">
                <h4>End Project</h4>
                <p>Manually end the project. This will deactivate the project and trigger final results collection.</p>
                <button 
                  className="danger-btn"
                  onClick={handleEndProject}
                  disabled={!project.isActive}
                >
                  End Project
                </button>
              </div>
            </div>
            <div className="project-status-summary">
              <h4>Project Status</h4>
              <div className="status-grid">
                <div className="status-item">
                  <label>Current Status:</label>
                  <span className={`status-value ${project.status}`}>{project.status}</span>
                </div>
                <div className="status-item">
                  <label>Active:</label>
                  <span className={`status-value ${project.isActive ? 'active' : 'inactive'}`}>
                    {project.isActive ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="status-item">
                  <label>Progress:</label>
                  <span className="status-value">
                    {Math.round((project.currentRound / project.totalRounds) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Model Updates Panel (Coordinator Only) */}
        {activeTab === 'model-updates' && isCoordinator && (
          <div className="model-updates-panel">
            <div className="panel-header">
              <h3>Model Updates History</h3>
              <p>Performance statistics for each iteration (latest on top)</p>
            </div>
            <div className="updates-list">
              {modelUpdates.length > 0 ? (
                modelUpdates.map(update => (
                  <div key={update.iterationNumber} className="update-item">
                    <div className="update-header">
                      <div className="iteration-info">
                        <h4>Iteration {update.iterationNumber}</h4>
                        <span className="timestamp">{formatTimeAgo(update.timestamp)}</span>
                      </div>
                      <div className="samples-added">
                        +{update.samplesAddedCount} samples
                      </div>
                    </div>
                    <div className="performance-metrics">
                      <div className="metric">
                        <span className="metric-label">Accuracy:</span>
                        <span className="metric-value">{(update.performance.accuracy * 100).toFixed(1)}%</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Precision:</span>
                        <span className="metric-value">{(update.performance.precision * 100).toFixed(1)}%</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Recall:</span>
                        <span className="metric-value">{(update.performance.recall * 100).toFixed(1)}%</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">F1-Score:</span>
                        <span className="metric-value">{(update.performance.f1Score * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    {update.notes && (
                      <div className="update-notes">
                        {update.notes}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                    No Model Updates Yet
                  </div>
                  <div style={{ color: '#666', fontSize: '14px' }}>
                    Model performance data will appear here after active learning iterations begin.
                    <br />
                    <strong>Data source:</strong> Derived from ALProjectStorage voting consensus data
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Dashboard Panel */}
        {activeTab === 'users' && (
          <div className="users-panel">
            <div className="panel-header">
              <h3>User Dashboard</h3>
              <p>All users, their roles, and contribution statistics</p>
            </div>
            <div className="users-table">
              <div className="table-header">
                <div className="col-address">Address</div>
                <div className="col-role">Role</div>
                <div className="col-votes">Votes</div>
                <div className="col-joined">Joined</div>
                <div className="col-activity">Last Activity</div>
                <div className="col-reputation">Reputation</div>
              </div>
              {userContributions.length > 0 ? (
                userContributions.map(user => (
                  <div key={user.address} className="table-row">
                    <div className="col-address">
                      <span className="address">{formatAddress(user.address)}</span>
                      {user.address === currentUser && <span className="you-badge">YOU</span>}
                    </div>
                    <div className="col-role">
                      <span className={`role-badge ${user.role}`}>{user.role.toUpperCase()}</span>
                    </div>
                    <div className="col-votes">{user.votesCount}</div>
                    <div className="col-joined">{formatTimeAgo(user.joinedAt)}</div>
                    <div className="col-activity">{formatTimeAgo(user.lastActivity)}</div>
                    <div className="col-reputation">
                      <span className="reputation-score">{user.reputation}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                    No User Activity Yet
                  </div>
                  <div style={{ color: '#666', fontSize: '14px' }}>
                    This project was recently deployed. User contributions will appear here once voting activity begins.
                    <br />
                    <strong>Data source:</strong> ALProjectVoting smart contract
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Voting History Panel */}
        {activeTab === 'voting-history' && (
          <div className="voting-history-panel">
            <div className="panel-header">
              <h3>Voting History</h3>
              <p>All samples with their voting statistics and final labels</p>
            </div>
            <div className="history-list">
              {votingHistory.length > 0 ? (
                votingHistory.map(record => (
                  <div key={record.sampleId} className="history-item">
                    <div className="item-header">
                      <div className="sample-info">
                        <h4>{record.sampleId}</h4>
                        <span className="iteration-badge">Iteration {record.iterationNumber}</span>
                      </div>
                      <div className="final-result">
                        <span className="final-label">Final: {record.finalLabel}</span>
                        <span className={`consensus-badge ${record.consensusReached ? 'reached' : 'no-consensus'}`}>
                          {record.consensusReached ? 'Consensus' : 'No Consensus'}
                        </span>
                      </div>
                    </div>
                    <div className="voting-details">
                      <div className="voter-breakdown">
                        <h5>Votes Cast:</h5>
                        {Object.entries(record.votes).map(([voter, vote]) => (
                          <div key={voter} className="vote-entry">
                            <span className="voter">{formatAddress(voter)}:</span>
                            <span className="vote">{vote}</span>
                          </div>
                        ))}
                      </div>
                      <div className="distribution">
                        <h5>Distribution:</h5>
                        {Object.entries(record.votingDistribution).map(([label, count]) => (
                          <span key={label} className="dist-item">
                            {label}: {count as number}
                          </span>
                        ))}
                      </div>
                      <div className="timestamp">
                        {formatTimeAgo(record.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📜</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                    No Voting History Yet
                  </div>
                  <div style={{ color: '#666', fontSize: '14px' }}>
                    This project was recently deployed. Voting history will appear here once samples are labeled.
                    <br />
                    <strong>Data source:</strong> ALProjectVoting smart contract
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DALProjectPage; 