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
  onVoteSubmission: (sampleId: string, label: string) => Promise<void>;
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
} 