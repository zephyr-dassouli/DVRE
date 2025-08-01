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
import { AssetService } from '../../../utils/AssetService';

/**
 * Deployment results interface
 */
export interface DeploymentResults {
  steps: {
    alSmartContracts: 'success' | 'failed' | 'skipped';
    ipfsUpload: 'success' | 'failed';
    assetContractStorage: 'success' | 'failed' | 'skipped';
    localROCrateSave: 'success' | 'failed' | 'skipped';
    orchestrationDeploy: 'success' | 'failed' | 'skipped';
    smartContractUpdate: 'success' | 'failed' | 'skipped';
    localFileDownload: 'success' | 'failed' | 'skipped';
  };
  roCrateHash?: string;
  assetContractAddress?: string;
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
        assetContractStorage: 'skipped',
        localROCrateSave: 'skipped',
        orchestrationDeploy: 'failed',
        smartContractUpdate: 'skipped',
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

      // 🔍 VALIDATION: Check for required fields before deployment (STRICT - No defaults anymore!)
      console.log('🔍 DEPLOYMENT VALIDATION STARTING...');
      console.log('🔍 Project config:', config);
      console.log('🔍 RO-Crate datasets:', config.roCrate?.datasets);
      
      const validationErrors: string[] = [];
      
      // Check for datasets (STRICT - no tolerance for empty)
      const datasets = config.roCrate?.datasets;
      console.log('🔍 Datasets object:', datasets);
      console.log('🔍 Datasets keys:', datasets ? Object.keys(datasets) : 'undefined');
      
      if (!datasets || Object.keys(datasets).length === 0) {
        console.log('❌ No datasets found');
        validationErrors.push('• At least one dataset is required');
      }

      // Check if project is Active Learning
      const isALProject = this.isActivelearningProject(config);
      console.log('🔍 Is AL project:', isALProject);
      
      if (isALProject) {
        const labelSpace = config.extensions?.dal?.labelSpace;
        console.log('🔍 Label space:', labelSpace);
        
        if (!labelSpace || !Array.isArray(labelSpace) || labelSpace.length === 0) {
          console.log('❌ No label space found');
          validationErrors.push('• Label space is required for Active Learning projects');
        }
        
        // Check for other required AL fields
        const dalConfig = config.extensions?.dal;
        console.log('🔍 DAL config:', dalConfig);
        
        if (!dalConfig?.queryStrategy) {
          console.log('❌ No query strategy found');
          validationErrors.push('• Query strategy is required for Active Learning projects');
        }
        if (!dalConfig?.maxIterations || dalConfig.maxIterations <= 0) {
          console.log('❌ Invalid max iterations:', dalConfig?.maxIterations);
          validationErrors.push('• Max iterations must be greater than 0 for Active Learning projects');
        }
      }
      
      console.log('🔍 Validation errors:', validationErrors);
      
      // If validation fails, throw error to stop deployment
      if (validationErrors.length > 0) {
        const errorMessage = `Cannot deploy project. Please fix the following issues:\n\n${validationErrors.join('\n')}\n\nPlease configure these fields in the Project Configuration section.`;
        console.log('❌ Validation failed:', errorMessage);
        throw new Error(errorMessage);
      }
      
      console.log('✅ Validation passed, proceeding with deployment');

