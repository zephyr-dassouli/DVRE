/**
 * Deployment Orchestrator - Centralized deployment logic
 * Coordinates all aspects of project deployment to remove redundancy
 */

import { ethers } from 'ethers';
import { projectConfigurationService, DVREProjectConfiguration } from '../../../services/ProjectConfigurationService';
import { projectDeploymentService } from './ProjectDeploymentService';
import JSONProject from '../../../abis/JSONProject.json';

export interface DeploymentResult {
  success: boolean;
  roCrateHash?: string;
  workflowHash?: string;
  bundleHash?: string;
  orchestrationWorkflowId?: string;
  error?: string;
  steps: {
    alContracts: 'success' | 'failed' | 'skipped';
    ipfsUpload: 'success' | 'failed' | 'pending';
    orchestrationDeploy: 'success' | 'failed' | 'pending';
    smartContractUpdate: 'success' | 'failed' | 'pending';
  };
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
    userAddress: string
  ): Promise<DeploymentResult> {
    console.log('🚀 Starting centralized project deployment:', projectId);
    
    const result: DeploymentResult = {
      success: false,
      steps: {
        alContracts: 'skipped',
        ipfsUpload: 'pending',
        orchestrationDeploy: 'pending',
        smartContractUpdate: 'pending'
      }
    };

    try {
      // Get project configuration
      const config = projectConfigurationService.getProjectConfiguration(projectId);
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
          await this.deployALSmartContracts(config, userAddress);
          result.steps.alContracts = 'success';
        } catch (error) {
          console.error('AL contract deployment failed:', error);
          result.steps.alContracts = 'failed';
          // Continue with deployment - AL contracts are optional for now
        }
      }

      // Step 2: Upload to IPFS (separated from orchestration deployment)
      console.log('☁️ Uploading to IPFS...');
      try {
        const ipfsResult = await this.uploadToIPFS(projectId, userAddress);
        result.roCrateHash = ipfsResult.roCrateHash;
        result.workflowHash = ipfsResult.workflowHash;
        result.bundleHash = ipfsResult.bundleHash;
        result.steps.ipfsUpload = 'success';
      } catch (error) {
        console.error('IPFS upload failed:', error);
        result.steps.ipfsUpload = 'failed';
        throw new Error(`IPFS upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Step 3: Deploy to orchestration server
      console.log('🚀 Deploying to orchestration server...');
      try {
        const deploymentSuccess = await this.deployToOrchestration(projectId, userAddress);
        if (deploymentSuccess) {
          result.steps.orchestrationDeploy = 'success';
          // Get orchestration workflow ID
          const deploymentStatus = projectDeploymentService.getDeploymentStatus(projectId);
          result.orchestrationWorkflowId = deploymentStatus?.orchestrationWorkflowId;
        } else {
          result.steps.orchestrationDeploy = 'failed';
        }
      } catch (error) {
        console.error('Orchestration deployment failed:', error);
        result.steps.orchestrationDeploy = 'failed';
        // Continue - IPFS upload succeeded
      }

      // Step 4: Update smart contract with IPFS hashes
      console.log('💾 Updating smart contract with IPFS hashes...');
      try {
        await this.updateSmartContractIPFS(config, result, userAddress);
        result.steps.smartContractUpdate = 'success';
      } catch (error) {
        console.error('Smart contract update failed:', error);
        result.steps.smartContractUpdate = 'failed';
        // Continue - deployment still partially successful
      }

      // Determine overall success
      result.success = result.steps.ipfsUpload === 'success';
      
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
  ): Promise<void> {
    if (!config.contractAddress) {
      throw new Error('Contract address not available');
    }

    // Get signer
    if (!(window as any).ethereum) {
      throw new Error('MetaMask not found');
    }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    
    // Get main project contract
    const projectContract = new ethers.Contract(
      config.contractAddress,
      JSONProject.abi,
      signer
    );

    // Get AL configuration
    const dalConfig = config.extensions?.dal;
    if (!dalConfig) {
      throw new Error('DAL configuration not found for AL project');
    }

    console.log('📋 Updating AL metadata on main contract...');
    
    // Update AL metadata on main JSONProject contract
    try {
      await projectContract.setALMetadata(
        dalConfig.queryStrategy || 'uncertainty_sampling',
        dalConfig.AL_scenario || 'pool_based',
        dalConfig.max_iterations || 10,
        dalConfig.query_batch_size || 5,
        dalConfig.label_space || ['positive', 'negative']
      );
      console.log('✅ AL metadata updated on main contract');
    } catch (metadataError) {
      console.warn('⚠️ AL metadata update failed (contract may not support this):', metadataError);
    }

    // TODO: Deploy ALProjectVoting and ALProjectStorage contracts
    // This requires the contract ABIs and bytecode
    console.log('🗳️ AL contract deployment (simulated)');
    console.log('💾 AL storage contract deployment (simulated)');
    console.log('🔗 AL contract linking (simulated)');
  }

  /**
   * Upload to IPFS (delegation to ProjectConfigurationService)
   */
  private async uploadToIPFS(projectId: string, userAddress: string): Promise<{
    roCrateHash: string;
    workflowHash?: string;
    bundleHash: string;
  }> {
    // This delegates to the existing IPFS upload logic but without triggering deployment
    const result = await projectConfigurationService.publishToIPFS(projectId, userAddress);
    if (!result) {
      throw new Error('IPFS upload failed');
    }
    
    return {
      roCrateHash: result.roCrateHash,
      workflowHash: result.workflowHash,
      bundleHash: result.bundleHash
    };
  }

  /**
   * Deploy to orchestration server (delegation to ProjectDeploymentService)
   */
  private async deployToOrchestration(projectId: string, userAddress: string): Promise<boolean> {
    const config = projectConfigurationService.getProjectConfiguration(projectId);
    if (!config || !config.ipfs) {
      throw new Error('Project configuration or IPFS data not available');
    }

    // Generate RO-Crate data for deployment
    const roCrateData = JSON.parse(projectConfigurationService.generateROCrateJSON(config));
    
    const ipfsHashes = {
      roCrateHash: config.ipfs.roCrateHash!,
      workflowHash: config.ipfs.workflowHash,
      bundleHash: config.ipfs.bundleHash!
    };

    return await projectDeploymentService.deployProject(
      projectId,
      roCrateData,
      ipfsHashes,
      userAddress
    );
  }

  /**
   * Update smart contract with IPFS hashes
   */
  private async updateSmartContractIPFS(
    config: DVREProjectConfiguration,
    deploymentResult: DeploymentResult,
    userAddress: string
  ): Promise<void> {
    if (!config.contractAddress || !deploymentResult.roCrateHash) {
      throw new Error('Contract address or IPFS hashes not available');
    }

    // Get signer
    if (!(window as any).ethereum) {
      throw new Error('MetaMask not found');
    }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    
    const projectContract = new ethers.Contract(
      config.contractAddress,
      JSONProject.abi,
      signer
    );

    // Store RO-Crate IPFS hash
    const tx = await projectContract.updateIPFSHash('ro-crate', deploymentResult.roCrateHash);
    await tx.wait();
    
    // Store workflow hash if available
    if (deploymentResult.workflowHash) {
      const workflowTx = await projectContract.updateIPFSHash('workflow', deploymentResult.workflowHash);
      await workflowTx.wait();
    }

    // Store bundle hash
    if (deploymentResult.bundleHash) {
      const bundleTx = await projectContract.updateIPFSHash('bundle', deploymentResult.bundleHash);
      await bundleTx.wait();
    }

    console.log('✅ IPFS hashes stored on smart contract successfully!');
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
}

export const deploymentOrchestrator = DeploymentOrchestrator.getInstance(); 