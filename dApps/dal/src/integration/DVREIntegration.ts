// DVRE Integration Layer for DAL Extension
// This replicates DVRE's exact hook patterns for project loading

import { useState, useEffect, useCallback } from 'react';

// Import contract ABIs (copied from main DVRE extension)
import ProjectFactory from '../abis/ProjectFactory.json';
import JSONProject from '../abis/JSONProject.json';
import FactoryRegistry from '../abis/FactoryRegistry.json';

// Configuration matching main DVRE extension
const FACTORY_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000001000";
const RPC_URL = 'http://145.100.135.27:8550';

// Types matching DVRE's project structure exactly
export interface ProjectMember {
  address: string;
  role: string;
  name?: string;
}

export interface JoinRequest {
  requester: string;
  role: string;
  timestamp: number;
}

export interface ProjectInfo {
  address: string;
  projectId: string;
  objective: string;
  description?: string;
  creator: string;
  isActive: boolean;
  created: number;
  lastModified: number;
  participants: ProjectMember[];
  joinRequests: JoinRequest[];
  projectData: any; // Full parsed JSON
  // UI helpers
  isMember: boolean;
  isOwner: boolean;
  hasPendingRequest: boolean;
  memberCount: number;
}

// Hook to replicate useAuth functionality
export const useDVREAuth = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('DAL: Initializing auth...');
    
    const checkAuth = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setAccount(accounts[0]);
            console.log('DAL: Connected via MetaMask:', accounts[0]);
          }
        }
      } catch (err: any) {
        console.error('DAL: Auth check failed:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for account changes
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('DAL: Account changed:', accounts);
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
        }
      };

      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  const connect = async () => {
    try {
      setError(null);
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0]);
        }
      }
    } catch (err: any) {
      console.error('DAL: Connect failed:', err);
      setError(err.message);
    }
  };

  const disconnect = () => {
    setAccount(null);
  };

  return { 
    account, 
    isConnected: !!account, 
    connect, 
    disconnect, 
    isLoading, 
    error 
  };
};

// Hook to replicate useFactoryRegistry functionality
export const useFactoryRegistry = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get a single factory address by name (exactly like DVRE)
  const getFactoryAddress = useCallback(async (factoryName: string): Promise<string | null> => {
    if (!factoryName) {
      setError("Factory name is required");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const registryContract = new ethers.Contract(FACTORY_REGISTRY_ADDRESS, FactoryRegistry.abi, provider);

      const address = await registryContract.get(factoryName);
      
      // Check if address is zero address (not found)
      if (address === "0x0000000000000000000000000000000000000000") {
        setError(`Factory "${factoryName}" not found in registry`);
        return null;
      }

      setLoading(false);
      return address;
    } catch (err: any) {
      setError(`Failed to get factory address: ${err.message}`);
      setLoading(false);
      return null;
    }
  }, []);

  // Convenience method to get factory contract instance (exactly like DVRE)
  const getFactoryContract = useCallback(async (factoryName: string, abi: any[], signer?: any): Promise<any | null> => {
    const address = await getFactoryAddress(factoryName);
    if (!address) return null;

    const { ethers } = await import('ethers');
    const provider = signer || new ethers.JsonRpcProvider(RPC_URL);
    return new ethers.Contract(address, abi, provider);
  }, [getFactoryAddress]);

  return {
    loading,
    error,
    getFactoryAddress,
    getFactoryContract,
    clearError: () => setError(null)
  };
};

