import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { orchestrationAPI } from './OrchestrationAPI';
export const ContributorManager = ({ projectId, userWallet, userRole, projectData, onContributorsChange }) => {
    const [contributors, setContributors] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [newInviteEmail, setNewInviteEmail] = useState('');
    const [newInviteWallet, setNewInviteWallet] = useState('');
    const [newInviteMessage, setNewInviteMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Load existing contributors from project data
    useEffect(() => {
        if (projectData === null || projectData === void 0 ? void 0 : projectData.participants) {
            const existingContributors = projectData.participants.map((p) => ({
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
        if (userRole !== 'coordinator')
            return;
        try {
            setLoading(true);
            // Get session stats to update contributor performance
            const sessionStats = await orchestrationAPI.getMultiUserSessionStats(projectId, userWallet, projectData);
            if (sessionStats.contributors) {
                setContributors(prev => prev.map(contributor => {
                    const stats = sessionStats.contributors.find((c) => c.wallet.toLowerCase() === contributor.wallet.toLowerCase());
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
        }
        catch (error) {
            console.warn('Failed to load contributor stats:', error);
        }
        finally {
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
            const invitation = {
                id: `invite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                projectId,
                contributorWallet: newInviteWallet,
                contributorEmail: newInviteEmail,
                invitedBy: userWallet,
                status: 'pending',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                message: newInviteMessage
            };
            // Store invitation locally (in real implementation, send to server)
            const storedInvitations = JSON.parse(localStorage.getItem('dvre-dal-invitations') || '[]');
            storedInvitations.push(invitation);
            localStorage.setItem('dvre-dal-invitations', JSON.stringify(storedInvitations));
            setInvitations(prev => [...prev, invitation]);
            // Add as pending contributor
            const newContributor = {
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
        }
        catch (error) {
            setError(error.message);
        }
        finally {
            setLoading(false);
        }
    }, [newInviteWallet, newInviteEmail, newInviteMessage, projectId, userWallet, contributors, onContributorsChange]);
    // Remove contributor
    const removeContributor = useCallback(async (contributorWallet) => {
        if (userRole !== 'coordinator')
            return;
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
        }
        catch (error) {
            setError(error.message);
        }
        finally {
            setLoading(false);
        }
    }, [userRole, projectId, userWallet, projectData, contributors, onContributorsChange]);
    if (userRole === 'observer') {
        return null; // Observers cannot see contributor management
    }
    return (_jsxs("div", { className: "contributor-manager", children: [_jsxs("div", { className: "contributor-header", children: [_jsx("h3", { children: "Project Contributors" }), userRole === 'coordinator' && (_jsx("button", { onClick: () => setShowInviteModal(true), className: "invite-button", disabled: loading, children: "Invite Contributor" }))] }), error && (_jsxs("div", { className: "error-message", children: [error, _jsx("button", { onClick: () => setError(null), children: "\u00D7" })] })), _jsx("div", { className: "contributors-list", children: contributors.length === 0 ? (_jsxs("div", { className: "empty-state", children: [_jsx("p", { children: "No contributors yet" }), userRole === 'coordinator' && (_jsx("p", { children: "Invite contributors to start collaborative Active Learning" }))] })) : (contributors.map((contributor, index) => (_jsxs("div", { className: "contributor-item", children: [_jsxs("div", { className: "contributor-info", children: [_jsxs("div", { className: "contributor-identity", children: [_jsx("strong", { children: contributor.name || contributor.email || 'Anonymous' }), _jsx("span", { className: `status-badge ${contributor.status}`, children: contributor.status })] }), _jsxs("div", { className: "contributor-details", children: [_jsxs("div", { children: ["Wallet: ", contributor.wallet === 'pending' ? 'Pending acceptance' : `${contributor.wallet.slice(0, 6)}...${contributor.wallet.slice(-4)}`] }), contributor.email && _jsxs("div", { children: ["Email: ", contributor.email] }), _jsxs("div", { children: ["Invited: ", new Date(contributor.invitedAt).toLocaleDateString()] }), contributor.lastActivity && (_jsxs("div", { children: ["Last Activity: ", new Date(contributor.lastActivity).toLocaleDateString()] }))] })] }), _jsxs("div", { className: "contributor-stats", children: [_jsxs("div", { className: "stat", children: [_jsx("span", { className: "stat-value", children: contributor.samplesAssigned }), _jsx("span", { className: "stat-label", children: "Samples Assigned" })] }), _jsxs("div", { className: "stat", children: [_jsx("span", { className: "stat-value", children: contributor.labelsSubmitted }), _jsx("span", { className: "stat-label", children: "Labels Submitted" })] }), _jsxs("div", { className: "stat", children: [_jsxs("span", { className: "stat-value", children: [(contributor.accuracyScore * 100).toFixed(1), "%"] }), _jsx("span", { className: "stat-label", children: "Accuracy" })] })] }), userRole === 'coordinator' && contributor.status !== 'invited' && (_jsx("div", { className: "contributor-actions", children: _jsx("button", { onClick: () => removeContributor(contributor.wallet), className: "remove-button", disabled: loading, children: "Remove" }) }))] }, contributor.wallet || index)))) }), showInviteModal && (_jsx("div", { className: "modal-overlay", children: _jsxs("div", { className: "modal", children: [_jsxs("div", { className: "modal-header", children: [_jsx("h3", { children: "Invite Contributor" }), _jsx("button", { onClick: () => setShowInviteModal(false), className: "close-button", children: "\u00D7" })] }), _jsxs("div", { className: "modal-content", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "invite-email", children: "Email Address (optional):" }), _jsx("input", { id: "invite-email", type: "email", value: newInviteEmail, onChange: (e) => setNewInviteEmail(e.target.value), placeholder: "contributor@example.com" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "invite-wallet", children: "Wallet Address (optional):" }), _jsx("input", { id: "invite-wallet", type: "text", value: newInviteWallet, onChange: (e) => setNewInviteWallet(e.target.value), placeholder: "0x..." })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "invite-message", children: "Invitation Message (optional):" }), _jsx("textarea", { id: "invite-message", value: newInviteMessage, onChange: (e) => setNewInviteMessage(e.target.value), placeholder: "Join our Active Learning project...", rows: 3 })] })] }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { onClick: () => setShowInviteModal(false), className: "cancel-button", children: "Cancel" }), _jsx("button", { onClick: sendInvitation, className: "send-button", disabled: loading || (!newInviteEmail && !newInviteWallet), children: loading ? 'Sending...' : 'Send Invitation' })] })] }) }))] }));
};
//# sourceMappingURL=ContributorManager.js.map