import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { orchestrationAPI } from './OrchestrationAPI';
const SessionControls = ({ session, onStartQuerying, onContinueQuerying, onPromptTraining, onSubmitLabels, onTerminateProject, isLoading }) => {
    var _a, _b, _c, _d;
    const [labelingMode, setLabelingMode] = useState(false);
    const [labels, setLabels] = useState([]);
    const handleSubmitLabels = () => {
        if (labels.length > 0) {
            onSubmitLabels(labels);
            setLabels([]);
            setLabelingMode(false);
        }
    };
    const addLabel = (sampleId) => {
        const label = prompt(`Enter label for sample ${sampleId}:`);
        if (label) {
            const confidence = parseFloat(prompt('Enter confidence (0-1):') || '1.0');
            setLabels(prev => [...prev, { sample_id: sampleId, label, confidence }]);
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'var(--jp-success-color1)';
            case 'waiting_for_labels': return 'var(--jp-warn-color1)';
            case 'training': return 'var(--jp-info-color1)';
            case 'completed': return 'var(--jp-layout-color3)';
            default: return 'var(--jp-ui-font-color2)';
        }
    };
    return (_jsxs("div", { className: "session-controls", children: [_jsxs("div", { className: "session-header", children: [_jsxs("h4", { children: ["Session: ", session.session_id.slice(0, 8), "..."] }), _jsx("span", { className: "session-status", style: { color: getStatusColor(session.status) }, children: session.status.toUpperCase() })] }), _jsxs("div", { className: "session-info", children: [_jsxs("div", { className: "info-row", children: [_jsx("span", { children: "Round:" }), _jsxs("span", { children: [session.current_round, " / ", session.total_rounds] })] }), ((_a = session.accuracy_metrics) === null || _a === void 0 ? void 0 : _a.accuracy) && (_jsxs("div", { className: "info-row", children: [_jsx("span", { children: "Accuracy:" }), _jsxs("span", { children: [(session.accuracy_metrics.accuracy * 100).toFixed(1), "%"] })] })), _jsxs("div", { className: "info-row", children: [_jsx("span", { children: "Queried Samples:" }), _jsx("span", { children: ((_b = session.queried_samples) === null || _b === void 0 ? void 0 : _b.length) || 0 })] })] }), _jsxs("div", { className: "session-actions", children: [session.status === 'active' && (_jsx("button", { onClick: onContinueQuerying, disabled: isLoading, className: "action-btn primary", children: "Continue Querying" })), session.status === 'waiting_for_labels' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setLabelingMode(!labelingMode), className: "action-btn secondary", children: labelingMode ? 'Cancel Labeling' : 'Label Samples' }), labelingMode && (_jsxs("div", { className: "labeling-section", children: [_jsxs("h5", { children: ["Queried Samples (", ((_c = session.queried_samples) === null || _c === void 0 ? void 0 : _c.length) || 0, ")"] }), _jsx("div", { className: "samples-list", children: (_d = session.queried_samples) === null || _d === void 0 ? void 0 : _d.slice(0, 5).map((sample) => {
                                            var _a;
                                            return (_jsxs("div", { className: "sample-item", children: [_jsx("span", { className: "sample-id", children: sample.sample_id }), _jsxs("span", { className: "sample-uncertainty", children: ["Uncertainty: ", (_a = sample.uncertainty) === null || _a === void 0 ? void 0 : _a.toFixed(3)] }), _jsx("button", { onClick: () => addLabel(sample.sample_id), className: "label-btn", children: "Add Label" })] }, sample.sample_id));
                                        }) }), labels.length > 0 && (_jsxs("div", { className: "labeled-samples", children: [_jsxs("h6", { children: ["Labels Added (", labels.length, ")"] }), labels.map((label, idx) => (_jsxs("div", { className: "labeled-item", children: [label.sample_id, ": ", label.label, " (conf: ", label.confidence, ")"] }, idx))), _jsx("button", { onClick: handleSubmitLabels, className: "action-btn primary", children: "Submit Labels" })] }))] }))] })), (session.status === 'active' || session.status === 'waiting_for_labels') && (_jsx("button", { onClick: onPromptTraining, disabled: isLoading, className: "action-btn secondary", children: "Prompt Training" }))] }), _jsx("div", { className: "danger-zone", children: _jsx("button", { onClick: onTerminateProject, disabled: isLoading, className: "action-btn danger", children: "Terminate Project" }) })] }));
};
export const RuntimeOrchestrationPanel = ({ projectId, workflowId, projectTitle, onClose }) => {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [commandLog, setCommandLog] = useState([]);
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
        }
        catch (err) {
            console.error('Failed to load sessions:', err);
        }
    }, [projectId, selectedSession]);
    const handleCommand = useCallback(async (commandType, parameters = {}) => {
        setLoading(true);
        setError(null);
        try {
            let response;
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
        }
        catch (err) {
            setError(err.message);
        }
        finally {
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
    const submitLabels = (labels) => {
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
    return (_jsxs("div", { className: "runtime-orchestration-panel", children: [_jsxs("div", { className: "panel-header", children: [_jsxs("h2", { children: ["Runtime Orchestration - ", projectTitle] }), _jsxs("div", { className: "header-info", children: [_jsxs("span", { children: ["Project: ", projectId] }), _jsxs("span", { children: ["Workflow: ", workflowId.slice(0, 8), "..."] })] }), onClose && (_jsx("button", { onClick: onClose, className: "close-button", children: "Close" }))] }), error && (_jsxs("div", { className: "error-message", children: [_jsx("span", { children: error }), _jsx("button", { onClick: () => setError(null), children: "\u2715" })] })), _jsxs("div", { className: "panel-content", children: [_jsxs("div", { className: "left-section", children: [_jsxs("div", { className: "sessions-section", children: [_jsxs("div", { className: "section-header", children: [_jsx("h3", { children: "Active Learning Sessions" }), _jsx("button", { onClick: startNewSession, disabled: loading, className: "action-btn primary", children: "Start New Session" })] }), sessions.length === 0 ? (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No active sessions. Start a new querying session to begin." }) })) : (_jsx("div", { className: "sessions-list", children: sessions.map(session => {
                                            var _a;
                                            return (_jsx("div", { className: `session-item ${(selectedSession === null || selectedSession === void 0 ? void 0 : selectedSession.session_id) === session.session_id ? 'selected' : ''}`, onClick: () => setSelectedSession(session), children: _jsxs("div", { className: "session-summary", children: [_jsxs("div", { className: "session-title", children: ["Session ", session.session_id.slice(0, 8), "..."] }), _jsxs("div", { className: "session-meta", children: [_jsx("span", { className: `status ${session.status}`, children: session.status }), _jsxs("span", { children: ["Round ", session.current_round, "/", session.total_rounds] })] }), ((_a = session.accuracy_metrics) === null || _a === void 0 ? void 0 : _a.accuracy) && (_jsxs("div", { className: "accuracy", children: ["Accuracy: ", (session.accuracy_metrics.accuracy * 100).toFixed(1), "%"] }))] }) }, session.session_id));
                                        }) }))] }), _jsxs("div", { className: "command-log-section", children: [_jsx("h3", { children: "Command Log" }), _jsx("div", { className: "command-log", children: commandLog.length === 0 ? (_jsx("p", { children: "No commands executed yet." })) : (commandLog.map((cmd, idx) => {
                                            var _a;
                                            return (_jsxs("div", { className: `log-entry ${cmd.status}`, children: [_jsxs("div", { className: "log-header", children: [_jsxs("span", { className: "command-id", children: [(_a = cmd.command_id) === null || _a === void 0 ? void 0 : _a.slice(0, 8), "..."] }), _jsx("span", { className: "timestamp", children: new Date(cmd.timestamp).toLocaleTimeString() }), _jsx("span", { className: `status ${cmd.status}`, children: cmd.status })] }), _jsx("div", { className: "log-message", children: cmd.message })] }, idx));
                                        })) })] })] }), _jsx("div", { className: "right-section", children: selectedSession ? (_jsx(SessionControls, { session: selectedSession, onStartQuerying: startNewSession, onContinueQuerying: continueQuerying, onPromptTraining: promptTraining, onSubmitLabels: submitLabels, onTerminateProject: terminateProject, isLoading: loading })) : (_jsxs("div", { className: "no-session-selected", children: [_jsx("h3", { children: "Select a Session" }), _jsx("p", { children: "Choose an active learning session from the left panel to view controls and details." })] })) })] })] }));
};
//# sourceMappingURL=RuntimeOrchestrationPanel.js.map