import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cwlManager, ALConfiguration, CWLWorkflow, StoredCWL } from './CWLManager';
import { orchestrationAPI, WorkflowStatus } from './OrchestrationAPI';
import { ContributorManager } from './ContributorManager';

interface CWLWorkflowEditorProps {
  projectId: string;
  projectTitle: string;
  userWallet?: string;
  projectData?: any; // DVRE project data with roles and participants
  onClose?: () => void;
  onWorkflowDeployed?: (workflowId: string) => void;
}

interface AutoSaveIndicatorProps {
  lastSaved?: string;
  isAutoSaving?: boolean;
}

const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({ lastSaved, isAutoSaving }) => {
  if (isAutoSaving) {
    return (
      <div className="autosave-indicator saving">
        <span className="dot-animation">●</span> Auto-saving...
      </div>
    );
  }

  if (lastSaved) {
    const timeAgo = new Date(lastSaved).toLocaleTimeString();
    return (
      <div className="autosave-indicator saved">
        ✓ Saved at {timeAgo}
      </div>
    );
  }

  return null;
};

interface ALConfigurationPanelProps {
  config: ALConfiguration;
  onChange: (config: ALConfiguration) => void;
  disabled?: boolean;
}

const ALConfigurationPanel: React.FC<ALConfigurationPanelProps> = ({ 
  config, 
  onChange, 
  disabled = false 
}) => {
  const updateConfig = (updates: Partial<ALConfiguration>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="al-config-panel">
      <h3>Active Learning Configuration</h3>
      
      <div className="config-grid">
        <div className="config-group">
          <label htmlFor="query-strategy">Query Strategy:</label>
          <select
            id="query-strategy"
            value={config.queryStrategy}
            onChange={(e) => updateConfig({ queryStrategy: e.target.value })}
            disabled={disabled}
          >
            <option value="uncertainty_sampling">Uncertainty Sampling</option>
            <option value="diversity_sampling">Diversity Sampling</option>
            <option value="query_by_committee">Query by Committee</option>
            <option value="expected_model_change">Expected Model Change</option>
            <option value="random_sampling">Random Sampling</option>
          </select>
        </div>

        <div className="config-group">
          <label htmlFor="labeling-budget">Labeling Budget:</label>
          <input
            id="labeling-budget"
            type="number"
            min="1"
            max="10000"
            value={config.labelingBudget}
            onChange={(e) => updateConfig({ labelingBudget: parseInt(e.target.value) || 100 })}
            disabled={disabled}
          />
        </div>

        <div className="config-group">
          <label htmlFor="max-iterations">Max Iterations:</label>
          <input
            id="max-iterations"
            type="number"
            min="1"
            max="100"
            value={config.maxIterations}
            onChange={(e) => updateConfig({ maxIterations: parseInt(e.target.value) || 10 })}
            disabled={disabled}
          />
        </div>

        <div className="config-group">
          <label htmlFor="validation-split">Validation Split:</label>
          <input
            id="validation-split"
            type="number"
            min="0.1"
            max="0.5"
            step="0.05"
            value={config.validationSplit || 0.2}
            onChange={(e) => updateConfig({ validationSplit: parseFloat(e.target.value) || 0.2 })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="config-group">
        <label>
          <input
            type="checkbox"
            checked={config.isFederated}
            onChange={(e) => updateConfig({ isFederated: e.target.checked })}
            disabled={disabled}
          />
          Enable Federated Learning
        </label>
      </div>

      {config.isFederated && (
        <div className="config-group">
          <label htmlFor="contributors">Contributors (comma-separated):</label>
          <input
            id="contributors"
            type="text"
            value={config.contributors.join(', ')}
            onChange={(e) => updateConfig({ 
              contributors: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
            })}
            placeholder="alice@example.com, bob@example.com"
            disabled={disabled}
          />
        </div>
      )}

      <div className="config-group">
        <label htmlFor="model-config">Model Configuration (JSON):</label>
        <textarea
          id="model-config"
          value={JSON.stringify(config.modelConfig, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              updateConfig({ modelConfig: parsed });
            } catch (error) {
              // Invalid JSON, but still update to show user's input
              updateConfig({ modelConfig: e.target.value });
            }
          }}
          rows={8}
          disabled={disabled}
          placeholder='{"model_type": "neural_network", "layers": [64, 32], "learning_rate": 0.001}'
        />
      </div>
    </div>
  );
};

