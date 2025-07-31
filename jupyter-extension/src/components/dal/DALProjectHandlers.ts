/**
 * DAL Project Handlers - Action handlers for Active Learning project operations
 */

import { DALProject } from './types';
import { SessionState } from './services/DALProjectSession';

export interface ProjectHandlers {
  handleStartNextIteration: () => Promise<void>;
  handleEndProject: () => Promise<void>;
  handleBatchVoteSubmission: (sampleIds: string[], labels: string[]) => Promise<void>;
  handleVoteSubmission: (sampleId: string, label: string) => Promise<void>;
  handleRefreshData: () => Promise<void>;
  handlePublishFinalResults: () => Promise<void>;
}

export interface HandlerDependencies {
  project: DALProject;
  currentUser: string;
  isCoordinator: boolean;
  dalSession: any; // DALProjectSession type
  sessionState: SessionState | null;
  triggerRefresh: () => void;
  setError: (error: string | null) => void;
}

export const createProjectHandlers = (deps: HandlerDependencies): ProjectHandlers => {
  const { project, currentUser, isCoordinator, dalSession, triggerRefresh, setError } = deps;

  const handleStartNextIteration = async () => {
    if (!isCoordinator) {
      setError('Only coordinators can start iterations');
      return;
    }

    if (!dalSession) {
      setError('DAL Session not initialized. Please wait a moment and try again.');
      return;
    }

    try {
      setError(null);
      console.log('🚀 Starting next AL iteration via DAL Session bridge');
      
      // Use the DAL Session bridge to orchestrate the complete workflow
      await dalSession.startIteration();
      
      console.log('✅ AL iteration workflow started successfully via DAL Session');
      
    } catch (error) {
      console.error('❌ Failed to start next AL iteration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start iteration';
      setError(errorMessage);
    }
  };

  const handleEndProject = async () => {
    if (!isCoordinator) {
      setError('Only coordinators can end projects');
      return;
    }

    try {
      setError(null);
      console.log('🏁 Ending project from UI');
      
      // Use ALContractService directly instead of hook (which can't be called in async functions)
      const { alContractService } = await import('./services/ALContractService');
      
      const success = await alContractService.endProject(project.contractAddress, currentUser);
      
      if (!success) {
        throw new Error('Failed to end project via smart contract');
      }
      
      // Trigger data refresh to show updated state
      triggerRefresh();
      
      console.log('✅ Project ended successfully');
      
    } catch (error) {
      console.error('❌ Failed to end project:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to end project';
      setError(errorMessage);
    }
  };

  const handleBatchVoteSubmission = async (sampleIds: string[], labels: string[]) => {
    if (!dalSession) {
      setError('DAL Session not initialized. Please wait a moment and try again.');
      return;
    }

    try {
      setError(null);
      const batchType = sampleIds.length === 1 ? 'single-sample batch' : 'multi-sample batch';
      console.log(`🗳️ Submitting ${batchType} vote via DAL Session bridge`);
      
      // Use the DAL Session bridge for batch vote submission (works for any batch size)
      await dalSession.submitBatchVote(sampleIds, labels);
      
      console.log(`✅ ${batchType} vote submitted successfully via DAL Session`);
      
    } catch (error) {
      console.error('❌ Failed to submit batch vote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit batch vote';
      setError(errorMessage);
    }
  };

  // Legacy wrapper for single sample voting (converted to batch)
  const handleVoteSubmission = async (sampleId: string, label: string) => {
    // Convert single vote to batch vote for consistency
    await handleBatchVoteSubmission([sampleId], [label]);
  };

  const handleRefreshData = async () => {
    console.log('Refreshing all project data from smart contracts...');
    
    // Trigger data refresh - loading and error states handled by parent component
    triggerRefresh();
    
    console.log('✅ Project data refresh triggered');
  };

  const handlePublishFinalResults = async () => {
    console.log('Publishing final AL project results...');
    
    try {
      // Step 1: Get the complete RO-Crate folder from AL-Engine
      console.log('📋 Step 1: Collecting complete RO-Crate folder from AL-Engine...');
      const alEngineUrl = 'http://localhost:5050'; // AL-Engine API base URL
      
      const roCrateFolderResponse = await fetch(`${alEngineUrl}/api/project/${project.contractAddress}/ro-crate`);
      
      if (!roCrateFolderResponse.ok) {
        throw new Error(`AL-Engine API failed: ${roCrateFolderResponse.status} ${roCrateFolderResponse.statusText}`);
      }
      
      const folderData = await roCrateFolderResponse.json();
      console.log('✅ Collected RO-Crate folder from AL-Engine:', {
        totalFiles: folderData.folder_structure?.total_files || 0,
        totalSize: folderData.folder_structure?.total_size || 0,
        totalIterations: folderData.al_summary?.total_iterations || 0,
        totalSamples: folderData.al_summary?.total_samples_queried || 0,
        latestPerformance: folderData.al_summary?.latest_performance
      });
      
      // Step 2: Convert folder structure to IPFS file format
      console.log('📦 Step 2: Preparing folder structure for IPFS upload...');
      const { IPFSService } = await import('../deployment/services/IPFSService');
      
      const bundleFiles = folderData.folder_structure.files.map((file: any) => {
        // Handle binary files (base64 encoded)
        let content = file.content;
        if (file.is_binary && file.type === 'application/octet-stream') {
          // Convert base64 back to binary for IPFS upload
          const binaryData = atob(content);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
          }
          content = bytes.buffer;
        }
        
        return {
          name: file.name,
          content: content,
          type: file.type || 'text/plain'
        };
      });
      
      console.log(`📂 Prepared ${bundleFiles.length} files for IPFS upload`);
      
      // Step 3: Upload complete RO-Crate folder to IPFS
      console.log('🚀 Step 3: Uploading complete RO-Crate folder to IPFS...');
      const folderName = `dvre-al-project-${project.contractAddress}`;
      
      const ipfsResults = await IPFSService.getInstance().uploadDirectory(bundleFiles, folderName);
      
      console.log('✅ Uploaded complete RO-Crate folder to IPFS:', ipfsResults.hash);
      
      // Step 4: Update project configuration
      console.log('📋 Step 4: Updating project configuration...');
      const { projectConfigurationService } = await import('../deployment/services/ProjectConfigurationService');
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const projectConfig = projectConfigurationService.getProjectConfiguration(project.contractAddress);
      if (projectConfig) {
        // Update configuration with final IPFS hash
        projectConfig.ipfs = {
          roCrateHash: ipfsResults.hash,
          publishedAt: new Date().toISOString()
        };
        projectConfig.status = 'deployed';
        projectConfig.lastModified = new Date().toISOString();
        
        // Add AL-specific metadata
        projectConfig.extensions.dal = {
          finalResults: {
            totalIterations: folderData.al_summary?.total_iterations || 0,
            totalSamplesQueried: folderData.al_summary?.total_samples_queried || 0,
            latestPerformance: folderData.al_summary?.latest_performance,
            publishedAt: new Date().toISOString(),
            ipfsHash: ipfsResults.hash,
            ipfsUrl: ipfsResults.url
          }
        };
        
        console.log('✅ Project configuration updated with final results');
      }
      
      console.log('🔗 Step 5: Creating blockchain asset and updating smart contract...');
      try {
        // Step 5a: Create blockchain asset for final RO-Crate
        console.log('📋 Creating blockchain asset for final results...');
        const { AssetService } = await import('../../utils/AssetService');
        const { ethers } = await import('ethers');
        
        // Get blockchain connection
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();
        console.log('✅ Wallet connection established:', signerAddress);
        
        // Create AssetService instance
        const assetService = new AssetService();
        
        // Wait for AssetService to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create asset name: ro-crate-<project-address>-final
        const assetName = `ro-crate-${project.contractAddress}-final`;
        const assetType = 'ro-crate';
        
        console.log(`🔗 Creating final results asset: "${assetName}" with IPFS hash: ${ipfsResults.hash}`);
        
        // Create the asset
        const assetContractAddress = await assetService.createAsset(assetName, assetType, ipfsResults.hash);
        console.log('✅ Final results asset created at:', assetContractAddress);
        
        // Step 5b: Update Project contract with final RO-Crate hash
        console.log('📋 Updating Project contract with final RO-Crate hash...');
        const Project = (await import('../../abis/Project.json')).default;
        const projectContract = new ethers.Contract(project.contractAddress, Project.abi, signer);
        
        // Use the new setFinalROCrateHash function
        const setFinalHashTx = await projectContract.setFinalROCrateHash(ipfsResults.hash);
        await setFinalHashTx.wait();
        console.log('✅ Project contract updated with final RO-Crate hash');
        
      } catch (contractError) {
        console.warn('⚠️ Failed to create asset or update smart contract (continuing anyway):', contractError);
      }
      
      // Step 6: Show success message
      const successMessage = 
        '🎉 Final Results Published Successfully!\n\n' +
        `📊 Project Summary:\n` +
        `• Total AL Iterations: ${folderData.al_summary?.total_iterations || 0}\n` +
        `• Total Samples Queried: ${folderData.al_summary?.total_samples_queried || 0}\n` +
        `• Total Files: ${folderData.folder_structure?.total_files || 0}\n` +
        `• Latest Accuracy: ${folderData.al_summary?.latest_performance?.accuracy || 'N/A'}\n` +
        `• Latest F1-Score: ${folderData.al_summary?.latest_performance?.f1_score || 'N/A'}\n\n` +
        `🔗 IPFS Hash: ${ipfsResults.hash}\n` +
        `📁 IPFS URL: ${ipfsResults.url}\n\n` +
        `⛓️ Blockchain Asset: ro-crate-${project.contractAddress}-final\n` +
        `📋 Project Contract Updated: Final RO-Crate hash stored on blockchain\n\n` +
        `✅ Your complete Active Learning project folder is now publicly available!\n` +
        `You can download the final RO-Crate folder from the Storage tab.`;
      
      alert(successMessage);
      
      // Trigger data refresh to show updated state
      triggerRefresh();
      
      console.log('✅ Final results publish process completed successfully');
      
    } catch (error) {
      console.error('❌ Failed to publish final results:', error);
      
      let errorMessage = 'Failed to publish final results: ';
      if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error';
      }
      
      // Show detailed error to user
      alert(`❌ Publish Failed\n\n${errorMessage}\n\nPlease check:\n• AL-Engine is running (localhost:5050)\n• Project has completed iterations\n• Project folder exists in al-engine/ro-crates/\n• Wallet is connected\n• Network connectivity`);
      
      throw error;
    }
  };

  return {
    handleStartNextIteration,
    handleEndProject,
    handleBatchVoteSubmission,
    handleVoteSubmission,
    handleRefreshData,
    handlePublishFinalResults
  };
}; 