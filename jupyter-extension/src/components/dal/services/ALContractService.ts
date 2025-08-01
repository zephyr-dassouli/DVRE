/**
 * Refactored AL Contract Service - Using modular services while preserving all functionality
 * This orchestrates interactions between smart contracts, AL-Engine, and UI components
 */

import { ethers } from 'ethers';
import { RPC_URL } from '../../../config/contracts';
import Project from '../../../abis/Project.json';
import ALProjectVoting from '../../../abis/ALProjectVoting.json';

// Import our modular services
import { VotingService, ActiveVoting } from './VotingService';
import { ALEngineService, ModelUpdate } from './ALEngineService';
import { offChainContractService } from './OffChainContractService';
import { VotingRecord, UserContribution } from '../types';

export { VotingRecord, UserContribution, ActiveVoting, ModelUpdate };

export class ALContractService {
  private static instance: ALContractService;
  private provider: ethers.JsonRpcProvider;
  
  // Modular services
  private votingService: VotingService;
  private alEngineService: ALEngineService;

  private constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.votingService = new VotingService();
    this.alEngineService = new ALEngineService();
  }

  static getInstance(): ALContractService {
    if (!ALContractService.instance) {
      ALContractService.instance = new ALContractService();
    }
    return ALContractService.instance;
  }

  // =====================================================================
  // AL-ENGINE SAMPLE MANAGEMENT (delegated to ALEngineService)
  // =====================================================================

  storeALSamplesForLabeling(projectAddress: string, sampleIds: string[], queriedSamples: any[]): void {
    this.alEngineService.storeALSamplesForLabeling(projectAddress, sampleIds, queriedSamples);
  }

  clearStoredALSamples(projectAddress: string): void {
    this.alEngineService.clearStoredALSamples(projectAddress);
  }

  getStoredALSamples(projectAddress: string): any[] | null {
    return this.alEngineService.getStoredALSamples(projectAddress);
  }

  public getSampleDataById(sampleId: string): any | null {
    return this.alEngineService.getSampleDataById(sampleId);
  }

  // =====================================================================
  // VOTING OPERATIONS (delegated to VotingService)
  // =====================================================================

  async getVotingHistory(projectAddress: string): Promise<VotingRecord[]> {
    return this.votingService.getVotingHistory(projectAddress);
  }

  async getUserContributions(projectAddress: string): Promise<UserContribution[]> {
    return this.votingService.getUserContributions(projectAddress);
  }

  async submitBatchVote(projectAddress: string, sampleIds: string[], labels: string[], userAddress: string): Promise<boolean> {
    return this.votingService.submitBatchVote(projectAddress, sampleIds, labels, userAddress);
  }

  async getVotingSessionStatus(projectAddress: string, sampleId: string) {
    return this.votingService.getVotingSessionStatus(projectAddress, sampleId);
  }

  async getVoterInformation(projectAddress: string) {
    return this.votingService.getVoterInformation(projectAddress);
  }

  // =====================================================================
  // AL-ENGINE OPERATIONS (delegated to ALEngineService)
  // =====================================================================

  async getModelUpdates(projectAddress: string): Promise<ModelUpdate[]> {
      const votingHistory = await this.getVotingHistory(projectAddress);
    return this.alEngineService.getModelUpdates(projectAddress, votingHistory);
  }

  async triggerPythonALEngine(projectId: string, iteration: number, alConfig: any) {
    return this.alEngineService.triggerPythonALEngine(projectId, iteration, alConfig);
  }

  // =====================================================================
  // PROJECT STATUS & SMART CONTRACT OPERATIONS
  // =====================================================================

  async getActiveVoting(projectAddress: string): Promise<ActiveVoting | null> {
    try {
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        return null;
      }

      // Use off-chain implementation instead of removed contract function
      const activeBatch = await this.getActiveBatch(projectAddress);
      if (!activeBatch || activeBatch.sampleIds.length === 0) {
        return null;
      }

      // For batch voting, return the first active sample as representative
      const sampleId = activeBatch.sampleIds[0];
      const sampleData = this.getSampleDataById(sampleId) || { sampleId, data: 'Sample data' };
        
        return {
        sampleId,
        sampleData,
        labelOptions: activeBatch.labelOptions,
          currentVotes: {},
        timeRemaining: Number(activeBatch.timeRemaining),
          voters: []
        };
    } catch (error) {
      console.error('Error getting active voting:', error);
        return null;
    }
  }

  async getProjectStatus(projectAddress: string): Promise<{
    currentIteration: number;
    maxIterations: number;
    isActive: boolean;
    activeVoting: ActiveVoting | null;
  }> {
    try {
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      
      const currentRound = await projectContract.currentRound();
      const metadata = await projectContract.getProjectMetadata();
      const activeVoting = await this.getActiveVoting(projectAddress);

      let isActive = true;
        try {
          isActive = await projectContract.isActive();
        } catch (activeError) {
          console.log('📝 isActive method not available, assuming project is active');
      }

      return {
        currentIteration: Number(currentRound),
        maxIterations: Number(metadata._maxIteration) || 10,
        isActive,
        activeVoting
      };
    } catch (error) {
      console.error('Error getting project status:', error);
      return {
        currentIteration: 0,
        maxIterations: 10,
        isActive: false,
        activeVoting: null
      };
    }
  }

  async startNextIteration(projectAddress: string, userAddress: string): Promise<boolean> {
    try {
      console.log(`🚀 Starting next AL iteration for project ${projectAddress}`);
      
      // Get project metadata for AL configuration
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      const metadata = await projectContract.getProjectMetadata();
      const currentRound = await projectContract.currentRound();
      const iterationNumber = Number(currentRound) + 1;

      console.log(`🔬 Current round: ${currentRound}, starting iteration: ${iterationNumber}`);

      // Trigger AL-Engine with sample generation
      const alResult = await this.triggerALEngineWithSampleGeneration(
        projectAddress, 
        iterationNumber, 
        metadata
      );

      if (!alResult.success) {
        console.error('❌ AL-Engine execution failed:', alResult.error);
        return false;
      }

      console.log('✅ AL iteration started successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to start next iteration:', error);
      return false;
    }
  }

  private async triggerALEngineWithSampleGeneration(
    projectAddress: string, 
    iterationNumber: number, 
    metadata: any
  ): Promise<{success: boolean, sampleIds?: string[], queriedSamples?: any[], error?: string}> {
    try {
      // Trigger Python AL-Engine
      const alConfig = {
        n_queries: Number(metadata._queryBatchSize) || 2,
        query_strategy: metadata._queryStrategy || 'uncertainty_sampling',  
        label_space: metadata._labelSpace || []
      };

      const pythonResult = await this.triggerPythonALEngine(projectAddress, iterationNumber, alConfig);
      
      if (!pythonResult.success) {
        console.error('❌ Python AL-Engine failed:', pythonResult.error);
        return { success: false, error: pythonResult.error };
      }

      console.log('✅ Python AL-Engine completed successfully');

      // Read actual samples from generated file
      const realSamples = await this.alEngineService.readQuerySamplesFromFile(projectAddress, iterationNumber);
      
      if (realSamples.length === 0) {
        return { success: false, error: 'No samples generated by AL-Engine' };
      }

      // Generate sample IDs
      const timestamp = Date.now();
      const sampleIds = realSamples.map((_: any, index: number) => 
        `sample_${iterationNumber}_${index + 1}_${timestamp}`
      );

      console.log(`📊 Generated ${sampleIds.length} samples for iteration ${iterationNumber}`);

      // NEW: Upload each sample individually to IPFS
      console.log('📤 Uploading individual samples to IPFS...');
      const sampleDataHashes: string[] = [];
      
      try {
        const { IPFSService } = await import('../../deployment/services/IPFSService');
        const ipfsService = IPFSService.getInstance();
        
        // Upload each sample individually
        for (let i = 0; i < realSamples.length; i++) {
          const sampleId = sampleIds[i];
          const sampleData = realSamples[i];
          
          console.log(`📤 Uploading sample ${i + 1}/${realSamples.length}: ${sampleId}`);
          
          // Create individual sample JSON
          const sampleContent = JSON.stringify({
            sampleId,
            projectAddress,
            iterationNumber,
            timestamp,
            index: i,
            data: sampleData
          }, null, 2);
          
          // Upload individual sample to IPFS
          const ipfsResult = await ipfsService.uploadFile({
            name: `sample_${sampleId}.json`,
            content: sampleContent,
            type: 'application/json'
          });
          
          sampleDataHashes.push(ipfsResult.hash);
          console.log(`✅ Sample ${sampleId} uploaded to IPFS: ${ipfsResult.hash}`);
        }
        
        console.log(`✅ All ${sampleDataHashes.length} samples uploaded to IPFS individually`);
        
      } catch (ipfsError) {
        console.warn('⚠️ Failed to upload samples to IPFS:', ipfsError);
        console.log('🔄 Continuing with local storage fallback...');
        // Fill with empty hashes as fallback
        for (let i = 0; i < realSamples.length; i++) {
          sampleDataHashes.push('');
        }
      }

      // Store samples for labeling (fallback for immediate coordinator access)
      this.storeALSamplesForLabeling(projectAddress, sampleIds, realSamples);

      // Setup event listeners and start batch voting
      this.setupProjectEventListeners(projectAddress, iterationNumber, sampleIds);

      // Start batch voting in smart contract with individual IPFS hashes
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);
      
      console.log(`🗳️ Starting batch voting with ${sampleDataHashes.length} individual IPFS hashes`);
      console.log('📋 Sample hashes:', sampleDataHashes);
      const tx = await projectContract.startBatchVoting(sampleIds, sampleDataHashes);
      await tx.wait();

      console.log('✅ Batch voting started on blockchain with individual sample IPFS data');

      return { 
        success: true, 
        sampleIds, 
        queriedSamples: realSamples 
      };
    } catch (error) {
      console.error('❌ Error in AL-Engine sample generation:', error);
      return { success: false, error: String(error) };
    }
  }

  private setupProjectEventListeners(projectAddress: string, round: number, sampleIds: string[]): void {
    try {
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);

      const votingSessionEndedFilter = projectContract.filters.VotingSessionEnded();
      const batchCompletedFilter = projectContract.filters.ALBatchCompleted();

      console.log(`🎧 Setting up event listeners for project ${projectAddress}, round ${round}`);

      // Listen for individual voting session completions
      projectContract.on(votingSessionEndedFilter, (sampleId, finalLabel, currentRound, timestamp) => {
        if (Number(currentRound) === round) {
          console.log(`✅ Project: Voting session ended for sample ${sampleId} with label ${finalLabel}`);
          
          // Trigger custom event for UI updates
          const event = new CustomEvent('dal-sample-completed', {
            detail: { projectAddress, sampleId, finalLabel, round: Number(currentRound) }
          });
          window.dispatchEvent(event);
        }
      });

      // Listen for complete batch completion
      projectContract.on(batchCompletedFilter, (completedRound, completedSamples, timestamp) => {
        if (Number(completedRound) === round) {
          console.log(`🎉 Project: Batch ${completedRound} completed with ${completedSamples} samples`);
          
          // Trigger custom event for UI updates
          const event = new CustomEvent('dal-iteration-completed', {
            detail: { projectAddress, round: Number(completedRound), completedSamples: Number(completedSamples) }
          });
          window.dispatchEvent(event);
        }
      });

      // Listen for project end triggers (NEW) - with error handling
      try {
        const projectEndTriggeredFilter = projectContract.filters.ProjectEndTriggered();
        projectContract.on(projectEndTriggeredFilter, (trigger, reason, currentRound, timestamp, event) => {
          console.log(`🚨 Project end triggered by ${trigger}: ${reason} (Round ${currentRound})`);
          console.log('🔍 Event details:', { trigger, reason, currentRound: Number(currentRound), timestamp: Number(timestamp) });
          
          // Trigger custom event for UI updates
          const customEvent = new CustomEvent('dal-project-end-triggered', {
            detail: { 
              projectAddress,
              trigger: String(trigger),
              reason: String(reason),
              currentRound: Number(currentRound),
              timestamp: Number(timestamp)
            }
          });
          window.dispatchEvent(customEvent);
        });
        console.log('✅ ProjectEndTriggered event listener set up successfully');
      } catch (projectEndError) {
        console.warn('⚠️ ProjectEndTriggered event not available in contract ABI, skipping listener setup:', projectEndError);
      }

    } catch (error) {
      console.error('❌ Error setting up event listeners:', error);
    }
  }

  async endProject(projectAddress: string, userAddress: string): Promise<boolean> {
    try {
      console.log(`🏁 Ending project ${projectAddress}`);
      
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);
      
      const tx = await projectContract.deactivateProject();
      await tx.wait();
      
      console.log('✅ Project ended successfully');
      await this.notifyProjectEnd(projectAddress);
      return true;
    } catch (error) {
      console.error('❌ Failed to end project:', error);
      return false;
    }
  }

  private async notifyProjectEnd(projectAddress: string): Promise<void> {
    // Clear stored samples
    this.clearStoredALSamples(projectAddress);
    
    // Trigger custom event for UI cleanup
    const event = new CustomEvent('dal-project-ended', {
      detail: { projectAddress }
    });
    window.dispatchEvent(event);
  }

  // =====================================================================
  // ENHANCED PROJECT STATUS (preserving original comprehensive method)
  // =====================================================================

  async getActiveBatch(projectAddress: string): Promise<{
    sampleIds: string[];
    sampleData: any[];
    labelOptions: string[];
    timeRemaining: number;
    round: number;
    batchSize: number;
  } | null> {
    try {
      // Use the off-chain contract service to get the active batch
      const activeBatch = await offChainContractService.getActiveBatch(projectAddress);
      
      if (!activeBatch || activeBatch.activeSampleIds.length === 0) {
        console.log('📝 No active batch found');
        return null;
      }

      console.log(`📊 Active batch found with ${activeBatch.activeSampleIds.length} samples`);
      console.log('📋 Raw sample data from contract:', activeBatch.sampleData);

      // Process sample data from the smart contract
      const sampleData: any[] = [];
      
      for (let i = 0; i < activeBatch.activeSampleIds.length; i++) {
        const sampleId = activeBatch.activeSampleIds[i];
        const ipfsHashOrData = activeBatch.sampleData[i];
        
        // Check if this is an IPFS hash (starts with 'Qm' typically) or placeholder text
        if (ipfsHashOrData && !ipfsHashOrData.startsWith('Sample data for ')) {
          console.log(`📥 Fetching sample data from IPFS: ${sampleId} -> ${ipfsHashOrData}`);
          
          try {
            // Fetch the individual sample data from IPFS using private network
            const { config } = await import('../../../config');
            const ipfsUrl = `${config.ipfs.publicUrl}/${ipfsHashOrData}`;
            console.log(`📥 Fetching from private IPFS: ${ipfsUrl}`);
            
            const response = await fetch(ipfsUrl);
            if (response.ok) {
              const ipfsData = await response.json();
              
              // Extract the actual sample data from the IPFS structure
              if (ipfsData.data) {
                sampleData.push(ipfsData.data);
                console.log(`✅ Loaded sample data from IPFS for ${sampleId}`);
              } else {
                sampleData.push({ sampleId, data: 'Sample failed to load from IPFS' });
              }
            } else {
              console.warn(`⚠️ Failed to fetch sample ${sampleId} from IPFS: ${response.status}`);
              sampleData.push({ sampleId, data: 'Sample failed to load from IPFS' });
            }
          } catch (ipfsError) {
            console.warn(`⚠️ Failed to fetch sample ${sampleId} from IPFS:`, ipfsError);
            sampleData.push({ sampleId, data: 'Sample failed to load from IPFS' });
          }
        } else {
          // This is placeholder text from the contract
          console.log(`📝 Using placeholder data for ${sampleId}: ${ipfsHashOrData}`);
          sampleData.push({ sampleId, data: ipfsHashOrData });
        }
      }

      // Adapt interface to match expected format
      return {
        sampleIds: activeBatch.activeSampleIds,
        sampleData: sampleData,
        labelOptions: activeBatch.labelOptions,
        timeRemaining: activeBatch.timeRemaining,
        round: activeBatch.round,
        batchSize: activeBatch.activeSampleIds.length
      };
    } catch (error) {
      console.error('Could not fetch active batch:', error);
      return null;
    }
  }

  async getEnhancedProjectStatus(projectAddress: string): Promise<{
    // Basic project info
    isActive: boolean;
    currentIteration: number;
    maxIterations: number;
    
    // AL Configuration
    queryStrategy: string;
    alScenario: string;
    queryBatchSize: number;
    votingTimeout: number;
    labelSpace: string[];
    
    // Current batch info from Project contract
    currentBatch: {
      round: number;
      totalSamples: number;
      activeSamples: number;
      completedSamples: number;
      sampleIds: string[];
      batchActive: boolean;
    };
    
    // Member info
    members: {
      addresses: string[];
      roles: string[];
      weights: number[];
      joinTimestamps: number[];
    };
    
    // Active voting info
    activeVoting?: {
      sampleId: string;
      sampleData: any;
      labelOptions: string[];
      timeRemaining: number;
      currentVotes: Record<string, number>;
    };
  }> {
    try {
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      
      // Get basic project info
      const isActive = await projectContract.getIsActive();
      const alConfig = await projectContract.getALConfiguration();
      
      // Use off-chain contract service for participants
      const participants = await offChainContractService.getAllParticipants(projectAddress);

      // Use off-chain implementation for current batch progress
      let currentBatch = null;
      try {
        const batchProgress = await offChainContractService.getCurrentBatchProgress(projectAddress);
        if (batchProgress) {
          currentBatch = {
            round: batchProgress.round,
            totalSamples: batchProgress.totalSamples,
            activeSamples: batchProgress.activeSamplesCount,
            completedSamples: batchProgress.completedSamples,
            sampleIds: batchProgress.sampleIds,
            batchActive: batchProgress.batchActive
          };
        } else {
          // Default batch info when no active batch
          const currentRound = await projectContract.currentRound();
          currentBatch = {
            round: Number(currentRound),
            totalSamples: 0,
            activeSamples: 0,
            completedSamples: 0,
            sampleIds: [],
            batchActive: false
          };
        }
      } catch (error) {
        console.log('📝 Could not get current batch progress');
        const currentRound = await projectContract.currentRound();
        currentBatch = {
          round: Number(currentRound),
          totalSamples: 0,
          activeSamples: 0,
          completedSamples: 0,
          sampleIds: [],
          batchActive: false
        };
      }

      // Try to get active batch if available
      let activeVoting;
      try {
        const activeBatch = await this.getActiveBatch(projectAddress);
        if (activeBatch && activeBatch.sampleIds.length > 0) {
          const sampleId = activeBatch.sampleIds[0];
          const sampleData = this.getSampleDataById(sampleId) || { sampleId, data: 'Sample data' };
          
          activeVoting = {
            sampleId,
            sampleData,
            labelOptions: activeBatch.labelOptions,
            timeRemaining: Number(activeBatch.timeRemaining),
            currentVotes: {}
          };
        }
      } catch (error) {
        console.log('📝 No active voting session');
      }

      return { 
        // Basic project info
        isActive,
        currentIteration: Number(alConfig._currentRound),
        maxIterations: Number(alConfig._maxIteration) || 10,
        
        // AL Configuration  
        queryStrategy: alConfig._queryStrategy || 'uncertainty_sampling',
        alScenario: alConfig._alScenario || 'pool_based',
        queryBatchSize: Number(alConfig._queryBatchSize) || 2,
        votingTimeout: Number(alConfig._votingTimeout) || 3600,
        labelSpace: alConfig._labelSpace ? [...alConfig._labelSpace] : [], // Remove default ['positive', 'negative']
        
        // Current batch info
        currentBatch: {
          round: Number(currentBatch.round),
          totalSamples: Number(currentBatch.totalSamples),
          activeSamples: Number(currentBatch.activeSamples),
          completedSamples: Number(currentBatch.completedSamples),
          sampleIds: currentBatch.sampleIds,
          batchActive: currentBatch.batchActive
        },
        
        // Member info
        members: {
          addresses: participants.participantAddresses,
          roles: participants.roles,
          weights: participants.weights.map((w: any) => Number(w)),
          joinTimestamps: participants.joinTimestamps.map((t: any) => Number(t))
        },
        
        // Active voting (if any)
        activeVoting
      };
      
    } catch (error) {
      console.error('Error getting enhanced project status:', error);
      throw error;
    }
  }

  /**
   * Get AL configuration from deployed smart contract
   */
  async getALConfiguration(projectAddress: string): Promise<{
    scenario: string;
    queryStrategy: string;
    model: { type: string; parameters: any };
    queryBatchSize: number;
    maxIterations: number;
    votingConsensus: string;
    votingTimeout: number;
    labelSpace: string[];
  } | null> {
    try {
      console.log(`⚙️ Fetching AL configuration from contract: ${projectAddress}`);
      
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        console.log('📝 Project has no AL contracts deployed');
        return null;
      }
      
      // Get AL configuration from contract
      const alConfig = await projectContract.getALConfiguration();
      console.log('📋 Raw AL config from contract:', alConfig);
      
      return {
        scenario: alConfig._alScenario || 'pool_based',
        queryStrategy: alConfig._queryStrategy || 'uncertainty_sampling',
        model: {
          type: alConfig._modelType || 'logistic_regression',
          parameters: alConfig._modelParameters || {}
        },
        queryBatchSize: Number(alConfig._queryBatchSize) || 2,
        maxIterations: Number(alConfig._maxIteration) || 10,
        votingConsensus: alConfig._votingConsensus || 'simple_majority',
        votingTimeout: Number(alConfig._votingTimeout) || 3600,
        labelSpace: alConfig._labelSpace ? [...alConfig._labelSpace] : []
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch AL configuration from contract:', error);
      return null;
    }
  }

  async getBatchProgressFromVotingContract(projectAddress: string): Promise<{
    round: number;
    isActive: boolean;
    totalSamples: number;
    completedSamples: number;
    sampleIds: string[];
  } | null> {
    try {
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        return null;
      }

      const votingContract = await projectContract.votingContract();
      const votingContractInstance = new ethers.Contract(votingContract, ALProjectVoting.abi, this.provider);
      
      const batchProgress = await votingContractInstance.getCurrentBatchProgress();
          
          return {
        round: Number(batchProgress.round),
        isActive: batchProgress.isActive,
        totalSamples: Number(batchProgress.totalSamples),
        completedSamples: Number(batchProgress.completedSamples),
        sampleIds: batchProgress.sampleIds
      };
      
    } catch (error) {
      console.error('Error getting batch progress from voting contract:', error);
      return null;
    }
  }

  /**
   * @dev Check if project should end based on smart contract conditions
   * Uses the shouldProjectEnd() function from Project.sol
   */
  async getProjectEndStatus(projectAddress: string): Promise<{
    shouldEnd: boolean;
    reason: string;
    currentRound: number;
    maxIterations: number;
  }> {
    try {
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      
      // Call the smart contract's shouldProjectEnd function
      const [shouldEnd, reason] = await projectContract.shouldProjectEnd();
      const currentRound = await projectContract.currentRound();
      const alConfig = await projectContract.getALConfiguration();
      const maxIterations = Number(alConfig._maxIteration) || 0;
      
      return {
        shouldEnd,
        reason,
        currentRound: Number(currentRound),
        maxIterations
      };
    } catch (error) {
      console.error('Error checking project end status:', error);
      return {
        shouldEnd: false,
        reason: 'Error checking end conditions',
        currentRound: 0,
        maxIterations: 0
      };
    }
  }

  /**
   * @dev Notify the contract that unlabeled samples are exhausted
   * This is called from AL-Engine when no more samples are available
   */
  async notifyUnlabeledSamplesExhausted(projectAddress: string): Promise<boolean> {
    try {
      console.log('🚨 Notifying contract that unlabeled samples are exhausted');
      
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);
      
      const tx = await projectContract.notifyUnlabeledSamplesExhausted();
      await tx.wait();
      
      console.log('✅ Successfully notified contract about sample exhaustion');
      return true;
    } catch (error) {
      console.error('❌ Failed to notify unlabeled samples exhausted:', error);
      return false;
    }
  }

  // =====================================================================
  // OFF-CHAIN CONTRACT FUNCTION DELEGATES
  // These delegate to OffChainContractService for functions removed from Project.sol
  // =====================================================================

  /**
   * @dev Get all join requesters for a project
   */
  async getAllRequesters(projectAddress: string): Promise<string[]> {
    return await offChainContractService.getAllRequesters(projectAddress);
  }

  /**
   * @dev Get all active samples for a project
   */
  async getActiveSamples(projectAddress: string): Promise<string[]> {
    return await offChainContractService.getActiveSamples(projectAddress);
  }

  /**
   * @dev Get voter statistics for a specific address
   */
  async getVoterStats(projectAddress: string, voterAddress: string): Promise<{
    weight: number;
    totalVotes: number;
    isRegistered: boolean;
  }> {
    return await offChainContractService.getVoterStats(projectAddress, voterAddress);
  }

}

// Export singleton instance
export const alContractService = ALContractService.getInstance(); 