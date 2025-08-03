const { ethers } = require('ethers');
const fs = require('fs');

// Configuration
const PROJECT_ADDRESS = '0x59426a58c9Ca86F8A0543b6f18DED176FA9762F8';
const RPC_URL = 'http://145.100.135.27:8550';

// Vote details to verify
const SAMPLE_ID = 'sample_1_1_1753842991114';
const EXPECTED_VOTER = '0x7387059e7dc85391f0bf04ecc349d0d955636282';
const EXPECTED_LABEL = 'flower1';
const EXPECTED_BLOCK = 453284;
const TRANSACTION_HASH = '0xb852afccd554c1300f48aea0eef12855e9a024ed31d37faf801d7b9eb6ec570b';

// Load ABIs
let ProjectABI, VotingABI;

try {
    const Project = JSON.parse(fs.readFileSync('../jupyter-extension/src/abis/Project.json', 'utf8'));
    ProjectABI = Project.abi;
    console.log('✅ Loaded updated Project ABI');
} catch (error) {
    console.log('⚠️ Could not load Project ABI:', error.message);
    ProjectABI = [
        "function votingContract() view returns (address)",
        "function isParticipant(address) view returns (bool)",
        "function participantRoles(address) view returns (string)",
        "function participantWeights(address) view returns (uint256)",
        "function joinedAt(address) view returns (uint256)",
        "function getAllMembers() view returns (address[], string[], uint256[], uint256[])",
        "event VoteSubmitted(string sampleId, address voter, string label, uint256 timestamp)",
        "event ParticipantAutoAdded(address indexed participant, string role, uint256 weight)"
    ];
}

try {
    const Voting = JSON.parse(fs.readFileSync('../jupyter-extension/src/abis/ALProjectVoting.json', 'utf8'));
    VotingABI = Voting.abi;
    console.log('✅ Loaded updated ALProjectVoting ABI');
} catch (error) {
    console.log('⚠️ Could not load ALProjectVoting ABI:', error.message);
    VotingABI = [
        "function voterWeights(address) view returns (uint256)",
        "function getVotingSession(string) view returns (uint256, bool, bool, string)",
        "function submitVoteOnBehalf(string, string, address) external",
        "event VoteSubmitted(string sampleId, address indexed voter, string label, bool support, uint256 timestamp)"
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
            
            console.log(`🔍 Found ${votingEvents.length} ALProjectVoting VoteSubmitted event(s) for sample`);
            
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

        // ============== STEP 3: Voting Session Status ==============
        console.log('📋 === STEP 3: VOTING SESSION STATUS ===');
        try {
            const session = await votingContract.getVotingSession(SAMPLE_ID);
            console.log('🗳️ Voting Session Details:');
            console.log(`   Start Time: ${session[0]} (${session[0] > 0 ? new Date(Number(session[0]) * 1000).toISOString() : 'Not started'})`);
            console.log(`   Is Active: ${session[1]}`);
            console.log(`   Is Finalized: ${session[2]}`);
            console.log(`   Final Label: "${session[3]}" ${session[3] ? '✅' : '(not set)'}`);
            
            if (session[1] && !session[2]) {
                console.log('⏳ Session is still active (voting in progress)');
            } else if (session[2]) {
                console.log(`✅ Session finalized with label: "${session[3]}"`);
            } else {
                console.log('💤 Session not active');
            }
        } catch (error) {
            console.log('❌ Error getting voting session status:', error.message);
        }
        console.log('');

        // ============== STEP 4: VOTER & MEMBER VERIFICATION ==============
        console.log('📋 === STEP 4: VOTER & MEMBER VERIFICATION ===');
        try {
            const voterWeight = await votingContract.voterWeights(EXPECTED_VOTER);
            console.log(`👤 Voter ${EXPECTED_VOTER}:`);
            console.log(`   Weight in ALProjectVoting: ${voterWeight}`);
            console.log(`   Registered in ALProjectVoting: ${voterWeight > 0 ? 'YES ✅' : 'NO ❌'}`);
            
            // Check if voter is a project member
            const isProjectMember = await projectContract.isParticipant(EXPECTED_VOTER);
            console.log(`   Project Member: ${isProjectMember ? 'YES ✅' : 'NO ❌'}`);
            
            if (isProjectMember) {
                const memberRole = await projectContract.participantRoles(EXPECTED_VOTER);
                const memberWeight = await projectContract.participantWeights(EXPECTED_VOTER);
                const joinedAt = await projectContract.joinedAt(EXPECTED_VOTER);
                
                console.log(`   Role: ${memberRole}`);
                console.log(`   Project Weight: ${memberWeight}`);
                console.log(`   Joined At: ${new Date(Number(joinedAt) * 1000).toISOString()}`);
            }
            
            // Get all project members
            try {
                const [memberAddresses, roles, weights, joinTimestamps] = await projectContract.getAllMembers();
                console.log(`\n👥 Total Project Members: ${memberAddresses.length}`);
                for (let i = 0; i < memberAddresses.length; i++) {
                    console.log(`   ${i + 1}. ${memberAddresses[i]} (${roles[i]}, weight: ${weights[i]})`);
                }
            } catch (error) {
                console.log('   ⚠️ Could not fetch all members:', error.message);
            }
            
            if (voterWeight == 0 && !isProjectMember) {
                console.log('ℹ️ NOTE: With the new member-based system:');
                console.log('   - Users are automatically added as project members when they vote');
                console.log('   - Project.startBatchVoting() automatically sets voters from members');
                console.log('   - If no vote events found, the user may not have voted yet');
            } else if (isProjectMember && voterWeight == 0) {
                console.log('⚠️ WARNING: User is a project member but not registered in voting contract');
                console.log('   This might indicate the voting session hasn\'t been started yet');
            } else if (isProjectMember && voterWeight > 0) {
                console.log('✅ Perfect! User is both a project member and registered voter');
            }
        } catch (error) {
            console.log('❌ Error checking voter registration:', error.message);
        }
        console.log('');

        // ============== STEP 5: Summary ==============
        console.log('🎯 === VERIFICATION SUMMARY ===');
        console.log('');
        console.log('✅ New Member-Based Architecture:');
        console.log('   - Project.sol is the source of truth for all participants');
        console.log('   - Users are automatically added as project members when they vote');
        console.log('   - Project.startBatchVoting() automatically sets voters from eligible members');
        console.log('   - Roles: "creator", "contributor", "observer" (only creator/contributor can vote)');
        console.log('   - Seamless workflow: No manual voter registration required');
        console.log('');
        console.log('🔍 Key Findings:');
        console.log('   - Check if ALProjectVoting events were found above');
        console.log('   - Verify user is both project member AND registered voter');
        console.log('   - Verify voting session finalization status');
        console.log('   - Member registration should happen automatically');
        console.log('');
        console.log('🛠️ Troubleshooting:');
        console.log('   - If user is member but not voter: Check if voting session started');
        console.log('   - If no events found: Verify transaction hash and block number');
        console.log('   - If vote rejected: Check member role (must be creator/contributor)');
        console.log('   - If consensus not reached: Check if other members have voted');

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
