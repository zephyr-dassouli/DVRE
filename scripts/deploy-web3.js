require("dotenv").config();
const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");
const { registerMultipleFactories } = require("./registryHook");

const rpcURL = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const web3 = new Web3(rpcURL);

const account = web3.eth.accounts.privateKeyToAccount(privateKey);
web3.eth.accounts.wallet.add(account);

const userMetadataFactoryPath = path.join(__dirname, "../artifacts/contracts/UserMetadataFactory.sol/UserMetadataFactory.json");
const userMetadataFactoryJson = JSON.parse(fs.readFileSync(userMetadataFactoryPath));

const projectFactoryPath = path.join(__dirname, "../artifacts/contracts/ProjectFactory.sol/ProjectFactory.json");
const projectFactoryJson = JSON.parse(fs.readFileSync(projectFactoryPath));

const templateRegistryPath = path.join(__dirname, "../artifacts/contracts/ProjectTemplateRegistry.sol/ProjectTemplateRegistry.json");
const templateRegistryJson = JSON.parse(fs.readFileSync(templateRegistryPath));

const assetFactoryPath = path.join(__dirname, "../artifacts/contracts/AssetFactory.sol/AssetFactory.json");
const assetFactoryJson = JSON.parse(fs.readFileSync(assetFactoryPath));

// Load new AL project contracts
const jsonProjectPath = path.join(__dirname, "../artifacts/contracts/JSONProject.sol/JSONProject.json");
const jsonProjectJson = JSON.parse(fs.readFileSync(jsonProjectPath));

const alProjectVotingPath = path.join(__dirname, "../artifacts/contracts/ALProjectVoting.sol/ALProjectVoting.json");
const alProjectVotingJson = JSON.parse(fs.readFileSync(alProjectVotingPath));

const alProjectStoragePath = path.join(__dirname, "../artifacts/contracts/ALProjectStorage.sol/ALProjectStorage.json");
const alProjectStorageJson = JSON.parse(fs.readFileSync(alProjectStoragePath));

