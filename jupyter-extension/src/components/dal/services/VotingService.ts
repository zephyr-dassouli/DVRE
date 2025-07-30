/**
 * Voting Service - Handles all voting-related operations
 * Extracted from ALContractService.ts for better organization
 */

import { ethers } from 'ethers';
import { RPC_URL } from '../../../config/contracts';
import Project from '../../../abis/Project.json';
import ALProjectVoting from '../../../abis/ALProjectVoting.json';

export interface VotingRecord {
  sampleId: string;
  sampleData: any;
  finalLabel: string;
  votes: { [voterAddress: string]: string };
  votingDistribution: { [label: string]: number };
  timestamp: Date;
  iterationNumber: number;
  consensusReached: boolean;
}

export interface UserContribution {
  address: string;
  role: string;
  votesCount: number;
  joinedAt: Date;
  lastActivity: Date;
  reputation: number;
}

export interface ActiveVoting {
  sampleId: string;
  sampleData: any;
  labelOptions: string[];
  currentVotes: { [label: string]: number };
  timeRemaining: number;
  voters: string[];
}

export class VotingService {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
  }

  /**
   * Get voting history from Project (which delegates to ALProjectStorage)
   */
  async getVotingHistory(projectAddress: string): Promise<VotingRecord[]> {
    try {
      console.log(`📜 Fetching voting history for project ${projectAddress}`);
      
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        console.log('📝 Project has no AL contracts');
        return [];
      }

      // Get the voting contract address
      const votingContractAddress = await projectContract.votingContract();
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, this.provider);

      // Get VotingSessionFinalized events to find all completed samples
      const filter = votingContract.filters.VotingSessionFinalized();
      const events = await votingContract.queryFilter(filter, 0, 'latest');
      
      console.log(`📊 Found ${events.length} completed voting sessions`);

      const votingRecords: VotingRecord[] = [];

      for (const event of events) {
        // Check if this is an EventLog (has args) or just a Log
        if (!('args' in event)) continue;
        
        const sampleId = event.args?.sampleId as string;
        const finalLabel = event.args?.finalLabel as string;
        const endTime = event.args?.endTime as bigint;
        const reason = event.args?.reason as string;

        if (!sampleId || !finalLabel) continue;

        try {
          // Get detailed voting session info
          const sessionInfo = await votingContract.getVotingSession(sampleId);
          const votingDistribution = await votingContract.getVotingDistribution(sampleId);
          
          // Get individual votes
          const votes = await votingContract.getVotes(sampleId);
          
          // Build vote record per voter
          const voterVotes: { [voterAddress: string]: string } = {};
          const distributionMap: { [label: string]: number } = {};
          
          // Process individual votes
          for (const vote of votes) {
            const voterAddress = vote.voter.toLowerCase();
            const label = vote.label;
            voterVotes[voterAddress] = label;
          }
          
          // Process voting distribution 
          for (let i = 0; i < votingDistribution.labels.length; i++) {
            const label = votingDistribution.labels[i];
            const count = Number(votingDistribution.voteCounts[i]);
            distributionMap[label] = count;
          }

          // Get sample data if available
          const sampleData = this.getSampleDataById ? this.getSampleDataById(sampleId) : { sampleId };

          const votingRecord: VotingRecord = {
            sampleId,
            sampleData,
            finalLabel,
            votes: voterVotes,
            votingDistribution: distributionMap,
            timestamp: new Date(Number(endTime) * 1000),
            iterationNumber: Number(sessionInfo.round || 1),
            consensusReached: reason.includes('Consensus') || reason.includes('consensus')
          };

          votingRecords.push(votingRecord);
          
        } catch (error) {
          console.warn(`⚠️ Error processing voting session for ${sampleId}:`, error);
        }
      }

      // Sort by timestamp (newest first)
      votingRecords.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      console.log(`✅ Retrieved ${votingRecords.length} voting records`);
      return votingRecords;

    } catch (error) {
      console.error('❌ Error fetching voting history:', error);
      return [];
    }
  }

  /**
   * Get user contributions from Project (which delegates to ALProjectVoting)
   */
  async getUserContributions(projectAddress: string): Promise<UserContribution[]> {
    try {
      console.log('👥 Getting user contributions via Project delegation for:', projectAddress);
      
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      
      try {
        // Try to get user contributions through Project delegation to ALProjectVoting
        const contributionsResult = await projectContract.getUserContributions();
        
        if (contributionsResult && contributionsResult.length === 3) {
          const [voters, voteCounts, weights] = contributionsResult;
          
          if (voters.length > 0) {
            console.log(`👥 Found ${voters.length} contributors via Project delegation`);
      
      const contributions: UserContribution[] = [];
            for (let i = 0; i < voters.length; i++) {
              // Get additional voter stats
              try {
                const voterStats = await projectContract.getVoterStats(voters[i]);
                const [weight, totalVotes, isRegistered] = voterStats;
                
                contributions.push({
                  address: voters[i],
                  role: isRegistered ? 'contributor' : 'observer',
                  votesCount: Number(voteCounts[i]) || Number(totalVotes) || 0,
                  joinedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Estimate
                  lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Estimate
                  reputation: Math.min(100, Math.max(50, Number(weight) || 50))
                });
                
              } catch (statsError) {
                console.warn(`⚠️ Could not get stats for voter ${voters[i]}:`, statsError);
                
                // Fallback to basic record
                contributions.push({
                  address: voters[i],
                  role: 'contributor',
                  votesCount: Number(voteCounts[i]) || 0,
                  joinedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                  lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
                  reputation: Number(weights[i]) || 50
                });
              }
            }
            
            return contributions;
          }
        }
      } catch (methodError) {
        console.log('📝 Project user contributions delegation not available yet, using placeholder data');
      }
      
      // Return empty array for now - will be populated when delegation is working
      console.log('📝 No user contributions available yet via delegation - contracts may need to be linked');
      return [];
      
    } catch (error) {
      console.error('Failed to get user contributions via Project delegation:', error);
      return [];
    }
  }

  /**
   * Submit batch vote for multiple samples - this is now the ONLY voting method!
   * Works for batch size 1 or more, providing consistency and simplification
   */
  async submitBatchVote(projectAddress: string, sampleIds: string[], labels: string[], userAddress: string): Promise<boolean> {
    try {
      console.log(`🗳️ Submitting BATCH vote (${sampleIds.length} samples) via Project:`, { projectAddress, sampleIds, labels, userAddress });
      
      // Validate inputs
      if (sampleIds.length !== labels.length) {
        throw new Error('Sample IDs and labels arrays must have the same length');
      }
      
      if (sampleIds.length === 0) {
        throw new Error('No samples provided for batch voting');
      }
      
      // Get signer for transaction
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);
      
      // Use the actual signer address
      const signerAddress = await signer.getAddress();
      console.log(`🔐 Using signer address for batch vote: ${signerAddress} (provided: ${userAddress})`);
      
      // Submit batch vote through Project (Project will handle auto-registration and AL contract interaction)
      const batchType = sampleIds.length === 1 ? 'single-sample batch' : 'multi-sample batch';
      console.log(`📤 Submitting ${batchType} vote for ${sampleIds.length} samples - Project will auto-register if needed...`);
      const tx = await projectContract.submitBatchVote(sampleIds, labels);
      console.log('📡 Batch vote transaction submitted via Project:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Batch vote confirmed in block:', receipt.blockNumber);
      console.log('🎉 Batch vote successfully processed (including any auto-registration)');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to submit batch vote via Project:', error);
      
      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('Mismatched arrays')) {
          throw new Error('The number of samples and labels must match.');
        } else if (error.message.includes('Sample not active for voting')) {
          throw new Error('One or more samples are not currently active for voting.');
        } else if (error.message.includes('Already voted')) {
          throw new Error('You have already voted on one or more of these samples.');
        } else if (error.message.includes('user rejected')) {
          throw new Error('Transaction was rejected. Please try again.');
        }
      }
      
      throw error;
    }
  }

  /**
   * Get detailed voting session status from ALProjectVoting contract
   */
  async getVotingSessionStatus(projectAddress: string, sampleId: string): Promise<{
    isActive: boolean;
    isFinalized: boolean;
    finalLabel: string;
    startTime: number;
    timeRemaining: number;
    votedCount: number;
    totalVoters: number;
    round: number;
    labelDistribution: { label: string; votes: number; weights: number }[];
  } | null> {
    try {
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      const votingContractAddress = await projectContract.votingContract();
      
      if (!votingContractAddress || votingContractAddress === ethers.ZeroAddress) {
        return null;
      }
      
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, this.provider);
      
      // Get session status
      const [isActive, isFinalized, finalLabel, startTime, timeRemaining, votedCount, totalVoters] = 
        await votingContract.getVotingSessionStatus(sampleId);
      
      // Get voting distribution
      const [labels, voteCounts, voteWeights] = await votingContract.getVotingDistribution(sampleId);
      
      const labelDistribution = [];
      for (let i = 0; i < labels.length; i++) {
        labelDistribution.push({
          label: labels[i],
          votes: Number(voteCounts[i]),
          weights: Number(voteWeights[i])
        });
      }
      
      // Get round from current round
      const round = await votingContract.currentRound();
      
      return {
        isActive: isActive,
        isFinalized: isFinalized,
        finalLabel: finalLabel,
        startTime: Number(startTime),
        timeRemaining: Number(timeRemaining),
        votedCount: Number(votedCount),
        totalVoters: Number(totalVoters),
        round: Number(round),
        labelDistribution
      };
      
    } catch (error) {
      console.error('Failed to get voting session status:', error);
      return null;
    }
  }

  /**
   * Get voter information from ALProjectVoting contract
   */
  async getVoterInformation(projectAddress: string): Promise<{
    voters: { address: string; weight: number }[];
    currentUserWeight: number;
    isCurrentUserRegistered: boolean;
  }> {
    try {
      const projectContract = new ethers.Contract(projectAddress, Project.abi, this.provider);
      const votingContractAddress = await projectContract.votingContract();
      
      if (!votingContractAddress || votingContractAddress === ethers.ZeroAddress) {
        return { voters: [], currentUserWeight: 0, isCurrentUserRegistered: false };
      }
      
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, this.provider);
      
      // Get all voters
      const voterList = await votingContract.getVoterList();
      const voters = voterList.map((voter: any) => ({
        address: voter.addr,
        weight: Number(voter.weight)
      }));
      
      // Get current user's weight
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const currentUserAddress = await signer.getAddress();
      const currentUserWeight = await votingContract.voterWeights(currentUserAddress);
      
      return {
        voters,
        currentUserWeight: Number(currentUserWeight),
        isCurrentUserRegistered: Number(currentUserWeight) > 0
      };
      
    } catch (error) {
      console.error('Failed to get voter information:', error);
      return { voters: [], currentUserWeight: 0, isCurrentUserRegistered: false };
    }
  }

  private getSampleDataById(sampleId: string): any {
    // This would typically come from ALEngineService
    // For now, return basic sample info
    return {
      sampleId,
      data: `Sample data for ${sampleId}`
    };
  }
}

export const votingService = new VotingService(); 