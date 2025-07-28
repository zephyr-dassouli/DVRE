import { useState, useEffect, useCallback } from 'react';
import { useProjects, ProjectInfo } from './useProjects';
import { useAuth } from './useAuth';
import { projectConfigurationService } from '../services/ProjectConfigurationService';
import { ethers } from 'ethers';
import { RPC_URL } from '../config/contracts';
import JSONProject from '../abis/JSONProject.json';

export interface DALProjectInfo extends ProjectInfo {
  // DAL-specific properties
  alConfiguration?: {
    queryStrategy: string;
    scenario: string;
    model: {
      type: string;
      parameters: any;
    };
    maxIterations: number;
    queryBatchSize: number;
    votingConsensus: string;
    votingTimeout: number;
  };
  currentIteration: number;
  totalSamplesLabeled: number;
  modelPerformance?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
  };
  activeVoting?: {
    sampleId: string;
    sampleData: any;
    labelOptions: string[];
    currentVotes: { [label: string]: number };
    timeRemaining: number;
  };
  // Deployment status
  isDeployed: boolean;
  deploymentStatus?: 'deployed' | 'running' | 'failed' | 'deploying' | 'pending';
}

export interface ModelUpdate {
  iterationNumber: number;
  timestamp: number;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  samplesAddedCount: number;
  modelParameters?: any;
}

export interface VotingRecord {
  sampleId: string;
  sampleData: any;
  finalLabel: string;
  votes: { [voterAddress: string]: string };
  votingDistribution: { [label: string]: number };
  timestamp: number;
  iterationNumber: number;
}

