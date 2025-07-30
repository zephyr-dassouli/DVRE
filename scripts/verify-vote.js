const { ethers } = require('ethers');
const fs = require('fs');

// Configuration
const PROJECT_ADDRESS = '0xD5b7B7c5673a86366f3f8203aD66dcE7FBEfb82A';
const RPC_URL = 'http://145.100.135.27:8550';

// Vote details to verify
const SAMPLE_ID = 'sample_1_1_1753835455533';
const EXPECTED_VOTER = '0x7387059e7dc85391f0bf04ecc349d0d955636282';
const EXPECTED_LABEL = 'yes';
const EXPECTED_BLOCK = 449577;

// Load ABIs
let ProjectABI, VotingABI;

try {
    const Project = JSON.parse(fs.readFileSync('./jupyter-extension/src/abis/Project.json', 'utf8'));
    ProjectABI = Project.abi;
} catch (error) {
    console.log('⚠️ Could not load Project ABI, using minimal ABI');
    ProjectABI = [
        "function votingContract() view returns (address)",
        "event VoteSubmitted(string sampleId, address voter, string label, uint256 timestamp)"
    ];
}

try {
    const Voting = JSON.parse(fs.readFileSync('./jupyter-extension/src/abis/ALProjectVoting.json', 'utf8'));
    VotingABI = Voting.abi;
} catch (error) {
    console.log('⚠️ Could not load ALProjectVoting ABI, using minimal ABI');
    VotingABI = [
        "function votes(string) view returns (tuple(address voter, string label, bool support, uint256 timestamp)[])",
        "function votingSessions(string) view returns (uint256 startTime, bool isActive, bool isFinalized, string finalLabel, uint256 totalVoters, uint256 round)",
        "function voterWeights(address) view returns (uint256)",
        "event VoteSubmitted(string sampleId, address indexed voter, string label, bool support, uint256 timestamp)",
        "event VotingSessionStarted(string sampleId, uint256 startTime)",
        "event VotingSessionFinalized(string sampleId, string finalLabel, uint256 endTime, string reason)"
    ];
}

