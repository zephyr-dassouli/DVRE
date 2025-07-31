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

  // Project description from smart contract
  const [projectDescription, setProjectDescription] = useState<string>('');

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

  // Project End State
  const [projectEndStatus, setProjectEndStatus] = useState<{
    shouldEnd: boolean;
    reason: string;
    currentRound: number;
    maxIterations: number;
  }>({
    shouldEnd: false,
    reason: '',
    currentRound: 0,
    maxIterations: 0
  });

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
    setError,
    setProjectDescription
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
          setError,
          setProjectEndStatus
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
  }, [refreshTrigger, project.contractAddress, currentUser]);

  // Check project end conditions periodically
  useEffect(() => {
    const checkEndConditions = async () => {
      if (!project.contractAddress) return;
      
      try {
        const { alContractService } = await import('./services/ALContractService');
        const endStatus = await alContractService.getProjectEndStatus(project.contractAddress);
        
        if (endStatus.shouldEnd && !projectEndStatus.shouldEnd) {
          console.log('🚨 Project should end based on smart contract conditions:', endStatus);
          setProjectEndStatus(endStatus);
        }
      } catch (error) {
        console.error('Error checking project end conditions:', error);
      }
    };

    // Check immediately
    checkEndConditions();

    // Check every 30 seconds
    const interval = setInterval(checkEndConditions, 30000);

    return () => clearInterval(interval);
  }, [project.contractAddress, projectEndStatus.shouldEnd]);

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
        {/* Navigation and Status Row */}
        <div className="header-row-1" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '16px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="back-button" onClick={onBack}>
              ← Back to Projects
            </button>
            <button
              onClick={handlers.handleRefreshData}
              disabled={loading}
              className="refresh-button"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', marginLeft: '100px' }}>
            <span style={{
              display: 'inline-block',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              backgroundColor: project.status === 'active' ? '#10b981' : '#6b7280',
              color: 'white',
              textTransform: 'uppercase'
            }}>
              {project.status}
            </span>
          </div>
        </div>
        
        {/* Project Meta Info */}
        <div className="project-meta" style={{ 
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          fontSize: '14px',
          color: '#666'
        }}>
          <span>Round {project.currentRound} of {project.totalRounds}</span>
          <span>•</span>
          <span>{Math.max(project.participants, userContributions.length)} participants</span>
          <span>•</span>
          <span>Last updated: {formatTimeAgo(project.lastUpdated)}</span>
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

      {/* Project Info Panel */}
      <div className="project-info-panel" style={{
        backgroundColor: 'white',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <strong style={{ color: '#495057', fontSize: '14px', minWidth: 'fit-content' }}>Project Title:</strong>
          <div style={{ fontSize: '14px', color: '#495057', fontWeight: 'bold' }}>
            {project.name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <strong style={{ color: '#495057', fontSize: '14px', minWidth: 'fit-content' }}>Description:</strong>
          <div style={{ fontSize: '16px', lineHeight: '1.5', color: '#6c757d' }}>
            {projectDescription && projectDescription.trim() !== '' ? (
              <span style={{ fontStyle: 'italic' }}>{projectDescription}</span>
            ) : (
              <span style={{ fontStyle: 'italic', color: '#adb5bd' }}>No description available</span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
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
            projectEndStatus={projectEndStatus}
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