import React, { useState, useEffect } from 'react';
import {
  DALProjectPageProps,
  ModelUpdate,
  VotingRecord,
  UserContribution
} from './types';
import { useDALProject } from '../../hooks/useDALProject';
import { useAuth } from '../../hooks/useAuth';

/**
 * DAL Project Page Component
 * Implements the complete project page with all panels from the design document
 */
export const DALProjectPage: React.FC<DALProjectPageProps> = ({ project, onBack }) => {
  const [activeTab, setActiveTab] = useState<string>('labeling');
  const [modelUpdates, setModelUpdates] = useState<ModelUpdate[]>([]);
  const [votingHistory, setVotingHistory] = useState<VotingRecord[]>([]);
  const [userContributions, setUserContributions] = useState<UserContribution[]>([]);

  // Use the real hooks
  const { startNextIteration, endProject, submitVote } = useDALProject(project.contractAddress);
  const { account } = useAuth();

  // Mock current user - in real implementation, this would come from useAuth
  const isCoordinator = project.userRole === 'coordinator';
  const currentUser = account || '0x742d35Cc6434C532532';

  // Load project data
  useEffect(() => {
    loadProjectData();
  }, [project.id]);

  const loadProjectData = async () => {
    // Mock model updates
    const mockModelUpdates: ModelUpdate[] = [
      {
        iterationNumber: 3,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        performance: { accuracy: 0.87, precision: 0.85, recall: 0.89, f1Score: 0.87 },
        samplesAddedCount: 15,
        notes: 'Added 15 new X-ray samples from recent voting round'
      },
      {
        iterationNumber: 2,
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        performance: { accuracy: 0.82, precision: 0.80, recall: 0.84, f1Score: 0.82 },
        samplesAddedCount: 12,
        notes: 'Model performance improved after adding ambiguous samples'
      },
      {
        iterationNumber: 1,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        performance: { accuracy: 0.75, precision: 0.73, recall: 0.77, f1Score: 0.75 },
        samplesAddedCount: 10,
        notes: 'Initial model training with seed dataset'
      }
    ];

    // Mock voting history
    const mockVotingHistory: VotingRecord[] = [];
    for (let i = 0; i < 20; i++) {
      mockVotingHistory.push({
        sampleId: `sample_${i + 1}`,
        sampleData: { 
          text: `Medical image sample ${i + 1}`,
          features: [Math.random(), Math.random(), Math.random()]
        },
        finalLabel: Math.random() > 0.6 ? 'COVID-19' : Math.random() > 0.5 ? 'Normal' : 'Other Pneumonia',
        votes: {
          '0x123coordinator': Math.random() > 0.5 ? 'COVID-19' : 'Normal',
          '0x456contributor1': Math.random() > 0.5 ? 'COVID-19' : 'Normal',
          '0x789contributor2': Math.random() > 0.5 ? 'COVID-19' : 'Normal'
        },
        votingDistribution: Math.random() > 0.7 ? 
          { 'COVID-19': 3, 'Normal': 0, 'Other Pneumonia': 0 } :
          { 'COVID-19': 2, 'Normal': 1, 'Other Pneumonia': 0 },
        timestamp: new Date(Date.now() - i * 2 * 60 * 60 * 1000),
        iterationNumber: Math.floor(i / 7) + 1,
        consensusReached: Math.random() > 0.2
      });
    }

    // Mock user contributions
    const mockUserContributions: UserContribution[] = [
      {
        address: '0x123coordinator',
        role: 'coordinator',
        votesCount: 25,
        joinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 30 * 60 * 1000),
        reputation: 95
      },
      {
        address: '0x456contributor1',
        role: 'contributor',
        votesCount: 18,
        joinedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
        reputation: 87
      },
      {
        address: '0x789contributor2',
        role: 'contributor',
        votesCount: 12,
        joinedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 4 * 60 * 60 * 1000),
        reputation: 78
      }
    ];

    setModelUpdates(mockModelUpdates);
    setVotingHistory(mockVotingHistory);
    setUserContributions(mockUserContributions);
  };

  const handleStartNextIteration = async () => {
    try {
      await startNextIteration(project.contractAddress);
      console.log('Next iteration started successfully');
    } catch (error) {
      console.error('Failed to start next iteration:', error);
    }
  };

  const handleEndProject = async () => {
    try {
      await endProject(project.contractAddress);
      console.log('Project ended successfully');
    } catch (error) {
      console.error('Failed to end project:', error);
    }
  };

  const handleSubmitVote = async (label: string) => {
    if (!project.activeVoting) return;
    
    try {
      await submitVote(project.contractAddress, project.activeVoting.sampleId, label);
      console.log(`Vote submitted successfully: ${label}`);
    } catch (error) {
      console.error('Failed to submit vote:', error);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  return (
    <div className="dal-project-page">
      {/* Header */}
      <div className="project-header">
        <div className="header-top">
          <button className="back-button" onClick={onBack}>
            ← Back to Projects
          </button>
          <div className="project-status">
            <span className={`status-indicator ${project.status}`}></span>
            {project.status.toUpperCase()}
          </div>
        </div>
        <h1>{project.name}</h1>
        <div className="project-meta">
          <span>Round {project.currentRound} of {project.totalRounds}</span>
          <span>•</span>
          <span>{project.participants} participants</span>
          <span>•</span>
          <span>Last updated: {formatTimeAgo(project.lastUpdated)}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="project-tabs">
        <button 
          className={`tab ${activeTab === 'labeling' ? 'active' : ''}`}
          onClick={() => setActiveTab('labeling')}
        >
          Labeling
        </button>
        <button 
          className={`tab ${activeTab === 'configuration' ? 'active' : ''}`}
          onClick={() => setActiveTab('configuration')}
        >
          Configuration
        </button>
        {isCoordinator && (
          <button 
            className={`tab ${activeTab === 'control' ? 'active' : ''}`}
            onClick={() => setActiveTab('control')}
          >
            Control Panel
          </button>
        )}
        {isCoordinator && (
          <button 
            className={`tab ${activeTab === 'model-updates' ? 'active' : ''}`}
            onClick={() => setActiveTab('model-updates')}
          >
            Model Updates
          </button>
        )}
        <button 
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Dashboard
        </button>
        <button 
          className={`tab ${activeTab === 'voting-history' ? 'active' : ''}`}
          onClick={() => setActiveTab('voting-history')}
        >
          Voting History
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Labeling Panel */}
        {activeTab === 'labeling' && (
          <div className="labeling-panel">
            <div className="panel-header">
              <h3>Sample Labeling</h3>
              <div className="iteration-info">
                AL Iteration Round: {project.currentRound}
              </div>
            </div>
            
            {project.activeVoting ? (
              <div className="active-voting">
                <div className="sample-display">
                  <h4>Current Sample</h4>
                  <div className="sample-content">
                    <pre>{JSON.stringify(project.activeVoting.sampleData, null, 2)}</pre>
                  </div>
                </div>
                
                <div className="voting-interface">
                  <h4>Select Label</h4>
                  <div className="label-options">
                    {project.activeVoting.labelOptions.map(label => (
                      <button
                        key={label}
                        className="label-button"
                        onClick={() => handleSubmitVote(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="live-voting">
                  <h4>Live Voting Distribution</h4>
                  <div className="vote-distribution">
                    {Object.entries(project.activeVoting.currentVotes).map(([label, count]) => (
                      <div key={label} className="vote-item">
                        <span className="vote-label">{label}:</span>
                        <span className="vote-count">{count as number}</span>
                      </div>
                    ))}
                  </div>
                  <div className="time-remaining">
                    Time remaining: {Math.floor(project.activeVoting.timeRemaining / 60)}m {project.activeVoting.timeRemaining % 60}s
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-active-voting">
                <h4>No Active Voting</h4>
                <p>Waiting for the next AL iteration to begin...</p>
                {isCoordinator && (
                  <p><em>As coordinator, you can start the next iteration from the Control Panel.</em></p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Project Configuration Panel */}
        {activeTab === 'configuration' && project.alConfiguration && (
          <div className="configuration-panel">
            <div className="panel-header">
              <h3>Project Configuration</h3>
            </div>
            <div className="config-grid">
              <div className="config-item">
                <label>AL Scenario:</label>
                <span>{project.alConfiguration.scenario}</span>
              </div>
              <div className="config-item">
                <label>Query Strategy:</label>
                <span>{project.alConfiguration.queryStrategy}</span>
              </div>
              <div className="config-item">
                <label>Model:</label>
                <span>{project.alConfiguration.model.type}</span>
              </div>
              <div className="config-item">
                <label>Query Batch Size:</label>
                <span>{project.alConfiguration.queryBatchSize}</span>
              </div>
              <div className="config-item">
                <label>Max Iteration Rounds:</label>
                <span>{project.alConfiguration.maxIterations}</span>
              </div>
              <div className="config-item">
                <label>Voting Consensus:</label>
                <span>{project.alConfiguration.votingConsensus}</span>
              </div>
              <div className="config-item">
                <label>Voting Timeout:</label>
                <span>{project.alConfiguration.votingTimeout}s</span>
              </div>
              <div className="config-item">
                <label>Label Space:</label>
                <span>{project.alConfiguration.labelSpace.join(', ')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Control Panel (Coordinator Only) */}
        {activeTab === 'control' && isCoordinator && (
          <div className="control-panel">
            <div className="panel-header">
              <h3>Control Panel</h3>
              <p>Coordinator controls for project management</p>
            </div>
            <div className="control-actions">
              <div className="action-card">
                <h4>Start Next Iteration</h4>
                <p>Trigger a new Active Learning round. This sends a signal to the smart contract and orchestrator.</p>
                <button 
                  className="primary-btn"
                  onClick={handleStartNextIteration}
                  disabled={!project.isActive}
                >
                  Start Next Iteration
                </button>
              </div>
              <div className="action-card">
                <h4>End Project</h4>
                <p>Manually end the project. This will deactivate the project and trigger final results collection.</p>
                <button 
                  className="danger-btn"
                  onClick={handleEndProject}
                  disabled={!project.isActive}
                >
                  End Project
                </button>
              </div>
            </div>
            <div className="project-status-summary">
              <h4>Project Status</h4>
              <div className="status-grid">
                <div className="status-item">
                  <label>Current Status:</label>
                  <span className={`status-value ${project.status}`}>{project.status}</span>
                </div>
                <div className="status-item">
                  <label>Active:</label>
                  <span className={`status-value ${project.isActive ? 'active' : 'inactive'}`}>
                    {project.isActive ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="status-item">
                  <label>Progress:</label>
                  <span className="status-value">
                    {Math.round((project.currentRound / project.totalRounds) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Model Updates Panel (Coordinator Only) */}
        {activeTab === 'model-updates' && isCoordinator && (
          <div className="model-updates-panel">
            <div className="panel-header">
              <h3>Model Updates History</h3>
              <p>Performance statistics for each iteration (latest on top)</p>
            </div>
            <div className="updates-list">
              {modelUpdates.map(update => (
                <div key={update.iterationNumber} className="update-card">
                  <div className="update-header">
                    <h4>Iteration {update.iterationNumber}</h4>
                    <span className="update-time">{formatTimeAgo(update.timestamp)}</span>
                  </div>
                  <div className="performance-metrics">
                    <div className="metric">
                      <label>Accuracy:</label>
                      <span>{(update.performance.accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div className="metric">
                      <label>Precision:</label>
                      <span>{(update.performance.precision * 100).toFixed(1)}%</span>
                    </div>
                    <div className="metric">
                      <label>Recall:</label>
                      <span>{(update.performance.recall * 100).toFixed(1)}%</span>
                    </div>
                    <div className="metric">
                      <label>F1-Score:</label>
                      <span>{(update.performance.f1Score * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="update-details">
                    <div className="samples-added">
                      Samples added: {update.samplesAddedCount}
                    </div>
                    {update.notes && (
                      <div className="update-notes">
                        {update.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Dashboard Panel */}
        {activeTab === 'users' && (
          <div className="users-panel">
            <div className="panel-header">
              <h3>User Dashboard</h3>
              <p>All users, their roles, and contribution statistics</p>
            </div>
            <div className="users-table">
              <div className="table-header">
                <div className="col-address">Address</div>
                <div className="col-role">Role</div>
                <div className="col-votes">Votes</div>
                <div className="col-joined">Joined</div>
                <div className="col-activity">Last Activity</div>
                <div className="col-reputation">Reputation</div>
              </div>
              {userContributions.map(user => (
                <div key={user.address} className="table-row">
                  <div className="col-address">
                    <span className="address">{formatAddress(user.address)}</span>
                    {user.address === currentUser && <span className="you-badge">YOU</span>}
                  </div>
                  <div className="col-role">
                    <span className={`role-badge ${user.role}`}>{user.role.toUpperCase()}</span>
                  </div>
                  <div className="col-votes">{user.votesCount}</div>
                  <div className="col-joined">{formatTimeAgo(user.joinedAt)}</div>
                  <div className="col-activity">{formatTimeAgo(user.lastActivity)}</div>
                  <div className="col-reputation">
                    <span className="reputation-score">{user.reputation}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voting History Panel */}
        {activeTab === 'voting-history' && (
          <div className="voting-history-panel">
            <div className="panel-header">
              <h3>Voting History</h3>
              <p>All samples with their voting statistics and final labels</p>
            </div>
            <div className="history-list">
              {votingHistory.map(record => (
                <div key={record.sampleId} className="history-item">
                  <div className="item-header">
                    <div className="sample-info">
                      <h4>{record.sampleId}</h4>
                      <span className="iteration-badge">Iteration {record.iterationNumber}</span>
                    </div>
                    <div className="final-result">
                      <span className="final-label">Final: {record.finalLabel}</span>
                      <span className={`consensus-badge ${record.consensusReached ? 'reached' : 'no-consensus'}`}>
                        {record.consensusReached ? 'Consensus' : 'No Consensus'}
                      </span>
                    </div>
                  </div>
                  <div className="voting-details">
                    <div className="voter-breakdown">
                      <h5>Votes Cast:</h5>
                      {Object.entries(record.votes).map(([voter, vote]) => (
                        <div key={voter} className="vote-entry">
                          <span className="voter">{formatAddress(voter)}:</span>
                          <span className="vote">{vote}</span>
                        </div>
                      ))}
                    </div>
                    <div className="distribution">
                      <h5>Distribution:</h5>
                      {Object.entries(record.votingDistribution).map(([label, count]) => (
                        <span key={label} className="dist-item">
                          {label}: {count as number}
                        </span>
                      ))}
                    </div>
                    <div className="timestamp">
                      {formatTimeAgo(record.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DALProjectPage; 