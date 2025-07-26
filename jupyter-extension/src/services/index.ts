/**
 * Services barrel file - Export all DVRE services
 */

export { 
  ProjectConfigurationService, 
  projectConfigurationService,
  type DVREProjectConfiguration,
  type ConfigurationDataset,
  type ConfigurationWorkflow,
  type ConfigurationModel,
  type ROCrateMetadata,
  type IPFSUploadResult,
  type IPFSFile
} from './ProjectConfigurationService';

export { 
  ExtensionDiscovery,
  type IExtensionDiscovery,
  type IExtensionInfo
} from './ExtensionDiscovery'; 