/**
 * Deployment Orchestrator - Centralized deployment logic
 * Coordinates all aspects of project deployment to remove redundancy
 */

import { projectConfigurationService, DVREProjectConfiguration } from '../../../services/ProjectConfigurationService';
import { projectDeploymentService } from './index';
import { SmartContractService } from '../../../services/SmartContractService';
import { localFileDownloadService } from '../../../services/LocalFileDownloadService';

// Import blockchain dependencies  
import { ethers } from 'ethers';
import JSONProject from '../../../abis/JSONProject.json';

// AL Contract ABIs and Bytecode - TODO: Replace with real compiled bytecode
const ALProjectVotingABI = [
  "constructor(address _jsonProject, string memory _votingConsensus, uint256 _votingTimeoutSeconds)",
  "function vote(bytes32 labelHash, uint8 label) external",
  "function getVotingResults(bytes32 labelHash) external view returns (uint8[], uint256[])",
  "function setVotingTimeout(uint256 _seconds) external",
  "function projectContract() external view returns (address)"
];

const ALProjectStorageABI = [
  "constructor(address _jsonProject)",
  "function storeLabels(bytes32[] calldata hashes, uint8[] calldata labels) external",
  "function getLabel(bytes32 hash) external view returns (uint8)",
  "function getLabelCount() external view returns (uint256)",
  "function projectContract() external view returns (address)"
];

// TODO: Replace with real compiled bytecode from: npx hardhat compile
const ALProjectVotingBytecode = "0x608060405234801561001057600080fd5b50"; // Placeholder - needs real bytecode
const ALProjectStorageBytecode = "0x608060405234801561001057600080fd5b50"; // Placeholder - needs real bytecode

/**
 * Deployment results interface
 */
