import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useFactoryRegistry } from './useFactoryRegistry';
import { useAuth } from './useAuth';

import UserMetadataFactory from '../abis/UserMetadataFactory.json';
import JSONProject from '../abis/JSONProject.json';

export interface UserInfo {
  address: string;
  name: string;
  email: string;
  institution: string;
  projects: string[]; // Project addresses they're part of
}

export interface InvitationInfo {
  projectAddress: string;
  projectName: string;
  role: string;
  timestamp: number;
  inviter: string;
}

export const useUserRegistry = () => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [userInvitations, setUserInvitations] = useState<InvitationInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getFactoryContract } = useFactoryRegistry();
  const { account } = useAuth();

  const getSigner = async () => {
    if (!(window as any).ethereum) {
      throw new Error('MetaMask not found');
    }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    return await provider.getSigner();
  };

  // Load all registered users
  const loadAllUsers = useCallback(async () => {
    if (!account) return;
    
    setLoading(true);
    setError(null);

    try {
      const factoryContract = await getFactoryContract(
        "UserMetadataFactory",
        UserMetadataFactory.abi
      );

      if (!factoryContract) {
        throw new Error("UserMetadataFactory not found");
      }

      const userAddresses = await factoryContract.getAllUsers();
      const loadedUsers: UserInfo[] = [];

      for (const address of userAddresses) {
        try {
          const metadataJSON = await factoryContract.getUserMetadataJSON(address);
          const metadata = JSON.parse(metadataJSON);
          
          // Get projects this user is part of (simplified version)
          const projects: string[] = [];
          // TODO: Could implement project lookup by scanning all projects and checking participants
          
          loadedUsers.push({
            address,
            name: metadata.name,
            email: metadata.email,
            institution: metadata.institution,
            projects
          });
        } catch (err) {
          console.warn(`Failed to load metadata for user ${address}:`, err);
        }
      }

      setUsers(loadedUsers);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load users: ${err.message}`);
      setLoading(false);
    }
  }, [account, getFactoryContract]);

  // Load invitations for current user
  const loadUserInvitations = useCallback(async () => {
    if (!account) return;
    
    setLoading(true);
    setError(null);

    try {
      // This would require scanning all projects to find invitations
      // For now, return empty array - a more efficient implementation would
      // require event filtering or additional indexing
      setUserInvitations([]);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load invitations: ${err.message}`);
      setLoading(false);
    }
  }, [account]);

  // Send invitation to user for a project
  const sendInvitation = useCallback(async (
    projectAddress: string,
    userAddress: string,
    role: string
  ): Promise<boolean> => {
    if (!account) return false;

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(projectAddress, JSONProject.abi, signer);
      
      // Check if current user is project creator
      const creator = await projectContract.creator();
      if (creator.toLowerCase() !== account.toLowerCase()) {
        throw new Error('Only project creator can send invitations');
      }

      const tx = await projectContract.sendInvitation(userAddress, role);
      await tx.wait();

      console.log('Invitation sent successfully');
      return true;
    } catch (err: any) {
      console.error('Failed to send invitation:', err);
      setError(`Failed to send invitation: ${err.message}`);
      return false;
    }
  }, [account]);

  // Accept invitation
  const acceptInvitation = useCallback(async (projectAddress: string): Promise<boolean> => {
    if (!account) return false;

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(projectAddress, JSONProject.abi, signer);
      
      // Get invitation details first
      const invitation = await projectContract.getInvitation(account);
      if (!invitation.exists) {
        throw new Error('No invitation found');
      }

      // Accept the invitation
      const acceptTx = await projectContract.acceptInvitation();
      await acceptTx.wait();

      // Now we need to update the project data to add the user as participant
      // Get current project data
      const projectDataString = await projectContract.getProjectData();
      const projectData = JSON.parse(projectDataString);

      // Initialize participants array if it doesn't exist
      if (!projectData.participants) {
        projectData.participants = [];
      }

      // Add the user to participants
      projectData.participants.push({
        address: account,
        role: invitation.role
      });

      // Update project data
      const newProjectDataString = JSON.stringify(projectData);
      const updateTx = await projectContract.updateProjectData(newProjectDataString);
      await updateTx.wait();

      console.log('Invitation accepted successfully');
      return true;
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      setError(`Failed to accept invitation: ${err.message}`);
      return false;
    }
  }, [account]);

  // Reject invitation
  const rejectInvitation = useCallback(async (projectAddress: string): Promise<boolean> => {
    if (!account) return false;

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(projectAddress, JSONProject.abi, signer);
      
      const tx = await projectContract.rejectInvitation();
      await tx.wait();

      console.log('Invitation rejected successfully');
      return true;
    } catch (err: any) {
      console.error('Failed to reject invitation:', err);
      setError(`Failed to reject invitation: ${err.message}`);
      return false;
    }
  }, [account]);

  // Initialize data on mount
  useEffect(() => {
    if (account) {
      loadAllUsers();
      loadUserInvitations();
    }
  }, [account, loadAllUsers, loadUserInvitations]);

  return {
    // State
    users,
    userInvitations,
    loading,
    error,

    // Methods
    loadAllUsers,
    loadUserInvitations,
    sendInvitation,
    acceptInvitation,
    rejectInvitation,

    // Utility
    clearError: () => setError(null)
  };
};
