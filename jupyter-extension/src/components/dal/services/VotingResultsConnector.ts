/**
 * VotingResultsConnector - Browser-compatible service to export blockchain voting data to AL-Engine
 * Uses existing VotingService to get blockchain data and AL-Engine API to write files
 */

import { VotingService } from './VotingService';
import { alEngineService } from './ALEngineService';
import { config } from '../../../config';

export interface ALEngineVotingResult {
  original_index: number;
  final_label: string;
  sample_data: any;
  votes: { [voterAddress: string]: string };
  consensus: boolean;
  timestamp: string;
}

export class VotingResultsConnector {
  private votingService: VotingService;

  constructor() {
    this.votingService = new VotingService();
  }

  /**
   * Export voting results for a specific round to AL-Engine format
   */
  async exportVotingResultsForRound(
    projectAddress: string, 
    round: number
  ): Promise<boolean> {
    try {
      console.log(`[PROCESSING] Exporting voting results for project ${projectAddress}, round ${round}`);
      
      // Get all voting records from blockchain
      const votingHistory = await this.votingService.getVotingHistory(projectAddress);
      
      // Filter for specific round
      const roundRecords = votingHistory.filter(record => record.iterationNumber === round);
      
      if (roundRecords.length === 0) {
        console.log(`[INFO] No voting results found for round ${round}`);
        return false;
      }
      
      // Convert to AL-Engine format
      const alEngineResults: ALEngineVotingResult[] = roundRecords.map(record => ({
        original_index: this.extractOriginalIndex(record.sampleId, record.sampleData),
        final_label: record.finalLabel,
        sample_data: this.formatSampleData(record.sampleData, record.sampleId),
        votes: record.votes,
        consensus: record.consensusReached,
        timestamp: record.timestamp.toISOString()
      }));
      
      console.log(`[DATA] Converted ${alEngineResults.length} voting results for round ${round}`);
      
      // Send to AL-Engine API to write the file
      const success = await this.sendToALEngine(projectAddress, round, alEngineResults);
      
      if (success) {
        console.log(`[SUCCESS] Successfully exported voting results for round ${round} to AL-Engine`);
      } else {
        console.warn(`[WARNING] Failed to export voting results for round ${round} to AL-Engine`);
      }
      
      return success;
      
    } catch (error) {
      console.error(`[ERROR] Error exporting voting results for round ${round}:`, error);
      return false;
    }
  }

  /**
   * Export all voting results to AL-Engine
   */
  async exportAllVotingResults(projectAddress: string): Promise<number> {
    try {
      console.log(`[PROCESSING] Exporting all voting results for project ${projectAddress}`);
      
      // Get all voting records from blockchain
      const votingHistory = await this.votingService.getVotingHistory(projectAddress);
      
      if (votingHistory.length === 0) {
        console.log(`[INFO] No voting results found for project ${projectAddress}`);
        return 0;
      }
      
      // Group by round
      const roundGroups = new Map<number, any[]>();
      votingHistory.forEach(record => {
        const round = record.iterationNumber;
        if (!roundGroups.has(round)) {
          roundGroups.set(round, []);
        }
        roundGroups.get(round)!.push(record);
      });
      
      console.log(`[STATS] Found voting results for ${roundGroups.size} rounds`);
      
      let exportedRounds = 0;
      
      // Export each round
      for (const [round] of roundGroups.entries()) {
        const success = await this.exportVotingResultsForRound(projectAddress, round);
        if (success) {
          exportedRounds++;
        }
      }
      
      console.log(`[SUCCESS] Exported voting results for ${exportedRounds}/${roundGroups.size} rounds`);
      return exportedRounds;
      
    } catch (error) {
      console.error(`[ERROR] Error exporting all voting results:`, error);
      return 0;
    }
  }

