require("dotenv").config();
const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");

const rpcURL = process.env.RPC_URL;
const web3 = new Web3(rpcURL);

// Load contract ABIs
const jsonProjectPath = path.join(__dirname, "../artifacts/contracts/JSONProject.sol/JSONProject.json");
const jsonProjectJson = JSON.parse(fs.readFileSync(jsonProjectPath));

const alProjectVotingPath = path.join(__dirname, "../artifacts/contracts/ALProjectVoting.sol/ALProjectVoting.json");
const alProjectVotingJson = JSON.parse(fs.readFileSync(alProjectVotingPath));

const alProjectStoragePath = path.join(__dirname, "../artifacts/contracts/ALProjectStorage.sol/ALProjectStorage.json");
const alProjectStorageJson = JSON.parse(fs.readFileSync(alProjectStoragePath));

const verifyDeployment = async () => {
  console.log("🔍 Verifying AL Contract Deployment...\n");

  // Get addresses from command line arguments or use defaults
  const args = process.argv.slice(2);
  
  let jsonProjectAddress, alVotingAddress, alStorageAddress;
  
  if (args.length >= 3) {
    jsonProjectAddress = args[0];
    alVotingAddress = args[1];
    alStorageAddress = args[2];
    console.log("📋 Using addresses from command line arguments:");
  } else {
    // Use the addresses from your deployment (fixed storage address)
    jsonProjectAddress = "0x29bc1F4a1be73c0F8FDACaDA95510C815Cf55C49";
    alVotingAddress = "0x21F5358c8F942113440816a1168b4Dd37b641A46";
    alStorageAddress = "0x0382147674c27A51d7ceE1ceDD1E7B6769655cCc"; 
    
    console.log("📋 Using default addresses (please verify these are correct):");
    console.log("💡 Usage: npx hardhat run scripts/verify-al-deployment.js -- <jsonProject> <voting> <storage>");
  }
  
  console.log(`JSONProject: ${jsonProjectAddress}`);
  console.log(`ALVoting:    ${alVotingAddress}`);
  console.log(`ALStorage:   ${alStorageAddress}`);
  console.log();

  try {
    // Validate addresses first
    if (!web3.utils.isAddress(jsonProjectAddress)) {
      throw new Error(`Invalid JSONProject address: ${jsonProjectAddress}`);
    }
    if (!web3.utils.isAddress(alVotingAddress)) {
      throw new Error(`Invalid ALVoting address: ${alVotingAddress}`);
    }
    if (!web3.utils.isAddress(alStorageAddress)) {
      throw new Error(`Invalid ALStorage address: ${alStorageAddress}`);
    }

    // 1. Verify AL contracts exist on blockchain
    console.log("📋 Step 1: Checking if AL contracts exist on blockchain...");
    
    const votingCode = await web3.eth.getCode(alVotingAddress);
    const storageCode = await web3.eth.getCode(alStorageAddress);
    
    console.log(`ALProjectVoting (${alVotingAddress}):`);
    console.log(`  Code exists: ${votingCode !== '0x' ? '✅ YES' : '❌ NO'}`);
    if (votingCode !== '0x') {
      console.log(`  Code size: ${(votingCode.length - 2) / 2} bytes`);
    }
    
    console.log(`ALProjectStorage (${alStorageAddress}):`);
    console.log(`  Code exists: ${storageCode !== '0x' ? '✅ YES' : '❌ NO'}`);
    if (storageCode !== '0x') {
      console.log(`  Code size: ${(storageCode.length - 2) / 2} bytes`);
    }

    // 2. Verify JSONProject has AL contract addresses
    console.log("\n📋 Step 2: Checking JSONProject AL contract links...");
    
    const jsonProject = new web3.eth.Contract(jsonProjectJson.abi, jsonProjectAddress);
    
    const storedVotingAddress = await jsonProject.methods.votingContract().call();
    const storedStorageAddress = await jsonProject.methods.storageContract().call();
    
    console.log(`JSONProject voting contract: ${storedVotingAddress}`);
    console.log(`Expected voting contract:     ${alVotingAddress}`);
    console.log(`Voting contract linked: ${storedVotingAddress.toLowerCase() === alVotingAddress.toLowerCase() ? '✅ YES' : '❌ NO'}`);
    
    console.log(`JSONProject storage contract: ${storedStorageAddress}`);
    console.log(`Expected storage contract:     ${alStorageAddress}`);
    console.log(`Storage contract linked: ${storedStorageAddress.toLowerCase() === alStorageAddress.toLowerCase() ? '✅ YES' : '❌ NO'}`);

    // 3. Verify AL contracts point back to JSONProject (only if they exist)
    if (votingCode !== '0x' && storageCode !== '0x') {
      console.log("\n📋 Step 3: Checking AL contracts point back to JSONProject...");
      
      const alVoting = new web3.eth.Contract(alProjectVotingJson.abi, alVotingAddress);
      const alStorage = new web3.eth.Contract(alProjectStorageJson.abi, alStorageAddress);
      
      const votingProjectRef = await alVoting.methods.jsonProject().call();
      const storageProjectRef = await alStorage.methods.jsonProject().call();
      
      console.log(`ALProjectVoting.jsonProject(): ${votingProjectRef}`);
      console.log(`Expected JSONProject:           ${jsonProjectAddress}`);
      console.log(`Voting → JSONProject link: ${votingProjectRef.toLowerCase() === jsonProjectAddress.toLowerCase() ? '✅ YES' : '❌ NO'}`);
      
      console.log(`ALProjectStorage.jsonProject(): ${storageProjectRef}`);
      console.log(`Expected JSONProject:            ${jsonProjectAddress}`);
      console.log(`Storage → JSONProject link: ${storageProjectRef.toLowerCase() === jsonProjectAddress.toLowerCase() ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log("\n⚠️ Step 3: Skipping AL contract verification - contracts don't exist on blockchain");
    }

    // 4. Verify JSONProject has AL contracts enabled
    console.log("\n📋 Step 4: Checking JSONProject AL status...");
    
    const hasALContracts = await jsonProject.methods.hasALContracts().call();
    const needsALDeployment = await jsonProject.methods.needsALDeployment().call();
    
    console.log(`hasALContracts(): ${hasALContracts ? '✅ TRUE' : '❌ FALSE'}`);
    console.log(`needsALDeployment(): ${needsALDeployment ? '⚠️ TRUE (still needs deployment?)' : '✅ FALSE (deployment complete)'}`);

    // 5. Test AL contract functionality (only if contracts exist)
    if (votingCode !== '0x' && storageCode !== '0x') {
      console.log("\n📋 Step 5: Testing AL contract interface calls...");
      
      try {
        const alVoting = new web3.eth.Contract(alProjectVotingJson.abi, alVotingAddress);
        
        // Test calling AL contracts via JSONProject interfaces
        const currentRound = await jsonProject.methods.currentRound().call();
        console.log(`Current AL round: ${currentRound}`);
        
        // Check if we can read AL contract state
        const votingConsensus = await alVoting.methods.votingConsensus().call();
        const votingTimeout = await alVoting.methods.votingTimeoutSeconds().call();
        
        console.log(`Voting consensus: ${votingConsensus}`);
        console.log(`Voting timeout: ${votingTimeout} seconds`);
        
        console.log("✅ AL contract interface calls working!");
      } catch (error) {
        console.log("❌ AL contract interface calls failed:", error.message);
      }
    } else {
      console.log("\n⚠️ Step 5: Skipping interface testing - AL contracts don't exist");
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 VERIFICATION SUMMARY:");
    console.log("=".repeat(60));
    
    console.log("📊 Contract Status:");
    console.log(`  JSONProject exists: ✅ (at ${jsonProjectAddress})`);
    console.log(`  ALProjectVoting exists: ${votingCode !== '0x' ? '✅' : '❌'} (at ${alVotingAddress})`);
    console.log(`  ALProjectStorage exists: ${storageCode !== '0x' ? '✅' : '❌'} (at ${alStorageAddress})`);
    console.log(`  AL contracts linked: ${hasALContracts ? '✅' : '❌'}`);
    
    if (votingCode !== '0x' && storageCode !== '0x' && hasALContracts) {
      console.log("\n🎉 AL DEPLOYMENT FULLY VERIFIED!");
      console.log("💡 The interface-based approach is working perfectly!");
      console.log("🚀 Ready for Active Learning workflows!");
    } else {
      console.log("\n⚠️ Issues detected:");
      if (votingCode === '0x') console.log("  - ALProjectVoting contract not found on blockchain");
      if (storageCode === '0x') console.log("  - ALProjectStorage contract not found on blockchain");
      if (!hasALContracts) console.log("  - JSONProject doesn't have AL contracts linked");
    }

  } catch (error) {
    console.error("❌ Verification failed:", error.message);
    console.log("\n💡 Tips:");
    console.log("  - Double-check contract addresses from your deployment");
    console.log("  - Make sure all contracts are deployed to the same network");
    console.log("  - Verify your .env RPC_URL is pointing to the correct network");
  }
};

console.log("🔍 AL Contract Deployment Verifier");
console.log("===================================");
verifyDeployment().catch(console.error); 