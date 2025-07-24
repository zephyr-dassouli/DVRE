import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DVREProjectConfiguration, ConfigurationWorkflow, projectConfigurationService } from '../../services/ProjectConfigurationService';
import { useAuth } from '../../hooks/useAuth';

interface WorkflowEditorProps {
  projectId: string;
  workflowId: string;
  workflow: ConfigurationWorkflow;
  projectConfig: DVREProjectConfiguration;
  onSave?: (workflow: ConfigurationWorkflow) => void;
  onClose?: () => void;
  isExpanded: boolean;
}

interface ALConfiguration {
  queryStrategy: string;
  AL_scenario: string;
  model: string | { type: string; parameters: Record<string, any> };
  labeling_budget: number;
  max_iterations: number;
  validation_split: number;
  federated?: boolean;
  contributors?: string[];
}

// Auto-save indicator component
const AutoSaveIndicator: React.FC<{ lastSaved?: string; isAutoSaving: boolean }> = ({
  lastSaved,
  isAutoSaving
}) => (
  <div className="auto-save-indicator">
    {isAutoSaving && <span className="saving">Saving...</span>}
    {lastSaved && !isAutoSaving && (
      <span className="saved">✓ Saved at {new Date(lastSaved).toLocaleTimeString()}</span>
    )}
  </div>
);

// AL Configuration Panel (for DAL projects)
const ALConfigurationPanel: React.FC<{
  config: ALConfiguration;
  onChange: (config: ALConfiguration) => void;
  disabled?: boolean;
}> = ({ config, onChange, disabled = false }) => {
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
          <label htmlFor="al-scenario">AL Scenario:</label>
          <select
            id="al-scenario"
            value={config.AL_scenario}
            onChange={(e) => updateConfig({ AL_scenario: e.target.value })}
            disabled={disabled}
          >
            <option value="single_annotator">Single Annotator</option>
            <option value="multi_annotator">Multi Annotator</option>
            <option value="federated">Federated</option>
            <option value="collaborative">Collaborative</option>
          </select>
        </div>

        <div className="config-group">
          <label htmlFor="labeling-budget">Labeling Budget:</label>
          <input
            id="labeling-budget"
            type="number"
            min="1"
            max="10000"
            value={config.labeling_budget}
            onChange={(e) => updateConfig({ labeling_budget: parseInt(e.target.value) || 100 })}
            disabled={disabled}
          />
          <small>Number of samples to label per iteration</small>
        </div>

        <div className="config-group">
          <label htmlFor="max-iterations">Max Iterations:</label>
          <input
            id="max-iterations"
            type="number"
            min="1"
            max="100"
            value={config.max_iterations}
            onChange={(e) => updateConfig({ max_iterations: parseInt(e.target.value) || 10 })}
            disabled={disabled}
          />
          <small>Maximum AL iterations to perform</small>
        </div>

        <div className="config-group">
          <label htmlFor="validation-split">Validation Split:</label>
          <input
            id="validation-split"
            type="number"
            min="0.1"
            max="0.5"
            step="0.05"
            value={config.validation_split}
            onChange={(e) => updateConfig({ validation_split: parseFloat(e.target.value) || 0.2 })}
            disabled={disabled}
          />
          <small>Ratio of data reserved for validation (0.1-0.5)</small>
        </div>

        <div className="config-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.federated || false}
              onChange={(e) => updateConfig({ federated: e.target.checked })}
              disabled={disabled}
            />
            Enable Federated Learning
          </label>
          <small>Distribute learning across multiple participants</small>
        </div>

        {config.federated && (
          <div className="config-group">
            <label htmlFor="contributors">Contributors:</label>
            <input
              id="contributors"
              type="text"
              value={(config.contributors || []).join(', ')}
              onChange={(e) => updateConfig({ 
                contributors: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
              })}
              placeholder="Enter contributor wallet addresses or emails"
              disabled={disabled}
            />
            <small>Comma-separated list of federated learning participants</small>
          </div>
        )}

        <div className="config-group model-config-group">
          <label htmlFor="model-config">Model Configuration (JSON):</label>
          <textarea
            id="model-config"
            value={typeof config.model === 'string' ? config.model : JSON.stringify(config.model, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                updateConfig({ model: parsed });
              } catch (error) {
                // Keep the raw text for user editing
                updateConfig({ model: e.target.value });
              }
            }}
            rows={6}
            disabled={disabled}
            placeholder='{"type": "neural_network", "parameters": {"layers": [64, 32], "learning_rate": 0.001, "batch_size": 32}}'
          />
          <small>JSON configuration for the machine learning model</small>
        </div>
      </div>
    </div>
  );
};

