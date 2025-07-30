import React from 'react';
import { UserDashboardPanelProps } from './PanelTypes';

export const UserDashboardPanel: React.FC<UserDashboardPanelProps> = ({
  userContributions,
  currentUser
}) => {
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="users-panel">
      <div className="panel-header">
        <h3>User Dashboard</h3>
        <p>All users, their roles, and contribution statistics</p>
      </div>
      <div className="users-table">
        {userContributions.length > 0 ? (
          <>
            <div className="table-header" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 80px 100px 100px 100px',
              gap: '12px',
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '14px',
              color: '#374151',
              marginBottom: '8px'
            }}>
              <div>Address</div>
              <div>Role</div>
              <div>Votes</div>
              <div>Joined</div>
              <div>Last Activity</div>
              <div>Reputation</div>
            </div>
            {userContributions.map(user => (
              <div key={user.address} className="table-row" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 80px 100px 100px 100px',
                gap: '12px',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                marginBottom: '4px',
                backgroundColor: user.address === currentUser ? '#f0f9ff' : 'white'
              }}>
                <div className="col-address" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="address" style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                    {formatAddress(user.address)}
                  </span>
                  {user.address === currentUser && (
                    <span className="you-badge" style={{
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      YOU
                    </span>
                  )}
                </div>
                <div className="col-role">
                  <span className={`role-badge ${user.role}`} style={{
                    backgroundColor: user.role === 'coordinator' ? '#fef3c7' : '#e0e7ff',
                    color: user.role === 'coordinator' ? '#92400e' : '#3730a3',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {user.role.toUpperCase()}
                  </span>
                </div>
                <div className="col-votes" style={{ fontWeight: 'bold' }}>{user.votesCount}</div>
                <div className="col-joined" style={{ fontSize: '14px', color: '#666' }}>
                  {formatTimeAgo(user.joinedAt)}
                </div>
                <div className="col-activity" style={{ fontSize: '14px', color: '#666' }}>
                  {formatTimeAgo(user.lastActivity)}
                </div>
                <div className="col-reputation">
                  <span className="reputation-score" style={{
                    fontWeight: 'bold',
                    color: (user.reputation || 0) >= 80 ? '#166534' : (user.reputation || 0) >= 60 ? '#ca8a04' : '#dc2626'
                  }}>
                    {user.reputation || 0}%
                  </span>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              No User Activity Yet
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              This project was recently deployed. User contributions will appear here once voting activity begins.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboardPanel; 