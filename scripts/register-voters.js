const { ethers } = require('ethers');
const fs = require('fs');

// Configuration
const PROJECT_ADDRESS = '0xD5b7B7c5673a86366f3f8203aD66dcE7FBEfb82A';
const RPC_URL = 'http://145.100.135.27:8550';

// Voters to register (add your wallet address here)
const VOTERS_TO_REGISTER = [
    {
        address: '0x7387059e7dc85391f0bf04ecc349d0d955636282',
        weight: 1
    }
    // Add more voters as needed
];

// Load Project ABI
let ProjectABI;
try {
    const Project = JSON.parse(fs.readFileSync('../jupyter-extension/src/abis/Project.json', 'utf8'));
    ProjectABI = Project.abi;
} catch (error) {
    console.log('❌ Could not load Project ABI');
    process.exit(1);
}

async function registerVoters() {
    try {
        console.log('👥 ===== VOTER REGISTRATION SCRIPT =====');
        console.log('📍 Project Address:', PROJECT_ADDRESS);
        console.log('🌐 RPC URL:', RPC_URL);
        console.log('');

        // Create provider
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        console.log('✅ Connected to blockchain');

        // You'll need to provide a private key or connect to MetaMask
        console.log('⚠️ IMPORTANT: This script requires a private key or signer');
        console.log('   To complete voter registration, you need:');
        console.log('   1. Project owner/coordinator private key');
        console.log('   2. Or connect via MetaMask in browser');
        console.log('');
        
        // Connect to Project contract
        const projectContract = new ethers.Contract(PROJECT_ADDRESS, ProjectABI, provider);
        
        // Get voting contract address
        const votingAddress = await projectContract.votingContract();
        console.log('🗳️ ALProjectVoting contract:', votingAddress);
        
        console.log('📋 Voters to register:');
        VOTERS_TO_REGISTER.forEach((voter, index) => {
            console.log(`   ${index + 1}. ${voter.address} (weight: ${voter.weight})`);
        });
        console.log('');
        
        console.log('🔧 To register these voters, run the following command:');
        console.log('');
        console.log('// In browser console with MetaMask connected:');
        console.log('const votingContract = new ethers.Contract(');
        console.log(`  "${votingAddress}",`);
        console.log('  ["function setVoters(address[] memory _voters, uint256[] memory _weights) external"],');
        console.log('  await new ethers.BrowserProvider(window.ethereum).getSigner()');
        console.log(');');
        console.log('');
        console.log('const voters = [');
        VOTERS_TO_REGISTER.forEach(voter => {
            console.log(`  "${voter.address}",`);
        });
        console.log('];');
        console.log('');
        console.log('const weights = [');
        VOTERS_TO_REGISTER.forEach(voter => {
            console.log(`  ${voter.weight},`);
        });
        console.log('];');
        console.log('');
        console.log('const tx = await votingContract.setVoters(voters, weights);');
        console.log('console.log("Transaction hash:", tx.hash);');
        console.log('await tx.wait();');
        console.log('console.log("✅ Voters registered successfully!");');
        console.log('');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the script
registerVoters();
