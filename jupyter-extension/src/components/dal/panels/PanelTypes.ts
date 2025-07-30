import { DALProject, ModelUpdate, VotingRecord, UserContribution } from '../types';
import { SessionState } from '../services/DALProjectSession';

export interface BasePanelProps {
  project: DALProject;
  currentUser: string;
  isCoordinator: boolean;
  onRefresh: () => void;
  onError: (error: string) => void;
}

export interface LabelingPanelProps extends BasePanelProps {
  sessionState: SessionState | null;
  batchProgress: {
    round: number;
    isActive: boolean;
    totalSamples: number;
    completedSamples: number;
    sampleIds: string[];
    currentSampleIndex: number;
  } | null;
  iterationCompleted: boolean;
  iterationMessage: string;
  onVoteSubmission: (sampleId: string, label: string) => Promise<void>; // Legacy single vote (converted to batch internally)
  onBatchVoteSubmission: (sampleIds: string[], labels: string[]) => Promise<void>; // New batch voting method
  onAcknowledgeCompletion: () => void;
}

export interface ConfigurationPanelProps extends BasePanelProps {
  // Additional props specific to configuration panel if needed
}

export interface ControlPanelProps extends BasePanelProps {
  onStartNextIteration: () => Promise<void>;
  onEndProject: () => Promise<void>;
}

export interface ModelUpdatesPanelProps extends BasePanelProps {
  modelUpdates: ModelUpdate[];
}

export interface UserDashboardPanelProps extends BasePanelProps {
  userContributions: UserContribution[];
}

export interface VotingHistoryPanelProps extends BasePanelProps {
  votingHistory: VotingRecord[];
  projectAddress?: string; // Project contract address for fetching blockchain data
} 