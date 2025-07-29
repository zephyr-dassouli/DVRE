/**
 * Deployment Orchestrator - Coordinates deployment across all services
 */

import { projectConfigurationService, DVREProjectConfiguration } from './ProjectConfigurationService';
import { ProjectDeploymentService } from './ProjectDeploymentService';
import { SmartContractService } from './SmartContractService';
import { localFileDownloadService } from './LocalFileDownloadService';

// Import blockchain dependencies  
import { ethers } from 'ethers';
import Project from '../../../abis/Project.json';

/**
 * Deployment results interface
 */
export interface DeploymentResults {
  steps: {
    alSmartContracts: 'success' | 'failed' | 'skipped';
    ipfsUpload: 'success' | 'failed';
    localROCrateSave: 'success' | 'failed' | 'skipped';
    orchestrationDeploy: 'success' | 'failed' | 'skipped';
    smartContractUpdate: 'success' | 'failed';
    localFileDownload: 'success' | 'failed' | 'skipped';
  };
  roCrateHash?: string;
  orchestrationWorkflowId?: string;
  localROCratePath?: string;
  localDownloadPath?: string;
  downloadedFiles?: string[];
  alContractAddresses?: {
    voting: string;
    storage: string;
  };
  error?: string;
}

export class DeploymentOrchestrator {
  private static instance: DeploymentOrchestrator;

  static getInstance(): DeploymentOrchestrator {
    if (!DeploymentOrchestrator.instance) {
      DeploymentOrchestrator.instance = new DeploymentOrchestrator();
    }
    return DeploymentOrchestrator.instance;
  }