const deploy = async () => {
  console.log("Deploying new AL Project contract architecture...");
  console.log("Deploying with account:", account.address);

  // Deploy UserMetadataFactory
  console.log("\nDeploying UserMetadataFactory...");
  const userMetadataFactoryContract = new web3.eth.Contract(userMetadataFactoryJson.abi);
  const userMetadataFactoryDeployTx = userMetadataFactoryContract.deploy({ data: userMetadataFactoryJson.bytecode });

  const userMetadataFactoryGas = await userMetadataFactoryDeployTx.estimateGas();
  const userMetadataFactoryTx = {
    from: account.address,
    gas: Math.floor(Number(userMetadataFactoryGas) * 1.2),
    gasPrice: 0,
    data: userMetadataFactoryDeployTx.encodeABI()
  };

  const userMetadataFactorySignedTx = await web3.eth.accounts.signTransaction(userMetadataFactoryTx, privateKey);
  const userMetadataFactoryReceipt = await web3.eth.sendSignedTransaction(userMetadataFactorySignedTx.rawTransaction);
  console.log("UserMetadataFactory deployed at:", userMetadataFactoryReceipt.contractAddress);

  // Deploy ProjectTemplateRegistry
  console.log("\nDeploying ProjectTemplateRegistry...");
  const templateRegistryContract = new web3.eth.Contract(templateRegistryJson.abi);
  const templateRegistryDeployTx = templateRegistryContract.deploy({ data: templateRegistryJson.bytecode });

  const templateRegistryGas = await templateRegistryDeployTx.estimateGas();
  const templateRegistryTx = {
    from: account.address,
    gas: Math.floor(Number(templateRegistryGas) * 1.2),
    gasPrice: 0,
    data: templateRegistryDeployTx.encodeABI()
  };

  const templateRegistrySignedTx = await web3.eth.accounts.signTransaction(templateRegistryTx, privateKey);
  const templateRegistryReceipt = await web3.eth.sendSignedTransaction(templateRegistrySignedTx.rawTransaction);
  console.log("ProjectTemplateRegistry deployed at:", templateRegistryReceipt.contractAddress);

  // Deploy simplified ProjectFactory (no more library linking needed)
  console.log("\nDeploying ProjectFactory...");
  const projectFactoryContract = new web3.eth.Contract(projectFactoryJson.abi);
  const projectFactoryDeployTx = projectFactoryContract.deploy({ 
    data: projectFactoryJson.bytecode,
    arguments: [templateRegistryReceipt.contractAddress]
  });

  const projectFactoryGas = await projectFactoryDeployTx.estimateGas();
  const projectFactoryTx = {
    from: account.address,
    gas: Math.floor(Number(projectFactoryGas) * 1.2),
    gasPrice: 0,
    data: projectFactoryDeployTx.encodeABI()
  };

  const projectFactorySignedTx = await web3.eth.accounts.signTransaction(projectFactoryTx, privateKey);
  const projectFactoryReceipt = await web3.eth.sendSignedTransaction(projectFactorySignedTx.rawTransaction);
  console.log("ProjectFactory deployed at:", projectFactoryReceipt.contractAddress);

  // Deploy AssetFactory
  console.log("\nDeploying AssetFactory...");
  const assetFactoryContract = new web3.eth.Contract(assetFactoryJson.abi);
  const assetFactoryDeployTx = assetFactoryContract.deploy({ data: assetFactoryJson.bytecode });

  const assetFactoryGas = await assetFactoryDeployTx.estimateGas();
  const assetFactoryTx = {
    from: account.address,
    gas: Math.floor(Number(assetFactoryGas) * 1.2),
    gasPrice: 0,
    data: assetFactoryDeployTx.encodeABI()
  };

  const assetFactorySignedTx = await web3.eth.accounts.signTransaction(assetFactoryTx, privateKey);
  const assetFactoryReceipt = await web3.eth.sendSignedTransaction(assetFactorySignedTx.rawTransaction);
  console.log("AssetFactory deployed at:", assetFactoryReceipt.contractAddress);

  // Verify initial templates
  console.log("\nVerifying initial templates...");
  const templateRegistryInstance = new web3.eth.Contract(templateRegistryJson.abi, templateRegistryReceipt.contractAddress);
  const templateCount = await templateRegistryInstance.methods.getTemplateCount().call();
  console.log("Number of initial templates:", templateCount.toString());

  let alTemplateId = null;
  for (let i = 0; i < templateCount; i++) {
    const template = await templateRegistryInstance.methods.getTemplate(i).call();
    console.log(`Template ${i}: ${template[0]} (${template[2]})`);
    if (template[2] === 'active_learning') {
      alTemplateId = i;
    }
  }

  // AL contract deployment and testing commented out
  // The AL contracts will be deployed separately via DeploymentOrchestrator
  // when users create AL projects through the frontend
  
  /*
  // Deploy AL contracts for this project
  console.log("\nDeploying ALProjectVoting for test project...");
  const alVotingContract = new web3.eth.Contract(alProjectVotingJson.abi);
  const alVotingDeployTx = alVotingContract.deploy({ 
    data: alProjectVotingJson.bytecode,
    arguments: [projectAddress, "simple_majority", 3600] // 1 hour timeout
  });

  const alVotingGas = await alVotingDeployTx.estimateGas();
  const alVotingTx = {
    from: account.address,
    gas: Math.floor(Number(alVotingGas) * 1.2),
    gasPrice: 0,
    data: alVotingDeployTx.encodeABI()
  };

  const alVotingSignedTx = await web3.eth.accounts.signTransaction(alVotingTx, privateKey);
  const alVotingReceipt = await web3.eth.sendSignedTransaction(alVotingSignedTx.rawTransaction);
  console.log("ALProjectVoting deployed at:", alVotingReceipt.contractAddress);

  console.log("\nDeploying ALProjectStorage for test project...");
  const alStorageContract = new web3.eth.Contract(alProjectStorageJson.abi);
  const alStorageDeployTx = alStorageContract.deploy({ 
    data: alProjectStorageJson.bytecode,
    arguments: [projectAddress]
  });

  const alStorageGas = await alStorageDeployTx.estimateGas();
  const alStorageTx = {
    from: account.address,
    gas: Math.floor(Number(alStorageGas) * 1.2),
    gasPrice: 0,
    data: alStorageDeployTx.encodeABI()
  };

  const alStorageSignedTx = await web3.eth.accounts.signTransaction(alStorageTx, privateKey);
  const alStorageReceipt = await web3.eth.sendSignedTransaction(alStorageSignedTx.rawTransaction);
  console.log("ALProjectStorage deployed at:", alStorageReceipt.contractAddress);

  // Link AL contracts to the main project
  console.log("\nLinking AL contracts to main project...");
  const jsonProjectInstance = new web3.eth.Contract(jsonProjectJson.abi, projectAddress);
  
  await jsonProjectInstance.methods.linkALContracts(
    alVotingReceipt.contractAddress,
    alStorageReceipt.contractAddress
  ).send({
    from: account.address,
    gas: 200000,
    gasPrice: 0
  });
  console.log("AL contracts linked successfully");

  // Configure project metadata
  console.log("\nConfiguring project metadata...");
  await jsonProjectInstance.methods.setProjectMetadata(
    "Test AL Project",
    "A comprehensive test of the new AL architecture",
    "active_learning",
    "", // rocrateHash - will be set later
    "workflow_123"
  ).send({
    from: account.address,
    gas: 300000,
    gasPrice: 0
  });

  await jsonProjectInstance.methods.setALMetadata(
    "uncertainty_sampling",
    "text_classification",
    10,  // max iterations
    50,  // query batch size
    ["positive", "negative", "neutral"]  // label space
  ).send({
    from: account.address,
    gas: 300000,
    gasPrice: 0
  });
  console.log("Project configured with AL parameters");

  // Set up test voters
  console.log("\nSetting up test voters...");
  
  await jsonProjectInstance.methods.setProjectVoters([account.address], [1]).send({
    from: account.address,
    gas: 200000,
    gasPrice: 0
  });
  console.log("Test voters configured");

  // Test basic functionality
  console.log("\nTesting basic AL functionality...");
  
  // Trigger new round
  await jsonProjectInstance.methods.triggerNextRound("Initial test round").send({
    from: account.address,
    gas: 200000,
    gasPrice: 0
  });
  
  const currentRound = await jsonProjectInstance.methods.currentRound().call();
  console.log("Current round:", currentRound);

  // Start voting session
  await jsonProjectInstance.methods.startVotingSession("sample_001").send({
    from: account.address,
    gas: 200000,
    gasPrice: 0
  });
  
  const alVotingInstance = new web3.eth.Contract(alProjectVotingJson.abi, alVotingReceipt.contractAddress);
  const isVotingActive = await alVotingInstance.methods.isVotingActive("sample_001").call();
  console.log("Voting session active for sample_001:", isVotingActive);

  // Submit a test vote
  await alVotingInstance.methods.submitVote("sample_001", "positive", true).send({
    from: account.address,
    gas: 200000,
    gasPrice: 0
  });
  console.log("Test vote submitted successfully");
  */

  // Print summary
  console.log("\nDeployment completed successfully!");
  console.log("================================================");
  console.log("CONTRACT ADDRESSES:");
  console.log(`UserMetadataFactory:      ${userMetadataFactoryReceipt.contractAddress}`);
  console.log(`ProjectTemplateRegistry:  ${templateRegistryReceipt.contractAddress}`);
  console.log(`ProjectFactory:           ${projectFactoryReceipt.contractAddress}`);
  console.log(`AssetFactory:             ${assetFactoryReceipt.contractAddress}`);
  console.log("================================================");
  console.log(`\nDeployer: ${account.address}`);
  console.log(`\nNOTE: AL contracts (ALProjectVoting, ALProjectStorage) will be`);
  console.log(`deployed automatically when users create AL projects via the frontend.`);

  // Register all factories in FactoryRegistry (frontend needs these addresses)
  console.log("\nRegistering core infrastructure contracts in FactoryRegistry...");
  const factories = [
    { name: "UserMetadataFactory", address: userMetadataFactoryReceipt.contractAddress },
    { name: "ProjectTemplateRegistry", address: templateRegistryReceipt.contractAddress },
    { name: "ProjectFactory", address: projectFactoryReceipt.contractAddress },
    { name: "AssetFactory", address: assetFactoryReceipt.contractAddress }
    // Note: Per-project contracts (JSONProject, ALProjectVoting, ALProjectStorage) 
    // are discovered through the project's state, not the registry
  ];

  try {
    await registerMultipleFactories(factories);
    console.log("\nCore infrastructure contracts registered successfully in FactoryRegistry!");
    console.log("Per-project contracts are accessible through JSONProject.votingContract() and JSONProject.storageContract()");
  } catch (error) {
    console.error("\nError registering factories:", error.message);
  }

  // Save deployment info for frontend integration
  const deploymentInfo = {
    network: "local",
    timestamp: new Date().toISOString(),
    deployer: account.address,
    coreInfrastructure: {
      UserMetadataFactory: userMetadataFactoryReceipt.contractAddress,
      ProjectTemplateRegistry: templateRegistryReceipt.contractAddress,
      ProjectFactory: projectFactoryReceipt.contractAddress,
      AssetFactory: assetFactoryReceipt.contractAddress
    },
    note: "AL contracts (ALProjectVoting, ALProjectStorage) are deployed separately when users create AL projects via the frontend DeploymentOrchestrator.",
    alContractDeployment: {
      method: "DeploymentOrchestrator",
      description: "AL contracts are deployed on-demand per project through the frontend interface."
    }
  };
  
  console.log("\nDeployment completed!");
  console.log("Core infrastructure contracts are registered in FactoryRegistry");
  console.log("AL contracts will be deployed per-project through the frontend");
  
  return deploymentInfo;
};

deploy().catch(console.error);
