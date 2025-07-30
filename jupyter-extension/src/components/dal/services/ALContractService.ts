/**
 * Refactored AL Contract Service - Using modular services while preserving all functionality
 * This orchestrates interactions between smart contracts, AL-Engine, and UI components
 */

import { ethers } from 'ethers';
import { RPC_URL } from '../../../config/contracts';
import Project from '../../../abis/Project.json';
import ALProjectVoting from '../../../abis/ALProjectVoting.json';

// Import our modular services
import { VotingService, VotingRecord, UserContribution, ActiveVoting } from './VotingService';
import { ALEngineService, ModelUpdate } from './ALEngineService';

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

      const currentBatch = await projectContract.getCurrentBatchProgress();
      
      if (!currentBatch.batchActive) {
        return null;
      }

      const activeBatch = await projectContract.getActiveBatch();
      if (!activeBatch.sampleIds || activeBatch.sampleIds.length === 0) {
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
        label_space: metadata._labelSpace || ['positive', 'negative']
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

      // Store samples for labeling
      this.storeALSamplesForLabeling(projectAddress, sampleIds, realSamples);

      // Setup event listeners and start batch voting
      this.setupProjectEventListeners(projectAddress, iterationNumber, sampleIds);

      // Start batch voting in smart contract
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);
      
      const tx = await projectContract.startBatchVoting(sampleIds);
      await tx.wait();

      console.log('✅ Batch voting started on blockchain');

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
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        console.log('📝 Project has no AL contracts');
        return null;
      }

      // Get active batch from Project contract
      const activeBatch = await projectContract.getActiveBatch();
      
      if (!activeBatch.sampleIds || activeBatch.sampleIds.length === 0) {
        console.log('📝 No active batch found');
        return null;
      }

      console.log(`📊 Active batch found with ${activeBatch.sampleIds.length} samples`);

      // Get sample data for each sample
      const sampleData = activeBatch.sampleIds.map((sampleId: string) => {
        const storedData = this.getSampleDataById(sampleId);
        return storedData || { sampleId, data: `Sample data for ${sampleId}` };
      });

      return {
        sampleIds: activeBatch.sampleIds,
        sampleData: sampleData,
        labelOptions: activeBatch.labelOptions,
        timeRemaining: Number(activeBatch.timeRemaining),
        round: Number(activeBatch.round),
        batchSize: activeBatch.sampleIds.length
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
      const currentBatch = await projectContract.getCurrentBatchProgress();
      const participants = await projectContract.getAllParticipants();

      // Try to get active batch if available
      let activeVoting;
      try {
        const activeBatch = await projectContract.getActiveBatch();
        if (activeBatch.sampleIds && activeBatch.sampleIds.length > 0) {
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
        labelSpace: alConfig._labelSpace || [],
        
        // Current batch info
        currentBatch: {
          round: Number(currentBatch.round),
          totalSamples: Number(currentBatch.totalSamples),
          activeSamples: Number(currentBatch.activeSamplesCount),
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

}

// Export singleton instance
export const alContractService = ALContractService.getInstance(); 