      // Step 1: Deploy AL smart contracts if needed
      if (isALProject) {
        console.log('📋 Deploying AL smart contracts...');
        try {
          const alContractResult = await this.deployALSmartContracts(config, userAddress);
          
          // Only set contract addresses if they were actually deployed
          if (alContractResult.voting && alContractResult.storage) {
            result.steps.alSmartContracts = 'success';
            result.alContractAddresses = {
              voting: alContractResult.voting,
              storage: alContractResult.storage
            };
          } else {
            result.steps.alSmartContracts = 'skipped'; // No contracts were deployed
          }
          
          // Track AL metadata update success
          if (alContractResult.metadataUpdateSuccess) {
            result.steps.smartContractUpdate = 'success';
            console.log('✅ AL metadata successfully updated on smart contract');
          } else {
            result.steps.smartContractUpdate = 'failed';
            console.log('❌ AL metadata update failed');
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
          result.steps.smartContractUpdate = 'failed';
          // Continue with deployment - AL contracts are optional for now
        }
      } else {
        // Non-AL projects don't need metadata updates
        result.steps.smartContractUpdate = 'skipped';
      }

      // 2. IPFS Upload
      console.log('📦 Step 2: Publishing to IPFS...');
      const ipfsResult = await projectConfigurationService.publishToIPFS(projectId, userAddress);
      
      if (ipfsResult && ipfsResult.roCrateHash) {
        result.roCrateHash = ipfsResult.roCrateHash;
        result.steps.ipfsUpload = 'success';
        console.log('✅ IPFS upload successful');

        // 2.4. Update smart contract with RO-Crate IPFS hash (final hash update)
        console.log('📋 Step 2.4: Updating smart contract with RO-Crate IPFS hash...');
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();
          const projectContract = new ethers.Contract(config.contractAddress!, Project.abi, signer);
          
          console.log('📡 Calling updateROCrateHash on contract:', config.contractAddress);
          const updateHashTx = await projectContract.updateROCrateHash(result.roCrateHash);
          
          console.log('⏳ Waiting for updateROCrateHash transaction:', updateHashTx.hash);
          const updateHashReceipt = await updateHashTx.wait();
          console.log('✅ RO-Crate hash updated successfully! Gas used:', updateHashReceipt.gasUsed.toString());
          
          // Verify the hash was actually set
          try {
            const verifyMetadata = await projectContract.getProjectMetadata();
            console.log('🔍 Verification - RO-Crate hash now on contract:', verifyMetadata._rocrateHash);
          } catch (verifyError) {
            console.warn('⚠️ Could not verify RO-Crate hash was updated:', verifyError);
          }
          
        } catch (error) {
          console.warn('⚠️ Failed to update RO-Crate hash on smart contract (continuing anyway):', error);
          // Don't fail deployment if this step fails - it's not critical
        }

        // 2.5. Asset Contract Storage (for RO-Crate as a blockchain asset)
        console.log('📋 Step 2.5: Storing RO-Crate in blockchain asset contract...');
        try {
          // Use the working AssetService but ensure wallet is connected first
          console.log('🔗 Using working AssetService (same as IPFS component)...');
          
          // Get blockchain connection to ensure wallet is ready
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();
          const signerAddress = await signer.getAddress();
          console.log('✅ Wallet connection established:', signerAddress);
          
          // Create AssetService instance (it will use its own initialization)
          const assetService = new AssetService();
          
          // Wait a moment for AssetService to initialize its provider
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          console.log('🔧 AssetService initialized, checking configuration...');
          
          // Create asset name in the format: ro-crate-<project-address>-initial
          const assetName = `ro-crate-${projectId}-initial`;
          const assetType = 'ro-crate';
          
          console.log(`🔗 Creating blockchain asset: "${assetName}" with IPFS hash: ${result.roCrateHash}`);
          console.log('📋 Function parameters:', {
            name: assetName,
            type: assetType,
            ipfsHash: result.roCrateHash,
            nameLength: assetName.length,
            typeLength: assetType.length,
            hashLength: result.roCrateHash?.length || 0
          });
          
          // Create the asset using the working AssetService
          if (result.roCrateHash) {
            const assetContractAddress = await assetService.createAsset(assetName, assetType, result.roCrateHash);
            
            result.assetContractAddress = assetContractAddress;
            result.steps.assetContractStorage = 'success';
            console.log('✅ RO-Crate stored in blockchain asset contract:', assetContractAddress);
            console.log(`📝 Asset details: Name="${assetName}", Type="${assetType}", Hash="${result.roCrateHash}"`);
          }
          
        } catch (error: any) {
          console.error('❌ Failed to store RO-Crate in blockchain asset contract:', error);
          console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
          console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          result.steps.assetContractStorage = 'failed';
          // Continue deployment - asset storage is optional but beneficial
        }

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
  ): Promise<{ voting?: string; storage?: string; metadataUpdateSuccess?: boolean }> {
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
        const labelSpace = dalConfig.labelSpace || []; // Remove default ['positive', 'negative']
        
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
        // Return with failed metadata update but successful contract deployment
        return {
          voting: votingContractAddress,
          storage: storageContractAddress,
          metadataUpdateSuccess: false
        };
      }

      const result = {
        voting: votingContractAddress,
        storage: storageContractAddress,
        metadataUpdateSuccess: true // Indicate success for the orchestrator
      };
      
      console.log('🎉 AL smart contract deployment completed successfully!');
      console.log('📊 Voting contract:', votingContractAddress);
      console.log('🗄️ Storage contract:', storageContractAddress);
      
      return result;
      
    } catch (error) {
      console.error('❌ AL smart contract deployment failed:', error);
      console.log('💡 This approach deploys AL contracts separately and links them to Project');
      return {
        metadataUpdateSuccess: false
      };
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