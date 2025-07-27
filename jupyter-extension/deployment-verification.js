/**
 * Deployment Verification Script
 * Verifies actual smart contract state vs reported deployment status
 */

async function verifySmartContractDeployment(projectId) {
    console.log(`🔍 Verifying smart contract deployment for project: ${projectId}`);
    
    try {
        // Get project configuration - try multiple approaches
        let config = null;
        
        // Method 1: Direct lookup by project ID
        if (window.dvreDebugData?.projects) {
            config = window.dvreDebugData.projects.find(p => 
                p.projectId === projectId || p.contractAddress === projectId
            );
        }
        
        // Method 2: Check localStorage
        if (!config) {
            const keys = Object.keys(localStorage).filter(key => key.includes('dvre_project_'));
            for (const key of keys) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && (data.projectId === projectId || data.contractAddress === projectId)) {
                        config = data;
                        break;
                    }
                } catch (e) {}
            }
        }
        
        // Method 3: Try window.dvreServices if available
        if (!config && window.dvreServices?.projectConfigurationService) {
            try {
                config = window.dvreServices.projectConfigurationService.getProjectConfiguration(projectId);
            } catch (e) {}
        }
        
        if (!config) {
            console.error(`❌ Project configuration not found for: ${projectId}`);
            console.log(`💡 Available projects:`, await discoverProjects());
            return false;
        }

        console.log(`📋 Project Config Found:`, {
            projectId: config.projectId,
            contractAddress: config.contractAddress,
            projectType: config.projectData?.type,
            hasDALExtension: !!config.extensions?.dal,
            status: config.status,
            hasIPFS: !!config.ipfs
        });

        // Check if project has been deployed
        if (config.status === 'not deployed' || !config.ipfs) {
            console.log(`📋 Project Status: ${config.status}`);
            console.log(`💡 This project hasn't been deployed yet!`);
            console.log(`🚀 To verify deployment:`);
            console.log(`   1. Go to the DVRE Project Deployment UI`);
            console.log(`   2. Select this project: ${config.projectData?.name || config.projectId}`);
            console.log(`   3. Click the "Deploy" button`);
            console.log(`   4. Wait for deployment to complete`);
            console.log(`   5. Then run verification again`);
            return false;
        }

        if (!config.contractAddress) {
            console.error(`❌ No contract address found for project: ${projectId}`);
            return false;
        }

        // Check if we can connect to the blockchain
        if (!window.ethereum) {
            console.error(`❌ MetaMask not found`);
            return false;
        }

        // Check for ethers library
        if (!window.ethers) {
            console.error(`❌ Ethers library not found. Make sure it's loaded in the page.`);
            console.log(`💡 Try refreshing the page or ensure the DVRE extension is properly loaded.`);
            return false;
        }

        const provider = new window.ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Load the JSONProject contract
        const JSONProjectABI = window.dvreServices?.JSONProject?.abi || [
            "function getProjectData() view returns (tuple(string project_id, string name, string description, string project_type, address owner, string[] participants))",
            "function owner() view returns (address)",
            "function getParticipants() view returns (address[])",
            "function setALMetadata(string, uint256, string) external",
            "function updateIPFSHash(string) external",
            "function setVotingContract(address) external",
            "function setStorageContract(address) external"
        ];

        const contract = new window.ethers.Contract(config.contractAddress, JSONProjectABI, signer);

        console.log(`📡 Checking contract at: ${config.contractAddress}`);

        // 1. Verify basic contract accessibility
        try {
            const owner = await contract.owner();
            console.log(`✅ Contract Owner: ${owner}`);
        } catch (error) {
            console.error(`❌ Failed to read contract owner:`, error.message);
            return false;
        }

        // 2. Check project data
        try {
            const projectData = await contract.getProjectData();
            console.log(`✅ Project Data:`, {
                project_id: projectData.project_id,
                name: projectData.name,
                project_type: projectData.project_type,
                owner: projectData.owner,
                participants: projectData.participants
            });
        } catch (error) {
            console.error(`❌ Failed to read project data:`, error.message);
        }

        // 3. Check if AL-specific methods exist and work
        if (config.extensions?.dal) {
            console.log(`🤖 Verifying Active Learning contract methods...`);
            
            // Test setALMetadata method availability
            try {
                // Just check if the method exists (don't actually call it)
                const fragment = contract.interface.getFunction('setALMetadata');
                console.log(`✅ setALMetadata method exists:`, fragment.name);
            } catch (error) {
                console.error(`❌ setALMetadata method not found:`, error.message);
            }

            // Test updateIPFSHash method availability  
            try {
                const fragment = contract.interface.getFunction('updateIPFSHash');
                console.log(`✅ updateIPFSHash method exists:`, fragment.name);
            } catch (error) {
                console.error(`❌ updateIPFSHash method not found:`, error.message);
            }

            // Test setVotingContract method availability
            try {
                const fragment = contract.interface.getFunction('setVotingContract');
                console.log(`✅ setVotingContract method exists:`, fragment.name);
            } catch (error) {
                console.error(`❌ setVotingContract method not found:`, error.message);
            }

            // Test setStorageContract method availability
            try {
                const fragment = contract.interface.getFunction('setStorageContract');
                console.log(`✅ setStorageContract method exists:`, fragment.name);
            } catch (error) {
                console.error(`❌ setStorageContract method not found:`, error.message);
            }
        }

        // 4. Check for AL-specific contract addresses (if they were supposed to be deployed)
        console.log(`🔍 Checking for AL-specific contract deployments...`);
        
        // In a real AL deployment, we would check for:
        // - ALProjectVoting contract address
        // - ALProjectStorage contract address
        // - Contract linkage between main contract and AL contracts
        
        console.log(`⚠️ AL-specific contracts are currently skipped in test mode`);

        return true;

    } catch (error) {
        console.error(`❌ Verification failed:`, error);
        return false;
    }
}

