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
import {
  LabelingPanel,
  ControlPanel,
  ConfigurationPanel,
  ModelUpdatesPanel,
  UserDashboardPanel,
  VotingHistoryPanel
} from './panels';

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

  // Use the real hooks  
  const { endProject } = useDALProject(project.contractAddress);
  const { account } = useAuth();

  const isCoordinator = project.userRole === 'coordinator';
  const currentUser = account; // Use actual connected wallet address

  // Function to trigger data refresh without causing loops
  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Set up event listeners for batch voting progress - regular functions like old implementation
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
      triggerRefresh(); // Trigger data refresh
    };

    window.addEventListener('dal-sample-completed', handleSampleCompleted as EventListener);
    window.addEventListener('dal-iteration-completed', handleIterationCompleted as EventListener);
  };

  const cleanupBatchEventListeners = () => {
    window.removeEventListener('dal-sample-completed', () => {});
    window.removeEventListener('dal-iteration-completed', () => {});
  };

  // Simple useEffect like the working testfile.txt
  useEffect(() => {
    // Move loadProjectData inside useEffect to make it stable
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

    loadProjectData();
    setupBatchEventListeners();
    
    // Create DAL session after a small delay to prevent state conflicts
    const sessionTimer = setTimeout(() => {
      if (currentUser) {
        console.log('🔗 Creating DAL Project Session for:', currentUser);
        const session = createDALProjectSession(project.contractAddress, currentUser);
        setDalSession(session);

        // Set up session event listeners
        const handleStateChange = (newState: SessionState) => {
          console.log('📊 Session state changed:', newState);
          setSessionState(newState);
          
          if (newState.batchProgress) {
            setBatchProgress({
              round: project.currentRound,
              isActive: newState.isActive,
              totalSamples: newState.batchProgress.totalSamples,
              completedSamples: newState.batchProgress.completedSamples,
              sampleIds: newState.batchProgress.sampleIds,
              currentSampleIndex: newState.batchProgress.currentSampleIndex
            });
          } else {
            setBatchProgress(null);
          }
        };

        const handleIterationComplete = (iteration: number, samplesLabeled: number) => {
          console.log(`🎉 Iteration ${iteration} completed with ${samplesLabeled} samples`);
          setIterationCompleted(true);
          setIterationMessage(`AL Iteration ${iteration} completed successfully! ${samplesLabeled} samples were labeled.`);
          
          // Trigger data refresh after a delay
          setTimeout(() => {
            triggerRefresh();
          }, 1000);
        };

        const handleSessionError = (errorMessage: string) => {
          console.error('❌ DAL Session error:', errorMessage);
          setError(`Session Error: ${errorMessage}`);
        };

        session.on('state-changed', handleStateChange);
        session.on('iteration-completed', handleIterationComplete);
        session.on('error', handleSessionError);

        // Check AL-Engine health
        session.checkALEngineHealth().catch(err => {
          console.warn('⚠️ AL-Engine health check failed:', err);
          setError('AL-Engine is not responsive. Please ensure it is running on localhost:5050');
        });
      }
    }, 100); // Small delay to prevent state conflicts
    
    // Cleanup event listeners on unmount
    return () => {
      clearTimeout(sessionTimer);
      cleanupBatchEventListeners();
      if (dalSession) {
        console.log('🧹 Cleaning up DAL Session');
        dalSession.removeAllListeners();
        dalSession.endSession().catch(console.error);
        setDalSession(null);
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

  // Handler functions for panel callbacks
  const handleStartNextIteration = async () => {
    if (!isCoordinator) {
      setError('Only coordinators can start iterations');
      return;
    }

    if (!dalSession) {
      setError('DAL Session not initialized. Please wait a moment and try again.');
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

  const handleEndProject = async () => {
    if (!isCoordinator) {
      setError('Only coordinators can end projects');
      return;
    }

    try {
      setError(null);
      console.log('🏁 Ending project from UI');
      
      await endProject(project.contractAddress);
      
      // Trigger data refresh to show updated state
      triggerRefresh();
      
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
      setError('DAL Session not initialized. Please wait a moment and try again.');
      return;
    }

    try {
      setError(null);
      console.log('🗳️ Submitting vote via DAL Session bridge');
      
      // Use the DAL Session bridge for vote submission
      await dalSession.submitVote(sampleId, label);
      
      console.log('✅ Vote submitted successfully via DAL Session');
      
    } catch (error) {
      console.error('❌ Failed to submit vote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit vote';
      setError(errorMessage);
    }
  };

  const handleRefreshData = async () => {
    console.log('Refreshing all project data from smart contracts...');
    
    // Trigger data refresh - loading and error states handled by useEffect
    triggerRefresh();
    
    console.log('✅ Project data refresh triggered');
  };

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
            onClick={handleRefreshData}
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
            onVoteSubmission={handleVoteSubmission}
            onAcknowledgeCompletion={() => setIterationCompleted(false)}
            onRefresh={handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'configuration' && (
          <ConfigurationPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            onRefresh={handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'control' && isCoordinator && (
          <ControlPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            onStartNextIteration={handleStartNextIteration}
            onEndProject={handleEndProject}
            onRefresh={handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'model-updates' && isCoordinator && (
          <ModelUpdatesPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            modelUpdates={modelUpdates}
            onRefresh={handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'users' && (
          <UserDashboardPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            userContributions={userContributions}
            onRefresh={handleRefreshData}
            onError={setError}
          />
        )}

        {currentUser && activeTab === 'voting-history' && (
          <VotingHistoryPanel
            project={project}
            currentUser={currentUser}
            isCoordinator={isCoordinator}
            votingHistory={votingHistory}
            onRefresh={handleRefreshData}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
};

export default DALProjectPage; 