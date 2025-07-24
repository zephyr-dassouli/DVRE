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
    projectData: any;
    isMember: boolean;
    isOwner: boolean;
    hasPendingRequest: boolean;
    memberCount: number;
}
export declare const useDVREAuth: () => {
    account: string;
    isConnected: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    isLoading: boolean;
    error: string;
};
export declare const useFactoryRegistry: () => {
    loading: boolean;
    error: string;
    getFactoryAddress: (factoryName: string) => Promise<string | null>;
    getFactoryContract: (factoryName: string, abi: any[], signer?: any) => Promise<any | null>;
    clearError: () => void;
};
export declare const useDVREProjects: () => {
    projects: ProjectInfo[];
    userProjects: ProjectInfo[];
    loading: boolean;
    error: string;
    loadProjects: () => Promise<void>;
    getProjectInfo: (projectAddress: string) => Promise<ProjectInfo | null>;
    clearError: () => void;
};
export declare const useActiveLearningProjects: (account: string | null) => {
    projects: ProjectInfo[];
    loading: boolean;
    error: string;
    loadProjects: () => Promise<void>;
};
