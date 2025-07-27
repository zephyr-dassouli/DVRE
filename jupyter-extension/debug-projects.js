/**
 * DVRE Project Deployment Verification Script
 * Checks the actual status of project deployments vs what the UI reports
 */

console.log('🔍 DVRE Project Deployment Verification');
console.log('=====================================');

// Helper function to check IPFS hash accessibility
async function verifyIPFSHash(hash, description) {
  const gateways = [
    'http://145.100.135.97:8081/ipfs/'
  ];
  
  console.log(`\n📦 Checking ${description}: ${hash}`);
  
  for (const gateway of gateways) {
    try {
      const url = `${gateway}${hash}`;
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        console.log(`✅ ${description} accessible via ${gateway}`);
        return true;
      }
    } catch (error) {
      console.log(`❌ ${gateway}: ${error.message}`);
    }
  }
  
  console.log(`🔍 ${description}: Not accessible via any gateway`);
  return false;
}

// Helper function to check orchestration server
async function verifyOrchestrationServer() {
  const orchestrationUrl = 'http://145.100.135.97:5004';
  
  console.log(`\n🚀 Checking Orchestration Server: ${orchestrationUrl}`);
  
  try {
    // Check health endpoint
    const healthResponse = await fetch(`${orchestrationUrl}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (healthResponse.ok) {
      console.log('✅ Orchestration server is healthy');
      return true;
    } else {
      console.log(`❌ Orchestration server health check failed: ${healthResponse.status}`);
    }
  } catch (error) {
    console.log(`❌ Orchestration server unreachable: ${error.message}`);
  }
  
  return false;
}

// Helper function to check smart contract state
async function verifySmartContract(contractAddress) {
  console.log(`\n📋 Checking Smart Contract: ${contractAddress}`);
  
  try {
    if (!window.ethereum) {
      console.log('❌ MetaMask not available');
      return false;
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(contractAddress, [
      "function getProjectConfiguration() view returns (tuple)",
      "function getIPFSHash(string memory hashType) view returns (string memory)",
      "function votingContract() view returns (address)",
      "function storageContract() view returns (address)"
    ], provider);
    
    // Check if contract exists
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
      console.log('❌ Contract does not exist at this address');
      return false;
    }
    
    console.log('✅ Contract exists and is accessible');
    
    // Check IPFS hashes stored on contract
    try {
      const roCrateHash = await contract.getIPFSHash('ro-crate');
      const bundleHash = await contract.getIPFSHash('bundle');
      console.log(`📦 Contract RO-Crate Hash: ${roCrateHash || 'Not set'}`);
      console.log(`📦 Contract Bundle Hash: ${bundleHash || 'Not set'}`);
    } catch (error) {
      console.log('⚠️ Could not retrieve IPFS hashes from contract (method may not exist)');
    }
    
    // Check AL helper contracts
    try {
      const votingContract = await contract.votingContract();
      const storageContract = await contract.storageContract();
      console.log(`🗳️ Voting Contract: ${votingContract || 'Not set'}`);
      console.log(`💾 Storage Contract: ${storageContract || 'Not set'}`);
      
      if (votingContract && votingContract !== '0x0000000000000000000000000000000000000000') {
        console.log('✅ AL Voting contract is linked');
      }
      if (storageContract && storageContract !== '0x0000000000000000000000000000000000000000') {
        console.log('✅ AL Storage contract is linked');
      }
    } catch (error) {
      console.log('⚠️ Could not check AL helper contracts (methods may not exist)');
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Smart contract verification failed: ${error.message}`);
    return false;
  }
}