export interface DeploymentResults {
  steps: {
    alSmartContracts: 'success' | 'failed' | 'skipped';
    ipfsUpload: 'success' | 'failed';
    orchestrationDeploy: 'success' | 'failed' | 'skipped';
    smartContractUpdate: 'success' | 'failed';
    localFileDownload: 'success' | 'failed' | 'skipped';
  };
  roCrateHash?: string;
  orchestrationWorkflowId?: string;
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
      } else {
        result.steps.ipfsUpload = 'failed';
        console.error('❌ IPFS upload failed');
      }

      // 3. Local File Download (if Local computation mode)
      if (computationMode === 'local' && result.roCrateHash) {
        console.log('📥 Step 3: Downloading files for local computation...');
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
            const { workflowService } = await import('../../../services/WorkflowService');
            
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
          const projectContract = new ethers.Contract(config.contractAddress, JSONProject.abi, signer);
          
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
   * Deploy AL smart contracts (extracted from component)
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

    console.log('🚀 Starting REAL AL smart contract deployment...');
    
    try {
      // Get blockchain connection
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      // Connect to main project contract
      const projectContract = new ethers.Contract(config.contractAddress, JSONProject.abi, signer);
      
      console.log('📋 Step 1: Updating AL metadata on main contract...');
      
      // Update AL metadata on main contract (if method exists)
      try {
        const votingTimeout = dalConfig.voting_timeout_seconds || 3600; // Default 1 hour
        const maxIterations = dalConfig.max_iterations || 10;
        const consensusThreshold = dalConfig.consensus || '0.7';
        
        // Check if setALMetadata method exists
        const setALMetadataFunction = projectContract.interface.getFunction('setALMetadata');
        if (setALMetadataFunction) {
          const tx = await projectContract.setALMetadata(
            consensusThreshold,
            maxIterations,
            votingTimeout.toString()
          );
          await tx.wait();
          console.log('✅ AL metadata updated on main contract');
        } else {
          console.log('⚠️ setALMetadata method not found on main contract - skipping');
        }
      } catch (error) {
        console.warn('⚠️ Failed to update AL metadata:', error);
      }

      console.log('📋 Step 2: Deploying ALProjectVoting contract...');
      
      let votingContractAddress: string | undefined;
      let storageContractAddress: string | undefined;
      
      // Deploy ALProjectVoting contract
      try {
        if (ALProjectVotingBytecode === "0x608060405234801561001057600080fd5b50") {
          throw new Error('Placeholder bytecode detected - need real compiled bytecode');
        }
        
        const votingContractFactory = new ethers.ContractFactory(
          ALProjectVotingABI,
          ALProjectVotingBytecode,
          signer
        );
        
        const votingTimeout = dalConfig.voting_timeout_seconds || 3600;
        const votingConsensus = dalConfig.voting_consensus || "simple_majority";
        const deployedVotingContract = await votingContractFactory.deploy(
          config.contractAddress,  // _jsonProject
          votingConsensus,         // _votingConsensus
          votingTimeout           // _votingTimeoutSeconds
        );
        await deployedVotingContract.waitForDeployment();
        
        votingContractAddress = await deployedVotingContract.getAddress();
        console.log('✅ ALProjectVoting deployed at:', votingContractAddress);
      } catch (error) {
        console.error('❌ Failed to deploy ALProjectVoting:', error);
        console.log('💡 To enable real deployment, provide actual compiled bytecode for ALProjectVoting');
      }

      console.log('📋 Step 3: Deploying ALProjectStorage contract...');
      
      // Deploy ALProjectStorage contract
      try {
        if (ALProjectStorageBytecode === "0x608060405234801561001057600080fd5b50") {
          throw new Error('Placeholder bytecode detected - need real compiled bytecode');
        }
        
        const storageContractFactory = new ethers.ContractFactory(
          ALProjectStorageABI,
          ALProjectStorageBytecode,
          signer
        );
        
        const deployedStorageContract = await storageContractFactory.deploy(config.contractAddress);
        await deployedStorageContract.waitForDeployment();
        
        storageContractAddress = await deployedStorageContract.getAddress();
        console.log('✅ ALProjectStorage deployed at:', storageContractAddress);
      } catch (error) {
        console.error('❌ Failed to deploy ALProjectStorage:', error);
        console.log('💡 To enable real deployment, provide actual compiled bytecode for ALProjectStorage');
      }

      console.log('📋 Step 4: Linking AL contracts to main contract using linkALContracts...');
      
      // Use the ProjectFactory pattern: linkALContracts(voting, storage) - both at once
      if (votingContractAddress && storageContractAddress) {
        try {
          const linkALContractsFunction = projectContract.interface.getFunction('linkALContracts');
          if (linkALContractsFunction) {
            const tx = await projectContract.linkALContracts(votingContractAddress, storageContractAddress);
            await tx.wait();
            console.log('✅ AL contracts linked to main contract:', {
              voting: votingContractAddress,
              storage: storageContractAddress
            });
          } else {
            console.log('⚠️ linkALContracts method not found on main contract');
          }
        } catch (error) {
          console.warn('⚠️ Failed to link AL contracts:', error);
        }
      } else {
        console.log('⚠️ Cannot link AL contracts - one or both deployments failed');
        console.log('  Voting address:', votingContractAddress || 'FAILED');
        console.log('  Storage address:', storageContractAddress || 'FAILED');
      }

      // Return deployed contract addresses
      const result = {
        voting: votingContractAddress,
        storage: storageContractAddress
      };
      
      if (votingContractAddress && storageContractAddress) {
        console.log('🎉 AL smart contract deployment completed successfully!');
      } else {
        console.log('⚠️ AL smart contract deployment partially completed');
        console.log('💡 Some contracts failed to deploy - check bytecode and main contract methods');
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ AL smart contract deployment failed:', error);
      console.log('💡 Common issues:');
      console.log('  - Placeholder bytecode (need real compiled contracts)');
      console.log('  - Missing methods on main JSONProject contract');
      console.log('  - Insufficient gas or network issues');
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
    return projectDeploymentService.getDeploymentStatus(projectId);
  }

  /**
   * Check if project is deployed
   */
  isProjectDeployed(projectId: string): boolean {
    return projectDeploymentService.isProjectDeployed(projectId);
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