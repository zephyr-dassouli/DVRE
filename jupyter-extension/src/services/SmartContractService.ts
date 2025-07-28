/**
 * Smart Contract Service - Handles smart contract integration
 * Extracted from ProjectConfigurationService for better organization
 */

import { ethers } from 'ethers';
import JSONProject from '../abis/JSONProject.json';
import { RPC_URL } from '../config/contracts';
import { DVREProjectConfiguration } from './types';

export class SmartContractService {
  private static instance: SmartContractService;

  static getInstance(): SmartContractService {
    if (!SmartContractService.instance) {
      SmartContractService.instance = new SmartContractService();
    }
    return SmartContractService.instance;
  }

  /**
   * Generate config.json from smart contract data for AL projects
   * This replaces hardcoded configuration with actual smart contract data
   */
  async generateConfigFromSmartContract(
    projectId: string,
    config: DVREProjectConfiguration
  ): Promise<any> {
    try {
      // If not an AL project, return basic config
      if (!config.extensions?.dal) {
        return {
          project_id: projectId,
          project_type: config.projectData?.type || 'general',
          version: '1.0.0',
          created_at: config.created,
          updated_at: config.lastModified
        };
      }

      // For AL projects, try to get data from smart contract
      console.log('🔍 Fetching AL configuration from smart contract...');
      
      // Use JsonRpcProvider for read-only operations
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      
      let smartContractData: {
        queryStrategy?: string;
        alScenario?: string;
        maxIterations?: number;
        queryBatchSize?: number;
        labelSpace?: string[];
        votingContract?: string | null;
        storageContract?: string | null;
      } = {};
      
      if (config.contractAddress) {
        try {
          // Get project contract instance
          const projectContract = new ethers.Contract(
            config.contractAddress,
            JSONProject.abi,
            provider
          );

          // Try to get AL metadata from smart contract
          try {
            const projectMetadata = await projectContract.getProjectMetadata();
            smartContractData = {
              queryStrategy: projectMetadata._queryStrategy || 'uncertainty_sampling',
              alScenario: projectMetadata._alScenario || 'pool_based',
              maxIterations: Number(projectMetadata._maxIteration) || 10,
              queryBatchSize: Number(projectMetadata._queryBatchSize) || 5,
              labelSpace: projectMetadata._labelSpace || ['positive', 'negative'],
              votingContract: await projectContract.votingContract?.() || null,
              storageContract: await projectContract.storageContract?.() || null
            };
            console.log('✅ Retrieved AL metadata from smart contract');
          } catch (contractError) {
            console.warn('⚠️ Could not retrieve AL metadata from contract, using configuration data');
            // Fallback to stored configuration
            smartContractData = {
              queryStrategy: config.extensions.dal.queryStrategy || 'uncertainty_sampling',
              alScenario: config.extensions.dal.AL_scenario || 'pool_based',
              maxIterations: config.extensions.dal.max_iterations || 10,
              queryBatchSize: config.extensions.dal.query_batch_size || 5,
              labelSpace: config.extensions.dal.label_space || ['positive', 'negative']
            };
          }
        } catch (error) {
          console.warn('⚠️ Could not connect to smart contract, using stored configuration');
          smartContractData = {
            queryStrategy: config.extensions.dal.queryStrategy || 'uncertainty_sampling',
            alScenario: config.extensions.dal.AL_scenario || 'pool_based',
            maxIterations: config.extensions.dal.max_iterations || 10,
            queryBatchSize: config.extensions.dal.query_batch_size || 5,
            labelSpace: config.extensions.dal.label_space || ['positive', 'negative']
          };
        }
      }

      // Generate comprehensive config.json for AL projects
      const alConfig = {
        // Project identification
        project_id: projectId,
        project_type: 'active_learning',
        version: '1.0.0',
        
        // Timestamps
        created_at: config.created,
        updated_at: config.lastModified,
        
        // Smart contract information
        smart_contract: {
          main_contract: config.contractAddress,
          voting_contract: smartContractData.votingContract,
          storage_contract: smartContractData.storageContract
        },
        
        // Active Learning Configuration
        active_learning: {
          query_strategy: smartContractData.queryStrategy,
          scenario: smartContractData.alScenario,
          max_iterations: smartContractData.maxIterations,
          query_batch_size: smartContractData.queryBatchSize,
          label_space: smartContractData.labelSpace,
          
          // Model configuration
          model: {
            type: config.extensions.dal.model?.type || 'RandomForestClassifier',
            parameters: config.extensions.dal.model?.parameters || {
              n_estimators: 100,
              random_state: 42
            },
            framework: 'scikit-learn'
          },
          
          // Dataset configuration
          datasets: {
            training_dataset: config.extensions.dal.training_dataset || 'dataset-main',
            labeling_dataset: config.extensions.dal.labeling_dataset || 'dataset-main',
            format: 'csv'
          },
          
          // Voting configuration
          voting: {
            consensus_type: config.extensions.dal.voting_consensus || 'simple_majority',
            threshold: 0.51,
            timeout_seconds: 3600
          }
        },
        
        // Workflow configuration
        workflow: {
          name: 'al_iteration.cwl',
          type: 'cwl',
          version: 'v1.2',
          orchestrator_endpoint: 'http://145.100.135.97:5004'
        },
        
        // IPFS configuration
        ipfs: {
          gateway: 'http://145.100.135.97:8081/ipfs/',
          api_endpoint: 'http://145.100.135.97:5002'
        }
      };

      return alConfig;
    } catch (error) {
      console.error('Error generating config from smart contract:', error);
      // Fallback to basic config
      return {
        project_id: projectId,
        project_type: config.extensions?.dal ? 'active_learning' : 'general',
        version: '1.0.0',
        created_at: config.created,
        updated_at: config.lastModified,
        error: 'Could not retrieve smart contract data'
      };
    }
  }

  /**
   * Refresh project configuration from smart contract
   */
  async refreshProjectConfigurationFromContract(
    projectId: string,
    config: DVREProjectConfiguration
  ): Promise<DVREProjectConfiguration | null> {
    if (!config.contractAddress) {
      console.warn('Project configuration or contract address not available for refresh.');
      return null;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const projectContract = new ethers.Contract(
        config.contractAddress,
        JSONProject.abi,
        signer
      );

      // Fetch the latest configuration from the smart contract
      const latestConfig = await projectContract.getProjectConfiguration();
      console.log('✅ Refreshed project configuration from smart contract:', latestConfig);

      // Update the local configuration with fresh smart contract data
      const updatedConfig = { ...config, projectData: latestConfig };

      // Update deployment status
      updatedConfig.ipfs = {
        roCrateHash: config.ipfs?.roCrateHash || '',
        publishedAt: config.ipfs?.publishedAt || new Date().toISOString()
      };

      return updatedConfig;
    } catch (error) {
      console.error('Failed to refresh project configuration from smart contract:', error);
      return null;
    }
  }
}

export const smartContractService = SmartContractService.getInstance(); 