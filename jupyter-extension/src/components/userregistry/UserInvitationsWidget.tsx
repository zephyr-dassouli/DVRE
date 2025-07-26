import React, { useState, useEffect } from 'react';
import { useUserRegistry, InvitationInfo } from '../../hooks/useUserRegistry';
import { useAuth } from '../../hooks/useAuth';

export const UserInvitationsWidget: React.FC = () => {
  const { userInvitations, loading, error, loadUserInvitations, acceptInvitation, rejectInvitation } = useUserRegistry();
  const { account } = useAuth();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      loadUserInvitations();
    }
  }, [account, loadUserInvitations]);

  const handleAcceptInvitation = async (projectAddress: string) => {
    setActionLoading(projectAddress);
    try {
      const success = await acceptInvitation(projectAddress);
      if (success) {
        // Refresh invitations
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
    setActionLoading(projectAddress);
    try {
      const success = await rejectInvitation(projectAddress);
      if (success) {
        // Refresh invitations
        await loadUserInvitations();
        alert('Invitation rejected.');
      }
    } catch (err) {
      console.error('Failed to reject invitation:', err);
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
        Please connect your wallet to view your invitations.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: 'var(--jp-ui-font-color2)'
      }}>
        Loading invitations...
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
        <button
          onClick={() => loadUserInvitations()}
          style={{
            padding: '6px 12px',
            background: 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

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
          My Project Invitations
        </h2>
        <button
          onClick={() => loadUserInvitations()}
          disabled={loading}
          style={{
            padding: '6px 12px',
            background: 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          Refresh
        </button>
      </div>

      {/* Invitations list */}
      <div style={{
        flex: 1,
        overflow: 'auto'
      }}>
        {userInvitations.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--jp-ui-font-color2)',
            padding: '40px 20px'
          }}>
            <div>No pending invitations</div>
            <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
              Project owners can invite you to collaborate on their projects
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '12px'
          }}>
            {userInvitations.map((invitation) => (
              <InvitationCard
                key={invitation.projectAddress}
                invitation={invitation}
                onAccept={() => handleAcceptInvitation(invitation.projectAddress)}
                onReject={() => handleRejectInvitation(invitation.projectAddress)}
                loading={actionLoading === invitation.projectAddress}
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
        <div>
          <h3 style={{
            margin: '0 0 4px 0',
            color: 'var(--jp-ui-font-color1)',
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            {invitation.projectName}
          </h3>
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
            padding: '6px 12px',
            background: 'var(--jp-layout-color2)',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '4px',
            color: 'var(--jp-ui-font-color1)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            opacity: loading ? 0.6 : 1
          }}
        >
          Decline
        </button>
        <button
          onClick={onAccept}
          disabled={loading}
          style={{
            padding: '6px 12px',
            background: loading ? 'var(--jp-ui-font-color3)' : 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          {loading ? 'Processing...' : 'Accept'}
        </button>
      </div>
    </div>
  );
};
