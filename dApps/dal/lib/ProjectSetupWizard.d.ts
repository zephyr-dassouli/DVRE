import React from 'react';
import { DALROCrate } from './DVREROCrateClient';
interface ProjectSetupWizardProps {
    projectId: string;
    projectData: any;
    userWallet: string;
    onComplete: (roCrate: DALROCrate) => void;
    onCancel: () => void;
}
export declare const ProjectSetupWizard: React.FC<ProjectSetupWizardProps>;
export {};
