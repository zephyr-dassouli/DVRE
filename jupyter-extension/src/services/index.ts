/**
 * Services barrel file - Export all DVRE services
 */

export { 
  ProjectConfigurationService, 
  projectConfigurationService
} from './ProjectConfigurationService';

// Export types from types.ts
export type {
  DVREProjectConfiguration,
  ConfigurationDataset,
  ConfigurationWorkflow,
  ConfigurationModel,
  ROCrateMetadata,
  IPFSUploadResult,
  IPFSFile,
  DALTemplateParameters,
  GeneralTemplateParameters,
  TemplateParameters,
  IPFSConfig,
  ConfigurationChangeCallback
} from './types';

// New refactored services
export {
  TemplateService,
  templateService
} from './TemplateService';

export {
  ROCrateService,
  roCrateService
} from './ROCrateService';

export {
  SmartContractService,
  smartContractService
} from './SmartContractService';

export { 
  LocalFileDownloadService,
  localFileDownloadService,
  type LocalDownloadResult
} from './LocalFileDownloadService';

export { 
  IPFSService,
  ipfsService 
} from './IPFSService';

// New workflow service
export {
  WorkflowService,
  workflowService,
  type WorkflowExecutionConfig,
  type WorkflowSubmissionResult
} from './WorkflowService';

export { 
  ExtensionDiscovery,
  type IExtensionDiscovery,
  type IExtensionInfo
} from './ExtensionDiscovery'; 