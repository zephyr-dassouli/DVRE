/**
 * DAL Project Data Loader - Handles loading and refreshing project data from smart contracts
 */

import { DALProject, ModelUpdate, VotingRecord, UserContribution } from './types';
import { alContractService } from './services/ALContractService';
import { ethers } from 'ethers';
import { useState, useEffect } from 'react';
import ALProject from '../../abis/ALProject.json';
import { RPC_URL } from '../../config/contracts';

export interface ProjectDataState {
  modelUpdates: ModelUpdate[];
  votingHistory: VotingRecord[];
  userContributions: UserContribution[];
  batchProgress: {
    round: number;
    isActive: boolean;
    totalSamples: number;
    completedSamples: number;
    sampleIds: string[];
    currentSampleIndex: number;
  } | null;
  loading: boolean;
  error: string | null;
}

export interface DataLoaderDependencies {
  project: DALProject;
  setModelUpdates: (updates: ModelUpdate[]) => void;
  setVotingHistory: (history: VotingRecord[]) => void;
  setUserContributions: (contributions: UserContribution[]) => void;
  setBatchProgress: (progress: any) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProjectDescription: (description: string) => void;
}

export const createDataLoader = (deps: DataLoaderDependencies) => {
  const {
    project,
    setModelUpdates,
    setVotingHistory,
    setUserContributions,
    setBatchProgress,
    setLoading,
    setError,
    setProjectDescription
  } = deps;

  const loadProjectData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Loading enhanced AL project data for:', project.contractAddress);
      
      // Load enhanced project status from contracts
      const [enhancedStatus, votingData, contributionData, modelData] = await Promise.all([
        alContractService.getEnhancedProjectStatus(project.contractAddress),
        alContractService.getVotingHistory(project.contractAddress),
        alContractService.getUserContributions(project.contractAddress),
        alContractService.getModelUpdates(project.contractAddress)
      ]);

      // Fetch project description from project data JSON (already stored during creation)
      try {
        console.log('🔍 Fetching project description from project data...');
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const projectContract = new ethers.Contract(project.contractAddress, ALProject.abi, provider);
        
        // Get the project data JSON that was stored during creation
        const projectDataString = await projectContract.getProjectData();
        const projectData = JSON.parse(projectDataString);
        
        // Extract description from the project data
        const description = projectData.description || projectData.objective || '';
        console.log('📝 Project description extracted from project data:', `"${description}"`);
        setProjectDescription(description);
        
        if (description && description.trim() !== '') {
          console.log('✅ Project description set successfully:', description);
        } else {
          console.log('ℹ️ Project description is empty or not set');
        }
      } catch (descError) {
        console.error('❌ Could not fetch project description:', descError);
        setProjectDescription('');
      }

      console.log('Loaded enhanced contract data:', {
        currentIteration: enhancedStatus.currentIteration,
        maxIterations: enhancedStatus.maxIterations,
        batchActive: enhancedStatus.currentBatch.batchActive,
        activeSamples: enhancedStatus.currentBatch.activeSamples,
        completedSamples: enhancedStatus.currentBatch.completedSamples,
        totalSamples: enhancedStatus.currentBatch.totalSamples,
        members: enhancedStatus.members.addresses.length,
        votingRecords: votingData.length,
        hasActiveVoting: !!enhancedStatus.activeVoting
      });

      setVotingHistory(votingData);
      setUserContributions(contributionData.map(user => ({
        ...user,
        role: user.role as 'coordinator' | 'contributor'
      })));
      setModelUpdates(modelData);

      // Update project data with enhanced contract state
      (project as any).isActive = enhancedStatus.isActive;
      (project as any).currentRound = enhancedStatus.currentIteration;
      (project as any).totalRounds = enhancedStatus.maxIterations;
      (project as any).queryBatchSize = enhancedStatus.queryBatchSize;
      (project as any).votingTimeout = enhancedStatus.votingTimeout;
      (project as any).labelSpace = enhancedStatus.labelSpace;
      (project as any).participants = enhancedStatus.members.addresses.length;
      
      // Set active voting from contract state
      if (enhancedStatus.activeVoting) {
        (project as any).activeVoting = {
          sampleId: enhancedStatus.activeVoting.sampleId,
          sampleData: enhancedStatus.activeVoting.sampleData,
          labelOptions: enhancedStatus.activeVoting.labelOptions,
          timeRemaining: enhancedStatus.activeVoting.timeRemaining,
          currentVotes: enhancedStatus.activeVoting.currentVotes
        };
      } else {
        delete (project as any).activeVoting;
      }

      // Set batch progress from contract state
      if (enhancedStatus.currentBatch.batchActive && enhancedStatus.currentBatch.totalSamples > 0) {
        setBatchProgress({
          round: enhancedStatus.currentBatch.round,
          isActive: enhancedStatus.currentBatch.batchActive,
          totalSamples: enhancedStatus.currentBatch.totalSamples,
          completedSamples: enhancedStatus.currentBatch.completedSamples,
          sampleIds: enhancedStatus.currentBatch.sampleIds,
          currentSampleIndex: enhancedStatus.currentBatch.activeSamples > 0 ? 
            enhancedStatus.currentBatch.totalSamples - enhancedStatus.currentBatch.activeSamples : 
            enhancedStatus.currentBatch.completedSamples
        });
      } else {
        setBatchProgress(null);
      }

      // Log contract state summary
      console.log(`📊 Contract State Summary:
        - Project Active: ${enhancedStatus.isActive}
        - Current Round: ${enhancedStatus.currentIteration}/${enhancedStatus.maxIterations}
        - Batch Active: ${enhancedStatus.currentBatch.batchActive}
        - Samples: ${enhancedStatus.currentBatch.completedSamples}/${enhancedStatus.currentBatch.totalSamples}
        - Members: ${enhancedStatus.members.addresses.length}
        - Active Voting: ${enhancedStatus.activeVoting ? 'Yes' : 'No'}`);

    } catch (err) {
      console.error('Failed to load enhanced project data from smart contracts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project data');
      
      // Set empty arrays instead of mock data
      setVotingHistory([]);
      setUserContributions([]);
      setModelUpdates([]);
      setBatchProgress(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    loadProjectData
  };
}; 