// Main verification function
async function verifyProjectDeployment(projectId) {
  console.log(`\n🔍 VERIFYING PROJECT: ${projectId}`);
  console.log('=' .repeat(50));
  
  // Get project configuration
  const config = projectConfigurationService?.getProjectConfiguration?.(projectId);
  if (!config) {
    console.log('❌ Project configuration not found');
    return;
  }
  
  console.log(`📋 Project Name: ${config.projectData?.name || 'Unknown'}`);
  console.log(`📋 Project Type: ${config.extensions?.dal ? 'Active Learning' : 'General'}`);
  console.log(`📋 Status: ${config.status}`);
  console.log(`📋 Contract: ${config.contractAddress}`);
  
  const results = {
    ipfs: false,
    orchestration: false,
    smartContract: false,
    overall: false
  };
  
  // 1. Verify IPFS uploads
  if (config.ipfs) {
    console.log('\n1️⃣ VERIFYING IPFS UPLOADS');
    console.log('-'.repeat(30));
    
    if (config.ipfs.roCrateHash) {
      results.ipfs = await verifyIPFSHash(config.ipfs.roCrateHash, 'RO-Crate Bundle');
      
      // Test organized structure
      console.log('\n📁 Verifying organized RO-Crate structure...');
      const structurePaths = [
        'ro-crate-metadata.json',
        'config/config.json',
        'workflows/',
        'inputs/'
      ];
      
      for (const path of structurePaths) {
        await verifyIPFSPath(config.ipfs.roCrateHash, path);
      }
    }
  } else {
    console.log('\n1️⃣ NO IPFS DATA FOUND');
  }
  
  // 2. Verify orchestration server
  console.log('\n2️⃣ VERIFYING ORCHESTRATION');
  console.log('-'.repeat(30));
  results.orchestration = await verifyOrchestrationServer();
  
  // Check deployment status in local storage
  const deploymentStatus = projectDeploymentService?.getDeploymentStatus?.(projectId);
  if (deploymentStatus) {
    console.log(`📊 Local Deployment Status: ${deploymentStatus.status}`);
    console.log(`📊 Workflow ID: ${deploymentStatus.orchestrationWorkflowId || 'None'}`);
  }
  
  // 3. Verify smart contract
  console.log('\n3️⃣ VERIFYING SMART CONTRACT');
  console.log('-'.repeat(30));
  if (config.contractAddress) {
    results.smartContract = await verifySmartContract(config.contractAddress);
  } else {
    console.log('❌ No contract address found');
  }
  
  // Overall assessment
  results.overall = results.ipfs && results.smartContract;
  
  console.log('\n📊 VERIFICATION SUMMARY');
  console.log('=' .repeat(30));
  console.log(`IPFS Upload: ${results.ipfs ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Orchestration: ${results.orchestration ? '✅ AVAILABLE' : '❌ UNAVAILABLE'}`);
  console.log(`Smart Contract: ${results.smartContract ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Overall Status: ${results.overall ? '✅ DEPLOYED' : '❌ PARTIAL/FAILED'}`);
  
  return results;
}

// Verify all projects
async function verifyAllProjects() {
  console.log('\n🔍 VERIFYING ALL PROJECTS');
  console.log('=' .repeat(50));
  
  // Get all project configurations
  const allConfigs = projectConfigurationService?.getAllProjectConfigurations?.() || [];
  
  if (allConfigs.length === 0) {
    console.log('❌ No projects found');
    return;
  }
  
  console.log(`Found ${allConfigs.length} projects`);
  
  for (const config of allConfigs) {
    await verifyProjectDeployment(config.projectId);
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Quick IPFS verification for the hashes shown in the image
async function quickIPFSCheck() {
  console.log('\n🚀 QUICK IPFS VERIFICATION');
  console.log('=' .repeat(30));
  
  const roCrateHash = 'QmPceKgtrHsKGrKgpiinq4LLKyakurwKQoFwFBKgoqMKmf';
  
  await verifyIPFSHash(roCrateHash, 'RO-Crate Bundle from Deployment');
  
  // Test the new organized RO-Crate structure
  console.log('\n📁 Testing new organized RO-Crate structure...');
  const testPaths = [
    'ro-crate-metadata.json',
    'config/config.json',
    'workflows/dal_cwl_workflow.cwl',
    'inputs/inputs.json',
    'config/extensions-config.json'
  ];
  
  for (const path of testPaths) {
    await verifyIPFSPath(roCrateHash, path);
  }
}

// Helper function to verify specific paths within IPFS hash
async function verifyIPFSPath(hash, path) {
  const gateways = [
    'http://145.100.135.97:8081/ipfs/',
    'https://ipfs.io/ipfs/'
  ];
  
  console.log(`📂 Checking ${path} in ${hash}:`);
  
  for (const gateway of gateways) {
    try {
      const url = `${gateway}${hash}/${path}`;
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        console.log(`  ✅ ${path} found via ${gateway}`);
        return true;
      }
    } catch (error) {
      console.log(`  ❌ ${gateway}: ${error.message}`);
    }
  }
  
  console.log(`  🔍 ${path}: Not found or not accessible`);
  return false;
}

// Export functions for console use
window.dvreVerification = {
  verifyProject: verifyProjectDeployment,
  verifyAll: verifyAllProjects,
  quickIPFS: quickIPFSCheck,
  verifyHash: verifyIPFSHash,
  verifyPath: verifyIPFSPath,
  verifyOrchestration: verifyOrchestrationServer
};

console.log('\n🛠️ VERIFICATION TOOLS LOADED');
console.log('Usage:');
console.log('  dvreVerification.quickIPFS() - Check IPFS hashes and organized structure');
console.log('  dvreVerification.verifyAll() - Verify all projects');
console.log('  dvreVerification.verifyProject("PROJECT_ID") - Verify specific project');
console.log('  dvreVerification.verifyOrchestration() - Check orchestration server');
console.log('  dvreVerification.verifyHash("HASH", "description") - Check specific IPFS hash');
console.log('  dvreVerification.verifyPath("HASH", "path") - Check specific path in IPFS hash');

// Auto-run quick IPFS check
console.log('\n🚀 Running quick IPFS verification...');
quickIPFSCheck(); 