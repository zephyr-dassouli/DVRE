import React, { useState, useEffect, useCallback } from 'react';
import { useUserRegistry, InvitationInfo } from '../../hooks/useUserRegistry';
import { useProjects, JoinRequest } from '../../hooks/useProjects';
import { useAuth } from '../../hooks/useAuth';

interface JoinRequestInfo extends JoinRequest {
  projectAddress: string;
  projectName: string;
}

interface UserInvitationsWidgetProps {
  onRefreshTrigger?: number; // Timestamp to trigger refresh from parent
}

export const UserInvitationsWidget: React.FC<UserInvitationsWidgetProps> = ({ onRefreshTrigger }) => {
  const { userInvitations, loading: invitationsLoading, error: invitationsError, loadUserInvitations, acceptInvitation, rejectInvitation } = useUserRegistry();
  const { userProjects, handleJoinRequest, loading: projectsLoading } = useProjects();
  const { account } = useAuth();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequestInfo[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);

  // Load join requests for user's projects
  const loadJoinRequests = async () => {
    if (!account || !userProjects.length) {
      setJoinRequests([]);
      return;
    }

    setJoinRequestsLoading(true);
    try {
      const allJoinRequests: JoinRequestInfo[] = [];
      
      for (const project of userProjects) {
        if (project.isOwner && project.joinRequests.length > 0) {
          for (const request of project.joinRequests) {
            allJoinRequests.push({
              ...request,
              projectAddress: project.address,
              projectName: project.objective || 'Unknown Project'
            });
          }
        }
      }
      
      setJoinRequests(allJoinRequests);
    } catch (err) {
      console.error('Failed to load join requests:', err);
    } finally {
      setJoinRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (account) {
      loadUserInvitations();
    }
  }, [account, loadUserInvitations]);

  useEffect(() => {
    if (account && userProjects.length > 0) {
      loadJoinRequests();
    }
  }, [account, userProjects]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadUserInvitations(),
      loadJoinRequests()
    ]);
  }, [loadUserInvitations]);

  // Listen for refresh triggers from parent component
  useEffect(() => {
    if (onRefreshTrigger && account && onRefreshTrigger > 0) {
      refreshAll();
    }
  }, [onRefreshTrigger, account, refreshAll]);

  const handleAcceptInvitation = async (projectAddress: string) => {
    setActionLoading(`invitation-${projectAddress}`);
    try {
      const success = await acceptInvitation(projectAddress);
      if (success) {
        await loadUserInvitations();
        alert('Invitation accepted successfully!');
      }
    } catch (err) {
      console.error('Failed to accept invitation:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectInvitation = async (projectAddress: string) => {
    setActionLoading(`invitation-${projectAddress}`);
    try {
      const success = await rejectInvitation(projectAddress);
      if (success) {
        await loadUserInvitations();
        alert('Invitation rejected.');
      }
    } catch (err) {
      console.error('Failed to reject invitation:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveJoinRequest = async (projectAddress: string, memberAddress: string) => {
    setActionLoading(`join-${projectAddress}-${memberAddress}`);
    try {
      const success = await handleJoinRequest(projectAddress, memberAddress, true);
      if (success) {
        await loadJoinRequests();
        alert('Join request approved successfully!');
      }
    } catch (err) {
      console.error('Failed to approve join request:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectJoinRequest = async (projectAddress: string, memberAddress: string) => {
    setActionLoading(`join-${projectAddress}-${memberAddress}`);
    try {
      const success = await handleJoinRequest(projectAddress, memberAddress, false);
      if (success) {
        await loadJoinRequests();
        alert('Join request rejected.');
      }
    } catch (err) {
      console.error('Failed to reject join request:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (!account) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: 'var(--jp-ui-font-color2)'
      }}>
        Please connect your wallet to view invitations and requests.
      </div>
    );
  }

  const loading = invitationsLoading || projectsLoading || joinRequestsLoading;
  const error = invitationsError;

  if (loading && userInvitations.length === 0 && joinRequests.length === 0) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: 'var(--jp-ui-font-color2)'
      }}>
        Loading invitations and requests...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        background: 'var(--jp-error-color3)',
        color: 'var(--jp-error-color1)',
        borderRadius: '4px',
        margin: '10px'
      }}>
        <div style={{ marginBottom: '10px' }}>Error: {error}</div>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          Use the main Refresh button to retry loading invitations and requests.
        </div>
      </div>
    );
  }

  const totalItems = userInvitations.length + joinRequests.length;

  return (
    <div style={{
      padding: '16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        borderBottom: '1px solid var(--jp-border-color1)',
        paddingBottom: '12px'
      }}>
        <h2 style={{
          margin: '0',
          color: 'var(--jp-ui-font-color1)',
          fontSize: '1.2rem'
        }}>
          Invitations and Join Requests
        </h2>
      </div>

      {/* Items list */}
      <div style={{
        flex: 1,
        overflow: 'auto'
      }}>
        {totalItems === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--jp-ui-font-color2)',
            padding: '40px 20px'
          }}>
            <div>No pending invitations or join requests</div>
            <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
              Project owners can invite you to collaborate, and users can request to join your projects
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '12px'
          }}>
            {/* User Invitations */}
            {userInvitations.map((invitation) => (
              <InvitationCard
                key={`invitation-${invitation.projectAddress}`}
                invitation={invitation}
                onAccept={() => handleAcceptInvitation(invitation.projectAddress)}
                onReject={() => handleRejectInvitation(invitation.projectAddress)}
                loading={actionLoading === `invitation-${invitation.projectAddress}`}
              />
            ))}

            {/* Join Requests for User's Projects */}
            {joinRequests.map((request) => (
              <JoinRequestCard
                key={`join-${request.projectAddress}-${request.requester}`}
                request={request}
                onApprove={() => handleApproveJoinRequest(request.projectAddress, request.requester)}
                onReject={() => handleRejectJoinRequest(request.projectAddress, request.requester)}
                loading={actionLoading === `join-${request.projectAddress}-${request.requester}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface InvitationCardProps {
  invitation: InvitationInfo;
  onAccept: () => void;
  onReject: () => void;
  loading: boolean;
}

const InvitationCard: React.FC<InvitationCardProps> = ({
  invitation,
  onAccept,
  onReject,
  loading
}) => {
  return (
    <div style={{
      background: 'var(--jp-layout-color1)',
      border: '1px solid var(--jp-border-color1)',
      borderRadius: '6px',
      padding: '16px',
      transition: 'border-color 0.2s ease'
    }}>
      {/* Invitation header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px'
          }}>
            <div style={{
              background: 'var(--jp-brand-color3, #dbeafe)',
              color: 'var(--jp-brand-color1, #2563eb)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: '500'
            }}>
              INVITATION
            </div>
            <h3 style={{
              margin: '0',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              {invitation.projectName}
            </h3>
          </div>
          <div style={{
            color: 'var(--jp-ui-font-color2)',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {invitation.projectAddress.slice(0, 10)}...{invitation.projectAddress.slice(-8)}
          </div>
        </div>
        <div style={{
          background: 'var(--jp-brand-color3)',
          color: 'var(--jp-brand-color1)',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          {invitation.role}
        </div>
      </div>

      {/* Invitation details */}
      <div style={{
        color: 'var(--jp-ui-font-color2)',
        fontSize: '13px',
        marginBottom: '16px'
      }}>
        <div>Invited by: {invitation.inviter.slice(0, 10)}...{invitation.inviter.slice(-8)}</div>
        <div>Date: {new Date(invitation.timestamp * 1000).toLocaleDateString()}</div>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={onReject}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: 'var(--jp-layout-color0)',
            color: 'var(--jp-ui-font-color1)',
            border: '1px solid var(--jp-border-color2)',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          Decline
        </button>
        <button
          onClick={onAccept}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: loading ? '#6b7280' : 'var(--jp-brand-color1, #2563eb)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Processing...' : 'Accept'}
        </button>
      </div>
    </div>
  );
};

interface JoinRequestCardProps {
  request: JoinRequestInfo;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
}

const JoinRequestCard: React.FC<JoinRequestCardProps> = ({
  request,
  onApprove,
  onReject,
  loading
}) => {
  return (
    <div style={{
      background: 'var(--jp-layout-color1)',
      border: '1px solid var(--jp-border-color1)',
      borderRadius: '6px',
      padding: '16px',
      transition: 'border-color 0.2s ease'
    }}>
      {/* Request header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px'
          }}>
            <div style={{
              background: 'var(--jp-brand-color3, #dbeafe)',
              color: 'var(--jp-brand-color1, #2563eb)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: '500'
            }}>
              JOIN REQUEST
            </div>
            <h3 style={{
              margin: '0',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              {request.projectName}
            </h3>
          </div>
          <div style={{
            color: 'var(--jp-ui-font-color2)',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {request.projectAddress.slice(0, 10)}...{request.projectAddress.slice(-8)}
          </div>
        </div>
        <div style={{
          background: 'var(--jp-warn-color3)',
          color: 'var(--jp-warn-color1)',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          {request.role}
        </div>
      </div>

      {/* Request details */}
      <div style={{
        color: 'var(--jp-ui-font-color2)',
        fontSize: '13px',
        marginBottom: '16px'
      }}>
        <div>Requested by: {request.requester.slice(0, 10)}...{request.requester.slice(-8)}</div>
        <div>Date: {new Date(request.timestamp * 1000).toLocaleDateString()}</div>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={onReject}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: 'var(--jp-layout-color0)',
            color: 'var(--jp-ui-font-color1)',
            border: '1px solid var(--jp-border-color2)',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: loading ? '#6b7280' : 'var(--jp-brand-color1, #2563eb)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Processing...' : 'Approve'}
        </button>
      </div>
    </div>
  );
};