export const useDALProject = (projectAddress?: string) => {
  const [dalProjects, setDalProjects] = useState<DALProjectInfo[]>([]);
  const [currentProject, setCurrentProject] = useState<DALProjectInfo | null>(null);
  const [modelUpdates, setModelUpdates] = useState<ModelUpdate[]>([]);
  const [votingHistory, setVotingHistory] = useState<VotingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { projects, userProjects, getProjectInfo } = useProjects();
  const { account } = useAuth();

  // Filter DAL projects from all projects
  const loadDALProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Combine both available projects and user projects
      const allProjects = [...projects, ...userProjects];
      
      const dalProjectsList: DALProjectInfo[] = [];

      for (const project of allProjects) {
        // Get project configuration to check if it's an AL project
        const config = projectConfigurationService.getProjectConfiguration(project.projectId);
        
        // Check if project is an Active Learning project
        // 1. Check the projectData from smart contract (primary source)
        // 2. Fallback to separate configuration service
        const isALProject = (
          // Check project data from smart contract
          project.projectData?.project_type === 'active_learning' ||
          project.projectData?.templateType === 'active_learning' ||
          project.projectData?.type === 'active_learning' ||
          // Fallback to configuration service
          (config && (
            config.projectData?.type === 'active_learning' || 
            config.projectData?.project_type === 'active_learning' ||
            !!config.extensions?.dal
          ))
        );
        
        if (isALProject) {
          // Fetch additional DAL-specific data
          const dalProject = await enrichProjectWithDALData(project, config);
          if (dalProject) {
            dalProjectsList.push(dalProject);
          }
        }
      }

      setDalProjects(dalProjectsList);
    } catch (err) {
      console.error('Failed to load DAL projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load DAL projects');
    } finally {
      setLoading(false);
    }
  }, [projects, userProjects]);

  // Enrich project with DAL-specific data
  const enrichProjectWithDALData = async (project: ProjectInfo, config: any): Promise<DALProjectInfo | null> => {
    try {
      // Check deployment status from smart contract
      let isDeployed = false;
      let deploymentStatus: 'deployed' | 'running' | 'failed' | 'deploying' | 'pending' = 'pending';
      
      try {
        // Get provider and create contract instance
        const provider = new ethers.JsonRpcProvider(RPC_URL); // Use your RPC URL
        const projectContract = new ethers.Contract(project.address, JSONProject.abi, provider);

        // Check if AL contracts are deployed
        const hasALContracts = await projectContract.hasALContracts();
        const needsALDeployment = await projectContract.needsALDeployment();
        
        if (hasALContracts) {
          isDeployed = true;
          deploymentStatus = 'deployed';
        } else if (needsALDeployment) {
          isDeployed = false;
          deploymentStatus = 'pending';
        } else {
          // This shouldn't happen for AL projects, but handle gracefully
          isDeployed = false;
          deploymentStatus = 'pending';
        }
        
      } catch (deploymentError) {
        console.warn('Could not check smart contract deployment status:', deploymentError);
        // Fallback to deployment service if smart contract calls fail
        try {
          const { ProjectDeploymentService } = await import('../components/deployment/services/ProjectDeploymentService');
          const deploymentService = ProjectDeploymentService.getInstance();
          isDeployed = deploymentService.isProjectDeployed(project.projectId);
          
          const status = deploymentService.getDeploymentStatus(project.projectId);
          if (status) {
            deploymentStatus = status.status as any;
          }
        } catch (fallbackError) {
          console.warn('Fallback deployment service also failed:', fallbackError);
        }
      }

      // Extract DAL configuration from project config
      const dalConfig = config?.extensions?.dal;
      
      // In real implementation, these would come from the AL engine, smart contract events, or external services
      // For now, we'll leave them undefined until real data sources are connected
      const currentIteration = 0; // TODO: Get from AL engine or smart contract events
      const totalSamplesLabeled = 0; // TODO: Get from AL engine or smart contract events

      const dalProject: DALProjectInfo = {
        ...project,
        alConfiguration: dalConfig ? {
          queryStrategy: dalConfig.queryStrategy || 'uncertainty_sampling',
          scenario: dalConfig.AL_scenario || 'pool_based',
          model: dalConfig.model || { type: 'logistic_regression', parameters: {} },
          maxIterations: dalConfig.max_iterations || 10,
          queryBatchSize: dalConfig.labeling_budget || 10,
          votingConsensus: dalConfig.voting_consensus || 'simple_majority',
          votingTimeout: dalConfig.voting_timeout_seconds || 3600
        } : undefined,
        currentIteration,
        totalSamplesLabeled,
        // Real model performance and voting data would come from AL contracts/services
        modelPerformance: undefined, // TODO: Get from AL contracts or external ML service
        activeVoting: undefined, // TODO: Get from ALProjectVoting contract
        isDeployed,
        deploymentStatus
      };

      return dalProject;
    } catch (err) {
      console.error(`Failed to enrich project ${project.address} with DAL data:`, err);
      return null;
    }
  };

  // Load specific project details
  const loadProjectDetails = useCallback(async (address: string) => {
    try {
      setLoading(true);
      setError(null);

      const project = await getProjectInfo(address);
      if (project) {
        const config = projectConfigurationService.getProjectConfiguration(project.projectId);
        const dalProject = await enrichProjectWithDALData(project, config);
        setCurrentProject(dalProject);

        // Load model updates and voting history for this project
        await loadModelUpdates(address);
        await loadVotingHistory(address);
      }
    } catch (err) {
      console.error(`Failed to load project details for ${address}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [getProjectInfo]);

  // Load model updates history (real implementation needed)
  const loadModelUpdates = async (projectAddress: string) => {
    // TODO: Implement real model updates loading
    // This should fetch from AL engine, smart contract events, or external ML service
    // For now, set empty array until real data source is connected
    setModelUpdates([]);
  };

  // Load voting history (real implementation needed)
  const loadVotingHistory = async (projectAddress: string) => {
    // TODO: Implement real voting history loading  
    // This should fetch from ALProjectVoting and ALProjectStorage contracts
    // For now, set empty array until real data source is connected
    setVotingHistory([]);
  };

  // Start next AL iteration (coordinator only)
  const startNextIteration = useCallback(async (projectAddress: string) => {
    if (!account || !currentProject) return;

    try {
      setLoading(true);
      // TODO: Implement real smart contract integration
      // This should call the AL orchestrator or smart contract to trigger new iteration
      
    } catch (err) {
      console.error('Failed to start next iteration:', err);
      setError(err instanceof Error ? err.message : 'Failed to start next iteration');
    } finally {
      setLoading(false);
    }
  }, [account, currentProject]);

  // End project (coordinator only)
  const endProject = useCallback(async (projectAddress: string) => {
    if (!account || !currentProject) return;

    try {
      setLoading(true);
      // TODO: Implement real smart contract integration
      // This should call smart contract to deactivate project
      
    } catch (err) {
      console.error('Failed to end project:', err);
      setError(err instanceof Error ? err.message : 'Failed to end project');
    } finally {
      setLoading(false);
    }
  }, [account, currentProject]);

  // Submit vote for current sample
  const submitVote = useCallback(async (projectAddress: string, sampleId: string, label: string) => {
    if (!account || !currentProject) return;

    try {
      setLoading(true);
      
      // TODO: Implement real smart contract integration
      // This should submit to ALProjectVoting contract
      
    } catch (err) {
      console.error('Failed to submit vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setLoading(false);
    }
  }, [account, currentProject]);

  // Load projects on mount and when projects change
  useEffect(() => {
    if (projects.length > 0 || userProjects.length > 0) {
      loadDALProjects();
    } else {
      setLoading(false);
    }
  }, [projects, userProjects, loadDALProjects]);

  // Load specific project if projectAddress is provided
  useEffect(() => {
    if (projectAddress) {
      loadProjectDetails(projectAddress);
    }
  }, [projectAddress, loadProjectDetails]);

  return {
    dalProjects,
    currentProject,
    modelUpdates,
    votingHistory,
    loading,
    error,
    loadDALProjects,
    loadProjectDetails,
    startNextIteration,
    endProject,
    submitVote
  };
};