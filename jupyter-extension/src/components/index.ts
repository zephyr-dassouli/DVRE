// Export all available widgets  
export { AuthWidget } from './auth/AuthWidget';
export { CollaborationWidget } from './collaboration/CollaborationWidget';
export { GraphWidget } from './graph/GraphWidget';
export { FederatedLearningWidget } from './federatedlearning/FederatedLearningWidget';
export { IPFSWidget } from './ipfs/IPFSWidget';

// Export the new Project Deployment components
export { ProjectDeploymentComponent, ProjectDeploymentWidget } from './deployment';

// DAL components are now completely separate extensions
// They will be discovered and loaded via ExtensionDiscovery