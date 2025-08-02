/**
 * DAL Project Event Listeners
 * Handles setting up event listeners for Active Learning project events
 */

import { DALProject } from './types';
import { DALProjectSession, type SessionState } from './services/DALProjectSession';

export interface EventListenerDependencies {
  project: DALProject;
  currentUser: string;
  triggerRefresh: () => void;
  setBatchProgress: (progress: any) => void;
  setIterationCompleted: (completed: boolean) => void;
  setIterationMessage: (message: string) => void;
  setDalSession: (session: any) => void;
  setSessionState: (state: any) => void;
  setError: (error: string | null) => void;
  setProjectEndStatus: (status: any) => void;
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

  const setupBatchEventListeners = () => {
    // Listen for sample completion events
    const handleSampleCompleted = (event: CustomEvent) => {
      console.log('Sample completed event:', event.detail);
      triggerRefresh();
    };

    const handleBatchCompleted = (event: CustomEvent) => {
      console.log('Batch completed event:', event.detail);
      setIterationCompleted(true);
      setIterationMessage(`Batch completed! ${event.detail.samplesCount} samples processed.`);
      triggerRefresh();
    };

    // Listen for smart contract events
    window.addEventListener('sampleCompleted', handleSampleCompleted as EventListener);
    window.addEventListener('batchCompleted', handleBatchCompleted as EventListener);

    return () => {
      window.removeEventListener('sampleCompleted', handleSampleCompleted as EventListener);
      window.removeEventListener('batchCompleted', handleBatchCompleted as EventListener);
    };
  };

  // Set up DAL Session event listeners
  const setupSessionEventListeners = () => {
    // Only coordinators need AL-Engine integration
    if (!project.userRole || project.userRole !== 'coordinator') {
      console.log('Skipping AL-Engine session setup for contributor role');
      return () => {}; // Return empty cleanup function
    }

    console.log('Setting up DAL Session for coordinator');
    
    // Create DAL session for coordinators
    const session = new DALProjectSession(project.contractAddress, currentUser);
    setDalSession(session);

    const handleStateChange = (newState: SessionState) => {
      console.log('DAL Session state changed:', newState);
      setSessionState(newState);
    };

    const handleIterationComplete = (details: { iteration: number; samplesProcessed: number; }) => {
      console.log('Iteration completed:', details);
      setBatchProgress(null);
      setIterationCompleted(true);
      setIterationMessage(`Iteration ${details.iteration} completed! ${details.samplesProcessed} samples processed.`);
      
      // Trigger data refresh to update voting history and model updates
      triggerRefresh();

    };

    const handleSessionError = (errorMessage: string) => {
      console.error('DAL Session error:', errorMessage);
      // For coordinators, show AL-Engine errors as warnings, not blocking errors
      if (errorMessage.includes('AL-Engine')) {
        console.warn('AL-Engine warning for coordinator:', errorMessage);
        // Don't set a blocking error, just log it
      } else {
        setError(`Session Error: ${errorMessage}`);
      }
    };

    const handleProjectShouldEnd = (details: { trigger: string; reason: string; currentRound: number; timestamp: number; }) => {
      console.log('Project should end:', details);
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

    // Check AL-Engine health for coordinators only
    session.checkALEngineHealth().catch((err: any) => {
      console.warn('AL-Engine health check failed for coordinator:', err);
      // Don't block the page - just log the warning
      // The coordinator can still use the interface, they'll just see AL-Engine is unavailable
    });

    // Return cleanup function
    return () => {
      console.log('Cleaning up DAL Session');
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