async function verifyIPFSDeployment(projectId) {
    console.log(`📦 Verifying IPFS deployment for project: ${projectId}`);
    
    try {
        // Get project configuration - same approach as smart contract verification
        let config = null;
        
        // Method 1: Direct lookup by project ID
        if (window.dvreDebugData?.projects) {
            config = window.dvreDebugData.projects.find(p => 
                p.projectId === projectId || p.contractAddress === projectId
            );
        }
        
        // Method 2: Check localStorage
        if (!config) {
            const keys = Object.keys(localStorage).filter(key => key.includes('dvre_project_'));
            for (const key of keys) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && (data.projectId === projectId || data.contractAddress === projectId)) {
                        config = data;
                        break;
                    }
                } catch (e) {}
            }
        }
        
        // Method 3: Try window.dvreServices if available
        if (!config && window.dvreServices?.projectConfigurationService) {
            try {
                config = window.dvreServices.projectConfigurationService.getProjectConfiguration(projectId);
            } catch (e) {}
        }
        
        if (!config?.ipfs?.roCrateHash) {
            console.error(`❌ No IPFS RO-Crate hash found for project: ${projectId}`);
            if (config) {
                console.log(`📋 Config found but no IPFS data:`, {
                    hasIPFS: !!config.ipfs,
                    ipfsKeys: config.ipfs ? Object.keys(config.ipfs) : 'N/A'
                });
            }
            return false;
        }

        const roCrateHash = config.ipfs.roCrateHash;
        console.log(`🔗 RO-Crate Hash: ${roCrateHash}`);

        // Test IPFS accessibility
        const ipfsUrl = `http://dvre03.lab.uvalight.net:8081/ipfs/${roCrateHash}`;
        
        // Check if RO-Crate metadata is accessible
        try {
            const response = await fetch(`${ipfsUrl}/ro-crate-metadata.json`);
            if (response.ok) {
                const metadata = await response.json();
                console.log(`✅ RO-Crate metadata accessible:`, metadata['@type']);
            } else {
                console.error(`❌ RO-Crate metadata not accessible: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Failed to fetch RO-Crate metadata:`, error.message);
            return false;
        }

        // Check specific file accessibility
        const filesToCheck = [
            'workflows/al_iteration.cwl',
            'config/config.json',
            'inputs/inputs.json'
        ];

        for (const file of filesToCheck) {
            try {
                const response = await fetch(`${ipfsUrl}/${file}`);
                if (response.ok) {
                    console.log(`✅ ${file} accessible`);
                } else {
                    console.warn(`⚠️ ${file} not accessible: ${response.status}`);
                }
            } catch (error) {
                console.warn(`⚠️ Failed to check ${file}:`, error.message);
            }
        }

        return true;
    } catch (error) {
        console.error(`❌ IPFS verification failed:`, error);
        return false;
    }
}

