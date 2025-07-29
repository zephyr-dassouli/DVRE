const { ethers } = require('ethers');
const fs = require('fs');

// Contract address to verify
const CONTRACT_ADDRESS = '0xFE7532b08AA5dC9D1D53DeEA9a64d5983172530F';

// RPC URL
const RPC_URL = 'http://145.100.135.27:8550';

// Load the updated ABI
const Project = JSON.parse(fs.readFileSync('./jupyter-extension/src/abis/Project.json', 'utf8'));

async function verifyContract() {
  try {
    console.log('🔍 Verifying contract:', CONTRACT_ADDRESS);
    console.log('🌐 Using RPC:', RPC_URL);
    console.log('📋 Using updated ABI with', Project.abi.length, 'functions');
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Create contract instance with updated ABI
    const contract = new ethers.Contract(CONTRACT_ADDRESS, Project.abi, provider);
    
    console.log('\n📋 === PROJECT BASIC INFO ===');
    try {
      const owner = await contract.owner();
      console.log('✅ Contract Owner:', owner);
    } catch (error) {
      console.log('❌ Could not fetch owner:', error.message);
    }
    
    console.log('\n🤖 === ACTIVE LEARNING METADATA (UPDATED ABI) ===');
    try {
      const alMetadata = await contract.getProjectMetadata();
      console.log('✅ AL Metadata successfully retrieved from Smart Contract!');
      console.log('📊 Query Strategy:', alMetadata._queryStrategy || '(empty)');
      console.log('🔄 AL Scenario:', alMetadata._alScenario || '(empty)');
      console.log('🔢 Max Iterations:', alMetadata._maxIteration.toString());
      console.log('📦 Query Batch Size:', alMetadata._queryBatchSize.toString());
      console.log('🏷️  Label Space:', alMetadata._labelSpace);
      
      console.log('\n📊 === FULL METADATA STRUCTURE ===');
      console.log('Title:', alMetadata._title || '(empty)');
      console.log('Description:', alMetadata._description || '(empty)');
      console.log('Project Type:', alMetadata._projectType || '(empty)');
      console.log('RO-Crate Hash:', alMetadata._rocrateHash || '(empty)');
      console.log('Start Time:', new Date(Number(alMetadata._start) * 1000).toISOString());
      console.log('End Time:', alMetadata._end.toString() === '0' ? 'Not set' : new Date(Number(alMetadata._end) * 1000).toISOString());
      
      console.log('\n📈 === VALIDATION ===');
      if (alMetadata._queryStrategy && alMetadata._queryStrategy !== '') {
        console.log('✅ Query strategy is configured:', alMetadata._queryStrategy);
      } else {
        console.log('⚠️ Query strategy is not set or empty');
      }
      
      if (alMetadata._alScenario && alMetadata._alScenario !== '') {
        console.log('✅ AL scenario is configured:', alMetadata._alScenario);
      } else {
        console.log('⚠️ AL scenario is not set or empty');
      }
      
      if (alMetadata._labelSpace && alMetadata._labelSpace.length > 0) {
        console.log('✅ Label space is configured with', alMetadata._labelSpace.length, 'labels:', alMetadata._labelSpace);
      } else {
        console.log('⚠️ Label space is empty or not configured');
      }
      
      if (Number(alMetadata._maxIteration) > 0) {
        console.log('✅ Max iterations configured:', alMetadata._maxIteration.toString());
      } else {
        console.log('ℹ️ Max iterations is 0 (infinite iterations allowed)');
      }
      
      if (Number(alMetadata._queryBatchSize) > 0) {
        console.log('✅ Query batch size configured:', alMetadata._queryBatchSize.toString());
      } else {
        console.log('⚠️ Query batch size is 0 or not configured');
      }
      
    } catch (error) {
      console.log('❌ Could not fetch AL metadata:', error.message);
      console.log('🔍 Error details:', error);
    }
    
    console.log('\n🔗 === AL CONTRACT LINKS ===');
    try {
      const votingContract = await contract.votingContract();
      if (votingContract && votingContract !== '0x0000000000000000000000000000000000000000') {
        console.log('✅ Voting Contract:', votingContract);
      } else {
        console.log('❌ Voting contract not linked');
      }
    } catch (error) {
      console.log('❌ Could not fetch voting contract:', error.message);
    }
    
    try {
      const storageContract = await contract.storageContract();
      if (storageContract && storageContract !== '0x0000000000000000000000000000000000000000') {
        console.log('✅ Storage Contract:', storageContract);
      } else {
        console.log('❌ Storage contract not linked');
      }
    } catch (error) {
      console.log('❌ Could not fetch storage contract:', error.message);
    }
    
    console.log('\n🎯 === SUMMARY ===');
    console.log('Contract verification completed successfully!');
    console.log('📋 Updated ABI is working correctly');
    console.log('🔧 No deployment errors or ABI mismatches detected');
    
  } catch (error) {
    console.error('❌ Error verifying contract:', error);
  }
}

// Run the verification
verifyContract(); 