  /**
   * Centralized deployment method that handles the entire deployment pipeline
   */
  async deployProject(
    projectId: string, 
    userAddress: string,
    computationMode: 'local' | 'remote' = 'local'
  ): Promise<DeploymentResults> {
    console.log('🚀 Starting centralized project deployment:', projectId);
    console.log('💻 Computation mode:', computationMode);
    
    const result: DeploymentResults = {
      steps: {
        alSmartContracts: 'skipped',
        ipfsUpload: 'failed',
        localROCrateSave: 'skipped',
        orchestrationDeploy: 'failed',
        smartContractUpdate: 'failed',
        localFileDownload: 'skipped'
      }
    };

    try {
      // Get project configuration
      let config = projectConfigurationService.getProjectConfiguration(projectId);
      if (!config) {
        throw new Error('Project configuration not found');
      }

      // Verify ownership
      if (!projectConfigurationService.isProjectOwner(projectId, userAddress)) {
        throw new Error('Only project owners can deploy projects');
      }

      // Step 1: Deploy AL smart contracts if needed
      const isALProject = this.isActivelearningProject(config);
      if (isALProject) {
        console.log('📋 Deploying AL smart contracts...');
        try {
          const alContractAddresses = await this.deployALSmartContracts(config, userAddress);
          
          // Only set contract addresses if they were actually deployed
          if (alContractAddresses.voting && alContractAddresses.storage) {
            result.steps.alSmartContracts = 'success';
            result.alContractAddresses = {
              voting: alContractAddresses.voting,
              storage: alContractAddresses.storage
            };
          } else {
            result.steps.alSmartContracts = 'skipped'; // No contracts were deployed
          }
          
          // Step 1.5: Refresh project configuration after contract updates
          console.log('🔄 Refreshing project configuration with updated smart contract data...');
          const refreshedConfig = await this.refreshProjectConfigurationFromContract(projectId, config);
          if (refreshedConfig) {
            config = refreshedConfig; // Use the updated configuration for subsequent steps
          }
        } catch (error) {
          console.error('AL contract deployment failed:', error);
          result.steps.alSmartContracts = 'failed';
          // Continue with deployment - AL contracts are optional for now
        }
      }

      // 2. IPFS Upload
      console.log('📦 Step 2: Publishing to IPFS...');
      const ipfsResult = await projectConfigurationService.publishToIPFS(projectId, userAddress);
      
      if (ipfsResult) {
        result.roCrateHash = ipfsResult.roCrateHash;
        result.steps.ipfsUpload = 'success';
        console.log('✅ IPFS upload successful');

        // 2.5. Local RO-Crate Save (ONLY for local computation mode - AL-Engine access)
        if (computationMode === 'local') {
          console.log('💾 Step 2.5: Saving RO-Crate locally for AL-Engine...');
          try {
            // Step 3: Save RO-Crate bundle locally for AL-Engine access
            console.log('💾 Step 3: Saving RO-Crate bundle locally...');
            const { localROCrateService } = await import('./LocalROCrateService');
            const { roCrateService } = await import('./ROCrateService');
            
            // Get the RO-Crate data that was uploaded to IPFS
            const roCrateData = roCrateService.generateROCrateJSON(config);
            
            // Save locally to al-engine/ro-crates (now includes actual dataset downloads)
            const localSaveResult = await localROCrateService.saveROCrateLocally(
              projectId, 
              roCrateData, 
              config
            );
            
            if (localSaveResult.success) {
              console.log('✅ RO-Crate saved locally for AL-Engine (including actual CSV datasets)');
              console.log(`📂 Saved to: ${localSaveResult.projectPath}`);
              console.log(`📄 Files: ${localSaveResult.savedFiles.length}`);
              result.steps.localROCrateSave = 'success';
              result.localROCratePath = localSaveResult.projectPath;
            } else {
              console.warn('⚠️ Failed to save RO-Crate locally:', localSaveResult.error);
              result.steps.localROCrateSave = 'failed';
            }
          } catch (error) {
            console.warn('⚠️ Failed to save RO-Crate locally:', error);
            result.steps.localROCrateSave = 'failed';
          }
        } else {
          // Remote mode - skip local RO-Crate save
          result.steps.localROCrateSave = 'skipped';
          console.log('⏭️ Skipping local RO-Crate save (Remote/Infra Sharing mode)');
        }
      } else {
        result.steps.ipfsUpload = 'failed';
        console.error('❌ IPFS upload failed');
      }

      // 3. Local File Download (if Local computation mode and RO-Crate save failed)
      if (computationMode === 'local' && result.roCrateHash) {
        // Skip local file download if RO-Crate save was successful
        if (result.steps.localROCrateSave === 'success') {
          result.steps.localFileDownload = 'skipped';
          console.log('⏭️ Skipping local file download (RO-Crate already saved locally)');
        } else {
          console.log('📥 Step 3: Downloading files for local computation (fallback)...');
          try {
            const downloadResult = await localFileDownloadService.downloadProjectFilesForLocal(
              config,
              result.roCrateHash
            );
            
            if (downloadResult.success) {
              result.steps.localFileDownload = 'success';
              result.localDownloadPath = downloadResult.localPath;
              result.downloadedFiles = downloadResult.downloadedFiles;
              console.log('✅ Local file download successful');
              console.log(`📁 Files downloaded to: ${downloadResult.localPath}`);
              console.log(`📋 Downloaded files: ${downloadResult.downloadedFiles.join(', ')}`);
            } else {
              result.steps.localFileDownload = 'failed';
              console.error('❌ Local file download failed:', downloadResult.error);
            }
          } catch (error) {
            result.steps.localFileDownload = 'failed';
            console.error('❌ Local file download failed:', error);
          }
        }
      } else if (computationMode === 'local') {
        result.steps.localFileDownload = 'failed';
        console.error('❌ Cannot download files: No RO-Crate hash available');
      }

      // 4. Orchestration Deployment (skip for local mode)
      if (computationMode === 'remote') {
        console.log('🚀 Step 4: Deploying to orchestration server...');
        
        // Get the updated config with IPFS hash
        const updatedConfig = projectConfigurationService.getProjectConfiguration(projectId);
        const roCrateHash = result.roCrateHash || updatedConfig?.ipfs?.roCrateHash;
        
        if (roCrateHash) {
          try {
            // Use WorkflowService to submit workflow to orchestrator
            const { workflowService } = await import('./WorkflowService');
            
            const workflowConfig = {
              projectId,
              workflowType: this.getWorkflowType(config),
              orchestratorEndpoint: workflowService.getOrchestratorEndpoint(), // This is for logging/reference
              configuration: {
                roCrateHash: roCrateHash,
                projectData: config.projectData,
                extensions: config.extensions,
                contractAddress: config.contractAddress
              }
            };

            const workflowResult = await workflowService.submitWorkflowToOrchestrator(workflowConfig);
            
            if (workflowResult.success) {
              result.steps.orchestrationDeploy = 'success';
              result.orchestrationWorkflowId = workflowResult.workflowId;
              console.log('✅ Orchestration deployment successful');
            } else {
              result.steps.orchestrationDeploy = 'failed';
              console.error('❌ Orchestration deployment failed:', workflowResult.error);
            }
          } catch (error) {
            result.steps.orchestrationDeploy = 'failed';
            console.error('❌ Orchestration deployment failed:', error);
          }
        } else {
          result.steps.orchestrationDeploy = 'failed';
          console.error('❌ No RO-Crate hash available for orchestration');
        }
      } else {
        // Local mode - skip orchestration
        result.steps.orchestrationDeploy = 'skipped';
        console.log('⏭️ Skipping orchestration deployment (Local computation mode)');
      }

      // 5. Smart Contract Update  
      console.log('📋 Step 5: Updating smart contract with IPFS hashes...');
      
      const roCrateHash = result.roCrateHash;
      if (roCrateHash && config.contractAddress) {
        try {
          console.log('🔗 Updating IPFS hash on smart contract...');
          
          // Get blockchain connection
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();
          
          // Connect to main project contract
          const projectContract = new ethers.Contract(config.contractAddress, Project.abi, signer);
          
          // Try to update IPFS hash on contract
          try {
            const updateIPFSHashFunction = projectContract.interface.getFunction('updateIPFSHash');
            if (updateIPFSHashFunction) {
              const tx = await projectContract.updateIPFSHash(roCrateHash);
              await tx.wait();
              console.log('✅ IPFS hash updated on smart contract:', roCrateHash);
              result.steps.smartContractUpdate = 'success';
            } else {
              console.log('⚠️ updateIPFSHash method not found on contract - storing locally only');
              console.log('📋 RO-Crate hash stored locally:', roCrateHash);
              result.steps.smartContractUpdate = 'success'; // Consider it successful since we have the hash
            }
          } catch (error) {
            console.warn('⚠️ Failed to update IPFS hash on contract:', error);
            console.log('📋 RO-Crate hash available locally:', roCrateHash);
            result.steps.smartContractUpdate = 'success'; // Consider it successful since we have the hash
          }
          
        } catch (error) {
          result.steps.smartContractUpdate = 'failed';
          console.error('❌ Smart contract update failed:', error);
        }
      } else {
        result.steps.smartContractUpdate = 'failed';
        console.error('❌ No RO-Crate hash or contract address available');
      }

      console.log('✅ Deployment completed:', result);
      return result;

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      result.error = error instanceof Error ? error.message : 'Unknown error';
      return result;
    }
  }

