import React from 'react';
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
interface ContributorManagerProps {
    projectId: string;
    userWallet: string;
    userRole: 'coordinator' | 'contributor' | 'observer';
    projectData: any;
    onContributorsChange?: (contributors: Contributor[]) => void;
}
export declare const ContributorManager: React.FC<ContributorManagerProps>;
export {};
