const { ethers } = require('ethers');
const fs = require('fs');

// Contract address to debug
const CONTRACT_ADDRESS = '0xE37d47DD4d4541b6f4Bd278B2c7714C062B55680';

// RPC URL - using localhost since we're debugging local deployment
const RPC_URL = 'http://145.100.135.27:8550';

// Load ABIs
const Project = JSON.parse(fs.readFileSync('./jupyter-extension/src/abis/Project.json', 'utf8'));
const ALProjectVoting = JSON.parse(fs.readFileSync('./jupyter-extension/src/abis/ALProjectVoting.json', 'utf8'));

async function debugVotingIssue() {
  try {
    console.log('🔍 DEBUGGING VOTING ISSUE');
    console.log('📍 Contract:', CONTRACT_ADDRESS);
    console.log('🌐 RPC:', RPC_URL);
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Create project contract instance
    const projectContract = new ethers.Contract(CONTRACT_ADDRESS, Project.abi, provider);
    
    console.log('\n👥 === PROJECT PARTICIPANTS ===');
    try {
      const participants = await projectContract.getAllParticipants();
      const [addresses, roles, weights, joinTimes] = participants;
      
      console.log('📊 Total participants:', addresses.length);
      for (let i = 0; i < addresses.length; i++) {
        console.log(`${i + 1}. ${addresses[i]}`);
        console.log(`   Role: ${roles[i]}`);
        console.log(`   Weight: ${weights[i].toString()}`);
        console.log(`   Joined: ${new Date(Number(joinTimes[i]) * 1000).toISOString()}`);
      }
    } catch (error) {
      console.log('❌ Failed to get participants:', error.message);
      return;
    }
    
    console.log('\n🗳️ === VOTING CONTRACT STATUS ===');
    try {
      const votingContractAddress = await projectContract.votingContract();
      
      if (!votingContractAddress || votingContractAddress === ethers.ZeroAddress) {
        console.log('❌ No voting contract linked to this project');
        return;
      }
      
      console.log('✅ Voting contract:', votingContractAddress);
      
      // Create voting contract instance
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, provider);
      
      // Get registered voters
      const voterList = await votingContract.getVoterList();
      console.log('\n👨‍🗳️ REGISTERED VOTERS:', voterList.length);
      
      for (let i = 0; i < voterList.length; i++) {
        const voter = voterList[i];
        console.log(`${i + 1}. ${voter.addr}`);
        console.log(`   Weight: ${voter.weight.toString()}`);
      }
      
      console.log('\n🔍 === VOTING SESSION ANALYSIS ===');
      
      // Get current round and batch status
      const currentRound = await votingContract.currentRound();
      console.log('📊 Current Round:', currentRound.toString());
      
      if (Number(currentRound) > 0) {
        try {
          const batchStatus = await votingContract.getBatchStatus(currentRound);
          const [isActive, totalSamples, completedSamples, remainingSamples, startTime] = batchStatus;
          
          console.log('📦 BATCH STATUS:');
          console.log('   Active:', isActive);
          console.log('   Total samples:', totalSamples.toString());
          console.log('   Completed:', completedSamples.toString());
          console.log('   Remaining:', remainingSamples.toString());
          console.log('   Started:', new Date(Number(startTime) * 1000).toISOString());
          
          if (Number(totalSamples) > 0) {
            // Get sample IDs for this batch
            const sampleIds = await votingContract.getBatchSamples(currentRound);
            console.log('📋 Sample IDs:', sampleIds);
            
            // Check each sample's voting status
            console.log('\n🗳️ INDIVIDUAL SAMPLE STATUS:');
            for (let i = 0; i < sampleIds.length; i++) {
              const sampleId = sampleIds[i];
              try {
                const sessionStatus = await votingContract.getVotingSessionStatus(sampleId);
                const [sessionIsActive, isFinalized, finalLabel, sessionStartTime, timeRemaining, votedCount, totalVoters] = sessionStatus;
                
                console.log(`\n📄 Sample ${i + 1}: ${sampleId}`);
                console.log(`   Session Active: ${sessionIsActive}`);
                console.log(`   Finalized: ${isFinalized}`);
                console.log(`   Final Label: ${finalLabel || '(none)'}`);
                console.log(`   Voted Count: ${votedCount.toString()}`);
                console.log(`   Total Voters: ${totalVoters.toString()}`);
                console.log(`   Time Remaining: ${timeRemaining.toString()}s`);
                
                // Get individual votes for this sample
                const votes = await votingContract.getVotes(sampleId);
                console.log(`   Individual Votes: ${votes.length}`);
                for (let j = 0; j < votes.length; j++) {
                  const vote = votes[j];
                  console.log(`     ${j + 1}. ${vote.voter} → ${vote.label} (support: ${vote.support})`);
                }
                
                // Check if session should still be active
                if (Number(votedCount) < Number(totalVoters) && sessionIsActive) {
                  console.log('   ✅ Session correctly active (waiting for more votes)');
                } else if (Number(votedCount) >= Number(totalVoters) && !sessionIsActive) {
                  console.log('   ✅ Session correctly finalized (all voters participated)');
                } else if (Number(votedCount) < Number(totalVoters) && !sessionIsActive) {
                  console.log('   ❌ ISSUE: Session finalized prematurely!');
                  console.log(`       Only ${votedCount}/${totalVoters} voters participated`);
                }
                
              } catch (sampleError) {
                console.log(`❌ Failed to get status for sample ${sampleId}:`, sampleError.message);
              }
            }
          }
          
        } catch (batchError) {
          console.log('❌ Failed to get batch status:', batchError.message);
        }
      }
      
      console.log('\n🎯 === DIAGNOSIS ===');
      const participants = await projectContract.getAllParticipants();
      const participantCount = participants[0].length;
      const voterCount = voterList.length;
      
      if (participantCount !== voterCount) {
        console.log('❌ CRITICAL ISSUE: Participant/Voter count mismatch');
        console.log(`   Project participants: ${participantCount}`);
        console.log(`   Registered voters: ${voterCount}`);
        console.log('   🔧 Solution: All participants should be auto-registered as voters');
      } else {
        console.log('✅ Participant/Voter counts match');
      }
      
      // Check for specific addresses missing from voter registration
      const participantAddresses = participants[0].map(addr => addr.toLowerCase());
      const voterAddresses = voterList.map(voter => voter.addr.toLowerCase());
      
      const missingVoters = participantAddresses.filter(addr => !voterAddresses.includes(addr));
      if (missingVoters.length > 0) {
        console.log('❌ MISSING VOTERS:', missingVoters);
      }
      
      const extraVoters = voterAddresses.filter(addr => !participantAddresses.includes(addr));
      if (extraVoters.length > 0) {
        console.log('⚠️ EXTRA VOTERS (not participants):', extraVoters);
      }
      
    } catch (error) {
      console.log('❌ Failed to analyze voting contract:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Debugging failed:', error);
  }
}

// Run the debugging
debugVotingIssue(); 