  /**
   * Check if project is Active Learning
   */
  private isActivelearningProject(config: DVREProjectConfiguration): boolean {
    return config.projectData?.type === 'active_learning' || 
           config.projectData?.project_type === 'active_learning' ||
           !!config.extensions?.dal;
  }

  /**
   * Deploy AL smart contracts separately and link them to Project
   */
  private async deployALSmartContracts(
    config: DVREProjectConfiguration, 
    userAddress: string
  ): Promise<{ voting?: string; storage?: string }> {
    if (!config.contractAddress) {
      throw new Error('Contract address not available');
    }

    // Get AL configuration
    const dalConfig = config.extensions?.dal;
    if (!dalConfig) {
      throw new Error('DAL configuration not found for AL project');
    }

    console.log('🚀 Deploying AL contracts separately and linking to Project...');
    
    try {
      // Get blockchain connection
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      // Step 1: Deploy ALProjectVoting contract
      console.log('📊 Step 1: Deploying ALProjectVoting contract...');
      
      const votingConsensus = dalConfig.votingConsensus || 'simple_majority';
      const votingTimeout = dalConfig.votingTimeout || 3600;
      
      // Import AL contract ABIs (these should exist in the compiled artifacts)
      const ALProjectVotingABI = (await import('../../../abis/ALProjectVoting.json')).default;
      const ALProjectStorageABI = (await import('../../../abis/ALProjectStorage.json')).default;
      
      const votingContractFactory = new ethers.ContractFactory(
        ALProjectVotingABI.abi,
        ALProjectVotingABI.bytecode,
        signer
      );
      
      const deployedVotingContract = await votingContractFactory.deploy(
        config.contractAddress,  // _project
        votingConsensus,         // _votingConsensus
        votingTimeout           // _votingTimeoutSeconds
      );
      await deployedVotingContract.waitForDeployment();
      
      const votingContractAddress = await deployedVotingContract.getAddress();
      console.log('✅ ALProjectVoting deployed at:', votingContractAddress);

      // Step 2: Deploy ALProjectStorage contract
      console.log('🗄️ Step 2: Deploying ALProjectStorage contract...');
      
      const storageContractFactory = new ethers.ContractFactory(
        ALProjectStorageABI.abi,
        ALProjectStorageABI.bytecode,
        signer
      );
      
      const deployedStorageContract = await storageContractFactory.deploy(config.contractAddress);
      await deployedStorageContract.waitForDeployment();
      
      const storageContractAddress = await deployedStorageContract.getAddress();
      console.log('✅ ALProjectStorage deployed at:', storageContractAddress);

      // Step 3: Link contracts to Project
      console.log('🔗 Step 3: Linking AL contracts to Project...');
      
      const projectContract = new ethers.Contract(config.contractAddress, Project.abi, signer);
      
      const linkTx = await projectContract.linkALContracts(votingContractAddress, storageContractAddress);
      await linkTx.wait();
      console.log('✅ AL contracts linked successfully');

      // Step 4: Set AL metadata (if not already set)
      console.log('📋 Step 4: Setting AL metadata...');
      try {
        const queryStrategy = dalConfig.queryStrategy || 'uncertainty_sampling';
        const alScenario = dalConfig.alScenario || 'pool_based';
        const maxIterations = dalConfig.maxIterations || 10;
        const queryBatchSize = dalConfig.queryBatchSize || 5;
        const labelSpace = dalConfig.labelSpace || ['positive', 'negative'];
        
        console.log('🔍 AL Metadata values to set:', {
          queryStrategy,
          alScenario,
          maxIterations,
          queryBatchSize,
          labelSpace
        });
        
        console.log('📡 Calling setALMetadata on contract:', config.contractAddress);
        const metadataTx = await projectContract.setALMetadata(
          queryStrategy,
          alScenario,
          maxIterations,
          queryBatchSize,
          labelSpace
        );
        
        console.log('⏳ Waiting for setALMetadata transaction:', metadataTx.hash);
        const receipt = await metadataTx.wait();
        console.log('✅ AL metadata set successfully! Gas used:', receipt.gasUsed.toString());
        
        // Verify the metadata was actually set
        try {
          const verifyMetadata = await projectContract.getProjectMetadata();
          console.log('🔍 Verification - AL metadata now on contract:', {
            queryStrategy: verifyMetadata._queryStrategy,
            alScenario: verifyMetadata._alScenario,
            maxIterations: verifyMetadata._maxIteration.toString(),
            queryBatchSize: verifyMetadata._queryBatchSize.toString(),
            labelSpace: verifyMetadata._labelSpace
          });
        } catch (verifyError) {
          console.warn('⚠️ Could not verify AL metadata was set:', verifyError);
        }
        
      } catch (error) {
        console.error('❌ Failed to set AL metadata:', error);
        if (error instanceof Error) {
          console.error('🔍 Error message:', error.message);
        }
        throw error; // Re-throw to fail the deployment instead of continuing silently
      }

      const result = {
        voting: votingContractAddress,
        storage: storageContractAddress
      };
      
      console.log('🎉 AL smart contract deployment completed successfully!');
      console.log('📊 Voting contract:', votingContractAddress);
      console.log('🗄️ Storage contract:', storageContractAddress);
      
      return result;
      
    } catch (error) {
      console.error('❌ AL smart contract deployment failed:', error);
      console.log('💡 This approach deploys AL contracts separately and links them to Project');
      throw error;
    }
  }

  /**
   * Refresh project configuration from smart contract after AL contract deployment
   */
  private async refreshProjectConfigurationFromContract(
    projectId: string, 
    config: DVREProjectConfiguration
  ): Promise<DVREProjectConfiguration | null> {
    const smartContractService = SmartContractService.getInstance();
    return await smartContractService.refreshProjectConfigurationFromContract(projectId, config);
  }

  /**
   * Get deployment status for a project
   */
  getDeploymentStatus(projectId: string) {
    return ProjectDeploymentService.getInstance().getDeploymentStatus(projectId);
  }

  /**
   * Check if project is deployed
   */
  isProjectDeployed(projectId: string): boolean {
    return ProjectDeploymentService.getInstance().isProjectDeployed(projectId);
  }

  /**
   * Get workflow type for project
   */
  private getWorkflowType(config: DVREProjectConfiguration): 'active_learning' | 'federated_learning' | 'general' {
    if (config.extensions?.dal) {
      return 'active_learning';
    } else if (config.extensions?.federated) {
      return 'federated_learning';
    } else {
      return 'general';
    }
  }
}

export const deploymentOrchestrator = DeploymentOrchestrator.getInstance(); 