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

// Load AL deployment contracts
const alProjectLinkerPath = path.join(__dirname, "../artifacts/contracts/ALProjectLinker.sol/ALProjectLinker.json");
const alProjectLinkerJson = JSON.parse(fs.readFileSync(alProjectLinkerPath));

const alProjectDeployerPath = path.join(__dirname, "../artifacts/contracts/ALProjectDeployer.sol/ALProjectDeployer.json");
const alProjectDeployerJson = JSON.parse(fs.readFileSync(alProjectDeployerPath));

// Load AL contract bytecodes (for ALProjectDeployer constructor)
const projectPath = path.join(__dirname, "../artifacts/contracts/Project.sol/Project.json");
const projectJson = JSON.parse(fs.readFileSync(projectPath));

const alProjectPath = path.join(__dirname, "../artifacts/contracts/ALProject.sol/ALProject.json");
const alProjectJson = JSON.parse(fs.readFileSync(alProjectPath));

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

  // Deploy ALProjectLinker
  console.log("\nDeploying ALProjectLinker...");
  const alProjectLinkerContract = new web3.eth.Contract(alProjectLinkerJson.abi);
  const alProjectLinkerDeployTx = alProjectLinkerContract.deploy({ data: alProjectLinkerJson.bytecode });

  const alProjectLinkerGas = await alProjectLinkerDeployTx.estimateGas();
  const alProjectLinkerTx = {
    from: account.address,
    gas: Math.floor(Number(alProjectLinkerGas) * 1.2),
    gasPrice: 0,
    data: alProjectLinkerDeployTx.encodeABI()
  };

  const alProjectLinkerSignedTx = await web3.eth.accounts.signTransaction(alProjectLinkerTx, privateKey);
  const alProjectLinkerReceipt = await web3.eth.sendSignedTransaction(alProjectLinkerSignedTx.rawTransaction);
  console.log("ALProjectLinker deployed at:", alProjectLinkerReceipt.contractAddress);

  // Deploy ALProjectDeployer
  console.log("\nDeploying ALProjectDeployer...");
  const alProjectDeployerContract = new web3.eth.Contract(alProjectDeployerJson.abi);
  
  // ALProjectDeployer needs bytecodes and addresses as constructor parameters
  const alProjectDeployerDeployTx = alProjectDeployerContract.deploy({ 
    data: alProjectDeployerJson.bytecode,
    arguments: [
      alProjectJson.bytecode,        // ALProject bytecode
      alProjectVotingJson.bytecode,  // ALProjectVoting bytecode  
      alProjectStorageJson.bytecode, // ALProjectStorage bytecode
      alProjectLinkerReceipt.contractAddress, // ALProjectLinker address
      assetFactoryReceipt.contractAddress     // AssetFactory address
    ]
  });

  const alProjectDeployerGas = await alProjectDeployerDeployTx.estimateGas();
  const alProjectDeployerTx = {
    from: account.address,
    gas: Math.floor(Number(alProjectDeployerGas) * 1.2),
    gasPrice: 0,
    data: alProjectDeployerDeployTx.encodeABI()
  };

  const alProjectDeployerSignedTx = await web3.eth.accounts.signTransaction(alProjectDeployerTx, privateKey);
  const alProjectDeployerReceipt = await web3.eth.sendSignedTransaction(alProjectDeployerSignedTx.rawTransaction);
  console.log("ALProjectDeployer deployed at:", alProjectDeployerReceipt.contractAddress);

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

  // Print summary
  console.log("\nDeployment completed successfully!");
  console.log("================================================");
  console.log("CONTRACT ADDRESSES:");
  console.log(`UserMetadataFactory:      ${userMetadataFactoryReceipt.contractAddress}`);
  console.log(`ProjectTemplateRegistry:  ${templateRegistryReceipt.contractAddress}`);
  console.log(`ProjectFactory:           ${projectFactoryReceipt.contractAddress}`);
  console.log(`AssetFactory:             ${assetFactoryReceipt.contractAddress}`);
  console.log(`ALProjectLinker:          ${alProjectLinkerReceipt.contractAddress}`);
  console.log(`ALProjectDeployer:        ${alProjectDeployerReceipt.contractAddress}`);
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
    { name: "AssetFactory", address: assetFactoryReceipt.contractAddress },
    { name: "ALProjectLinker", address: alProjectLinkerReceipt.contractAddress },
    { name: "ALProjectDeployer", address: alProjectDeployerReceipt.contractAddress }
    // Note: Per-project contracts (Project, ALProjectVoting, ALProjectStorage) 
    // are discovered through the project's state, not the registry
  ];

  try {
    await registerMultipleFactories(factories);
    console.log("\nCore infrastructure contracts registered successfully in FactoryRegistry!");
    console.log("Per-project contracts are accessible through Project.votingContract() and Project.storageContract()");
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
      AssetFactory: assetFactoryReceipt.contractAddress,
      ALProjectLinker: alProjectLinkerReceipt.contractAddress,
      ALProjectDeployer: alProjectDeployerReceipt.contractAddress
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
