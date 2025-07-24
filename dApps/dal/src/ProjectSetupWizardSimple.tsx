import React, { useState, useEffect, useCallback } from 'react';
import { dvreROCrateClient, DALROCrate, DALConfiguration, DALDataset, DALWorkflow } from './DVREROCrateClient';

interface ProjectSetupWizardProps {
  projectId: string;
  projectData: any;
  userWallet: string;
  onComplete: (roCrate: DALROCrate) => void;
  onCancel: () => void;
}

type SetupStep = 'configuration' | 'review';

export const ProjectSetupWizard: React.FC<ProjectSetupWizardProps> = ({
  projectId,
  projectData,
  userWallet,
  onComplete,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('configuration');
  const [roCrate, setRoCrate] = useState<DALROCrate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configuration state
  const [queryStrategy, setQueryStrategy] = useState<'uncertainty_sampling' | 'diversity_sampling' | 'hybrid'>('uncertainty_sampling');
  const [labelingBudget, setLabelingBudget] = useState<number>(100);
  const [maxIterations, setMaxIterations] = useState<number>(10);

  // Initialize RO-Crate from DVRE
  const initializeROCrate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to get existing DAL RO-Crate from DVRE
      let existingROCrate = await dvreROCrateClient.getDALROCrate(projectId);
      
      if (existingROCrate) {
        setRoCrate(existingROCrate);
        
        // Load existing configuration
        if (existingROCrate.alConfig) {
          setQueryStrategy(existingROCrate.alConfig.queryStrategy);
          setLabelingBudget(existingROCrate.alConfig.labelingBudget);
          setMaxIterations(existingROCrate.alConfig.maxIterations);
        }
        
        console.log('DAL: Loaded existing RO-Crate configuration');
      } else {
        // Initialize new DAL configuration in DVRE
        existingROCrate = await dvreROCrateClient.updateDALConfiguration(projectId, {
          queryStrategy: 'uncertainty_sampling',
          labelingBudget: 100,
          maxIterations: 10,
          modelConfig: {
            model_type: 'logistic_regression',
            parameters: {}
          },
          dataConfig: {
            trainingDataset: '',
            features: []
          }
        });
        
        if (existingROCrate) {
          setRoCrate(existingROCrate);
          console.log('DAL: Initialized new RO-Crate configuration');
        }
      }
    } catch (error) {
      console.error('DAL: Failed to initialize RO-Crate:', error);
      setError('Failed to load project configuration');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initialize on component mount
  useEffect(() => {
    initializeROCrate();
  }, [initializeROCrate]);

  // Update configuration
  const updateConfiguration = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const alConfig: Partial<DALConfiguration> = {
        queryStrategy,
        labelingBudget,
        maxIterations,
        modelConfig: {
          model_type: 'logistic_regression',
          parameters: {}
        },
        dataConfig: {
          trainingDataset: 'default-dataset',
          features: ['feature1', 'feature2']
        }
      };

      const updatedROCrate = await dvreROCrateClient.updateDALConfiguration(projectId, alConfig);
      
      if (updatedROCrate) {
        setRoCrate(updatedROCrate);
        console.log('DAL: Configuration updated successfully');
        setCurrentStep('review');
      }
    } catch (error: any) {
      console.error('DAL: Failed to update configuration:', error);
      setError(`Failed to update configuration: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [projectId, queryStrategy, labelingBudget, maxIterations]);

  // Finalize project
  const finalizeProject = useCallback(async () => {
    if (!roCrate) return;

    try {
      setLoading(true);
      setError(null);

      console.log('Starting project finalization...');

      // Use DVRE's finalization process
      const finalizationResult = await dvreROCrateClient.finalizeProject(
        projectId,
        projectData.address
      );

      console.log('Project finalized successfully:', finalizationResult);

      if (finalizationResult.success) {
        // Update local state
        const finalizedROCrate = await dvreROCrateClient.getDALROCrate(projectId);
        if (finalizedROCrate) {
          setRoCrate(finalizedROCrate);
          onComplete(finalizedROCrate);
        }
      }
    } catch (error: any) {
      console.error('DAL: Project finalization failed:', error);
      setError(`Project finalization failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [roCrate, projectId, projectData.address, onComplete]);

  const renderConfigurationStep = () => (
    <div style={{ padding: '20px' }}>
      <h3>Active Learning Configuration</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>Query Strategy:</label>
        <select
          value={queryStrategy}
          onChange={(e) => setQueryStrategy(e.target.value as any)}
          style={{ width: '100%', padding: '8px' }}
        >
          <option value="uncertainty_sampling">Uncertainty Sampling</option>
          <option value="diversity_sampling">Diversity Sampling</option>
          <option value="hybrid">Hybrid Approach</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>Labeling Budget:</label>
        <input
          type="number"
          min="1"
          max="10000"
          value={labelingBudget}
          onChange={(e) => setLabelingBudget(parseInt(e.target.value))}
          style={{ width: '100%', padding: '8px' }}
        />
        <small>Total number of samples to be labeled</small>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>Max Iterations:</label>
        <input
          type="number"
          min="1"
          max="100"
          value={maxIterations}
          onChange={(e) => setMaxIterations(parseInt(e.target.value))}
          style={{ width: '100%', padding: '8px' }}
        />
        <small>Number of Active Learning rounds</small>
      </div>

      <div style={{ marginTop: '30px' }}>
        <button
          onClick={updateConfiguration}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            marginRight: '10px'
          }}
        >
          {loading ? 'Updating...' : 'Save Configuration'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 20px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div style={{ padding: '20px' }}>
      <h3>Review Configuration</h3>
      
      {roCrate && (
        <div style={{ marginBottom: '20px' }}>
          <h4>Project Details:</h4>
          <p><strong>Project ID:</strong> {roCrate.projectId}</p>
          <p><strong>Status:</strong> {roCrate.status}</p>
          
          <h4>Active Learning Configuration:</h4>
          <p><strong>Query Strategy:</strong> {roCrate.alConfig.queryStrategy}</p>
          <p><strong>Labeling Budget:</strong> {roCrate.alConfig.labelingBudget}</p>
          <p><strong>Max Iterations:</strong> {roCrate.alConfig.maxIterations}</p>
          <p><strong>Model Type:</strong> {roCrate.alConfig.modelConfig.model_type}</p>
        </div>
      )}

      <div style={{ marginTop: '30px' }}>
        <button
          onClick={finalizeProject}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            marginRight: '10px'
          }}
        >
          {loading ? 'Finalizing...' : 'Finalize Project'}
        </button>
        <button
          onClick={() => setCurrentStep('configuration')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            marginRight: '10px'
          }}
        >
          Back to Configuration
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 20px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  if (loading && !roCrate) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading project configuration...</div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'var(--jp-ui-font-family)',
      background: 'var(--jp-layout-color1)',
      border: '1px solid var(--jp-border-color1)',
      borderRadius: '4px',
      maxWidth: '600px',
      margin: '20px auto'
    }}>
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--jp-border-color1)',
        background: 'var(--jp-layout-color2)'
      }}>
        <h2>DAL Project Setup</h2>
        <div>Step: {currentStep === 'configuration' ? '1. Configuration' : '2. Review'}</div>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          margin: '10px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          border: '1px solid #ffcdd2',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {currentStep === 'configuration' && renderConfigurationStep()}
      {currentStep === 'review' && renderReviewStep()}
    </div>
  );
}; 