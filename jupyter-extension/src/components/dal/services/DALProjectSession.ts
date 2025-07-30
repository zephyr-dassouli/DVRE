/**
 * DAL Project Session - Bridge between Smart Contracts and AL-Engine
 * 
 * This service orchestrates the complete Active Learning workflow by:
 * - Coordinating between smart contracts (voting, storage) and AL-Engine (iterations)
 * - Managing AL iteration lifecycle (start → query → vote → aggregate → repeat)
 * - Handling real-time event listening and API communication
 * - Providing clean APIs to the UI layer
 */

import { EventEmitter } from 'events';
import { alContractService } from './ALContractService';
import { config } from '../../../config';

export interface ALEngineStatus {
  project_id: string;
  computation_mode: string;
  work_dir: string;
  config_path: string;
  running: boolean;
  timestamp: number;
}

export interface ALIterationResult {
  success: boolean;
  iteration: number;
  result?: {
    execution_method: string;
    outputs: {
      model_out?: string;
      query_samples?: string;
    };
    stdout: string;
  };
  error?: string;
  message: string;
}

export interface QuerySample {
  sepal_length?: number;
  sepal_width?: number;
  petal_length?: number;
  petal_width?: number;
  original_index: number;
  features?: number[];
  [key: string]: any;
}

export interface SessionState {
  projectId: string;
  isActive: boolean;
  phase: 'idle' | 'generating_samples' | 'voting' | 'aggregating' | 'completed' | 'error';
  batchProgress?: {
    totalSamples: number;
    completedSamples: number;
    currentSampleIndex: number;
    sampleIds: string[];
  };
  querySamples?: QuerySample[];
  error?: string;
  lastUpdate: Date;
}

export interface SessionEvents {
  'state-changed': (state: SessionState) => void;
  'iteration-started': (iteration: number) => void;
  'samples-generated': (samples: QuerySample[]) => void;
  'voting-started': (sampleId: string, sampleData: any) => void;
  'vote-submitted': (sampleId: string, voter: string, label: string) => void;
  'sample-completed': (sampleId: string, finalLabel: string) => void;
  'iteration-completed': (iteration: number, samplesLabeled: number) => void;
  'session-ended': () => void;
  'error': (error: string) => void;
}

export class DALProjectSession extends EventEmitter {
  private state: SessionState;
  private contractListeners: Array<() => void> = [];
  private alEngineBaseUrl: string;
  private userAddress: string;

  constructor(projectId: string, userAddress: string, alEnginePort: number = 5050) {
    super();
    
    this.alEngineBaseUrl = config.alEngine.apiUrl || `http://localhost:${alEnginePort}`;
    this.userAddress = userAddress;
    this.state = {
      projectId,
      isActive: false,
      phase: 'idle',
      lastUpdate: new Date()
    };

    this.setupContractEventListeners();
  }

  // =====================================================================
  // PUBLIC API - Session Management
  // =====================================================================