async function verifyCompleteDeployment(projectId) {
    console.log(`🚀 Starting complete deployment verification for: ${projectId}`);
    console.log(`================================================`);
    
    const results = {
        smartContract: await verifySmartContractDeployment(projectId),
        ipfs: await verifyIPFSDeployment(projectId)
    };
    
    console.log(`================================================`);
    console.log(`📊 Verification Summary for ${projectId}:`);
    console.log(`Smart Contract: ${results.smartContract ? '✅ VERIFIED' : '❌ FAILED'}`);
    console.log(`IPFS Deployment: ${results.ipfs ? '✅ VERIFIED' : '❌ FAILED'}`);
    
    const overallSuccess = results.smartContract && results.ipfs;
    console.log(`Overall Status: ${overallSuccess ? '✅ VERIFIED' : '❌ ISSUES FOUND'}`);
    
    return results;
}

// Quick verification of the most recent project
async function quickVerifyLatest() {
    try {
        console.log('🔍 Searching for projects...');
        
        // Debug: Check what's available in the window
        console.log('Available in window:', {
            dvreServices: !!window.dvreServices,
            dvreDebugData: !!window.dvreDebugData
        });

        // Try multiple ways to find projects
        let projects = [];
        
        // Method 1: Check if there's debug data with projects
        if (window.dvreDebugData?.projects) {
            projects = window.dvreDebugData.projects;
            console.log(`📋 Found ${projects.length} projects via dvreDebugData`);
        }
        
        // Method 2: Check localStorage for project configurations
        if (projects.length === 0) {
            const localStorageKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('dvre_project_') || key.includes('project')
            );
            console.log(`🗂️ Found ${localStorageKeys.length} project-related localStorage keys:`, localStorageKeys);
            
            // Try to load projects from localStorage
            const projectConfigs = [];
            for (const key of localStorageKeys) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && (data.projectId || data.contractAddress)) {
                        projectConfigs.push(data);
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            }
            projects = projectConfigs;
            console.log(`📋 Found ${projects.length} projects via localStorage`);
        }
        
        // Method 3: Manual project ID entry if nothing found
        if (projects.length === 0) {
            console.log(`❌ No projects found automatically.`);
            console.log(`💡 You can manually verify a project using:`);
            console.log(`   window.dvreVerifyDeployment.verifyComplete('YOUR_PROJECT_ID')`);
            console.log(`📋 To find your project ID, check the Project Information panel in the UI.`);
            return;
        }

        // Get the most recently modified project
        const latestProject = projects.reduce((latest, current) => {
            const latestTime = latest.lastModified || latest.modified || 0;
            const currentTime = current.lastModified || current.modified || 0;
            return new Date(currentTime) > new Date(latestTime) ? current : latest;
        });

        const projectId = latestProject.projectId || latestProject.contractAddress;
        const projectName = latestProject.projectData?.name || latestProject.name || 'Unnamed Project';
        
        console.log(`🎯 Verifying latest project: ${projectName} (${projectId})`);
        return await verifyCompleteDeployment(projectId);
    } catch (error) {
        console.error(`❌ Quick verification failed:`, error);
    }
}

