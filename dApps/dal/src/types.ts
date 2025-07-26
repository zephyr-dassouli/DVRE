/**
 * DAL (Decentralized Active Learning) - Essential Types
 * Minimal type definitions for the clean DAL extension
 */

export interface DALProject {
  id: string;
  name: string;
  contractAddress: string;
  status: 'draft' | 'configured' | 'running' | 'completed';
  participants: number;
  currentRound: number;
  totalRounds: number;
  lastUpdated: Date;
  workflowConfigured: boolean;
}

export interface ProjectStats {
  accuracy?: number;
  samplesLabeled?: number;
  modelsCreated?: number;
  contributors?: string[];
}

export interface DALComponentProps {
  title?: string;
  onProjectSelect?: (project: DALProject) => void;
} 