interface CWLCodeEditorProps {
  cwl: CWLWorkflow;
  onChange: (cwl: CWLWorkflow) => void;
  disabled?: boolean;
}

const CWLCodeEditor: React.FC<CWLCodeEditorProps> = ({ cwl, onChange, disabled = false }) => {
  const [jsonText, setJsonText] = useState('');
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setJsonText(JSON.stringify(cwl, null, 2));
  }, [cwl]);

  const handleChange = (value: string) => {
    setJsonText(value);
    
    try {
      const parsed = JSON.parse(value);
      setIsValid(true);
      onChange(parsed);
    } catch (error) {
      setIsValid(false);
    }
  };

  return (
    <div className="cwl-code-editor">
      <h3>CWL Workflow Definition</h3>
      <div className={`editor-container ${!isValid ? 'invalid' : ''}`}>
        <textarea
          value={jsonText}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          rows={25}
          className="cwl-textarea"
          spellCheck={false}
        />
        {!isValid && (
          <div className="validation-error">
            Invalid JSON syntax. Please check your formatting.
          </div>
        )}
      </div>
    </div>
  );
};

interface WorkflowValidationPanelProps {
  cwl: CWLWorkflow;
}

const WorkflowValidationPanel: React.FC<WorkflowValidationPanelProps> = ({ cwl }) => {
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    const isValid = cwlManager.validateCWL(cwl);
    // For now, just basic validation - could be enhanced
    setValidation({
      valid: isValid,
      errors: isValid ? [] : ['CWL validation failed'],
      warnings: []
    });
  }, [cwl]);

  if (!validation) return null;

  return (
    <div className="validation-panel">
      <h3>Validation Status</h3>
      <div className={`validation-status ${validation.valid ? 'valid' : 'invalid'}`}>
        {validation.valid ? (
          <div className="validation-success">
            ✓ Workflow is valid and ready for deployment
          </div>
        ) : (
          <div className="validation-errors">
            <h4>Errors:</h4>
            <ul>
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        {validation.warnings.length > 0 && (
          <div className="validation-warnings">
            <h4>Warnings:</h4>
            <ul>
              {validation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

interface DeploymentPanelProps {
  onDeploy: () => Promise<void>;
  status: string;
  workflowId?: string;
  canDeploy: boolean;
  isDeploying: boolean;
  error?: string;
}

const DeploymentPanel: React.FC<DeploymentPanelProps> = ({
  onDeploy,
  status,
  workflowId,
  canDeploy,
  isDeploying,
  error
}) => {
  return (
    <div className="deployment-panel">
      <h3>Deployment</h3>
      
      <div className="deployment-status">
        <span className={`status-badge ${status}`}>
          {status.toUpperCase()}
        </span>
        
        {workflowId && (
          <div className="workflow-id">
            Workflow ID: <code>{workflowId}</code>
          </div>
        )}
      </div>

      {error && (
        <div className="deployment-error">
          <strong>Deployment Error:</strong> {error}
        </div>
      )}

      <button
        onClick={onDeploy}
        disabled={!canDeploy || isDeploying}
        className={`deploy-button ${canDeploy ? 'ready' : 'disabled'}`}
      >
        {isDeploying ? 'Deploying...' : 'Deploy Workflow'}
      </button>
      
      <div className="deployment-info">
        {canDeploy ? (
          <p>Ready to deploy to orchestration server</p>
        ) : (
          <p>Fix validation errors before deploying</p>
        )}
      </div>
    </div>
  );
};

export const CWLWorkflowEditor: React.FC<CWLWorkflowEditorProps> = ({
  projectId,
  projectTitle,
  userWallet,
  projectData,
  onClose,
  onWorkflowDeployed
}) => {
  const [cwlWorkflow, setCwlWorkflow] = useState<CWLWorkflow | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string>('draft');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [alConfig, setAlConfig] = useState<ALConfiguration>({
    queryStrategy: 'uncertainty_sampling',
    modelConfig: {
      model_type: 'neural_network',
      layers: [64, 32],
      learning_rate: 0.001,
      batch_size: 32
    },
    labelingBudget: 100,
    maxIterations: 10,
    isFederated: false,
    contributors: [],
    validationSplit: 0.2
  });

  const autoSaveTimeoutRef = useRef<number>();

  // Load or create CWL workflow
  useEffect(() => {
    loadOrCreateCWL();
    
    // Listen for auto-save events
    const handleAutoSave = (event: CustomEvent) => {
      if (event.detail.projectId === projectId) {
        setLastAutoSave(event.detail.timestamp);
        setIsAutoSaving(false);
      }
    };

    window.addEventListener('dvre-cwl-saved', handleAutoSave as EventListener);
    
    return () => {
      window.removeEventListener('dvre-cwl-saved', handleAutoSave as EventListener);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [projectId]);

  // Set up auto-save when CWL changes
  useEffect(() => {
    if (cwlWorkflow && !readOnly) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      autoSaveTimeoutRef.current = setTimeout(() => {
        setIsAutoSaving(true);
        cwlManager.autoSave(projectId, cwlWorkflow);
      }, 2000) as any; // Auto-save after 2 seconds of inactivity
    }
  }, [cwlWorkflow, projectId, readOnly]);

  const loadOrCreateCWL = useCallback(() => {
    try {
      const existingCWL = cwlManager.loadCWL(projectId);
      if (existingCWL) {
        setCwlWorkflow(existingCWL.cwl);
        setMetadata(existingCWL.metadata);
        setDeploymentStatus(existingCWL.metadata.status);
        setWorkflowId(existingCWL.metadata.workflowId || null);
        
        // Load AL config if available
        if (existingCWL.metadata.alConfig) {
          setAlConfig(existingCWL.metadata.alConfig);
        }
      } else {
        // Create new CWL from template
        createFromTemplate();
      }
    } catch (error: any) {
      if (error.message.includes('Access denied')) {
        setReadOnly(true);
        // Try to load read-only version
        const storage = JSON.parse(localStorage.getItem('dvre-project-cwls') || '{}');
        const cwlData = storage[projectId];
        if (cwlData) {
          setCwlWorkflow(cwlData.cwl);
          setMetadata(cwlData.metadata);
          setDeploymentStatus(cwlData.metadata.status);
        }
      }
    }
  }, [projectId]);

  const createFromTemplate = useCallback(() => {
    const template = cwlManager.createALTemplate(projectId, projectTitle, alConfig);
    setCwlWorkflow(template);
    setDeploymentStatus('draft');
    
    // Save initial template
    cwlManager.saveCWL(projectId, template, {
      projectTitle: projectTitle,
      alConfig: alConfig
    });
  }, [projectId, projectTitle, alConfig]);

  const updateALConfiguration = useCallback((newConfig: ALConfiguration) => {
    setAlConfig(newConfig);
    
    if (cwlWorkflow && !readOnly) {
      cwlManager.updateALConfiguration(projectId, newConfig);
      
      // Update local CWL with new configuration
      const updatedCWL = { ...cwlWorkflow };
      updatedCWL.inputs.query_strategy.default = newConfig.queryStrategy;
      updatedCWL.inputs.model_config.default = JSON.stringify(newConfig.modelConfig);
      updatedCWL.inputs.labeling_budget.default = newConfig.labelingBudget;
      updatedCWL.inputs.max_iterations.default = newConfig.maxIterations;
      
      setCwlWorkflow(updatedCWL);
    }
  }, [cwlWorkflow, projectId, readOnly]);

  const deployWorkflow = useCallback(async () => {
    if (!cwlWorkflow || !userWallet) {
      setDeploymentError('User authentication required for workflow deployment');
      return;
    }

    try {
      setIsDeploying(true);
      setDeploymentError(null);

      // Finalize CWL locally
      const success = cwlManager.finalizeCWL(projectId);
      if (!success) throw new Error('Failed to finalize CWL');

      // Create authenticated submission data with user context
      const submissionData = orchestrationAPI.createAuthenticatedSubmission(
        projectId,
        projectTitle,
        cwlWorkflow,
        alConfig,
        userWallet,
        projectData || {}, // Use project data for role determination
        {} // additional inputs
      );

      // Submit to orchestration server
      const response = await orchestrationAPI.submitProjectWorkflow(submissionData);

      // Update local status
      cwlManager.markAsDeployed(projectId, response.workflow_id);

      setDeploymentStatus('deployed');
      setWorkflowId(response.workflow_id);

      if (onWorkflowDeployed) {
        onWorkflowDeployed(response.workflow_id);
      }

    } catch (error: any) {
      console.error('Deployment failed:', error);
      setDeploymentError(error.message);
    } finally {
      setIsDeploying(false);
    }
  }, [cwlWorkflow, projectId, projectTitle, alConfig, userWallet, projectData, onWorkflowDeployed]);

  if (readOnly) {
    return (
      <div className="cwl-workflow-editor read-only">
        <div className="editor-header">
          <h2>CWL Workflow - Read Only</h2>
          <p>Only the project creator can edit the CWL workflow</p>
          {onClose && (
            <button onClick={onClose} className="close-button">Close</button>
          )}
        </div>
        
        {cwlWorkflow && (
          <CWLCodeEditor
            cwl={cwlWorkflow}
            onChange={() => {}} // No-op for read-only
            disabled={true}
          />
        )}
      </div>
    );
  }

  const canDeploy = cwlWorkflow && cwlManager.validateCWL(cwlWorkflow) && deploymentStatus !== 'deployed';

  return (
    <div className="cwl-workflow-editor">
      <div className="editor-header">
        <h2>CWL Workflow Editor - {projectTitle}</h2>
        <AutoSaveIndicator lastSaved={lastAutoSave} isAutoSaving={isAutoSaving} />
        {onClose && (
          <button onClick={onClose} className="close-button">Close</button>
        )}
      </div>

      <div className="editor-content">
        <div className="left-panel">
          <ALConfigurationPanel
            config={alConfig}
            onChange={updateALConfiguration}
            disabled={deploymentStatus === 'deployed'}
          />
          
          {userWallet && projectData && (
            <ContributorManager
              projectId={projectId}
              userWallet={userWallet}
              userRole={orchestrationAPI['getUserRole'] ? orchestrationAPI['getUserRole'](userWallet, projectData) : 'contributor'}
              projectData={projectData}
              onContributorsChange={(contributors) => {
                console.log('Contributors updated:', contributors);
                // Optionally update AL config with contributor list
                const contributorWallets = contributors
                  .filter(c => c.status === 'active' && c.wallet !== 'pending')
                  .map(c => c.wallet);
                if (contributorWallets.length > 0) {
                  updateALConfiguration({
                    ...alConfig,
                    contributors: contributorWallets
                  });
                }
              }}
            />
          )}
          
          {cwlWorkflow && (
            <WorkflowValidationPanel cwl={cwlWorkflow} />
          )}
        </div>

        <div className="right-panel">
          {cwlWorkflow && (
            <CWLCodeEditor
              cwl={cwlWorkflow}
              onChange={setCwlWorkflow}
              disabled={deploymentStatus === 'deployed'}
            />
          )}
          
          <DeploymentPanel
            onDeploy={deployWorkflow}
            status={deploymentStatus}
            workflowId={workflowId}
            canDeploy={!!canDeploy}
            isDeploying={isDeploying}
            error={deploymentError}
          />
        </div>
      </div>
    </div>
  );
}; 