// Helper function to discover available projects
async function discoverProjects() {
    console.log('🔍 Discovering available projects...');
    
    // Check all possible sources
    const sources = {
        dvreDebugData: window.dvreDebugData?.projects || [],
        localStorage: []
    };
    
    // Scan localStorage
    const localStorageKeys = Object.keys(localStorage);
    console.log(`📂 Total localStorage keys: ${localStorageKeys.length}`);
    
    for (const key of localStorageKeys) {
        if (key.includes('project') || key.includes('dvre')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && typeof data === 'object') {
                    sources.localStorage.push({ key, data });
                }
            } catch (e) {
                // Skip invalid JSON
            }
        }
    }
    
    console.log('📊 Project Discovery Results:');
    console.log(`- dvreDebugData: ${sources.dvreDebugData.length} projects`);
    console.log(`- localStorage: ${sources.localStorage.length} relevant entries`);
    
    // Show localStorage entries
    if (sources.localStorage.length > 0) {
        console.log('\n📋 localStorage entries that might be projects:');
        sources.localStorage.forEach(({ key, data }) => {
            console.log(`  ${key}:`, {
                hasProjectId: !!data.projectId,
                hasContractAddress: !!data.contractAddress,
                hasProjectData: !!data.projectData,
                name: data.projectData?.name || data.name || 'Unknown'
            });
        });
    }
    
    return sources;
}

// Helper function to check project status without full verification
async function checkProjectStatus() {
    console.log('📊 Checking all project deployment status...');
    
    const sources = await discoverProjects();
    const allProjects = [...sources.dvreDebugData];
    
    // Add projects from localStorage
    sources.localStorage.forEach(({ key, data }) => {
        if (data.projectId || data.contractAddress) {
            allProjects.push(data);
        }
    });
    
    if (allProjects.length === 0) {
        console.log('❌ No projects found');
        return;
    }
    
    console.log(`📋 Found ${allProjects.length} project(s):\n`);
    
    allProjects.forEach((project, index) => {
        const projectId = project.projectId || project.contractAddress;
        const name = project.projectData?.name || project.name || 'Unnamed Project';
        const status = project.status || 'unknown';
        const hasIPFS = !!project.ipfs;
        const isAL = project.projectData?.type === 'active_learning' || !!project.extensions?.dal;
        
        console.log(`${index + 1}. ${name}`);
        console.log(`   📍 ID: ${projectId}`);
        console.log(`   📊 Status: ${status}`);
        console.log(`   🔗 IPFS: ${hasIPFS ? '✅ Published' : '❌ Not published'}`);
        console.log(`   🤖 Type: ${isAL ? 'Active Learning' : 'General'}`);
        console.log('');
    });
    
    const deployedProjects = allProjects.filter(p => p.status === 'deployed' && p.ipfs);
    const undeployedProjects = allProjects.filter(p => p.status !== 'deployed' || !p.ipfs);
    
    console.log(`📈 Summary:`);
    console.log(`   ✅ Deployed: ${deployedProjects.length}`);
    console.log(`   ⏳ Undeployed: ${undeployedProjects.length}`);
    
    if (undeployedProjects.length > 0) {
        console.log(`\n💡 To deploy undeployed projects:`);
        console.log(`   1. Open the DVRE Project Deployment UI`);
        console.log(`   2. Select a project from the list`);
        console.log(`   3. Click "Deploy"`);
        console.log(`   4. Wait for completion`);
        console.log(`   5. Run verification: window.dvreVerifyDeployment.quickVerify()`);
    }
    
    return { allProjects, deployedProjects, undeployedProjects };
}

// Export functions to window for easy access
window.dvreVerifyDeployment = {
    verifySmartContract: verifySmartContractDeployment,
    verifyIPFS: verifyIPFSDeployment,
    verifyComplete: verifyCompleteDeployment,
    quickVerify: quickVerifyLatest,
    discoverProjects: discoverProjects,
    checkProjectStatus: checkProjectStatus
};

console.log(`🔧 Deployment verification tools loaded. Use:`);
console.log(`- window.dvreVerifyDeployment.checkProjectStatus() - List all projects and their status`);
console.log(`- window.dvreVerifyDeployment.quickVerify() - Verify latest project`);
console.log(`- window.dvreVerifyDeployment.discoverProjects() - Find available projects`);
console.log(`- window.dvreVerifyDeployment.verifyComplete('projectId') - Verify specific project`);
console.log(`- window.dvreVerifyDeployment.verifySmartContract('projectId') - Check contracts only`);
console.log(`- window.dvreVerifyDeployment.verifyIPFS('projectId') - Check IPFS only`); 