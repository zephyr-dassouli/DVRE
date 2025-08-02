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
        validationErrors.push('At least one dataset is required');
      } else {
        // For AL projects, check that datasets are actually selected in the configuration
        const isALProject = this.isActivelearningProject(config);
        if (isALProject) {
          const dalConfig = config.extensions?.dal;
          
          if (!dalConfig?.trainingDataset) {
            validationErrors.push('Training dataset must be selected');
          }
          if (!dalConfig?.labelingDataset) {
            validationErrors.push('Labeling dataset must be selected');
          }
          
          console.log('🔍 Training dataset selected:', !!dalConfig?.trainingDataset);
          console.log('🔍 Labeling dataset selected:', !!dalConfig?.labelingDataset);
        } else {
          // For non-AL projects, validate that datasets have actual content (not just placeholders)
          for (const [key, dataset] of Object.entries(datasets as any)) {
            const datasetObj = dataset as any; // Type assertion for dataset object
            
            if (!datasetObj.url && !datasetObj.path && !datasetObj.contentUrl) {
              validationErrors.push(`Dataset "${datasetObj.name || key}" must have a valid file path or URL`);
            }
            
            // Check for placeholder values
            const placeholderKeywords = ['placeholder', 'example', 'sample', 'default', 'template'];
            const datasetText = JSON.stringify(datasetObj).toLowerCase();
            
            if (placeholderKeywords.some(keyword => datasetText.includes(keyword))) {
              validationErrors.push(`Dataset "${datasetObj.name || key}" contains placeholder values`);
            }
          }
        }
      }

      // Check if project is Active Learning
      const isALProject = this.isActivelearningProject(config);
      console.log('🔍 Is AL project:', isALProject);
      
      if (isALProject) {
        const labelSpace = config.extensions?.dal?.labelSpace;
        console.log('🔍 Label space:', labelSpace);
        
        if (!labelSpace || !Array.isArray(labelSpace) || labelSpace.length === 0) {
          console.log('❌ No label space found');
          validationErrors.push('Label space is required');
        } else {
          // Check for placeholder values in label space
          const hasPlaceholders = labelSpace.some(label => 
            typeof label === 'string' && 
            ['placeholder', 'example', 'sample', 'label', 'positive', 'negative'].includes(label.toLowerCase())
          );
          
          if (hasPlaceholders) {
            validationErrors.push('Label space contains placeholder values');
          }
        }
        
        // Check for other required AL fields
        const dalConfig = config.extensions?.dal;
        console.log('🔍 DAL config:', dalConfig);
        
        if (!dalConfig?.queryStrategy) {
          console.log('❌ No query strategy found');
          validationErrors.push('Query strategy is required');
        }
        if (dalConfig?.maxIterations == null || dalConfig.maxIterations < 0) {
          console.log('❌ Invalid max iterations:', dalConfig?.maxIterations);
          validationErrors.push('Max iterations must be 0 or greater (0 = infinite)');
        }
      }
      
      console.log('🔍 Validation errors:', validationErrors);
      
      // If validation fails, throw error to stop deployment
      if (validationErrors.length > 0) {
        const errorMessage = `Cannot deploy project. Please fix the following issues:\n\n${validationErrors.join('. ')}.`;
        console.log('❌ Validation failed:', errorMessage);
        throw new Error(errorMessage);
      }
      
      console.log('✅ Validation passed, proceeding with deployment');

      // Step 1: IPFS Upload (generate RO-Crate hash first)
      console.log('📦 Step 1: Publishing to IPFS...');
      const ipfsResult = await projectConfigurationService.publishToIPFS(projectId, userAddress);
      
      if (ipfsResult && ipfsResult.roCrateHash) {
        result.roCrateHash = ipfsResult.roCrateHash;
        result.steps.ipfsUpload = 'success';
        console.log('✅ IPFS upload successful');

        // Step 2: Deploy AL smart contracts if needed (now with RO-Crate hash available)
        if (isALProject) {
          console.log('📋 Step 2: Deploying AL smart contracts...');
          try {
            const alContractResult = await this.deployALSmartContracts(config, userAddress, result.roCrateHash);
            
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
            
            // Step 2.5: Refresh project configuration after contract updates
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

      // 2.4. Update smart contract with RO-Crate IPFS hash (for non-AL projects only)
      if (!isALProject) {
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
      } else {
        console.log('⏭️ Skipping separate RO-Crate hash update (already done in AL setup)');
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
            // Step 2.6: Get project contributors first for batched asset creation
            let contributors: string[] = [];
            if (config.contractAddress) {
              console.log('👥 Step 2.6: Getting project contributors for RO-Crate asset viewers...');
              try {
                // Import getAllParticipantsForProject function
                const { getAllParticipantsForProject } = await import('../../../hooks/useProjects');
                
                // Get all project participants
                const participantsData = await getAllParticipantsForProject(config.contractAddress);
                console.log('📋 Retrieved participants:', participantsData.participantAddresses.length, 'participants');
                
                // Filter for contributors (exclude owner who is already the asset owner)
                contributors = participantsData.participantAddresses.filter((address, index) => {
                  const role = participantsData.roles[index];
                  const isNotOwner = address.toLowerCase() !== userAddress.toLowerCase();
                  const isContributor = role === 'contributor' || role === 'coordinator';
                  return isNotOwner && isContributor;
                });
                
                console.log('👥 Found', contributors.length, 'contributors to add as viewers');
                console.log('📋 Contributors:', contributors);
              } catch (error) {
                console.warn('⚠️ Failed to get contributors, creating asset without viewers:', error);
                contributors = [];
              }
            }
            
            // Create asset with viewers in a single transaction
            const assetContractAddress = await assetService.createAsset(
              assetName,
              assetType,
              result.roCrateHash,
              contributors
            );
            
            result.assetContractAddress = assetContractAddress;
            result.steps.assetContractStorage = 'success';
            console.log('✅ RO-Crate stored in blockchain asset contract with viewers:', assetContractAddress);
            console.log(`📝 Asset details: Name="${assetName}", Type="${assetType}", Hash="${result.roCrateHash}"`);
            console.log(`👥 Added ${contributors.length} contributors as viewers in single transaction`);
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
   * Deploy AL smart contracts using ALProjectDeployer (single transaction)
   */
  private async deployALSmartContracts(
    config: DVREProjectConfiguration, 
    userAddress: string,
    roCrateHash?: string
  ): Promise<{ voting?: string; storage?: string; alProject?: string; metadataUpdateSuccess?: boolean }> {
    if (!config.contractAddress) {
      throw new Error('Contract address not available');
    }

    // Get AL configuration
    const dalConfig = config.extensions?.dal;
    if (!dalConfig) {
      throw new Error('DAL configuration not found for AL project');
    }

    console.log('🚀 Deploying AL contracts using ALProjectDeployer (single transaction)...');
    
    try {
      // Get blockchain connection
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      // Get ALProjectDeployer address from FactoryRegistry
      console.log('📋 Getting ALProjectDeployer address from FactoryRegistry...');
      const { getFactoryAddressFromRegistry } = await import('../../../utils/registryClient');
      const alProjectDeployerAddress = await getFactoryAddressFromRegistry('ALProjectDeployer');
      
      if (!alProjectDeployerAddress) {
        throw new Error('ALProjectDeployer not found in FactoryRegistry');
      }
      
      console.log('✅ ALProjectDeployer found at:', alProjectDeployerAddress);
      
      // Import ALProjectDeployer ABI
      const ALProjectDeployerABI = (await import('../../../abis/ALProjectDeployer.json')).default;
      
      // Create ALProjectDeployer contract instance
      const alProjectDeployerContract = new ethers.Contract(
        alProjectDeployerAddress,
        ALProjectDeployerABI.abi,
        signer
      );
      
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
      console.log('👥 Getting project contributors for RO-Crate asset viewers...');
      let contributors: string[] = [];
      try {
        const { getAllParticipantsForProject } = await import('../../../hooks/useProjects');
        const participantsData = await getAllParticipantsForProject(config.contractAddress);
        
        // Filter for contributors (exclude owner who will be asset owner)
        contributors = participantsData.participantAddresses.filter((address, index) => {
          const role = participantsData.roles[index];
          const isNotOwner = address.toLowerCase() !== userAddress.toLowerCase();
          const isContributor = role === 'contributor' || role === 'coordinator';
          return isNotOwner && isContributor;
        });
        
        console.log('👥 Found', contributors.length, 'contributors to add as viewers:', contributors);
      } catch (error) {
        console.warn('⚠️ Failed to get contributors, creating asset without viewers:', error);
        contributors = [];
      }
      
      // Generate nonce for CREATE2 deployment (use timestamp + random)
      const nonce = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
      
      console.log('🔍 AL deployment parameters:', {
        baseProject: config.contractAddress,
        alConfig,
        votingConfig,
        rocrateHash: roCrateHash || '',
        contributors: contributors.length,
        nonce
      });
      
      // Call ALProjectDeployer.deployAL() for single-transaction deployment
      console.log('📡 Calling ALProjectDeployer.deployAL()...');
      const deployTx = await alProjectDeployerContract.deployAL(
        config.contractAddress,  // baseProject
        alConfig,               // ALProjectConfig struct
        votingConfig,           // VotingConfig struct
        roCrateHash || '',      // rocrateHash
        contributors,           // contributors array
        nonce                   // nonce for CREATE2
      );
      
      console.log('⏳ Waiting for AL deployment transaction:', deployTx.hash);
      const receipt = await deployTx.wait();
      console.log('✅ AL deployment completed successfully! Gas used:', receipt.gasUsed.toString());
      
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
      
      const [baseProject, alProject, votingContract, storageContract, roCrateAsset] = parsedEvent.args;
      
      console.log('🎉 AL smart contract deployment completed successfully!');
      console.log('📊 ALProject:', alProject);
      console.log('🗳️ Voting contract:', votingContract);
      console.log('🗄️ Storage contract:', storageContract);
      console.log('📦 RO-Crate asset:', roCrateAsset);
      console.log('⚡ Reduced from 3+ transactions to 1 transaction using ALProjectDeployer!');
      
      // Verify the setup was successful by checking Project.getALExtension()
      try {
        const ProjectABI = (await import('../../../abis/Project.json')).default;
        const projectContract = new ethers.Contract(config.contractAddress, ProjectABI.abi, signer);
        const linkedALExtension = await projectContract.getALExtension();
        console.log('🔍 Verification - AL extension linked to Project:', linkedALExtension === alProject);
      } catch (verifyError) {
        console.warn('⚠️ Could not verify AL extension linking:', verifyError);
      }

      const result = {
        alProject: alProject,
        voting: votingContract,
        storage: storageContract,
        metadataUpdateSuccess: true // All setup succeeded in single transaction
      };
      
      return result;
      
    } catch (error) {
      console.error('❌ AL smart contract deployment failed:', error);
      console.log('💡 This approach uses ALProjectDeployer for single-transaction deployment');
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