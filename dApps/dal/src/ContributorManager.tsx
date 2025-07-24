import React, { useState, useEffect, useCallback } from 'react';
import { orchestrationAPI } from './OrchestrationAPI';

interface Contributor {
  wallet: string;
  name?: string;
  email?: string;
  status: 'invited' | 'accepted' | 'active' | 'inactive';
  invitedAt: string;
  acceptedAt?: string;
  lastActivity?: string;
  samplesAssigned: number;
  labelsSubmitted: number;
  accuracyScore: number;
}

interface Invitation {
  id: string;
  projectId: string;
  contributorWallet: string;
  contributorEmail?: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
  message?: string;
}

interface ContributorManagerProps {
  projectId: string;
  userWallet: string;
  userRole: 'coordinator' | 'contributor' | 'observer';
  projectData: any;
  onContributorsChange?: (contributors: Contributor[]) => void;
}

export const ContributorManager: React.FC<ContributorManagerProps> = ({
  projectId,
  userWallet,
  userRole,
  projectData,
  onContributorsChange
}) => {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteWallet, setNewInviteWallet] = useState('');
  const [newInviteMessage, setNewInviteMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing contributors from project data
  useEffect(() => {
    if (projectData?.participants) {
      const existingContributors: Contributor[] = projectData.participants.map((p: any) => ({
        wallet: p.address || p.wallet,
        name: p.name,
        email: p.email,
        status: 'active',
        invitedAt: p.joinedAt || new Date().toISOString(),
        acceptedAt: p.joinedAt || new Date().toISOString(),
        samplesAssigned: 0,
        labelsSubmitted: 0,
        accuracyScore: 0
      }));
      setContributors(existingContributors);
    }
  }, [projectData]);

  // Load invitations and contributor stats from orchestration server
  const loadContributorData = useCallback(async () => {
    if (userRole !== 'coordinator') return;

    try {
      setLoading(true);
      
      // Get session stats to update contributor performance
      const sessionStats = await orchestrationAPI.getMultiUserSessionStats(projectId, userWallet, projectData);
      
      if (sessionStats.contributors) {
        setContributors(prev => prev.map(contributor => {
          const stats = sessionStats.contributors.find((c: any) => 
            c.wallet.toLowerCase() === contributor.wallet.toLowerCase()
          );
          
          if (stats) {
            return {
              ...contributor,
              samplesAssigned: stats.samples_assigned || 0,
              labelsSubmitted: stats.labels_submitted || 0,
              accuracyScore: stats.accuracy_score || 0,
              lastActivity: stats.last_submission,
              status: stats.status === 'active' ? 'active' : 'inactive'
            };
          }
          return contributor;
        }));
      }
    } catch (error) {
      console.warn('Failed to load contributor stats:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, userWallet, userRole, projectData]);

  useEffect(() => {
    loadContributorData();
  }, [loadContributorData]);

  // Send invitation
  const sendInvitation = useCallback(async () => {
    if (!newInviteWallet && !newInviteEmail) {
      setError('Please provide either a wallet address or email');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create invitation
      const invitation: Invitation = {
        id: `invite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        contributorWallet: newInviteWallet,
        contributorEmail: newInviteEmail,
        invitedBy: userWallet,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        message: newInviteMessage
      };

      // Store invitation locally (in real implementation, send to server)
      const storedInvitations = JSON.parse(localStorage.getItem('dvre-dal-invitations') || '[]');
      storedInvitations.push(invitation);
      localStorage.setItem('dvre-dal-invitations', JSON.stringify(storedInvitations));

      setInvitations(prev => [...prev, invitation]);

      // Add as pending contributor
      const newContributor: Contributor = {
        wallet: newInviteWallet || 'pending',
        email: newInviteEmail,
        status: 'invited',
        invitedAt: new Date().toISOString(),
        samplesAssigned: 0,
        labelsSubmitted: 0,
        accuracyScore: 0
      };

      setContributors(prev => [...prev, newContributor]);

      // Clear form
      setNewInviteEmail('');
      setNewInviteWallet('');
      setNewInviteMessage('');
      setShowInviteModal(false);

      // Notify parent component
      if (onContributorsChange) {
        onContributorsChange([...contributors, newContributor]);
      }

      // TODO: In real implementation, call orchestration server to send invitation
      // await orchestrationAPI.sendContributorInvitation(invitation);

    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [newInviteWallet, newInviteEmail, newInviteMessage, projectId, userWallet, contributors, onContributorsChange]);

  // Remove contributor
  const removeContributor = useCallback(async (contributorWallet: string) => {
    if (userRole !== 'coordinator') return;

    try {
      setLoading(true);
      
      // Remove from local state
      setContributors(prev => prev.filter(c => c.wallet !== contributorWallet));

      // TODO: Call orchestration server to remove contributor from project
      // await orchestrationAPI.removeContributor(projectId, contributorWallet, userWallet, projectData);

      // Notify parent component
      if (onContributorsChange) {
        onContributorsChange(contributors.filter(c => c.wallet !== contributorWallet));
      }

    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [userRole, projectId, userWallet, projectData, contributors, onContributorsChange]);

  if (userRole === 'observer') {
    return null; // Observers cannot see contributor management
  }

  return (
    <div className="contributor-manager">
      <div className="contributor-header">
        <h3>Project Contributors</h3>
        {userRole === 'coordinator' && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="invite-button"
            disabled={loading}
          >
            Invite Contributor
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="contributors-list">
        {contributors.length === 0 ? (
          <div className="empty-state">
            <p>No contributors yet</p>
            {userRole === 'coordinator' && (
              <p>Invite contributors to start collaborative Active Learning</p>
            )}
          </div>
        ) : (
          contributors.map((contributor, index) => (
            <div key={contributor.wallet || index} className="contributor-item">
              <div className="contributor-info">
                <div className="contributor-identity">
                  <strong>{contributor.name || contributor.email || 'Anonymous'}</strong>
                  <span className={`status-badge ${contributor.status}`}>
                    {contributor.status}
                  </span>
                </div>
                <div className="contributor-details">
                  <div>Wallet: {contributor.wallet === 'pending' ? 'Pending acceptance' : `${contributor.wallet.slice(0, 6)}...${contributor.wallet.slice(-4)}`}</div>
                  {contributor.email && <div>Email: {contributor.email}</div>}
                  <div>Invited: {new Date(contributor.invitedAt).toLocaleDateString()}</div>
                  {contributor.lastActivity && (
                    <div>Last Activity: {new Date(contributor.lastActivity).toLocaleDateString()}</div>
                  )}
                </div>
              </div>

              <div className="contributor-stats">
                <div className="stat">
                  <span className="stat-value">{contributor.samplesAssigned}</span>
                  <span className="stat-label">Samples Assigned</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{contributor.labelsSubmitted}</span>
                  <span className="stat-label">Labels Submitted</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{(contributor.accuracyScore * 100).toFixed(1)}%</span>
                  <span className="stat-label">Accuracy</span>
                </div>
              </div>

              {userRole === 'coordinator' && contributor.status !== 'invited' && (
                <div className="contributor-actions">
                  <button
                    onClick={() => removeContributor(contributor.wallet)}
                    className="remove-button"
                    disabled={loading}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Invitation Modal */}
      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Invite Contributor</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="close-button"
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label htmlFor="invite-email">Email Address (optional):</label>
                <input
                  id="invite-email"
                  type="email"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                  placeholder="contributor@example.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="invite-wallet">Wallet Address (optional):</label>
                <input
                  id="invite-wallet"
                  type="text"
                  value={newInviteWallet}
                  onChange={(e) => setNewInviteWallet(e.target.value)}
                  placeholder="0x..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="invite-message">Invitation Message (optional):</label>
                <textarea
                  id="invite-message"
                  value={newInviteMessage}
                  onChange={(e) => setNewInviteMessage(e.target.value)}
                  placeholder="Join our Active Learning project..."
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowInviteModal(false)}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={sendInvitation}
                className="send-button"
                disabled={loading || (!newInviteEmail && !newInviteWallet)}
              >
                {loading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 