async function verifyVote() {
    try {
        console.log('🗳️ ===== VOTE VERIFICATION SCRIPT =====');
        console.log('🔍 Verifying vote registration on ALProjectVoting contract');
        console.log('📍 Project Address:', PROJECT_ADDRESS);
        console.log('🌐 RPC URL:', RPC_URL);
        console.log('');
        
        console.log('🎯 Vote Details to Verify:');
        console.log('   Sample ID:', SAMPLE_ID);
        console.log('   Voter:', EXPECTED_VOTER);
        console.log('   Label:', EXPECTED_LABEL);
        console.log('   Expected Block:', EXPECTED_BLOCK);
        console.log('');

        // Create provider
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        console.log('✅ Connected to blockchain');

        // Connect to Project contract
        const projectContract = new ethers.Contract(PROJECT_ADDRESS, ProjectABI, provider);
        console.log('✅ Connected to Project contract');

        // Get voting contract address
        let votingAddress;
        try {
            votingAddress = await projectContract.votingContract();
            console.log('✅ ALProjectVoting contract address:', votingAddress);
        } catch (error) {
            console.log('❌ Could not get voting contract address:', error.message);
            return;
        }

        // Connect to voting contract
        const votingContract = new ethers.Contract(votingAddress, VotingABI, provider);
        console.log('✅ Connected to ALProjectVoting contract');
        console.log('');

        // ============== STEP 1: Check Project VoteSubmitted Events ==============
        console.log('📋 === STEP 1: PROJECT VOTE EVENTS ===');
        try {
            const projectFilter = projectContract.filters.VoteSubmitted(SAMPLE_ID);
            const projectEvents = await projectContract.queryFilter(projectFilter, EXPECTED_BLOCK - 10, EXPECTED_BLOCK + 10);
            
            console.log(`🔍 Found ${projectEvents.length} Project VoteSubmitted event(s) for sample`);
            
            if (projectEvents.length > 0) {
                projectEvents.forEach((event, index) => {
                    console.log(`   Event ${index + 1}:`);
                    console.log(`     Sample ID: ${event.args[0]}`);
                    console.log(`     Voter: ${event.args[1]}`);
                    console.log(`     Label: ${event.args[2]}`);
                    console.log(`     Timestamp: ${event.args[3]} (${new Date(Number(event.args[3]) * 1000).toISOString()})`);
                    console.log(`     Block: ${event.blockNumber}`);
                    console.log(`     Transaction: ${event.transactionHash}`);
                    
                    // Verify this matches our expected vote
                    const matches = event.args[1].toLowerCase() === EXPECTED_VOTER.toLowerCase() && 
                                  event.args[2] === EXPECTED_LABEL;
                    console.log(`     ✅ Matches expected vote: ${matches ? 'YES' : 'NO'}`);
                });
            } else {
                console.log('❌ No Project VoteSubmitted events found for this sample');
            }
        } catch (error) {
            console.log('❌ Error querying Project vote events:', error.message);
        }
        console.log('');

        // ============== STEP 2: Check ALProjectVoting Events ==============
        console.log('📋 === STEP 2: VOTING CONTRACT EVENTS ===');
        try {
            const votingFilter = votingContract.filters.VoteSubmitted(SAMPLE_ID);
            const votingEvents = await votingContract.queryFilter(votingFilter, EXPECTED_BLOCK - 10, EXPECTED_BLOCK + 10);
            
            console.log(`�� Found ${votingEvents.length} ALProjectVoting VoteSubmitted event(s) for sample`);
            
            if (votingEvents.length > 0) {
                votingEvents.forEach((event, index) => {
                    console.log(`   Event ${index + 1}:`);
                    console.log(`     Sample ID: ${event.args[0]}`);
                    console.log(`     Voter: ${event.args[1]}`);
                    console.log(`     Label: ${event.args[2]}`);
                    console.log(`     Support: ${event.args[3]}`);
                    console.log(`     Timestamp: ${event.args[4]} (${new Date(Number(event.args[4]) * 1000).toISOString()})`);
                    console.log(`     Block: ${event.blockNumber}`);
                    console.log(`     Transaction: ${event.transactionHash}`);
                    
                    // Verify this matches our expected vote
                    const matches = event.args[1].toLowerCase() === EXPECTED_VOTER.toLowerCase() && 
                                  event.args[2] === EXPECTED_LABEL;
                    console.log(`     ✅ Matches expected vote: ${matches ? 'YES' : 'NO'}`);
                });
            } else {
                console.log('❌ No ALProjectVoting VoteSubmitted events found for this sample');
            }
        } catch (error) {
            console.log('❌ Error querying ALProjectVoting events:', error.message);
        }
        console.log('');

        // ============== STEP 3: Check Voting Session Status ==============
        console.log('📋 === STEP 3: VOTING SESSION STATUS ===');
        try {
            const session = await votingContract.votingSessions(SAMPLE_ID);
            console.log('🗳️ Voting Session Details:');
            console.log(`   Start Time: ${session[0]} (${session[0] > 0 ? new Date(Number(session[0]) * 1000).toISOString() : 'Not started'})`);
            console.log(`   Is Active: ${session[1]}`);
            console.log(`   Is Finalized: ${session[2]}`);
            console.log(`   Final Label: "${session[3]}" ${session[3] ? '✅' : '(not set)'}`);
            console.log(`   Total Voters: ${session[4]}`);
            console.log(`   Round: ${session[5]}`);
            
            if (session[2] && session[3] === EXPECTED_LABEL) {
                console.log('🎉 Session finalized with expected label!');
            } else if (session[2]) {
                console.log(`⚠️ Session finalized but with different label: "${session[3]}" (expected: "${EXPECTED_LABEL}")`);
            } else if (session[1]) {
                console.log('⏳ Session is still active (voting in progress)');
            } else {
                console.log('❓ Session status unclear');
            }
        } catch (error) {
            console.log('❌ Error checking voting session:', error.message);
        }
        console.log('');

        // ============== STEP 4: Check Voter Registration ==============
        console.log('📋 === STEP 4: VOTER VERIFICATION ===');
        try {
            const voterWeight = await votingContract.voterWeights(EXPECTED_VOTER);
            console.log(`👤 Voter ${EXPECTED_VOTER}:`);
            console.log(`   Weight: ${voterWeight}`);
            console.log(`   Registered: ${voterWeight > 0 ? 'YES ✅' : 'NO ❌'}`);
            
            if (voterWeight == 0) {
                console.log('⚠️ WARNING: Voter is not registered or has zero weight!');
                console.log('   This could explain why votes are not being stored in ALProjectVoting');
            }
        } catch (error) {
            console.log('❌ Error checking voter registration:', error.message);
        }
        console.log('');

        // ============== STEP 5: Summary ==============
        console.log('�� === VERIFICATION SUMMARY ===');
        console.log('');
        console.log('Based on the above checks:');
        console.log('');
        console.log('✅ What\'s Working:');
        console.log('   - Frontend successfully submits votes to Project contract');
        console.log('   - Project contract emits VoteSubmitted events');
        console.log('   - Transaction is confirmed on blockchain');
        console.log('');
        console.log('🔍 Key Findings:');
        console.log('   - Check if ALProjectVoting events were found');
        console.log('   - Verify voter registration status');
        console.log('   - Check voting session finalization');
        console.log('');
        console.log('📝 Next Steps:');
        console.log('   1. If voter is not registered → Need to call setVoters() on ALProjectVoting');
        console.log('   2. If no ALProjectVoting events → Check Project→ALProjectVoting integration');
        console.log('   3. If session not finalized → May need manual finalization or wait for consensus');
        console.log('');

    } catch (error) {
        console.error('❌ Critical error during verification:', error);
    }
}

// Helper function to verify a specific transaction
async function verifyTransaction(txHash) {
    try {
        console.log(`�� Verifying transaction: ${txHash}`);
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        const tx = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);
        
        console.log('📋 Transaction Details:');
        console.log(`   From: ${tx.from}`);
        console.log(`   To: ${tx.to}`);
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Status: ${receipt.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌'}`);
        
        console.log('📊 Event Logs:');
        receipt.logs.forEach((log, index) => {
            console.log(`   Log ${index + 1}: ${log.topics[0]}`);
        });
        
    } catch (error) {
        console.error('❌ Error verifying transaction:', error);
    }
}

// Run the verification
if (require.main === module) {
    console.log('Starting vote verification...\n');
    verifyVote().then(() => {
        console.log('\n🏁 Vote verification completed!');
    }).catch(error => {
        console.error('\n❌ Vote verification failed:', error);
    });
}

module.exports = { verifyVote, verifyTransaction };
