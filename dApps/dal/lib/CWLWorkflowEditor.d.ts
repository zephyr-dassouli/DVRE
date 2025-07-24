import React from 'react';
interface CWLWorkflowEditorProps {
    projectId: string;
    projectTitle: string;
    userWallet?: string;
    projectData?: any;
    onClose?: () => void;
    onWorkflowDeployed?: (workflowId: string) => void;
}
export declare const CWLWorkflowEditor: React.FC<CWLWorkflowEditorProps>;
export {};
