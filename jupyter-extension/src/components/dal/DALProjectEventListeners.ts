/**
 * DAL Project Event Listeners
 * Handles setting up event listeners for Active Learning project events
 */

import { DALProjectSession, SessionState, createDALProjectSession } from './services/DALProjectSession';
import { DALProject } from './types';

export interface EventListenerDependencies {
  project: DALProject;
  currentUser: string;
  triggerRefresh: () => void;
  setBatchProgress: (progress: any) => void;
  setIterationCompleted: (completed: boolean) => void;
  setIterationMessage: (message: string) => void;
  setDalSession: (session: DALProjectSession | null) => void;
  setSessionState: (state: SessionState | null) => void;
  setError: (error: string) => void;
  setProjectEndStatus: (status: { shouldEnd: boolean; reason: string; currentRound: number; maxIterations: number; }) => void;
}

export interface EventListenerCleanup {
  cleanupBatchListeners: () => void;
  cleanupSessionListeners: () => void;
}

export const setupProjectEventListeners = (deps: EventListenerDependencies): EventListenerCleanup => {
  const {
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
  } = deps;

  // Set up event listeners for batch voting progress
  const setupBatchEventListeners = () => {
    // Listen for sample completion events
    const handleSampleCompleted = (event: CustomEvent) => {
      const { sampleId, finalLabel } = event.detail;
      console.log(`Sample ${sampleId} completed:`, finalLabel);
      
      // FIXED: Don't update batch progress here - let DALProjectSession handle it
      // The DALProjectSession already correctly increments completedSamples and currentSampleIndex
      // Updating here was causing double increments and wrong calculations
      
      // FIXED: Force refresh project data when sample completes to update activeVoting state
      console.log(' Sample completed, triggering project data refresh to clear activeVoting');
      triggerRefresh();
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

    // FIXED: Store handler references for proper cleanup
    window.addEventListener('dal-sample-completed', handleSampleCompleted as EventListener);
    window.addEventListener('dal-iteration-completed', handleIterationCompleted as EventListener);
    
    // Return cleanup function that removes the ACTUAL handlers
    return () => {
      window.removeEventListener('dal-sample-completed', handleSampleCompleted as EventListener);
      window.removeEventListener('dal-iteration-completed', handleIterationCompleted as EventListener);
    };
  };

  // Set up DAL Session event listeners
  const setupSessionEventListeners = () => {
    if (!currentUser) {
      return () => {}; // No cleanup needed if no user
    }

    console.log(' Creating DAL Project Session for:', currentUser);
    const session = createDALProjectSession(project.contractAddress, currentUser);
    setDalSession(session);

    // Store session globally for LabelingPanel access (temporary)
    (window as any).currentDALSession = session;

    // Set up session event listeners
    const handleStateChange = (newState: SessionState) => {
      console.log(' Session state changed:', newState);
      setSessionState(newState);
      
      if (newState.batchProgress) {
        setBatchProgress({
          round: newState.batchProgress.round, // FIXED: Use synchronized round from session
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
      console.log(` Iteration ${iteration} completed with ${samplesLabeled} samples`);
      setIterationCompleted(true);
      setIterationMessage(`AL Iteration ${iteration} completed successfully! ${samplesLabeled} samples were labeled.`);
      
      // Trigger data refresh after a delay
      setTimeout(() => {
        triggerRefresh();
      }, 1000);
    };

    const handleSessionError = (errorMessage: string) => {
      console.error(' DAL Session error:', errorMessage);
      setError(`Session Error: ${errorMessage}`);
    };

    const handleProjectShouldEnd = (details: { trigger: string; reason: string; currentRound: number; timestamp: number; }) => {
      console.log(' Project should end:', details);
      setProjectEndStatus({
        shouldEnd: true,
        reason: details.reason,
        currentRound: details.currentRound,
        maxIterations: project.totalRounds || 0
      });
    };

    session.on('state-changed', handleStateChange);
    session.on('iteration-completed', handleIterationComplete);
    session.on('error', handleSessionError);
    session.on('project-should-end', handleProjectShouldEnd);

    // Check AL-Engine health
    session.checkALEngineHealth().catch((err: any) => {
      console.warn(' AL-Engine health check failed:', err);
      setError('AL-Engine is not responsive. Please ensure it is running on localhost:5050');
    });

    // Return cleanup function
    return () => {
      console.log('🧹 Cleaning up DAL Session');
      session.removeAllListeners();
      session.endSession().catch(console.error);
      setDalSession(null);
    };
  };

  // Set up both types of listeners
  const cleanupBatchListeners = setupBatchEventListeners();
  const cleanupSessionListeners = setupSessionEventListeners();

  return {
    cleanupBatchListeners,
    cleanupSessionListeners
  };
};