// Hook to replicate useProjects functionality
export const useDVREProjects = () => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [userProjects, setUserProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getFactoryContract } = useFactoryRegistry();
  const { account } = useDVREAuth();

  const getProvider = () => {
    const { ethers } = require('ethers');
    return new ethers.JsonRpcProvider(RPC_URL);
  };

  // Get detailed project information (exactly like DVRE's implementation)
  const getProjectInfo = useCallback(async (projectAddress: string): Promise<ProjectInfo | null> => {
    try {
      const provider = getProvider();
      const { ethers } = await import('ethers');
      const projectContract = new ethers.Contract(projectAddress, JSONProject.abi, provider);

      // First, validate that this is a valid contract by checking if it has code
      const code = await provider.getCode(projectAddress);
      if (code === '0x') {
        console.warn(`DAL: No contract code at address ${projectAddress}`);
        return null;
      }

      // Try to call a simple read function first to validate the contract
      try {
        await projectContract.creator();
      } catch (err) {
        console.warn(`DAL: Address ${projectAddress} is not a valid JSONProject contract:`, err);
        return null;
      }

      const projectDataString = await projectContract.getProjectData();
      let projectData;
      
      try {
        projectData = JSON.parse(projectDataString);
      } catch (parseErr) {
        console.error(`DAL: Invalid JSON in project ${projectAddress}:`, parseErr);
        return null;
      }
      
      // Get project status (returns: active, created, modified, creator)
      const projectStatus = await projectContract.getProjectStatus();
      const projectInfo = {
        creator: projectStatus.projectCreator,
        isActive: projectStatus.active,
        created: Number(projectStatus.created),
        lastModified: Number(projectStatus.modified)
      };

      // Extract participants from project data (address and role)
      const participants: ProjectMember[] = [];
      if (projectData.participants && Array.isArray(projectData.participants)) {
        participants.push(...projectData.participants);
      }

      // Get join requests from contract
      const joinRequests: JoinRequest[] = [];
      try {
        const requesters = await projectContract.getAllRequesters();
        for (const requester of requesters) {
          const request = await projectContract.getJoinRequest(requester);
          if (request.exists) {
            joinRequests.push({
              requester: request.requester,
              role: request.role,
              timestamp: Number(request.timestamp)
            });
          }
        }
      } catch (err) {
        console.warn('DAL: Failed to get join requests:', err);
      }

      // Find the user's membership (might be owner or regular member)
      const userParticipant = participants.find(p => p.address.toLowerCase() === account?.toLowerCase());
      const isOwner = projectInfo.creator.toLowerCase() === account?.toLowerCase();
      const isMember = !!userParticipant || isOwner;
      const hasPendingRequest = joinRequests.some(r => r.requester.toLowerCase() === account?.toLowerCase());

      // Count of participants in the project
      const memberCount = participants.length;

      return {
        address: projectAddress,
        projectId: projectData.project_id || projectData.projectId || 'Unknown',
        objective: projectData.objective || 'No objective specified',
        description: projectData.description,
        creator: projectInfo.creator,
        isActive: projectInfo.isActive,
        created: Number(projectInfo.created),
        lastModified: Number(projectInfo.lastModified),
        participants,
        joinRequests,
        projectData,
        isMember,
        isOwner,
        hasPendingRequest,
        memberCount
      };
    } catch (err) {
      console.error(`DAL: Failed to get project info for ${projectAddress}:`, err);
      return null;
    }
  }, [account]);

  // Load all projects (exactly like DVRE's implementation)
  const loadProjects = useCallback(async () => {
    if (!account) return;
    
    setLoading(true);
    setError(null);

    try {
      const factoryContract = await getFactoryContract(
        "ProjectFactory",
        ProjectFactory.abi
      );

      if (!factoryContract) {
        throw new Error("ProjectFactory not found");
      }

      const projectAddresses = await factoryContract.getAllProjects();
      console.log(`DAL: Found ${projectAddresses.length} total projects`);
      
      const allProjects: ProjectInfo[] = [];

      for (let i = 0; i < projectAddresses.length; i++) {
        try {
          const projectInfo = await getProjectInfo(projectAddresses[i]);
          if (projectInfo) {
            allProjects.push(projectInfo);
          }
        } catch (err) {
          console.warn(`DAL: Failed to load project at address ${projectAddresses[i]}:`, err);
        }
      }

      // Separate user projects from all projects (exactly like DVRE)
      const userProjectsList = allProjects.filter(p => p.isMember || p.isOwner);
      const availableProjectsList = allProjects.filter(p => !p.isMember && !p.isOwner);

      setUserProjects(userProjectsList);
      setProjects(availableProjectsList);
      setLoading(false);
      
      console.log(`DAL: Successfully loaded ${userProjectsList.length} user projects out of ${allProjects.length} total`);
      
    } catch (err: any) {
      setError(`Failed to load projects: ${err.message}`);
      setLoading(false);
    }
  }, [account, getFactoryContract, getProjectInfo]);

  // Initialize data on mount (exactly like DVRE)
  useEffect(() => {
    if (account) {
      loadProjects();
    }
  }, [account, loadProjects]);

  return {
    // State
    projects,
    userProjects,
    loading,
    error,

    // Methods
    loadProjects,
    getProjectInfo,

    // Utility
    clearError: () => setError(null)
  };
};

// Filter projects to get only Active Learning projects
export const useActiveLearningProjects = (account: string | null) => {
  const { userProjects, loading, error, loadProjects } = useDVREProjects();
  
  // Use the same filtering approach as Federated Learning
  const alProjects = userProjects.filter(project => 
    project.projectData?.type === 'active_learning'
  );

  console.log('DAL: Total user projects:', userProjects.length, 'AL projects:', alProjects.length);
  if (userProjects.length > 0) {
    console.log('DAL: Project details:', userProjects.map(p => ({ 
      objective: p.objective, 
      type: p.projectData?.type,
      isMember: p.isMember,
      isOwner: p.isOwner
    })));
  }

  return {
    projects: alProjects,
    loading,
    error,
    loadProjects
  };
}; 