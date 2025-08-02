/**
 * Deployment Orchestrator - Coordinates deployment across all services
 */

import { projectConfigurationService, DVREProjectConfiguration } from './ProjectConfigurationService';
import { ProjectDeploymentService } from './ProjectDeploymentService';

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

      // Check if project is Active Learning
      const isALProject = this.isActivelearningProject(config);
      console.log('🔍 Project type detection:', {
        isALProject,
        projectType: config.projectData?.type,
        projectTypeAlt: config.projectData?.project_type,
        hasDALExtension: !!config.extensions?.dal,
        projectDataKeys: config.projectData ? Object.keys(config.projectData) : 'null',
        extensionsKeys: config.extensions ? Object.keys(config.extensions) : 'null',
        fullProjectData: config.projectData,
        fullExtensions: config.extensions
      });

      // 🔍 VALIDATION: Check for required fields before deployment
      console.log('🔍 DEPLOYMENT VALIDATION STARTING...');
      const validationErrors: string[] = [];
      
      // Check for datasets
      const datasets = config.roCrate?.datasets;
      if (!datasets || Object.keys(datasets).length === 0) {
        validationErrors.push('At least one dataset is required');
      } else if (isALProject) {
        // For AL projects, check that datasets are selected
        const dalConfig = config.extensions?.dal;
        if (!dalConfig?.trainingDataset) {
          validationErrors.push('Training dataset must be selected');
        }
        if (!dalConfig?.labelingDataset) {
          validationErrors.push('Labeling dataset must be selected');
        }
      }

      // For AL projects, validate AL-specific fields
      if (isALProject) {
        const dalConfig = config.extensions?.dal;
        const labelSpace = dalConfig?.labelSpace;
        
        if (!labelSpace || !Array.isArray(labelSpace) || labelSpace.length === 0) {
          validationErrors.push('Label space is required');
        }
        if (!dalConfig?.queryStrategy) {
          validationErrors.push('Query strategy is required');
        }
        if (dalConfig?.maxIterations == null || dalConfig.maxIterations < 0) {
          validationErrors.push('Max iterations must be 0 or greater (0 = infinite)');
        }
      }
      
      // If validation fails, throw error to stop deployment
      if (validationErrors.length > 0) {
        const errorMessage = `Cannot deploy project. Please fix the following issues:\n\n${validationErrors.join('. ')}.`;
        throw new Error(errorMessage);
      }
      
      console.log('✅ Validation passed, proceeding with deployment');

      // Step 1: IPFS Upload (generate RO-Crate hash first)
      console.log('📦 Step 1: Publishing to IPFS...');
      const ipfsResult = await projectConfigurationService.publishToIPFS(projectId, userAddress);
      
      if (!ipfsResult || !ipfsResult.roCrateHash) {
        throw new Error('IPFS upload failed - no RO-Crate hash returned');
      }

      result.roCrateHash = ipfsResult.roCrateHash;
      result.steps.ipfsUpload = 'success';
      console.log('✅ IPFS upload successful, RO-Crate hash:', result.roCrateHash);

      // Step 2: Deploy AL Smart Contracts using ALProjectDeployer (if AL project)
      if (isALProject) {
        console.log('📋 Step 2: Deploying AL contracts using ALProjectDeployer...');
        console.log('💡 ALProjectDeployer will handle: AL contracts + RO-Crate asset + linking + metadata');
        try {
          const alContractResult = await this.deployALContractsWithDeployer(config, userAddress, result.roCrateHash);
          
          if (alContractResult.success) {
            result.steps.alSmartContracts = 'success';
            result.alContractAddresses = {
              voting: alContractResult.votingContract!,
              storage: alContractResult.storageContract!
            };
            result.steps.smartContractUpdate = 'success';
            result.steps.assetContractStorage = 'success'; // ALProjectDeployer creates the asset
            console.log('✅ AL contracts deployed successfully:', result.alContractAddresses);
            console.log('✅ RO-Crate asset and linking handled by ALProjectDeployer');
          } else {
            throw new Error(alContractResult.error || 'AL contract deployment failed');
          }
        } catch (error) {
          console.error('❌ AL contract deployment failed:', error);
          throw new Error(`AL contract deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // Step 2.1: For non-AL projects, update RO-Crate hash and create asset manually
        console.log('📋 Step 2.1: Updating RO-Crate hash on Project contract...');
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();
          const projectContract = new ethers.Contract(config.contractAddress!, Project.abi, signer);
          
          const updateHashTx = await projectContract.updateROCrateHash(result.roCrateHash);
          await updateHashTx.wait();
          
          result.steps.smartContractUpdate = 'success';
          console.log('✅ RO-Crate hash updated on Project contract');
        } catch (error) {
          console.warn('⚠️ Failed to update RO-Crate hash on Project contract:', error);
          result.steps.smartContractUpdate = 'failed';
        }

        // Step 2.2: Create RO-Crate asset for non-AL projects
        console.log('📋 Step 2.2: Creating RO-Crate as blockchain asset...');
        try {
          const AssetService = (await import('../../../utils/AssetService')).AssetService;
          const assetService = new AssetService();
          
          // Get project contributors for asset viewers
          let contributors: string[] = [];
          if (config.contractAddress) {
            try {
              const { getAllParticipantsForProject } = await import('../../../hooks/useProjects');
              const participantsData = await getAllParticipantsForProject(config.contractAddress);
              
              contributors = participantsData.participantAddresses.filter((address, index) => {
                const role = participantsData.roles[index];
                const isNotOwner = address.toLowerCase() !== userAddress.toLowerCase();
                const isContributor = role === 'contributor' || role === 'coordinator';
                return isNotOwner && isContributor;
              });
            } catch (error) {
              console.warn('⚠️ Failed to get contributors:', error);
            }
          }
          
          const assetName = `ro-crate-${projectId}-initial`;
          const assetContractAddress = await assetService.createAsset(
            assetName,
            'ro-crate',
            result.roCrateHash,
            contributors
          );
          
          result.assetContractAddress = assetContractAddress;
          result.steps.assetContractStorage = 'success';
          console.log('✅ RO-Crate asset created:', assetContractAddress);
        } catch (error) {
          console.error('❌ Asset contract storage failed:', error);
          result.steps.assetContractStorage = 'failed';
          // Continue - asset storage is not critical
        }
      }

      // Step 3: Local RO-Crate Save (for local computation mode)
      if (computationMode === 'local') {
        console.log('💾 Step 3: Saving RO-Crate locally for AL-Engine...');
        try {
          const { localROCrateService } = await import('./LocalROCrateService');
          const { roCrateService } = await import('./ROCrateService');
          
          const roCrateData = roCrateService.generateROCrateJSON(config);
          const localSaveResult = await localROCrateService.saveROCrateLocally(
            projectId, 
            roCrateData, 
            config
          );
          
          if (localSaveResult.success) {
            result.steps.localROCrateSave = 'success';
            result.localROCratePath = localSaveResult.projectPath;
            console.log('✅ RO-Crate saved locally:', localSaveResult.projectPath);
          } else {
            result.steps.localROCrateSave = 'failed';
            console.warn('⚠️ Local RO-Crate save failed:', localSaveResult.error);
          }
        } catch (error) {
          result.steps.localROCrateSave = 'failed';
          console.warn('⚠️ Local RO-Crate save failed:', error);
        }
      } else {
        result.steps.localROCrateSave = 'skipped';
      }

      // Step 4: Orchestration Deployment (for remote mode)
      if (computationMode === 'remote') {
        console.log('🚀 Step 4: Deploying to orchestration server...');
        try {
          const { workflowService } = await import('./WorkflowService');
          
          const workflowConfig = {
            projectId,
            workflowType: this.getWorkflowType(config),
            orchestratorEndpoint: workflowService.getOrchestratorEndpoint(),
            configuration: {
              roCrateHash: result.roCrateHash,
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
        result.steps.orchestrationDeploy = 'skipped';
      }

      console.log('✅ Deployment completed successfully:', result);
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
   * Deploy AL smart contracts using ALProjectDeployer (single transaction)
   */
  private async deployALContractsWithDeployer(
    config: DVREProjectConfiguration, 
    userAddress: string,
    roCrateHash: string
  ): Promise<{ success: boolean; votingContract?: string; storageContract?: string; alProject?: string; error?: string }> {
    console.log('🚀 Starting AL deployment with ALProjectDeployer');

    try {
      // Get blockchain connection
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      // Get ALProjectDeployer address from FactoryRegistry
      const { getFactoryAddressFromRegistry } = await import('../../../utils/registryClient');
      const alProjectDeployerAddress = await getFactoryAddressFromRegistry('ALProjectDeployer');
      
      if (!alProjectDeployerAddress) {
        throw new Error('ALProjectDeployer not found in FactoryRegistry - ensure infrastructure is deployed');
      }
      
      console.log('✅ ALProjectDeployer found at:', alProjectDeployerAddress);
      
      // Import ALProjectDeployer ABI
      const ALProjectDeployerABI = (await import('../../../abis/ALProjectDeployer.json')).default;
      const ALProjectLinkerABI = (await import('../../../abis/ALProjectLinker.json')).default;
      
      // Create ALProjectDeployer contract instance
      const alProjectDeployerContract = new ethers.Contract(
        alProjectDeployerAddress,
        ALProjectDeployerABI.abi,
        signer
      );
      
      // Create ALProjectLinker interface for event parsing
      const alProjectLinkerInterface = new ethers.Interface(ALProjectLinkerABI.abi);
      
      // Get AL configuration
      const dalConfig = config.extensions?.dal;
      if (!dalConfig) {
        throw new Error('DAL configuration not found');
      }
      
      // Prepare AL configuration struct
      const alConfig = {
        queryStrategy: dalConfig.queryStrategy || 'uncertainty_sampling',
        alScenario: dalConfig.alScenario || 'pool_based',
        maxIteration: dalConfig.maxIterations || 10,
        queryBatchSize: dalConfig.queryBatchSize || 5,
        labelSpace: dalConfig.labelSpace || []
      };
      
      // Prepare voting configuration struct
      const votingConfig = {
        votingConsensus: dalConfig.votingConsensus || 'simple_majority',
        votingTimeout: dalConfig.votingTimeout || 3600
      };
      
      // Get project contributors for RO-Crate asset viewers
      let contributors: string[] = [];
      if (config.contractAddress) {
        try {
          const { getAllParticipantsForProject } = await import('../../../hooks/useProjects');
          const participantsData = await getAllParticipantsForProject(config.contractAddress);
          
          contributors = participantsData.participantAddresses.filter((address, index) => {
            const role = participantsData.roles[index];
            const isNotOwner = address.toLowerCase() !== userAddress.toLowerCase();
            const isContributor = role === 'contributor' || role === 'coordinator';
            return isNotOwner && isContributor;
          });
          
          console.log('👥 Found', contributors.length, 'contributors for asset viewers');
        } catch (error) {
          console.warn('⚠️ Failed to get contributors:', error);
        }
      }
      
      // Generate nonce for CREATE2 deployment
      const nonce = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
      
      // STEP 1: Pre-approve ALProjectDeployer as delegate
      console.log('🔑 Step 1: Approving ALProjectDeployer as delegate...');
      try {
        const ProjectABI = (await import('../../../abis/Project.json')).default;
        const baseProjectContract = new ethers.Contract(config.contractAddress!, ProjectABI.abi, signer);
        
        // Check if already approved
        const isAlreadyApproved = await baseProjectContract.isApprovedDelegate(alProjectDeployerAddress);
        
        if (!isAlreadyApproved) {
          console.log('📋 Approving ALProjectDeployer as delegate:', alProjectDeployerAddress);
          const approveTx = await baseProjectContract.approveDelegate(alProjectDeployerAddress);
          await approveTx.wait();
          console.log('✅ ALProjectDeployer approved as delegate');
        } else {
          console.log('✅ ALProjectDeployer already approved as delegate');
        }
      } catch (error) {
        console.error('❌ Failed to approve ALProjectDeployer as delegate:', error);
        throw new Error(`Failed to approve delegate: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // STEP 3: Call ALProjectDeployer.deployAL() for AL contracts deployment
      console.log('🚀 Step 3: Calling ALProjectDeployer.deployAL()...');
      
      console.log('🔍 Calling ALProjectDeployer.deployAL() with:', {
        originalCaller: userAddress,
        baseProject: config.contractAddress,
        alConfig,
        votingConfig,
        roCrateHash,
        contributors: contributors.length,
        nonce
      });
      
      // Call ALProjectDeployer.deployAL() with originalCaller for correct asset ownership
      const deployTx = await alProjectDeployerContract.deployAL(
        userAddress,            // originalCaller (becomes RO-Crate asset owner)
        config.contractAddress, // baseProject
        alConfig,               // ALProjectConfig struct
        votingConfig,           // VotingConfig struct
        roCrateHash,            // rocrateHash
        contributors,           // contributors array
        nonce                   // nonce for CREATE2
      );
      
      console.log('⏳ Waiting for AL deployment transaction:', deployTx.hash);
      const receipt = await deployTx.wait();
      console.log('✅ AL deployment transaction completed! Gas used:', receipt.gasUsed.toString());
      
      // Parse and log all debugging events from the transaction
      console.log('🔍 Parsing deployment events for debugging...');
      for (const log of receipt.logs) {
        try {
          // Try parsing as ALProjectDeployer event
          const deployerParsed = alProjectDeployerContract.interface.parseLog(log);
          if (deployerParsed) {
            console.log(`📋 ALProjectDeployer Event: ${deployerParsed.name}`, deployerParsed.args);
            continue;
          }
        } catch {
          // Not an ALProjectDeployer event
        }
        
        try {
          // Try parsing as ALProjectLinker event
          const linkerParsed = alProjectLinkerInterface.parseLog(log);
          if (linkerParsed) {
            console.log(`🔗 ALProjectLinker Event: ${linkerParsed.name}`, linkerParsed.args);
            continue;
          }
        } catch {
          // Not an ALProjectLinker event
        }
        
        // For other contracts, just log the basic info
        if (log.topics.length > 0) {
          console.log(`📝 Other Event: ${log.address} - Topic: ${log.topics[0]}`);
        }
      }
      
      // Parse deployment results from transaction receipt
      const deployedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = alProjectDeployerContract.interface.parseLog(log);
          return parsed?.name === 'ALProjectDeployed';
        } catch {
          return false;
        }
      });
      
      if (!deployedEvent) {
        throw new Error('ALProjectDeployed event not found in transaction receipt');
      }
      
      const parsedEvent = alProjectDeployerContract.interface.parseLog(deployedEvent);
      if (!parsedEvent) {
        throw new Error('Failed to parse ALProjectDeployed event');
      }
      
      const [, alProject, votingContract, storageContract, roCrateAsset] = parsedEvent.args;
      
      console.log('🎉 AL smart contracts deployed successfully:');
      console.log('📊 ALProject:', alProject);
      console.log('🗳️ Voting contract:', votingContract);
      console.log('🗄️ Storage contract:', storageContract);
      console.log('📦 RO-Crate asset:', roCrateAsset, '(owned by user)');
      
      // Verify the AL extension was linked
      try {
        const ProjectABI = (await import('../../../abis/Project.json')).default;
        const projectContract = new ethers.Contract(config.contractAddress!, ProjectABI.abi, signer);
        const linkedALExtension = await projectContract.getALExtension();
        console.log('🔍 Verification - AL extension linked:', linkedALExtension === alProject);
      } catch (verifyError) {
        console.warn('⚠️ Could not verify AL extension linking:', verifyError);
      }

      return {
        success: true,
        alProject: alProject,
        votingContract: votingContract,
        storageContract: storageContract
      };
      
    } catch (error) {
      console.error('❌ AL contract deployment failed:', error);
      
      // If it's a transaction revert, try to get more details
      if (error instanceof Error) {
        console.error('📋 Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack?.substring(0, 500) + '...' // Truncate stack trace
        });
        
        // Check if this is a MetaMask/RPC error with more context
        if ('data' in error && error.data) {
          console.error('📋 Transaction error data:', error.data);
        }
        
        // Check if this is a contract revert
        if (error.message.includes('revert') || error.message.includes('execution reverted')) {
          console.error('🚨 Contract execution reverted - check the events above for the exact failure point');
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error'
      };
    }
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