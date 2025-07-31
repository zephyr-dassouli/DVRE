import React, { useState, useEffect } from 'react';
import { LabelingPanelProps } from './PanelTypes';

interface VotingStatus {
  userHasVoted: boolean;
  votedCount: number;
  totalVoters: number;
  allVoted: boolean;
  isCheckingStatus: boolean;
}

interface ProjectEndStatus {
  hasEnded: boolean;
  reason: string;
  trigger: string;
  endTime: Date | null;
  isCheckingEnd: boolean;
}

export const LabelingPanel: React.FC<LabelingPanelProps> = ({
  project,
  currentUser,
  isCoordinator,
  sessionState,
  batchProgress,
  iterationCompleted,
  iterationMessage,
  onVoteSubmission,
  onBatchVoteSubmission,
  onAcknowledgeCompletion,
  onError
}) => {

  // State for batch voting
  const [activeBatch, setActiveBatch] = useState<{
    sampleIds: string[];
    sampleData: any[];
    labelOptions: string[];
    timeRemaining: number;
    round: number;
    batchSize: number;
  } | null>(null);
  
  const [batchVotes, setBatchVotes] = useState<{ [sampleId: string]: string }>({});
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  
  // NEW: State for tracking voting status after submission
  const [votingStatus, setVotingStatus] = useState<VotingStatus>({
    userHasVoted: false,
    votedCount: 0,
    totalVoters: 0,
    allVoted: false,
    isCheckingStatus: false
  });

  // NEW: State for tracking project end status
  const [projectEndStatus, setProjectEndStatus] = useState<ProjectEndStatus>({
    hasEnded: false,
    reason: '',
    trigger: '',
    endTime: null,
    isCheckingEnd: false
  });

  // Load active batch when session state changes
  useEffect(() => {
    const loadActiveBatch = async () => {
      try {
        const dalSession = (window as any).currentDALSession;
        if (dalSession && sessionState?.phase === 'voting') {
          console.log('🔍 Loading active batch for labeling...');
          const batch = await dalSession.getActiveBatch();
          if (batch) {
            console.log('✅ Found active batch:', batch);
            setActiveBatch(batch);
            setBatchVotes({});
            
            // Reset voting status when new batch is loaded
            setVotingStatus({
              userHasVoted: false,
              votedCount: 0,
              totalVoters: 0,
              allVoted: false,
              isCheckingStatus: false
            });
            
            // Check if user has already voted in this batch
            await checkCurrentVotingStatus(batch);
          } else {
            console.log('ℹ️ No active batch found');
            setActiveBatch(null);
          }
        }
      } catch (error) {
        console.error('❌ Failed to load active batch:', error);
        setActiveBatch(null);
      }
    };

    if (sessionState) {
      loadActiveBatch();
    }
    
    // Set a retry timeout for cases where batch is slow to appear
    const retryTimeout = setTimeout(() => {
      if (sessionState?.phase === 'voting' && !activeBatch) {
        loadActiveBatch();
      }
    }, 2000);

    
    return () => clearTimeout(retryTimeout);
  }, [sessionState]);
  
  // Additional effect to poll for active batches when component first mounts
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    // If we don't have an active batch initially, poll for it
    if (!activeBatch) {
      console.log('🔍 Starting polling for active voting sessions...');
      
      pollInterval = setInterval(async () => {
        try {
          const dalSession = (window as any).currentDALSession;
          if (dalSession) {
            const batch = await dalSession.getActiveBatch();
            if (batch) {
              console.log('✅ Found active batch during polling:', batch);
              setActiveBatch(batch);
              setBatchVotes({});
              
              // Reset voting status and check current status
              setVotingStatus({
                userHasVoted: false,
                votedCount: 0,
                totalVoters: 0,
                allVoted: false,
                isCheckingStatus: false
              });
              await checkCurrentVotingStatus(batch);
              
              clearInterval(pollInterval); // Stop polling once we find an active batch
            }
          }
        } catch (error) {
          console.error('Error during active batch polling:', error);
        }
      }, 2000); // Poll every 2 seconds
      
      // Stop polling after 30 seconds to avoid infinite polling
      const stopPollingTimeout = setTimeout(() => {
        console.log('⏰ Stopping active batch polling after timeout');
        clearInterval(pollInterval);
      }, 30000);
      
      return () => {
        clearInterval(pollInterval);
        clearTimeout(stopPollingTimeout);
      };
    }
  }, [activeBatch]); // Include activeBatch in dependencies

  // NEW: Periodic polling for voting status updates when user has voted
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    // Only poll if user has voted but not all voters have voted yet
    if (votingStatus.userHasVoted && !votingStatus.allVoted && !votingStatus.isCheckingStatus) {
      console.log('🔄 Starting voting status polling...');
      
      pollInterval = setInterval(() => {
        console.log('📊 Polling for voting status updates...');
        checkCurrentVotingStatus();
      }, 5000); // Poll every 5 seconds
      
      // Stop polling after 5 minutes to prevent infinite polling
      const stopPollingTimeout = setTimeout(() => {
        console.log('⏰ Stopping voting status polling after timeout');
        clearInterval(pollInterval);
      }, 300000); // 5 minutes
      
      return () => {
        clearInterval(pollInterval);
        clearTimeout(stopPollingTimeout);
      };
    }
  }, [votingStatus.userHasVoted, votingStatus.allVoted, votingStatus.isCheckingStatus]);

  // NEW: Polling for new iterations when all voters have voted (waiting for next iteration)
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    // Poll for new iterations when all voters have voted
    if (votingStatus.allVoted && !iterationCompleted) {
      console.log('🔄 All voters have voted - starting polling for new iteration...');
      
      pollInterval = setInterval(async () => {
        console.log('📊 Polling for new iteration...');
        try {
          const dalSession = (window as any).currentDALSession;
          if (dalSession) {
            // Check if a new batch has started
            const newBatch = await dalSession.getActiveBatch();
            if (newBatch && (!activeBatch || newBatch.round > activeBatch.round)) {
              console.log('🎉 New iteration detected! Loading new batch:', newBatch);
              setActiveBatch(newBatch);
              setBatchVotes({});
              
              // Reset voting status for new iteration
              setVotingStatus({
                userHasVoted: false,
                votedCount: 0,
                totalVoters: 0,
                allVoted: false,
                isCheckingStatus: false
              });
              
              await checkCurrentVotingStatus(newBatch);
              clearInterval(pollInterval); // Stop polling once new iteration is found
            }
          }
        } catch (error) {
          console.error('Error polling for new iteration:', error);
        }
      }, 3000); // Poll every 3 seconds for new iterations
      
      // Stop polling after 10 minutes to prevent infinite polling
      const stopPollingTimeout = setTimeout(() => {
        console.log('⏰ Stopping new iteration polling after timeout');
        clearInterval(pollInterval);
      }, 600000); // 10 minutes
      
      return () => {
        clearInterval(pollInterval);
        clearTimeout(stopPollingTimeout);
      };
    }
  }, [votingStatus.allVoted, iterationCompleted, activeBatch]);

  // NEW: Listen for DAL session events for immediate reactivity
  useEffect(() => {
    const dalSession = (window as any).currentDALSession;
    if (!dalSession) return;

    // Event handler for when new iterations start
    const handleIterationStarted = (iteration: number) => {
      console.log(`🚀 DAL Session: Iteration ${iteration} started - refreshing labeling panel`);
      // Small delay to let the session state update
      setTimeout(async () => {
        try {
          const newBatch = await dalSession.getActiveBatch();
          if (newBatch) {
            console.log('✅ New batch found after iteration started:', newBatch);
            setActiveBatch(newBatch);
            setBatchVotes({});
            
            // Reset voting status for new iteration
            setVotingStatus({
              userHasVoted: false,
              votedCount: 0,
              totalVoters: 0,
              allVoted: false,
              isCheckingStatus: false
            });
            
            await checkCurrentVotingStatus(newBatch);
          }
        } catch (error) {
          console.error('Error loading batch after iteration started:', error);
        }
      }, 1000);
    };

    // Event handler for when samples are generated
    const handleSamplesGenerated = (samples: any[]) => {
      console.log(`🌸 DAL Session: ${samples.length} samples generated - refreshing labeling panel`);
      // Small delay to let the voting session start
      setTimeout(async () => {
        try {
          const newBatch = await dalSession.getActiveBatch();
          if (newBatch) {
            console.log('✅ New batch found after samples generated:', newBatch);
            setActiveBatch(newBatch);
            setBatchVotes({});
            
            // Reset voting status for new iteration
            setVotingStatus({
              userHasVoted: false,
              votedCount: 0,
              totalVoters: 0,
              allVoted: false,
              isCheckingStatus: false
            });
            
            await checkCurrentVotingStatus(newBatch);
          }
        } catch (error) {
          console.error('Error loading batch after samples generated:', error);
        }
      }, 1500);
    };

    // Event handler for session state changes
    const handleSessionStateChanged = (newState: any) => {
      console.log('🔄 DAL Session state changed:', newState.phase);
      
      // If session goes from completed/aggregating back to voting, load new batch
      if (newState.phase === 'voting' && sessionState?.phase !== 'voting') {
        console.log('📋 Session phase changed to voting - loading new batch');
        setTimeout(async () => {
          try {
            const newBatch = await dalSession.getActiveBatch();
            if (newBatch) {
              console.log('✅ New batch found after state change to voting:', newBatch);
              setActiveBatch(newBatch);
              setBatchVotes({});
              
              // Reset voting status for new iteration
              setVotingStatus({
                userHasVoted: false,
                votedCount: 0,
                totalVoters: 0,
                allVoted: false,
                isCheckingStatus: false
              });
              
              await checkCurrentVotingStatus(newBatch);
            }
          } catch (error) {
            console.error('Error loading batch after state change:', error);
          }
        }, 500);
      }
    };

    // Add event listeners
    dalSession.on('iteration-started', handleIterationStarted);
    dalSession.on('samples-generated', handleSamplesGenerated);
    dalSession.on('state-changed', handleSessionStateChanged);

    // Cleanup function
    return () => {
      dalSession.off('iteration-started', handleIterationStarted);
      dalSession.off('samples-generated', handleSamplesGenerated);
      dalSession.off('state-changed', handleSessionStateChanged);
    };
  }, [sessionState?.phase]);

  // NEW: Polling for project end status  
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    // Poll for project end status every 10 seconds
    if (!projectEndStatus.hasEnded && project?.contractAddress) {
      console.log('🔄 Starting project end status polling...');
      
      pollInterval = setInterval(async () => {
        await checkProjectEndStatus();
      }, 10000); // Poll every 10 seconds
      
      // Stop polling after 2 hours to prevent infinite polling
      const stopPollingTimeout = setTimeout(() => {
        console.log('⏰ Stopping project end status polling after timeout');
        clearInterval(pollInterval);
      }, 7200000); // 2 hours
      
      return () => {
        clearInterval(pollInterval);
        clearTimeout(stopPollingTimeout);
      };
    }
  }, [projectEndStatus.hasEnded, project?.contractAddress]);

  // NEW: Listen for global project end events
  useEffect(() => {
    if (!project?.contractAddress) return;

    // Event handler for project end events
    const handleProjectEndTriggered = (event: any) => {
      const { projectAddress, trigger, reason, timestamp } = event.detail || {};
      
      // Only handle events for this specific project
      if (projectAddress === project.contractAddress) {
        console.log(`🚨 Project end detected for ${projectAddress}:`, { trigger, reason });
        
        setProjectEndStatus({
          hasEnded: true,
          reason: reason || 'Project ended',
          trigger: trigger || 'system',
          endTime: new Date(timestamp ? timestamp * 1000 : Date.now()),
          isCheckingEnd: false
        });
        
        // Clear active batch and voting status when project ends
        setActiveBatch(null);
        setBatchVotes({});
        setVotingStatus({
          userHasVoted: false,
          votedCount: 0,
          totalVoters: 0,
          allVoted: false,
          isCheckingStatus: false
        });
      }
    };

    const handleProjectEnded = (event: any) => {
      const { projectAddress } = event.detail || {};
      
      // Only handle events for this specific project
      if (projectAddress === project.contractAddress) {
        console.log(`🏁 Project cleanup triggered for ${projectAddress}`);
        
        setProjectEndStatus(prev => ({
          ...prev,
          hasEnded: true,
          reason: prev.reason || 'Project ended',
          trigger: prev.trigger || 'coordinator',
          endTime: prev.endTime || new Date(),
          isCheckingEnd: false
        }));
      }
    };

    // Listen for project end events
    window.addEventListener('dal-project-end-triggered', handleProjectEndTriggered);
    window.addEventListener('dal-project-ended', handleProjectEnded);

    // Cleanup function
    return () => {
      window.removeEventListener('dal-project-end-triggered', handleProjectEndTriggered);
      window.removeEventListener('dal-project-ended', handleProjectEnded);
    };
  }, [project?.contractAddress]);

  // NEW: Listen for DAL session project end events
  useEffect(() => {
    const dalSession = (window as any).currentDALSession;
    if (!dalSession) return;

    const handleSessionProjectShouldEnd = (details: any) => {
      console.log('🚨 DAL Session: Project should end:', details);
      
      setProjectEndStatus({
        hasEnded: true,
        reason: details.reason || 'Project ended',
        trigger: details.trigger || 'system',
        endTime: new Date(details.timestamp || Date.now()),
        isCheckingEnd: false
      });
      
      // Clear active batch and voting status
      setActiveBatch(null);
      setBatchVotes({});
      setVotingStatus({
        userHasVoted: false,
        votedCount: 0,
        totalVoters: 0,
        allVoted: false,
        isCheckingStatus: false
      });
    };

    const handleSessionEnded = () => {
      console.log('🏁 DAL Session ended');
      
      setProjectEndStatus(prev => ({
        ...prev,
        hasEnded: true,
        reason: prev.reason || 'Session ended',
        endTime: prev.endTime || new Date()
      }));
    };

    // Add DAL session event listeners
    dalSession.on('project-should-end', handleSessionProjectShouldEnd);
    dalSession.on('session-ended', handleSessionEnded);

    // Cleanup function
    return () => {
      dalSession.off('project-should-end', handleSessionProjectShouldEnd);
      dalSession.off('session-ended', handleSessionEnded);
    };
  }, [project?.contractAddress]);

  // NEW: Function to check project end status via smart contracts
  const checkProjectEndStatus = async () => {
    if (!project?.contractAddress || projectEndStatus.hasEnded) return;
    
    try {
      setProjectEndStatus(prev => ({ ...prev, isCheckingEnd: true }));
      
      // Import ALContractService dynamically
      const { ALContractService } = await import('../services/ALContractService');
      const alContractService = ALContractService.getInstance();
      
      // Check project end status from smart contract
      const endStatus = await alContractService.getProjectEndStatus(project.contractAddress);
      
      if (endStatus.shouldEnd) {
        console.log(`🚨 Project should end detected via polling:`, endStatus);
        
        setProjectEndStatus({
          hasEnded: true,
          reason: endStatus.reason || 'Project ended',
          trigger: 'polling',
          endTime: new Date(),
          isCheckingEnd: false
        });
        
        // Clear active batch and voting status
        setActiveBatch(null);
        setBatchVotes({});
        setVotingStatus({
          userHasVoted: false,
          votedCount: 0,
          totalVoters: 0,
          allVoted: false,
          isCheckingStatus: false
        });
      } else {
        setProjectEndStatus(prev => ({ ...prev, isCheckingEnd: false }));
      }
    } catch (error) {
      console.error('❌ Failed to check project end status:', error);
      setProjectEndStatus(prev => ({ ...prev, isCheckingEnd: false }));
    }
  };

  // NEW: Function to check current voting status
  const checkCurrentVotingStatus = async (batch: any = activeBatch) => {
    if (!batch || !project?.contractAddress) return;
    
    try {
      setVotingStatus(prev => ({ ...prev, isCheckingStatus: true }));
      
      // Import voting service dynamically
      const { VotingService } = await import('../services/VotingService');
      const votingService = new VotingService();
      
      // Check voting status for the first sample (since it's batch voting, all samples have the same participation)
      const sampleId = batch.sampleIds[0];
      const sessionStatus = await votingService.getVotingSessionStatus(project.contractAddress, sampleId);
      
      if (sessionStatus) {
        const allVoted = sessionStatus.votedCount >= sessionStatus.totalVoters;
        const currentUserAddress = currentUser ? String(currentUser).toLowerCase() : '';
        
        // Check if current user has voted by checking the votes for this sample
        const votes = await votingService.getVotesForSample(project.contractAddress, sampleId);
        const userHasVoted = votes.some((vote: any) => 
          vote.voter.toLowerCase() === currentUserAddress
        );
        
        setVotingStatus({
          userHasVoted,
          votedCount: sessionStatus.votedCount,
          totalVoters: sessionStatus.totalVoters,
          allVoted,
          isCheckingStatus: false
        });
        
        console.log(`📊 Voting status: ${sessionStatus.votedCount}/${sessionStatus.totalVoters} voted, user voted: ${userHasVoted}, all voted: ${allVoted}`);
      }
    } catch (error) {
      console.error('❌ Failed to check voting status:', error);
      setVotingStatus(prev => ({ ...prev, isCheckingStatus: false }));
    }
  };

  const handleBatchVoteChange = (sampleId: string, label: string) => {
    setBatchVotes(prev => ({
      ...prev,
      [sampleId]: label
    }));
  };

  const handleBatchSubmit = async () => {
    if (!activeBatch || !onBatchVoteSubmission) return;
    
    // Validate all samples have votes
    const missingVotes = activeBatch.sampleIds.filter(id => !batchVotes[id]);
    if (missingVotes.length > 0) {
      onError?.(`Please vote on all samples. Missing votes: ${missingVotes.join(', ')}`);
      return;
    }
    
    setIsSubmittingBatch(true);
    try {
      // Convert batchVotes object to arrays expected by the interface
      const sampleIds = activeBatch.sampleIds;
      const labels = sampleIds.map(id => batchVotes[id]);
      
      await onBatchVoteSubmission(sampleIds, labels);
      setBatchVotes({});
      
      // NEW: After successful vote submission, check voting status
      console.log('✅ Vote submitted successfully, checking voting status...');
      setTimeout(() => {
        checkCurrentVotingStatus();
      }, 1000); // Small delay to allow blockchain to update
      
    } catch (error) {
      console.error('Failed to submit batch votes:', error);
      onError?.('Failed to submit batch votes');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Helper function to render sample data in a readable format
  const renderSampleData = (sampleData: any) => {
    if (!sampleData) return <p>No sample data available</p>;
    
    if (typeof sampleData === 'string') {
      try {
        const parsed = JSON.parse(sampleData);
        return (
          <div className="sample-data">
            <pre style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '12px', 
              borderRadius: '4px',
              fontSize: '14px',
              whiteSpace: 'pre-wrap' 
            }}>
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </div>
        );
      } catch {
        return (
          <div className="sample-data">
            <p style={{ fontFamily: 'monospace' }}>{sampleData}</p>
          </div>
        );
      }
    }
    
    if (typeof sampleData === 'object') {
      return (
        <div className="sample-data">
          <pre style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '12px', 
            borderRadius: '4px',
            fontSize: '14px',
            whiteSpace: 'pre-wrap' 
          }}>
            {JSON.stringify(sampleData, null, 2)}
          </pre>
        </div>
      );
    }
    
    return <p>{String(sampleData)}</p>;
  };

  // Helper function to render label buttons
  const renderLabelButtons = (labelOptions: string[], sampleId: string) => {
    return (
      <div className="label-buttons" style={{ 
        display: 'flex', 
        gap: '12px', 
        flexWrap: 'wrap',
        marginBottom: '16px' 
      }}>
        {labelOptions.map((label) => (
          <button
            key={label}
            className={`label-button ${batchVotes[sampleId] === label ? 'selected' : ''}`}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: batchVotes[sampleId] === label ? '#3b82f6' : '#6366f1',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              minWidth: '80px',
              opacity: batchVotes[sampleId] === label ? 1 : 0.8,
              transform: batchVotes[sampleId] === label ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleBatchVoteChange(sampleId, label)}
            onMouseOver={(e) => {
              if (batchVotes[sampleId] !== label) {
                (e.target as HTMLButtonElement).style.transform = 'scale(1.05)';
                (e.target as HTMLButtonElement).style.opacity = '1';
              }
            }}
            onMouseOut={(e) => {
              if (batchVotes[sampleId] !== label) {
                (e.target as HTMLButtonElement).style.transform = 'scale(1)';
                (e.target as HTMLButtonElement).style.opacity = '0.8';
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="labeling-panel">
      <div className="panel-header">
        <h3>Sample Labeling</h3>
        <div className="iteration-info">
          {/* FIXED: Use synchronized round from batchProgress when available */}
          {batchProgress?.round ? (
            <div>
              AL Iteration Round: {batchProgress.round}
              <div className="batch-progress">
                {batchProgress.totalSamples === 1 
                  ? `Sample Status: ${batchProgress.completedSamples > 0 ? 'Completed' : 'In Progress'}`
                  : `Batch Progress: ${batchProgress.completedSamples}/${batchProgress.totalSamples} samples completed`
                }
              </div>
            </div>
          ) : (
            <div>
              AL Iteration Round: {project.currentRound || 'Not Set'}
              {batchProgress && (
                <div className="batch-progress">
                  {batchProgress.totalSamples === 1 
                    ? `Sample Status: ${batchProgress.completedSamples > 0 ? 'Completed' : 'In Progress'}`
                    : `Batch Progress: ${batchProgress.completedSamples}/${batchProgress.totalSamples} samples completed`
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Show iteration completion message */}
      {iterationCompleted && (
        <div className="iteration-completed">
          <div className="completion-message">
            <h4>✅ {iterationMessage}</h4>
            {isCoordinator ? (
              <p>You may start the next iteration or end the project in the Control Panel.</p>
            ) : (
              <p>Wait for the project Coordinator to start a new round.</p>
            )}
            <button 
              onClick={onAcknowledgeCompletion}
              style={{ 
                marginTop: '10px', 
                padding: '8px 16px', 
                backgroundColor: '#10b981', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
      
      {/* NEW: Show project ended status (highest priority) */}
      {projectEndStatus.hasEnded && (
        <div className="project-ended-message" style={{
          backgroundColor: '#fee2e2',
          border: '2px solid #dc2626',
          borderRadius: '8px',
          padding: '30px',
          margin: '20px 0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🏁</div>
          <h3 style={{ color: '#dc2626', marginBottom: '16px' }}>
            Project Has Ended
          </h3>
          <div style={{ marginBottom: '16px', fontSize: '16px', lineHeight: '1.6' }}>
            <p><strong>Reason:</strong> {projectEndStatus.reason}</p>
            {projectEndStatus.endTime && (
              <p><strong>Ended at:</strong> {projectEndStatus.endTime.toLocaleString()}</p>
            )}
            {projectEndStatus.trigger === 'coordinator' && (
              <p><strong>Ended by:</strong> Project Coordinator</p>
            )}
            {projectEndStatus.trigger === 'system' && (
              <p><strong>Ended by:</strong> System (Max iterations reached)</p>
            )}
          </div>
          <div style={{ 
            backgroundColor: '#f9fafb', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px',
            padding: '16px',
            marginTop: '20px',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            <h4 style={{ marginBottom: '12px', color: '#374151' }}>What happens now?</h4>
            <ul style={{ textAlign: 'left', margin: 0, paddingLeft: '20px' }}>
              <li>All voting sessions have been finalized</li>
              <li>Final results can be viewed in the "Publish Final Results" tab</li>
              <li>The model performance and labeled dataset are available</li>
              <li>No more iterations can be started</li>
            </ul>
          </div>
          {isCoordinator && (
            <div style={{
              marginTop: '20px',
              padding: '12px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #3b82f6',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              <strong>As coordinator:</strong> You can publish final results and download the labeled dataset in the "Publish Final Results" tab.
            </div>
          )}
        </div>
      )}
      
      {/* NEW: Show voting status after user has voted (only if project hasn't ended) */}
      {!projectEndStatus.hasEnded && activeBatch && votingStatus.userHasVoted && !iterationCompleted && (
        <div className="voting-status-message" style={{
          backgroundColor: '#f0f9ff',
          border: '2px solid #3b82f6',
          borderRadius: '8px',
          padding: '20px',
          margin: '20px 0',
          textAlign: 'center'
        }}>
          {votingStatus.isCheckingStatus ? (
            <div>
              <h4>🔄 Checking voting status...</h4>
              <p>Please wait while we verify the current voting progress.</p>
            </div>
          ) : votingStatus.allVoted ? (
            <div>
              <h4>⏳ Waiting for next iteration</h4>
              <p>All participants have submitted their votes ({votingStatus.votedCount}/{votingStatus.totalVoters}).</p>
              <p>The system is processing the results and preparing the next round.</p>
              {isCoordinator && (
                <p><strong>As coordinator, you can start the next iteration in the Control Panel.</strong></p>
              )}
            </div>
          ) : (
            <div>
              <h4>⏳ Waiting for other participants</h4>
              <p>You have successfully submitted your votes. Thank you!</p>
              <p>Waiting for other participants to submit their votes...</p>
              <p>Progress: {votingStatus.votedCount}/{votingStatus.totalVoters} participants have voted</p>
              {votingStatus.totalVoters - votingStatus.votedCount === 1 ? (
                <p><strong>Just waiting for 1 more participant!</strong></p>
              ) : (
                <p><strong>Waiting for {votingStatus.totalVoters - votingStatus.votedCount} more participants.</strong></p>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Batch voting in progress */}
      {!projectEndStatus.hasEnded && activeBatch && !votingStatus.userHasVoted && !iterationCompleted && (
        <div className="batch-voting">
          <div className="batch-header">
            <h4>
              Batch Voting - Round {activeBatch.round || project.currentRound}
            </h4>
            {activeBatch.batchSize > 1 && (
              <div className="progress-bar" style={{ 
                width: '100%', 
                height: '8px', 
                backgroundColor: '#e5e7eb', 
                borderRadius: '4px', 
                marginTop: '8px' 
              }}>
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${(activeBatch.batchSize / activeBatch.batchSize) * 100}%`,
                    height: '100%',
                    backgroundColor: '#10b981',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }}
                ></div>
              </div>
            )}
            <div className="progress-text" style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
              {activeBatch.batchSize === 1 
                ? `Sample voting in progress`
                : `Batch voting in progress`
              }
            </div>
          </div>
          
          {activeBatch.sampleIds.map((sampleId, index) => (
            <div key={sampleId} className="sample-display" style={{ 
              border: '1px solid #d1d5db', 
              borderRadius: '8px', 
              padding: '20px', 
              marginBottom: '20px',
              backgroundColor: '#f9fafb'
            }}>
              <h4 style={{ marginBottom: '16px' }}>Sample {index + 1}: {sampleId}</h4>
              {renderSampleData(activeBatch.sampleData[index])}
              <div className="voting-interface" style={{ marginTop: '20px' }}>
                <h4 style={{ marginBottom: '16px' }}>🏷️ Select Classification</h4>
                {renderLabelButtons(activeBatch.labelOptions, sampleId)}
              </div>
              <div className="live-voting" style={{ 
                border: '1px solid #d1d5db', 
                borderRadius: '8px', 
                padding: '16px',
                backgroundColor: '#f8fafc'
              }}>
                <h4 style={{ marginBottom: '12px' }}>📊 Live Voting Distribution</h4>
                <div className="vote-distribution" style={{ 
                  display: 'flex', 
                  gap: '16px', 
                  marginBottom: '12px' 
                }}>
                  {Object.entries(project.activeVoting?.currentVotes || {}).map(([label, count]) => (
                    <div key={label} className="vote-item" style={{
                      padding: '8px 12px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}>
                      <span className="vote-label" style={{ fontWeight: 'bold' }}>{label}:</span>
                      <span className="vote-count" style={{ marginLeft: '4px' }}>{count as number}</span>
                    </div>
                  ))}
                </div>
                <div className="time-remaining" style={{ fontSize: '14px', color: '#666' }}>
                  ⏱️ Time remaining: {Math.floor((project.activeVoting?.timeRemaining || 0) / 60)}m {(project.activeVoting?.timeRemaining || 0) % 60}s
                </div>
              </div>
            </div>
          ))}

          <div className="submit-batch-vote" style={{ marginTop: '20px' }}>
            <button 
              onClick={handleBatchSubmit}
              disabled={isSubmittingBatch}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#4f46e5', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#4f46e5';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              {isSubmittingBatch ? 'Submitting...' : 'Submit Batch Vote'}
            </button>
          </div>
        </div>
      )}
      
      {/* No active batch (only show if project hasn't ended) */}
      {!projectEndStatus.hasEnded && !activeBatch && !iterationCompleted && (
        <div className="no-active-voting" style={{ 
          textAlign: 'center', 
          padding: '60px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>⏳</div>
          <h4 style={{ marginBottom: '16px' }}>No Active Voting</h4>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Waiting for the next AL iteration to begin...
          </p>
          {isCoordinator && (
            <p style={{ color: '#3b82f6', fontStyle: 'italic' }}>
              <em>As coordinator, you can start the next iteration from the Control Panel.</em>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LabelingPanel; 