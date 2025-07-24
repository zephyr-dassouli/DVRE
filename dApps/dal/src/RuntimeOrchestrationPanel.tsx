import React, { useState, useEffect, useCallback } from 'react';
import { orchestrationAPI, QueryingSession, ALEngineResponse } from './OrchestrationAPI';

interface RuntimeOrchestrationPanelProps {
  projectId: string;
  workflowId: string;
  projectTitle: string;
  onClose?: () => void;
}

interface SessionControlsProps {
  session: QueryingSession;
  onStartQuerying: () => void;
  onContinueQuerying: () => void;
  onPromptTraining: () => void;
  onSubmitLabels: (labels: any[]) => void;
  onTerminateProject: () => void;
  isLoading: boolean;
}

const SessionControls: React.FC<SessionControlsProps> = ({
  session,
  onStartQuerying,
  onContinueQuerying,
  onPromptTraining,
  onSubmitLabels,
  onTerminateProject,
  isLoading
}) => {
  const [labelingMode, setLabelingMode] = useState(false);
  const [labels, setLabels] = useState<Array<{ sample_id: string; label: string; confidence: number }>>([]);

  const handleSubmitLabels = () => {
    if (labels.length > 0) {
      onSubmitLabels(labels);
      setLabels([]);
      setLabelingMode(false);
    }
  };

  const addLabel = (sampleId: string) => {
    const label = prompt(`Enter label for sample ${sampleId}:`);
    if (label) {
      const confidence = parseFloat(prompt('Enter confidence (0-1):') || '1.0');
      setLabels(prev => [...prev, { sample_id: sampleId, label, confidence }]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'var(--jp-success-color1)';
      case 'waiting_for_labels': return 'var(--jp-warn-color1)';
      case 'training': return 'var(--jp-info-color1)';
      case 'completed': return 'var(--jp-layout-color3)';
      default: return 'var(--jp-ui-font-color2)';
    }
  };

  return (
    <div className="session-controls">
      <div className="session-header">
        <h4>Session: {session.session_id.slice(0, 8)}...</h4>
        <span 
          className="session-status"
          style={{ color: getStatusColor(session.status) }}
        >
          {session.status.toUpperCase()}
        </span>
      </div>

      <div className="session-info">
        <div className="info-row">
          <span>Round:</span>
          <span>{session.current_round} / {session.total_rounds}</span>
        </div>
        {session.accuracy_metrics?.accuracy && (
          <div className="info-row">
            <span>Accuracy:</span>
            <span>{(session.accuracy_metrics.accuracy * 100).toFixed(1)}%</span>
          </div>
        )}
        <div className="info-row">
          <span>Queried Samples:</span>
          <span>{session.queried_samples?.length || 0}</span>
        </div>
      </div>

      <div className="session-actions">
        {session.status === 'active' && (
          <button
            onClick={onContinueQuerying}
            disabled={isLoading}
            className="action-btn primary"
          >
            Continue Querying
          </button>
        )}

        {session.status === 'waiting_for_labels' && (
          <>
            <button
              onClick={() => setLabelingMode(!labelingMode)}
              className="action-btn secondary"
            >
              {labelingMode ? 'Cancel Labeling' : 'Label Samples'}
            </button>
            
            {labelingMode && (
              <div className="labeling-section">
                <h5>Queried Samples ({session.queried_samples?.length || 0})</h5>
                <div className="samples-list">
                  {session.queried_samples?.slice(0, 5).map((sample: any) => (
                    <div key={sample.sample_id} className="sample-item">
                      <span className="sample-id">{sample.sample_id}</span>
                      <span className="sample-uncertainty">
                        Uncertainty: {sample.uncertainty?.toFixed(3)}
                      </span>
                      <button
                        onClick={() => addLabel(sample.sample_id)}
                        className="label-btn"
                      >
                        Add Label
                      </button>
                    </div>
                  ))}
                </div>
                
                {labels.length > 0 && (
                  <div className="labeled-samples">
                    <h6>Labels Added ({labels.length})</h6>
                    {labels.map((label, idx) => (
                      <div key={idx} className="labeled-item">
                        {label.sample_id}: {label.label} (conf: {label.confidence})
                      </div>
                    ))}
                    <button
                      onClick={handleSubmitLabels}
                      className="action-btn primary"
                    >
                      Submit Labels
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {(session.status === 'active' || session.status === 'waiting_for_labels') && (
          <button
            onClick={onPromptTraining}
            disabled={isLoading}
            className="action-btn secondary"
          >
            Prompt Training
          </button>
        )}
      </div>

      <div className="danger-zone">
        <button
          onClick={onTerminateProject}
          disabled={isLoading}
          className="action-btn danger"
        >
          Terminate Project
        </button>
      </div>
    </div>
  );
};

export const RuntimeOrchestrationPanel: React.FC<RuntimeOrchestrationPanelProps> = ({
  projectId,
  workflowId,
  projectTitle,
  onClose
}) => {
  const [sessions, setSessions] = useState<QueryingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<QueryingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandLog, setCommandLog] = useState<ALEngineResponse[]>([]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [projectId]);

  const loadSessions = useCallback(async () => {
    try {
      const sessionList = await orchestrationAPI.listQueryingSessions(projectId);
      setSessions(sessionList);
      
      // Update selected session if it exists
      if (selectedSession) {
        const updated = sessionList.find(s => s.session_id === selectedSession.session_id);
        if (updated) {
          setSelectedSession(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, [projectId, selectedSession]);

  const handleCommand = useCallback(async (commandType: string, parameters: any = {}) => {
    setLoading(true);
    setError(null);

    try {
      let response: ALEngineResponse;

      switch (commandType) {
        case 'start_querying':
          response = await orchestrationAPI.startQuerying(projectId, workflowId, parameters);
          break;
        case 'continue_querying':
          response = await orchestrationAPI.continueQuerying(projectId, workflowId, parameters.session_id);
          break;
        case 'prompt_training':
          response = await orchestrationAPI.promptTraining(projectId, workflowId, {
            session_id: parameters.session_id,
            training_config: parameters.training_config || {}
          });
          break;
        case 'submit_labels':
          response = await orchestrationAPI.submitLabels(projectId, workflowId, {
            session_id: parameters.session_id,
            labeled_samples: parameters.labeled_samples
          });
          break;
        case 'terminate_project':
          response = await orchestrationAPI.terminateProject(projectId, workflowId);
          break;
        default:
          throw new Error(`Unknown command type: ${commandType}`);
      }

      setCommandLog(prev => [response, ...prev.slice(0, 9)]); // Keep last 10 commands
      
      // Refresh sessions after command
      setTimeout(loadSessions, 1000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, workflowId, loadSessions]);

  const startNewSession = () => {
    const queryCount = parseInt(prompt('Enter query count (default 10):') || '10');
    const strategy = prompt('Enter query strategy (default: uncertainty_sampling):') || 'uncertainty_sampling';
    
    handleCommand('start_querying', {
      query_count: queryCount,
      strategy_override: strategy,
      max_rounds: 10
    });
  };

  const continueQuerying = () => {
    if (selectedSession) {
      handleCommand('continue_querying', { session_id: selectedSession.session_id });
    }
  };

  const promptTraining = () => {
    if (selectedSession) {
      handleCommand('prompt_training', { 
        session_id: selectedSession.session_id,
        training_config: {}
      });
    }
  };

  const submitLabels = (labels: any[]) => {
    if (selectedSession) {
      handleCommand('submit_labels', {
        session_id: selectedSession.session_id,
        labeled_samples: labels
      });
    }
  };

  const terminateProject = () => {
    if (confirm('Are you sure you want to terminate this project? This action cannot be undone.')) {
      handleCommand('terminate_project');
    }
  };

  return (
    <div className="runtime-orchestration-panel">
      <div className="panel-header">
        <h2>Runtime Orchestration - {projectTitle}</h2>
        <div className="header-info">
          <span>Project: {projectId}</span>
          <span>Workflow: {workflowId.slice(0, 8)}...</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="close-button">Close</button>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="panel-content">
        <div className="left-section">
          <div className="sessions-section">
            <div className="section-header">
              <h3>Active Learning Sessions</h3>
              <button
                onClick={startNewSession}
                disabled={loading}
                className="action-btn primary"
              >
                Start New Session
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="empty-state">
                <p>No active sessions. Start a new querying session to begin.</p>
              </div>
            ) : (
              <div className="sessions-list">
                {sessions.map(session => (
                  <div
                    key={session.session_id}
                    className={`session-item ${selectedSession?.session_id === session.session_id ? 'selected' : ''}`}
                    onClick={() => setSelectedSession(session)}
                  >
                    <div className="session-summary">
                      <div className="session-title">
                        Session {session.session_id.slice(0, 8)}...
                      </div>
                      <div className="session-meta">
                        <span className={`status ${session.status}`}>
                          {session.status}
                        </span>
                        <span>Round {session.current_round}/{session.total_rounds}</span>
                      </div>
                      {session.accuracy_metrics?.accuracy && (
                        <div className="accuracy">
                          Accuracy: {(session.accuracy_metrics.accuracy * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="command-log-section">
            <h3>Command Log</h3>
            <div className="command-log">
              {commandLog.length === 0 ? (
                <p>No commands executed yet.</p>
              ) : (
                commandLog.map((cmd, idx) => (
                  <div key={idx} className={`log-entry ${cmd.status}`}>
                    <div className="log-header">
                      <span className="command-id">{cmd.command_id?.slice(0, 8)}...</span>
                      <span className="timestamp">
                        {new Date(cmd.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`status ${cmd.status}`}>{cmd.status}</span>
                    </div>
                    <div className="log-message">{cmd.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="right-section">
          {selectedSession ? (
            <SessionControls
              session={selectedSession}
              onStartQuerying={startNewSession}
              onContinueQuerying={continueQuerying}
              onPromptTraining={promptTraining}
              onSubmitLabels={submitLabels}
              onTerminateProject={terminateProject}
              isLoading={loading}
            />
          ) : (
            <div className="no-session-selected">
              <h3>Select a Session</h3>
              <p>Choose an active learning session from the left panel to view controls and details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 