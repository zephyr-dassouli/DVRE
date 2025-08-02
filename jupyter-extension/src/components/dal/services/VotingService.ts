/**
 * Voting Service - Handles all voting-related operations
 * Extracted from ALContractService.ts for better organization
 */

import { ethers } from 'ethers';
import { RPC_URL } from '../../../config/contracts';
import ALProject from '../../../abis/ALProject.json';
import ALProjectVoting from '../../../abis/ALProjectVoting.json';
import { UserContribution, VotingRecord } from '../types'; // Import from types.ts
import { resolveALProjectAddress, getBaseProjectAddress } from '../utils/AddressResolver';

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
      console.log(`📜 Fetching voting history using contract methods for project ${projectAddress}`);
      
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress, this.provider);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        console.log('📝 Project has no AL contracts');
        return [];
      }

      // Get the voting contract address
      const votingContractAddress = await projectContract.votingContract();
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, this.provider);

      // Get current round to know how many rounds to check
      const currentRound = await votingContract.currentRound();
      console.log(`📊 Checking voting history for ${currentRound} rounds`);

      const votingRecords: VotingRecord[] = [];

      // For each round, get all samples and their voting data
      for (let round = 1; round <= currentRound; round++) {
        try {
          console.log(`🔍 Processing round ${round}...`);
          
          // Get all sample IDs for this round
          const sampleIds = await votingContract.getBatchSamples(round);
          console.log(`📋 Found ${sampleIds.length} samples in round ${round}:`, sampleIds);

          // For each sample, get voting details
          for (const sampleId of sampleIds) {
            try {
              // Get voting session info
              const sessionInfo = await votingContract.getVotingSession(sampleId);
              const [startTime, , isFinalized, finalLabel] = sessionInfo; // Skip isActive with comma

              // Only include finalized samples (completed voting)
              if (!isFinalized || !finalLabel) {
                console.log(`⏳ Skipping ${sampleId} - not finalized yet`);
                continue;
              }

              // Get individual votes for this sample
              const votes = await votingContract.getVotes(sampleId);
              
              // Get voting distribution
              const votingDistribution = await votingContract.getVotingDistribution(sampleId);
              const [labels, voteCounts] = votingDistribution;

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
              for (let i = 0; i < labels.length; i++) {
                const label = labels[i];
                const count = Number(voteCounts[i]);
                distributionMap[label] = count;
              }

              // Get sample data if available
              const sampleData = this.getSampleDataById ? this.getSampleDataById(sampleId) : { sampleId };

              // Check if true consensus was achieved using the contract function
              let consensusReached = false;
              try {
                consensusReached = await votingContract.wasConsensusAchieved(sampleId);
              } catch (consensusError) {
                console.warn(`⚠️ Failed to check consensus for ${sampleId}:`, consensusError);
                // Fallback: no consensus if we can't check
                consensusReached = false;
              }

              const votingRecord: VotingRecord = {
                sampleId,
                sampleData,
                finalLabel,
                votes: voterVotes,
                votingDistribution: distributionMap,
                timestamp: new Date(Number(startTime) * 1000), // Use start time as timestamp
                iterationNumber: round,
                consensusReached // Now using actual consensus check from contract
              };

              votingRecords.push(votingRecord);
              console.log(`✅ Added voting record for ${sampleId}: ${finalLabel}`);
              
            } catch (sampleError) {
              console.warn(`⚠️ Error processing sample ${sampleId}:`, sampleError);
            }
          }
          
        } catch (roundError) {
          console.warn(`⚠️ Error processing round ${round}:`, roundError);
        }
      }

      // Sort by round and timestamp (newest first)
      votingRecords.sort((a, b) => {
        // First sort by iteration (descending)
        if (a.iterationNumber !== b.iterationNumber) {
          return b.iterationNumber - a.iterationNumber;
        }
        // Then by timestamp (descending)
        return b.timestamp.getTime() - a.timestamp.getTime();
      });

      console.log(`✅ Retrieved ${votingRecords.length} voting records using contract methods`);
      return votingRecords;

    } catch (error) {
      console.error('❌ Error fetching voting history using contract methods:', error);
      return [];
    }
  }

  /**
   * Get user contributions from Project (which delegates to ALProjectVoting)
   */
  async getUserContributions(projectAddress: string): Promise<UserContribution[]> {
    try {
      console.log(`👥 Fetching real user contributions using contract methods for project ${projectAddress}`);
      
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress, this.provider);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        console.log('📝 Project has no AL contracts');
        return [];
      }

      // Get the voting contract address
      const votingContractAddress = await projectContract.votingContract();
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, this.provider);

      // Get project creator from base Project contract (not ALProject)
      const baseProjectAddress = await getBaseProjectAddress(alProjectAddress, this.provider);
      const Project = (await import('../../../abis/Project.json')).default;
      const baseProjectContract = new ethers.Contract(baseProjectAddress, Project.abi, this.provider);
      const projectCreator = await baseProjectContract.creator();
      
      // Get all voters from the voting contract
      const voterList = await votingContract.getVoterList();
      console.log(`📋 Found ${voterList.length} registered voters`);

      if (voterList.length === 0) {
        console.log('📝 No voters registered in the project yet');
        return [];
      }

      const contributions: UserContribution[] = [];

      // Get current round to calculate voting statistics
      const currentRound = await votingContract.currentRound();

      // For each voter, calculate their real contributions
      for (let i = 0; i < voterList.length; i++) {
        const voter = voterList[i]; // voter is a struct with addr and weight
        const voterAddress = voter.addr;
        
        try {
          console.log(`👤 Processing voter ${i + 1}/${voterList.length}: ${voterAddress}`);

          // Determine role based on address comparison
          const isCreator = voterAddress.toLowerCase() === projectCreator.toLowerCase();
          const role = isCreator ? 'coordinator' : 'contributor';

          // Calculate real voting statistics
          let totalVotes = 0;
          let firstVoteTime: Date | null = null;
          let lastVoteTime: Date | null = null;

          // Iterate through all rounds and samples to count this voter's contributions
          for (let round = 1; round <= currentRound; round++) {
            try {
              const sampleIds = await votingContract.getBatchSamples(round);
              
              for (const sampleId of sampleIds) {
                try {
                  // Get all votes for this sample
                  const votes = await votingContract.getVotes(sampleId);
                  
                  // Check if this voter voted on this sample
                  for (const vote of votes) {
                    if (vote.voter.toLowerCase() === voterAddress.toLowerCase()) {
                      totalVotes++;
                      const voteTime = new Date(Number(vote.timestamp) * 1000);
                      
                      if (!firstVoteTime || voteTime < firstVoteTime) {
                        firstVoteTime = voteTime;
                      }
                      if (!lastVoteTime || voteTime > lastVoteTime) {
                        lastVoteTime = voteTime;
                      }

                      break; // Only count once per sample
                    }
                  }
                } catch (sampleError) {
                  console.warn(`⚠️ Error processing sample ${sampleId} for voter ${voterAddress}:`, sampleError);
                }
              }
            } catch (roundError) {
              console.warn(`⚠️ Error processing round ${round} for voter ${voterAddress}:`, roundError);
            }
          }

          // Use real timestamps or reasonable defaults
          const joinedAt = firstVoteTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago as fallback
          const lastActivity = lastVoteTime || joinedAt;

          const contribution: UserContribution = {
            address: voterAddress,
            role: role as 'coordinator' | 'contributor',
            votesCount: totalVotes,
            joinedAt,
            lastActivity
          };

          contributions.push(contribution);
          console.log(`✅ Added user contribution for ${voterAddress}: ${totalVotes} votes`);
          
        } catch (voterError) {
          console.warn(`⚠️ Error processing voter ${voter.addr}:`, voterError);
        }
      }

      // Sort by vote count (descending)
      contributions.sort((a, b) => b.votesCount - a.votesCount);

      console.log(`✅ Retrieved ${contributions.length} real user contributions using contract methods`);
      return contributions;
      
    } catch (error) {
      console.error('❌ Error fetching user contributions using contract methods:', error);
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
      
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress, new ethers.JsonRpcProvider(RPC_URL));
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, signer);
      
      // Use the actual signer address
      const signerAddress = await signer.getAddress();
      console.log(`🔐 Using signer address for batch vote: ${signerAddress} (provided: ${userAddress})`);
      
      // Submit batch vote through Project (Project will handle auto-registration and AL contract interaction)
      const batchType = sampleIds.length === 1 ? 'single-sample batch' : 'multi-sample batch';
      console.log(`📤 Submitting ${batchType} vote for ${sampleIds.length} samples - Project will auto-register if needed...`);
      
      // Create mutable copies to avoid Ethers.js readonly array errors
      const mutableSampleIds = [...sampleIds];
      const mutableLabels = [...labels];
      
      const tx = await projectContract.submitBatchVote(mutableSampleIds, mutableLabels);
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
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress, this.provider);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
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
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress, this.provider);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
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

  /**
   * Get individual votes for a specific sample from ALProjectVoting contract
   */
  async getVotesForSample(projectAddress: string, sampleId: string): Promise<Array<{
    voter: string;
    label: string;
    support: boolean;
  }>> {
    try {
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress, this.provider);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      const votingContractAddress = await projectContract.votingContract();
      
      if (!votingContractAddress || votingContractAddress === ethers.ZeroAddress) {
        return [];
      }
      
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, this.provider);
      
      // Get votes for this specific sample
      const votes = await votingContract.getVotes(sampleId);
      
      return votes.map((vote: any) => ({
        voter: vote.voter,
        label: vote.label,
        support: vote.support
      }));
      
    } catch (error) {
      console.error('Failed to get votes for sample:', error);
      return [];
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