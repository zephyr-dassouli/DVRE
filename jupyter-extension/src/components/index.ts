export { AuthComponent } from './auth/AuthComponent';
export { AuthWidget } from './auth/AuthWidget';
export { CollaborationWidget } from './collaboration/CollaborationWidget';
export { GraphWidget } from './graph/GraphWidget';
export { IPFSWidget } from './ipfs/IPFSWidget';
export { FederatedLearningWidget } from './federatedlearning/FederatedLearningWidget';

// Project Configuration widget
export { ProjectConfigurationWidget } from './configuration/ProjectConfigurationWidget';
export {
  DVREProjectConfiguration,
  ConfigurationDataset,
  ConfigurationWorkflow,
  ConfigurationModel,
  projectConfigurationService
} from '../services/ProjectConfigurationService';

// DAL components are now completely separate extensions
// They will be discovered and loaded via ExtensionDiscovery