  /**
   * Send voting results to AL-Engine API to write voting_results_round_X.json file
   */
  private async sendToALEngine(
    projectAddress: string, 
    round: number, 
    votingResults: ALEngineVotingResult[]
  ): Promise<boolean> {
    try {
      const alEngineUrl = config.alEngine.apiUrl || 'http://localhost:5050';
      
      // Check if AL-Engine is running
      try {
        const healthResponse = await fetch(`${alEngineUrl}/health`);
        if (!healthResponse.ok) {
          throw new Error('AL-Engine health check failed');
        }
      } catch (healthError) {
        console.warn('[WARNING] AL-Engine is not running, cannot export voting results');
        return false;
      }
      
      // Send voting results to AL-Engine
      const response = await fetch(`${alEngineUrl}/api/voting-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectAddress,
          round: round,
          voting_results: votingResults
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[SAVED] AL-Engine saved voting results to: ${result.file_path}`);
        return true;
      } else {
        console.error(`[ERROR] AL-Engine API error: ${response.status} ${response.statusText}`);
        return false;
      }
      
    } catch (error) {
      console.error(`[ERROR] Failed to send voting results to AL-Engine:`, error);
      
      // Fallback: Try local file server approach
      return await this.fallbackToFileServer(projectAddress, round, votingResults);
    }
  }

  /**
   * Fallback: Use local file server to write voting results
   */
  private async fallbackToFileServer(
    projectAddress: string, 
    round: number, 
    votingResults: ALEngineVotingResult[]
  ): Promise<boolean> {
    try {
      console.log('[PROCESSING] Trying fallback file server approach...');
      
      const fileContent = JSON.stringify(votingResults, null, 2);
      const filePath = `al-engine/ro-crates/${projectAddress}/outputs/voting_results_round_${round}.json`;
      
      const response = await fetch('http://localhost:3001/write-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: filePath,
          content: fileContent
        })
      });
      
      if (response.ok) {
        console.log(`[SAVED] File server saved voting results to: ${filePath}`);
        return true;
      } else {
        console.warn(`[WARNING] File server error: ${response.status}`);
        return false;
      }
      
    } catch (error) {
      console.warn('[WARNING] File server not available:', error);
      return false;
    }
  }

  /**
   * Extract original dataset index from sample ID or data
   */
  private extractOriginalIndex(sampleId: string, sampleData: any): number {
    // Try to get original index from sample data first
    if (sampleData && typeof sampleData.original_index === 'number') {
      return sampleData.original_index;
    }
    
    // Try to extract from sampleId format (e.g., "sample_66_round1")
    const indexMatch = sampleId.match(/sample_(\d+)/);
    if (indexMatch) {
      return parseInt(indexMatch[1]);
    }
    
    // Fallback: extract number from end of sampleId
    const numberMatch = sampleId.match(/(\d+)$/);
    if (numberMatch) {
      return parseInt(numberMatch[1]);
    }
    
    // Last resort: return 0
    console.warn(`[WARNING] Could not extract original index from sample ${sampleId}`);
    return 0;
  }

  /**
   * Format sample data for AL-Engine
   */
  private formatSampleData(sampleData: any, sampleId: string): any {
    if (sampleData && typeof sampleData === 'object') {
      return {
        ...sampleData,
        sample_id: sampleId // Ensure sample_id is included
      };
    }
    
    // Get stored sample data from ALEngineService if available
    const storedData = alEngineService.getSampleDataById(sampleId);
    if (storedData) {
      return {
        ...storedData,
        sample_id: sampleId
      };
    }
    
    // Fallback: create minimal sample data
    return {
      sample_id: sampleId,
      original_index: this.extractOriginalIndex(sampleId, null)
    };
  }

  /**
   * Get summary of voting results (for debugging)
   */
  async getVotingResultsSummary(projectAddress: string): Promise<string> {
    try {
      const votingHistory = await this.votingService.getVotingHistory(projectAddress);
      
      if (votingHistory.length === 0) {
        return `[STATS] Voting Results Summary for ${projectAddress}:\n   No voting results found`;
      }
      
      // Group by round
      const roundGroups = new Map<number, any[]>();
      votingHistory.forEach(record => {
        const round = record.iterationNumber;
        if (!roundGroups.has(round)) {
          roundGroups.set(round, []);
        }
        roundGroups.get(round)!.push(record);
      });
      
      let summary = `[STATS] Voting Results Summary for ${projectAddress}:\n`;
      summary += `   Total voting records: ${votingHistory.length}\n`;
      summary += `   Rounds completed: ${roundGroups.size}\n\n`;
      
      // Round details
      for (const [round, records] of Array.from(roundGroups.entries()).sort(([a], [b]) => a - b)) {
        const consensusCount = records.filter(r => r.consensusReached).length;
        const labels = records.map(r => r.finalLabel);
        const uniqueLabels = [...new Set(labels)];
        
        summary += `   Round ${round}: ${records.length} samples, ${consensusCount} consensus, labels [${uniqueLabels.join(', ')}]\n`;
      }
      
      return summary;
      
    } catch (error) {
      return `[ERROR] Error getting voting results summary: ${error}`;
    }
  }
}

// Export singleton instance
export const votingResultsConnector = new VotingResultsConnector(); 