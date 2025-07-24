import React from 'react';
interface RuntimeOrchestrationPanelProps {
    projectId: string;
    workflowId: string;
    projectTitle: string;
    onClose?: () => void;
}
export declare const RuntimeOrchestrationPanel: React.FC<RuntimeOrchestrationPanelProps>;
export {};
