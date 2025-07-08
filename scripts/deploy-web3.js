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

// Load new JSON project system contracts
const templateRegistryPath = path.join(__dirname, "../artifacts/contracts/ProjectTemplateRegistry.sol/ProjectTemplateRegistry.json");
const templateRegistryJson = JSON.parse(fs.readFileSync(templateRegistryPath));

const deploy = async () => {
  console.log("Deploying all contracts with account:", account.address);

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

  // Deploy ProjectFactory (JSON-based system)
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

  // Verify initial templates
  console.log("\nVerifying initial templates...");
  const templateRegistryInstance = new web3.eth.Contract(templateRegistryJson.abi, templateRegistryReceipt.contractAddress);
  const templateCount = await templateRegistryInstance.methods.getTemplateCount().call();
  console.log("Number of initial templates:", templateCount.toString());

  for (let i = 0; i < templateCount; i++) {
    const template = await templateRegistryInstance.methods.getTemplate(i).call();
    console.log(`Template ${i}: ${template[0]} (${template[2]})`);
  }

  // Print summary
  console.log("\n=== Deployment Summary ===");
  console.log("Deployed Contracts:");
  console.log(`  UserMetadataFactory:      ${userMetadataFactoryReceipt.contractAddress}`);
  console.log(`  ProjectTemplateRegistry:  ${templateRegistryReceipt.contractAddress}`);
  console.log(`  ProjectFactory:           ${projectFactoryReceipt.contractAddress}`);
  console.log(`\nDeployer: ${account.address}`);

  // Register all factories in FactoryRegistry (frontend needs these addresses)
  console.log("\nRegistering all factories in FactoryRegistry...");
  const factories = [
    { name: "UserMetadataFactory", address: userMetadataFactoryReceipt.contractAddress },
    { name: "ProjectTemplateRegistry", address: templateRegistryReceipt.contractAddress },
    { name: "ProjectFactory", address: projectFactoryReceipt.contractAddress }
  ];

  try {
    await registerMultipleFactories(factories);
    console.log("\nAll factories registered successfully in FactoryRegistry!");
  } catch (error) {
    console.error("\nError registering factories:", error.message);
  }
};

deploy().catch(console.error);
