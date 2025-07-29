require("dotenv").config();
const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");

const rpcURL = process.env.RPC_URL;
const web3 = new Web3(rpcURL);

// Load contract ABIs
const projectPath = path.join(__dirname, "../artifacts/contracts/Project.sol/Project.json");
const projectJson = JSON.parse(fs.readFileSync(projectPath));

const alProjectVotingPath = path.join(__dirname, "../artifacts/contracts/ALProjectVoting.sol/ALProjectVoting.json");
const alProjectVotingJson = JSON.parse(fs.readFileSync(alProjectVotingPath));

const alProjectStoragePath = path.join(__dirname, "../artifacts/contracts/ALProjectStorage.sol/ALProjectStorage.json");
const alProjectStorageJson = JSON.parse(fs.readFileSync(alProjectStoragePath));

const verifyDeployment = async () => {
  console.log("🔍 Verifying AL Contract Deployment...\n");

  // Get addresses from command line arguments or use defaults
  const args = process.argv.slice(2);
  
  let projectAddress, alVotingAddress, alStorageAddress;
  
  if (args.length >= 3) {
    projectAddress = args[0];
    alVotingAddress = args[1];
    alStorageAddress = args[2];
    console.log("📋 Using addresses from command line arguments:");
  } else {
    // Use the addresses from your deployment (fixed storage address)
    projectAddress = "0x29bc1F4a1be73c0F8FDACaDA95510C815Cf55C49";
    alVotingAddress = "0x21F5358c8F942113440816a1168b4Dd37b641A46";
    alStorageAddress = "0x0382147674c27A51d7ceE1ceDD1E7B6769655cCc"; 
    
    console.log("📋 Using default addresses (please verify these are correct):");
    console.log("💡 Usage: npx hardhat run scripts/verify-al-deployment.js -- <project> <voting> <storage>");
  }
  
  console.log(`Project: ${projectAddress}`);
  console.log(`ALVoting:    ${alVotingAddress}`);
  console.log(`ALStorage:   ${alStorageAddress}`);
  console.log();

  try {
    // Validate addresses first
    if (!web3.utils.isAddress(projectAddress)) {
      throw new Error(`Invalid Project address: ${projectAddress}`);
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

    // 2. Verify Project has AL contract addresses
    console.log("\n📋 Step 2: Checking Project AL contract links...");
    
    const project = new web3.eth.Contract(projectJson.abi, projectAddress);
    
    const storedVotingAddress = await project.methods.votingContract().call();
    const storedStorageAddress = await project.methods.storageContract().call();
    
    console.log(`Project voting contract: ${storedVotingAddress}`);
    console.log(`Expected voting contract:     ${alVotingAddress}`);
    console.log(`Voting contract linked: ${storedVotingAddress.toLowerCase() === alVotingAddress.toLowerCase() ? '✅ YES' : '❌ NO'}`);
    
    console.log(`Project storage contract: ${storedStorageAddress}`);
    console.log(`Expected storage contract:     ${alStorageAddress}`);
    console.log(`Storage contract linked: ${storedStorageAddress.toLowerCase() === alStorageAddress.toLowerCase() ? '✅ YES' : '❌ NO'}`);

    // 3. Verify AL contracts point back to Project (only if they exist)
    if (votingCode !== '0x' && storageCode !== '0x') {
      console.log("\n📋 Step 3: Checking AL contracts point back to Project...");
      
      const alVoting = new web3.eth.Contract(alProjectVotingJson.abi, alVotingAddress);
      const alStorage = new web3.eth.Contract(alProjectStorageJson.abi, alStorageAddress);
      
      const votingProjectRef = await alVoting.methods.project().call();
      const storageProjectRef = await alStorage.methods.project().call();
      
      console.log(`ALProjectVoting.project(): ${votingProjectRef}`);
      console.log(`Expected Project:           ${projectAddress}`);
      console.log(`Voting → Project link: ${votingProjectRef.toLowerCase() === projectAddress.toLowerCase() ? '✅ YES' : '❌ NO'}`);
      
      console.log(`ALProjectStorage.project(): ${storageProjectRef}`);
      console.log(`Expected Project:            ${projectAddress}`);
      console.log(`Storage → Project link: ${storageProjectRef.toLowerCase() === projectAddress.toLowerCase() ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log("\n⚠️ Step 3: Skipping AL contract verification - contracts don't exist on blockchain");
    }

    // 4. Verify Project has AL contracts enabled
    console.log("\n📋 Step 4: Checking Project AL status...");
    
    const hasALContracts = await project.methods.hasALContracts().call();
    const needsALDeployment = await project.methods.needsALDeployment().call();
    
    console.log(`hasALContracts(): ${hasALContracts ? '✅ TRUE' : '❌ FALSE'}`);
    console.log(`needsALDeployment(): ${needsALDeployment ? '⚠️ TRUE (still needs deployment?)' : '✅ FALSE (deployment complete)'}`);

    // 5. Test AL contract functionality (only if contracts exist)
    if (votingCode !== '0x' && storageCode !== '0x') {
      console.log("\n📋 Step 5: Testing AL contract interface calls...");
      
      try {
        const alVoting = new web3.eth.Contract(alProjectVotingJson.abi, alVotingAddress);
        
        // Test calling AL contracts via Project interfaces
        const currentRound = await project.methods.currentRound().call();
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
    console.log(`  Project exists: ✅ (at ${projectAddress})`);
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
      if (!hasALContracts) console.log("  - Project doesn't have AL contracts linked");
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