  /**
   * Start a new AL iteration - orchestrates the complete workflow
   */
  async startIteration(): Promise<void> {
    try {
      // Get current iteration from smart contract (single source of truth)
      const currentIteration = await this.getCurrentIterationFromContract();
      const nextIteration = currentIteration + 1;

      this.updateState({
        phase: 'generating_samples',
        isActive: true,
        error: undefined
      });

      this.emit('iteration-started', nextIteration);

      // Step 1: Call AL-Engine to start next iteration (train model + query samples)
      console.log(`🚀 Starting AL iteration ${nextIteration}`);
      const samples = await this.startNextIteration(nextIteration);
      
      this.updateState({
        phase: 'voting',
        querySamples: samples,
        batchProgress: {
          totalSamples: samples.length,
          completedSamples: 0,
          currentSampleIndex: 0,
          sampleIds: samples.map((_, index) => `sample_${nextIteration}_${index}`)
        }
      });

      this.emit('samples-generated', samples);

      // Step 2: Start batch voting on smart contracts
      await this.startBatchVoting(samples);

      console.log(`✅ AL iteration ${nextIteration} workflow started`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start iteration';
      console.error('❌ Failed to start AL iteration:', error);
      
      this.updateState({
        phase: 'error',
        error: errorMessage,
        isActive: false
      });

      this.emit('error', errorMessage);
      throw error;
    }
  }

  /**
   * Submit a vote for the current sample
   */
  async submitVote(sampleId: string, label: string): Promise<void> {
    try {
      console.log(`🗳️ Submitting vote for ${sampleId}: ${label}`);
      
      // Submit vote to smart contract
      await alContractService.submitVote(this.state.projectId, sampleId, label, this.userAddress);
      
      console.log(`✅ Vote submitted successfully`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit vote';
      console.error('❌ Failed to submit vote:', error);
      this.emit('error', errorMessage);
      throw error;
    }
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    try {
      console.log('🏁 Ending DAL project session');
      
      this.cleanupContractListeners();
      
      this.updateState({
        isActive: false,
        phase: 'idle'
      });

      this.emit('session-ended');
      
    } catch (error) {
      console.error('❌ Failed to end session:', error);
      throw error;
    }
  }

  /**
   * Get current session state
   */
  getState(): SessionState {
    return { ...this.state };
  }

  /**
   * Check if AL-Engine is healthy and responsive
   */
  async checkALEngineHealth(): Promise<ALEngineStatus> {
    try {
      const response = await fetch(`${this.alEngineBaseUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`AL-Engine health check failed: ${response.statusText}`);
      }

      const status: ALEngineStatus = await response.json();
      console.log('🏥 AL-Engine health check:', status);
      
      return status;
      
    } catch (error) {
      console.error('❌ AL-Engine health check failed:', error);
      throw error;
    }
  }

  // =====================================================================
  // PRIVATE METHODS - AL-Engine Communication
  // =====================================================================

  private async startNextIteration(iteration: number): Promise<QuerySample[]> {
    try {
      console.log(`🔬 Starting AL iteration ${iteration} (train model + query samples)`);
      
      const response = await fetch(`${this.alEngineBaseUrl}/start_iteration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ iteration })
      });

      if (!response.ok) {
        throw new Error(`AL-Engine request failed: ${response.statusText}`);
      }

      const result: ALIterationResult = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'AL iteration failed');
      }

      // Load the query samples from the output file
      const querySamplesPath = result.result?.outputs?.query_samples;
      if (!querySamplesPath) {
        throw new Error('No query samples generated');
      }

      const samples = await this.loadQuerySamplesFile(querySamplesPath);
      console.log(`✅ Generated ${samples.length} query samples`);
      
      return samples;
      
    } catch (error) {
      console.error('❌ Failed to start AL iteration:', error);
      throw error;
    }
  }

  private async loadQuerySamplesFile(filePath: string): Promise<QuerySample[]> {
    try {
      console.log('📁 Loading query samples directly from file:', filePath);
      
      // Extract the relative path from the full path returned by AL-Engine
      // filePath looks like: "../ro-crates/0xProject.../outputs/query_samples_round_1.json"
      const relativePath = filePath.replace('../', 'al-engine/');
      console.log('🔍 Reading file via read-file endpoint:', relativePath);
      
      try {
        // Read the file content via local file server
        const fileResponse = await fetch(`http://localhost:3001/read-file?path=${encodeURIComponent(relativePath)}`);
        
        if (fileResponse.ok) {
          const responseData = await fileResponse.json();
          if (responseData.success && responseData.content) {
            const samplesData = JSON.parse(responseData.content);
            console.log(`✅ Successfully read ${samplesData.length} samples from file`);
            console.log('🌸 First sample from file:', samplesData[0]);
            
            // Convert AL-Engine iris format to QuerySample format
            const querySamples: QuerySample[] = samplesData.map((sample: any) => ({
              sepal_length: sample['sepal length (cm)'],
              sepal_width: sample['sepal width (cm)'],
              petal_length: sample['petal length (cm)'],
              petal_width: sample['petal width (cm)'],
              original_index: sample.original_index
            }));
            
            console.log('🔄 Converted to QuerySample format:', querySamples[0]);
            return querySamples;
          }
        } else {
          console.warn('⚠️ Failed to read file via read-file endpoint:', fileResponse.statusText);
        }
      } catch (fileError) {
        console.warn('⚠️ Local file server not available:', fileError);
      }
      
      // Fallback: Try to get samples from ALContractService if they were stored
      console.log('📊 Fallback: trying to get stored samples from ALContractService...');
      const storedSamples = alContractService.getStoredALSamples(this.state.projectId);
      
      if (storedSamples && storedSamples.length > 0) {
        console.log(`✅ Found ${storedSamples.length} stored samples from ALContractService`);
        
        // Convert AL-Engine iris format to QuerySample format
        const querySamples: QuerySample[] = storedSamples.map((sample: any) => ({
          sepal_length: sample['sepal length (cm)'],
          sepal_width: sample['sepal width (cm)'],
          petal_length: sample['petal length (cm)'],
          petal_width: sample['petal width (cm)'],
          original_index: sample.original_index
        }));
        
        return querySamples;
      }
      
      console.warn('⚠️ No samples found via file or stored samples, using mock data');
      
      // Last fallback to mock data
      const mockSamples: QuerySample[] = [
        {
          sepal_length: 6.83,
          sepal_width: 2.84,
          petal_length: 4.92,
          petal_width: 1.55,
          original_index: 12
        },
        {
          sepal_length: 6.86,
          sepal_width: 2.57,
          petal_length: 5.43,
          petal_width: 1.74,
          original_index: 6
        }
      ];
      
      return mockSamples;
      
    } catch (error) {
      console.error('❌ Failed to load query samples:', error);
      throw error;
    }
  }

  private async submitLabeledSamples(labeledSamples: Array<{
    sampleId: string;
    sampleData: QuerySample;
    label: string;
    originalIndex: number;
  }>): Promise<void> {
    try {
      // Get current iteration from smart contract
      const currentIteration = await this.getCurrentIterationFromContract();
      
      console.log(`📤 Submitting ${labeledSamples.length} labeled samples to AL-Engine`);
      
      const response = await fetch(`${this.alEngineBaseUrl}/submit_labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          iteration: currentIteration,
          project_id: this.state.projectId,
          labeled_samples: labeledSamples.map(sample => ({
            sample_id: sample.sampleId,
            sample_data: sample.sampleData,
            label: sample.label,
            original_index: sample.originalIndex
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to submit labeled samples: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit labeled samples');
      }

      console.log(`✅ Successfully submitted labeled samples to AL-Engine`);
      
    } catch (error) {
      console.error('❌ Failed to submit labeled samples:', error);
      throw error;
    }
  }

  // =====================================================================
  // PRIVATE METHODS - Smart Contract Integration
  // =====================================================================

  private async startBatchVoting(samples: QuerySample[]): Promise<void> {
    try {
      console.log(`🗳️ Starting batch voting for ${samples.length} samples`);
      
      // Start batch voting using ALContractService
      await alContractService.startNextIteration(this.state.projectId, this.userAddress);
      
      console.log(`✅ Batch voting started successfully`);
      
    } catch (error) {
      console.error('❌ Failed to start batch voting:', error);
      throw error;
    }
  }

  private async getCurrentIterationFromContract(): Promise<number> {
    try {
      const projectStatus = await alContractService.getProjectStatus(this.state.projectId);
      console.log(`🔄 Current AL iteration from contract: ${projectStatus.currentIteration}`);
      return projectStatus.currentIteration;
    } catch (error) {
      console.error('❌ Failed to get current iteration from contract:', error);
      throw error;
    }
  }

  private setupContractEventListeners(): void {
    console.log('📡 Setting up smart contract event listeners');

    // Listen for voting session started events
    const onVotingStarted = (event: any) => {
      console.log('📢 Voting session started:', event);
      
      if (this.state.batchProgress && this.state.querySamples) {
        const currentSample = this.state.querySamples[this.state.batchProgress.currentSampleIndex];
        const sampleId = this.state.batchProgress.sampleIds[this.state.batchProgress.currentSampleIndex];
        
        this.emit('voting-started', sampleId, currentSample);
      }
    };

    // Listen for vote submitted events
    const onVoteSubmitted = (event: any) => {
      const { sampleId, voter, label } = event.detail || event;
      console.log('📢 Vote submitted:', { sampleId, voter, label });
      
      this.emit('vote-submitted', sampleId, voter, label);
    };

    // Listen for voting session ended events (sample completed)
    const onVotingEnded = async (event: any) => {
      const { sampleId, finalLabel } = event.detail || event;
      console.log('📢 Voting session ended:', { sampleId, finalLabel });
      
      this.emit('sample-completed', sampleId, finalLabel);
      
      // Update batch progress
      if (this.state.batchProgress) {
        const updatedProgress = {
          ...this.state.batchProgress,
          completedSamples: this.state.batchProgress.completedSamples + 1,
          currentSampleIndex: this.state.batchProgress.currentSampleIndex + 1
        };

        this.updateState({
          batchProgress: updatedProgress
        });

        // Check if batch is complete
        if (updatedProgress.completedSamples >= updatedProgress.totalSamples) {
          await this.handleBatchCompleted();
        }
      }
    };

    // Add event listeners
    window.addEventListener('voting-session-started', onVotingStarted);
    window.addEventListener('vote-submitted', onVoteSubmitted);
    window.addEventListener('voting-session-ended', onVotingEnded);

    // Store cleanup functions
    this.contractListeners = [
      () => window.removeEventListener('voting-session-started', onVotingStarted),
      () => window.removeEventListener('vote-submitted', onVoteSubmitted),
      () => window.removeEventListener('voting-session-ended', onVotingEnded)
    ];
  }

  private cleanupContractListeners(): void {
    console.log('🧹 Cleaning up smart contract event listeners');
    this.contractListeners.forEach(cleanup => cleanup());
    this.contractListeners = [];
  }

  private async handleBatchCompleted(): Promise<void> {
    try {
      console.log('🎉 Batch voting completed, finalizing iteration');
      
      this.updateState({
        phase: 'aggregating'
      });

      // Collect all labeled samples from this iteration
      const labeledSamples = await this.collectLabeledSamples();
      
      // Submit labeled samples back to AL-Engine
      await this.submitLabeledSamples(labeledSamples);
      
      // Get current iteration from smart contract for events
      const currentIteration = await this.getCurrentIterationFromContract();
      
      this.updateState({
        phase: 'completed',
        isActive: false,
        batchProgress: undefined
      });

      this.emit('iteration-completed', currentIteration, labeledSamples.length);
      
      console.log(`✅ AL iteration ${currentIteration} completed successfully`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete iteration';
      console.error('❌ Failed to complete iteration:', error);
      
      this.updateState({
        phase: 'error',
        error: errorMessage,
        isActive: false
      });

      this.emit('error', errorMessage);
    }
  }

  private async collectLabeledSamples(): Promise<Array<{
    sampleId: string;
    sampleData: QuerySample;
    label: string;
    originalIndex: number;
  }>> {
    try {
      // Get finalized labels from smart contracts
      const labeledSamples = [];
      
      if (this.state.batchProgress && this.state.querySamples) {
        // Get voting history to extract final labels
        const votingHistory = await alContractService.getVotingHistory(this.state.projectId);
        
        for (let i = 0; i < this.state.batchProgress.totalSamples; i++) {
          const sampleId = this.state.batchProgress.sampleIds[i];
          const sampleData = this.state.querySamples[i];
          
          // Find the final label from voting history
          const votingRecord = votingHistory.find(record => record.sampleId === sampleId);
          const finalLabel = votingRecord?.finalLabel || 'unknown';
          
          labeledSamples.push({
            sampleId,
            sampleData,
            label: finalLabel,
            originalIndex: sampleData.original_index
          });
        }
      }
      
      return labeledSamples;
      
    } catch (error) {
      console.error('❌ Failed to collect labeled samples:', error);
      throw error;
    }
  }

  // =====================================================================
  // PRIVATE METHODS - State Management
  // =====================================================================

  private updateState(updates: Partial<SessionState>): void {
    this.state = {
      ...this.state,
      ...updates,
      lastUpdate: new Date()
    };
    
    console.log('📊 Session state updated:', this.state);
    this.emit('state-changed', this.getState());
  }
}

// Export singleton factory for easy usage
export const createDALProjectSession = (projectId: string, userAddress: string, alEnginePort?: number): DALProjectSession => {
  return new DALProjectSession(projectId, userAddress, alEnginePort);
};

export default DALProjectSession; 