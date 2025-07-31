import React, { useState, useEffect } from 'react';
import {
  DALProjectPageProps,
  ModelUpdate,
  VotingRecord,
  UserContribution
} from './types';
import { useAuth } from '../../hooks/useAuth';
import { type DALProjectSession, type SessionState } from './services/DALProjectSession';
import {
  LabelingPanel,
  ControlPanel,
  ConfigurationPanel,
  ModelUpdatesPanel,
  UserDashboardPanel,
  VotingHistoryPanel,
  PublishFinalResultsPanel
} from './panels';

// Import the new modular components
import { createProjectHandlers, type ProjectHandlers } from './DALProjectHandlers';
import { createDataLoader } from './DALProjectDataLoader';
import { setupProjectEventListeners, type EventListenerCleanup } from './DALProjectEventListeners';
import { formatTimeAgo } from './DALProjectUtils';

/**
 * DAL Project Page Component
 * Implements the complete project page with all panels from the design document
 */
export const DALProjectPage: React.FC<DALProjectPageProps> = ({ project, onBack }) => {
  // ALL HOOKS MUST BE CALLED FIRST - before any conditional logic
  const [activeTab, setActiveTab] = useState<string>('labeling');
  const [modelUpdates, setModelUpdates] = useState<ModelUpdate[]>([]);
  const [votingHistory, setVotingHistory] = useState<VotingRecord[]>([]);
  const [userContributions, setUserContributions] = useState<UserContribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Trigger to force data refresh
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // DAL Project Session - Bridge between smart contracts and AL-Engine
  const [dalSession, setDalSession] = useState<DALProjectSession | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);

  // Use the auth hook to get current user
  const { account } = useAuth();

  const isCoordinator = project.userRole === 'coordinator';
  const currentUser = account; // Use actual connected wallet address

  // Function to trigger data refresh without causing loops
  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Create data loader
  const dataLoader = createDataLoader({
    project,
    setModelUpdates,
    setVotingHistory,
    setUserContributions,
    setBatchProgress,
    setLoading,
    setError
  });

  // Create project handlers
  const handlers: ProjectHandlers = createProjectHandlers({
    project,
    currentUser: currentUser || '',
    isCoordinator,
    dalSession,
    sessionState,
    triggerRefresh,
    setError
  });

  // Main useEffect for data loading and event listener setup
  useEffect(() => {
    dataLoader.loadProjectData();
    
    // Set up event listeners
    let cleanup: EventListenerCleanup | null = null;
    
    // Create event listeners after a small delay to prevent state conflicts
    const eventTimer = setTimeout(() => {
      if (currentUser) {
        cleanup = setupProjectEventListeners({
          project,
          currentUser,
          triggerRefresh,
          setBatchProgress,
          setIterationCompleted,
          setIterationMessage,
          setDalSession,
          setSessionState,
          setError
        });
      }
    }, 100);
    
    // Cleanup event listeners on unmount
    return () => {
      clearTimeout(eventTimer);
      if (cleanup) {
        cleanup.cleanupBatchListeners();
        cleanup.cleanupSessionListeners();
      }
    };
  }, [currentUser, refreshTrigger]); // Add refreshTrigger to dependencies

  // Check if wallet is connected AFTER all hooks are called
  if (!account) {
    return (
      <div className="dal-project-container">
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          color: 'var(--jp-ui-font-color2)'
        }}>
          <h3>Decentralized Active Learning Project</h3>
          <p>Please connect your wallet to access this Active Learning project.</p>
          <button 
            onClick={onBack}
            style={{
              marginTop: '20px',
              padding: '8px 16px',
              background: 'var(--jp-brand-color1)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

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
            onClick={handlers.handleRefreshData}
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
              onClick={handlers.handleRefreshData}
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
        
        {/* Enhanced Contract State Display */}
        <div className="contract-state-info" style={{ 
          marginTop: '12px', 
          padding: '12px', 
          backgroundColor: '#f8fafc', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          fontSize: '14px',
          color: '#475569'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
            📋 Project Configuration (From Smart Contract)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            <div>
              <span style={{ fontWeight: '500' }}>Batch Size:</span> {(project as any).queryBatchSize || 'Not Set'}
            </div>
            <div>
              <span style={{ fontWeight: '500' }}>Voting Timeout:</span> {(project as any).votingTimeout ? `${Math.floor((project as any).votingTimeout / 60)}m` : 'Not Set'}
            </div>
            <div>
              <span style={{ fontWeight: '500' }}>Label Options:</span> {(project as any).labelSpace?.length || 0} labels
            </div>
            <div>
              <span style={{ fontWeight: '500' }}>Project Status:</span> 
              <span style={{ 
                color: (project as any).isActive ? '#10b981' : '#ef4444',
                fontWeight: 'bold',
                marginLeft: '4px'
              }}>
                {(project as any).isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          
          {/* Current Batch Info */}
          {batchProgress && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#1e293b' }}>
                🗳️ Current Batch Status (Round {batchProgress.round})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                <div>
                  <span style={{ fontWeight: '500' }}>Progress:</span> {batchProgress.completedSamples}/{batchProgress.totalSamples}
                </div>
                <div>
                  <span style={{ fontWeight: '500' }}>Status:</span> 
                  <span style={{ 
                    color: batchProgress.isActive ? '#3b82f6' : '#10b981',
                    fontWeight: 'bold',
                    marginLeft: '4px'
                  }}>
                    {batchProgress.isActive ? 'In Progress' : 'Completed'}
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: '500' }}>Sample IDs:</span> {batchProgress.sampleIds.length} samples
                </div>
              </div>
            </div>
          )}
          
          {/* Active Voting Info */}
          {project.activeVoting && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#1e293b' }}>
                ⏱️ Active Voting Session
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                <div>
                  <span style={{ fontWeight: '500' }}>Sample:</span> {project.activeVoting.sampleId}
                </div>
                <div>
                  <span style={{ fontWeight: '500' }}>Time Remaining:</span> {Math.floor(project.activeVoting.timeRemaining / 60)}m {project.activeVoting.timeRemaining % 60}s
                </div>
                <div>
                  <span style={{ fontWeight: '500' }}>Current Votes:</span> {Object.values(project.activeVoting.currentVotes || {}).reduce((a: number, b: number) => a + b, 0)} votes
                </div>
              </div>
            </div>
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
        {isCoordinator && (
          <button 
            className={`tab ${activeTab === 'publish-results' ? 'active' : ''}`}
            onClick={() => setActiveTab('publish-results')}
          >
            Publish Final Results
          </button>
        )}
      </div>

      {/* Tab Content - Using Panel Components */}
      <div className="tab-content">
        {currentUser && activeTab === 'labeling' && (
          <LabelingPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            sessionState={sessionState}
            batchProgress={batchProgress}
            iterationCompleted={iterationCompleted}
            iterationMessage={iterationMessage}
            onVoteSubmission={handlers.handleVoteSubmission}
            onBatchVoteSubmission={handlers.handleBatchVoteSubmission}
            onAcknowledgeCompletion={() => setIterationCompleted(false)}
            onRefresh={handlers.handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'configuration' && (
          <ConfigurationPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            onRefresh={handlers.handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'control' && isCoordinator && (
          <ControlPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            onStartNextIteration={handlers.handleStartNextIteration}
            onEndProject={handlers.handleEndProject}
            onRefresh={handlers.handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'model-updates' && isCoordinator && (
          <ModelUpdatesPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            modelUpdates={modelUpdates}
            onRefresh={handlers.handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'users' && (
          <UserDashboardPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            userContributions={userContributions}
            onRefresh={handlers.handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'voting-history' && (
          <VotingHistoryPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            votingHistory={votingHistory}
            projectAddress={project.contractAddress}
            onRefresh={handlers.handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'publish-results' && isCoordinator && (
          <PublishFinalResultsPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            onPublishFinalResults={handlers.handlePublishFinalResults}
            onRefresh={handlers.handleRefreshData}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
};

export default DALProjectPage; 