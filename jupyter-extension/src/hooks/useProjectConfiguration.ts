import { useState, useEffect, useCallback } from 'react';
import {
  DVREProjectConfiguration,
  projectConfigurationService
} from '../services/ProjectConfigurationService';

/**
 * Hook for managing project configuration
 * Integrates with existing project collaboration system
 */
export function useProjectConfiguration(projectId?: string) {
  const [configuration, setConfiguration] = useState<DVREProjectConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load configuration
  const loadConfiguration = useCallback(async (id: string) => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const config = projectConfigurationService.getProjectConfiguration(id);
      setConfiguration(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create configuration (called when new project is created)
  const createConfiguration = useCallback(async (
    projectId: string,
    projectData: any,
    templateId?: number
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const config = await projectConfigurationService.createProjectConfiguration(
        projectId,
        projectData,
        templateId
      );
      setConfiguration(config);
      return config;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create configuration');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update dApp extension
  const updateExtension = useCallback(async (
    dAppName: string,
    extensionData: any
  ) => {
    if (!projectId) return null;
    
    try {
      const updated = projectConfigurationService.updateExtensionConfiguration(
        projectId,
        dAppName,
        extensionData
      );
      
      if (updated) {
        setConfiguration(updated);
      }
      
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update extension');
      return null;
    }
  }, [projectId]);

  // Add dataset
  const addDataset = useCallback(async (
    datasetId: string,
    dataset: any
  ) => {
    if (!projectId) return null;
    
    try {
      const updated = projectConfigurationService.addDataset(
        projectId,
        datasetId,
        dataset
      );
      
      if (updated) {
        setConfiguration(updated);
      }
      
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dataset');
      return null;
    }
  }, [projectId]);

  // Add workflow
  const addWorkflow = useCallback(async (
    workflowId: string,
    workflow: any
  ) => {
    if (!projectId) return null;
    
    try {
      const updated = projectConfigurationService.addWorkflow(
        projectId,
        workflowId,
        workflow
      );
      
      if (updated) {
        setConfiguration(updated);
      }
      
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add workflow');
      return null;
    }
  }, [projectId]);

  // Publish to IPFS
  const publishToIPFS = useCallback(async () => {
    if (!projectId) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await projectConfigurationService.publishToIPFS(projectId);
      
      // Reload configuration to get updated IPFS hashes
      if (result) {
        await loadConfiguration(projectId);
      }
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish to IPFS');
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId, loadConfiguration]);

  // Subscribe to configuration changes
  useEffect(() => {
    if (projectId) {
      const unsubscribe = projectConfigurationService.onConfigurationChange(
        projectId,
        (config) => {
          setConfiguration(config);
        }
      );
      
      return unsubscribe;
    }
  }, [projectId]);

  // Load initial configuration
  useEffect(() => {
    if (projectId) {
      loadConfiguration(projectId);
    }
  }, [projectId, loadConfiguration]);

  return {
    configuration,
    loading,
    error,
    createConfiguration,
    updateExtension,
    addDataset,
    addWorkflow,
    publishToIPFS,
    reload: () => projectId && loadConfiguration(projectId)
  };
} 