// CWL Code Editor
const CWLCodeEditor: React.FC<{
  workflow: ConfigurationWorkflow;
  onChange: (content: string) => void;
  disabled?: boolean;
}> = ({ workflow, onChange, disabled = false }) => {
  const [jsonText, setJsonText] = useState('');
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setJsonText(workflow.content);
  }, [workflow.content]);

  const handleChange = (value: string) => {
    setJsonText(value);
    
    try {
      JSON.parse(value);
      setIsValid(true);
      onChange(value);
    } catch (error) {
      setIsValid(false);
      // Still call onChange to show user's input
      onChange(value);
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

// Workflow Validation Panel
const WorkflowValidationPanel: React.FC<{
  workflow: ConfigurationWorkflow;
}> = ({ workflow }) => {
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    // Basic CWL validation
    try {
      const cwl = JSON.parse(workflow.content);
      const isValid = cwl.cwlVersion && cwl.class && cwl.inputs && cwl.outputs;
      
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (!cwl.cwlVersion) errors.push('Missing cwlVersion');
      if (!cwl.class) errors.push('Missing class');
      if (!cwl.inputs) errors.push('Missing inputs');
      if (!cwl.outputs) errors.push('Missing outputs');
      
      if (Object.keys(cwl.inputs || {}).length === 0) {
        warnings.push('No inputs defined');
      }
      if (Object.keys(cwl.outputs || {}).length === 0) {
        warnings.push('No outputs defined');
      }

      setValidation({
        valid: isValid && errors.length === 0,
        errors,
        warnings
      });
    } catch (error) {
      setValidation({
        valid: false,
        errors: ['Invalid JSON format'],
        warnings: []
      });
    }
  }, [workflow.content]);

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

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  projectId,
  workflowId,
  workflow,
  projectConfig,
  onSave,
  onClose,
  isExpanded
}) => {
  const { account } = useAuth();
  const [currentWorkflow, setCurrentWorkflow] = useState<ConfigurationWorkflow>(workflow);
  const [alConfig, setAlConfig] = useState<ALConfiguration | null>(null);
  const [lastAutoSave, setLastAutoSave] = useState<string | undefined>(undefined);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<number>();

  // Helper function to detect if a project should be a DAL project
  const checkIfShouldBeDALProject = useCallback((projectData: any): boolean => {
    console.log('🔍 WorkflowEditor checkIfShouldBeDALProject called with:', projectData);
    
    if (!projectData) {
      console.log('❌ WorkflowEditor: No project data provided');
      return false;
    }
    
    // PRIORITY 1: Check explicit template type markers
    if (projectData.templateType === 'active_learning' || 
        projectData.project_type === 'active_learning' || 
        projectData.type === 'active_learning') {
      console.log('✅ WorkflowEditor: Detected as AL by explicit markers:', {
        templateType: projectData.templateType,
        project_type: projectData.project_type,
        type: projectData.type
      });
      return true;
    }
    
    // PRIORITY 2: Check project data for DAL indicators (enhanced detection)
    const indicators = [
      'active learning', 'al', 'dal', 'machine learning', 'annotation', 'labeling',
      'query strategy', 'uncertainty sampling', 'model training', 'classification',
      'supervised learning', 'semi-supervised', 'iterative learning'
    ];
    
    const projectText = (
      (projectData.name || '') + ' ' + 
      (projectData.description || '') + ' ' +
      (projectData.objective || '') + ' ' +
      (projectData.project_type || '') + ' ' +
      (projectData.keywords || []).join(' ')
    ).toLowerCase();
    
    const textMatch = indicators.some(indicator => projectText.includes(indicator));
    
    console.log('🔍 WorkflowEditor: Text analysis result:', {
      projectText,
      indicators,
      textMatch,
      finalResult: textMatch
    });
    
    return textMatch;
  }, []);

  // Initialize AL config for DAL projects
  useEffect(() => {
    console.log('WorkflowEditor: Initializing AL config for project:', projectId);
    
    // Get AL config from project extensions (if it exists)
    const existingAlConfig = projectConfig?.extensions?.dal;
    
    if (existingAlConfig) {
      console.log('Found existing DAL extension for project:', projectId);
      setAlConfig(existingAlConfig);
    } else {
      // Check if this should be a DAL project based on project characteristics
      const shouldBeDALProject = checkIfShouldBeDALProject(projectConfig?.projectData);
      
      if (shouldBeDALProject) {
        // Create default AL configuration (no more prompts!)
        console.log('Project detected as DAL project, creating default AL configuration');
        
        const defaultAlConfig: ALConfiguration = {
          queryStrategy: 'uncertainty_sampling',
          AL_scenario: 'single_annotator',
          model: {
            type: 'neural_network',
            parameters: {
              layers: [64, 32],
              learning_rate: 0.001,
              batch_size: 32
            }
          },
          labeling_budget: 100,
          max_iterations: 10,
          validation_split: 0.2,
          federated: false,
          contributors: []
        };
        
        // Update the project configuration with default DAL extension
        if (account) {
          try {
            projectConfigurationService.updateExtensionConfiguration(
              projectId,
              'dal',
              defaultAlConfig,
              account
            );
            setAlConfig(defaultAlConfig);
            console.log('Created default DAL extension for project:', projectId);
          } catch (error) {
            console.error('Failed to create DAL extension:', error);
            setAlConfig(defaultAlConfig);
          }
        } else {
          setAlConfig(defaultAlConfig);
        }
      } else {
        // For non-DAL projects, provide minimal AL config that can be activated later
        console.log('Non-DAL project, providing minimal AL config');
        const minimalAlConfig: ALConfiguration = {
          queryStrategy: 'uncertainty_sampling',
          AL_scenario: 'single_annotator',
          model: {
            type: 'logistic_regression',
            parameters: {
              max_iter: 1000,
              random_state: 42
            }
          },
          labeling_budget: 100,  
          max_iterations: 10,
          validation_split: 0.2,
          federated: false,
          contributors: []
        };
        setAlConfig(minimalAlConfig);
      }
    }
  }, [projectId, projectConfig, account]);

  // Auto-save functionality
  useEffect(() => {
    if (!account) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, 2000) as any; // Auto-save after 2 seconds of inactivity

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [currentWorkflow.content, account]);

  const handleAutoSave = useCallback(async () => {
    if (!account) return;

    setIsAutoSaving(true);
    try {
      const result = projectConfigurationService.addWorkflow(
        projectId,
        workflowId,
        currentWorkflow,
        account
      );

      if (result) {
        const now = new Date().toISOString();
        setLastAutoSave(now);
        onSave?.(currentWorkflow);
        
        // Emit custom event for backward compatibility
        window.dispatchEvent(new CustomEvent('dvre-workflow-saved', {
          detail: { projectId, workflowId, timestamp: now }
        }));
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [projectId, workflowId, currentWorkflow, account, onSave]);

  const handleWorkflowContentChange = (content: string) => {
    setCurrentWorkflow(prev => ({
      ...prev,
      content,
      lastModified: new Date().toISOString()
    }));
  };

  const handleALConfigChange = useCallback((newConfig: ALConfiguration) => {
    setAlConfig(newConfig);
    
    // Update workflow with new AL configuration if it's a CWL workflow
    if (currentWorkflow.type === 'cwl') {
      try {
        const cwl = JSON.parse(currentWorkflow.content);
        
        // Update CWL inputs with new AL config
        if (cwl.inputs) {
          if (cwl.inputs.query_strategy) cwl.inputs.query_strategy.default = newConfig.queryStrategy;
          if (cwl.inputs.AL_scenario) cwl.inputs.AL_scenario.default = newConfig.AL_scenario;
          if (cwl.inputs.model) cwl.inputs.model.default = JSON.stringify(newConfig.model);
          if (cwl.inputs.max_iterations) cwl.inputs.max_iterations.default = newConfig.max_iterations;
          if (cwl.inputs.labeling_budget) cwl.inputs.labeling_budget.default = newConfig.labeling_budget;
          if (cwl.inputs.validation_split) cwl.inputs.validation_split.default = newConfig.validation_split;
          if (cwl.inputs.federated) cwl.inputs.federated.default = newConfig.federated;
          if (cwl.inputs.contributors) cwl.inputs.contributors.default = JSON.stringify(newConfig.contributors);
        }
        
        setCurrentWorkflow(prev => ({
          ...prev,
          content: JSON.stringify(cwl, null, 2),
          lastModified: new Date().toISOString()
        }));
        
        // Also update the project's DAL extension
        if (account) {
          projectConfigurationService.updateExtensionConfiguration(
            projectId,
            'dal',
            newConfig,
            account
          );
        }
      } catch (error) {
        console.warn('Failed to update CWL with AL config:', error);
      }
    }
  }, [currentWorkflow.content, currentWorkflow.type, projectId, account]);

  const isDALProject = projectConfig.extensions?.dal !== undefined;
  
  // For debugging, let's always show the AL config panel for now
  const shouldShowALPanel = !!alConfig && (isDALProject || checkIfShouldBeDALProject(projectConfig.projectData));

  console.log('WorkflowEditor render:', {
    isDALProject,
    shouldShowALPanel,
    alConfig: !!alConfig,
    isExpanded,
    hasDALExtension: !!projectConfig.extensions?.dal,
    shouldBeDAL: checkIfShouldBeDALProject(projectConfig.projectData)
  });

  if (!isExpanded) {
    return null;
  }

  return (
    <div className="workflow-editor-expanded">
      <div className="editor-header">
        <h2>CWL Workflow Editor - {currentWorkflow.name}</h2>
        <div className="header-actions">
          <AutoSaveIndicator lastSaved={lastAutoSave} isAutoSaving={isAutoSaving} />
          {onClose && (
            <button onClick={onClose} className="close-button">Close</button>
          )}
        </div>
      </div>

      <div className="editor-content">
        <div className="left-panel">
          {shouldShowALPanel && alConfig && (
            <ALConfigurationPanel
              config={alConfig}
              onChange={handleALConfigChange}
              disabled={false}
            />
          )}
          
          <WorkflowValidationPanel workflow={currentWorkflow} />
        </div>

        <div className="right-panel">
          <CWLCodeEditor
            workflow={currentWorkflow}
            onChange={handleWorkflowContentChange}
            disabled={false}
          />
        </div>
      </div>
    </div>
  );
};

export default WorkflowEditor; 