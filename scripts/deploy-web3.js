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

const assetFactoryPath = path.join(__dirname, "../artifacts/contracts/AssetFactory.sol/AssetFactory.json");
const assetFactoryJson = JSON.parse(fs.readFileSync(assetFactoryPath));

// Load WorkflowLibrary for linking
const workflowLibraryPath = path.join(__dirname, "../artifacts/contracts/WorkflowLibrary.sol/WorkflowLibrary.json");
const workflowLibraryJson = JSON.parse(fs.readFileSync(workflowLibraryPath));

// Function to link library addresses in bytecode
function linkLibrary(bytecode, placeholder, libraryAddress) {
  // Remove 0x prefix from address and ensure it's 40 characters (20 bytes)
  const address = libraryAddress.slice(2).toLowerCase();
  // Escape the $ characters for regex
  const escapedPlaceholder = placeholder.replace(/\$/g, '\\$');
  const linkedBytecode = bytecode.replace(new RegExp(escapedPlaceholder, 'g'), address);
  
  // Verify linking worked
  if (linkedBytecode.includes(placeholder)) {
    throw new Error(`Library linking failed: placeholder ${placeholder} still present`);
  }
  
  return linkedBytecode;
}

const deploy = async () => {
  console.log("Deploying all contracts with account:", account.address);

  // Deploy WorkflowLibrary first
  console.log("\nDeploying WorkflowLibrary...");
  const workflowLibraryContract = new web3.eth.Contract(workflowLibraryJson.abi);
  const workflowLibraryDeployTx = workflowLibraryContract.deploy({ data: workflowLibraryJson.bytecode });

  const workflowLibraryGas = await workflowLibraryDeployTx.estimateGas();
  const workflowLibraryTx = {
    from: account.address,
    gas: Math.floor(Number(workflowLibraryGas) * 1.2),
    gasPrice: 0,
    data: workflowLibraryDeployTx.encodeABI()
  };

  const workflowLibrarySignedTx = await web3.eth.accounts.signTransaction(workflowLibraryTx, privateKey);
  const workflowLibraryReceipt = await web3.eth.sendSignedTransaction(workflowLibrarySignedTx.rawTransaction);
  console.log("WorkflowLibrary deployed at:", workflowLibraryReceipt.contractAddress);

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

  // Deploy ProjectFactory with linked WorkflowLibrary
  console.log("\nDeploying ProjectFactory...");
  
  // Link WorkflowLibrary to ProjectFactory bytecode
  const placeholder = '__$11cad8bab9bcc8d77d0860a93c9bc9898e$__';
  const linkedProjectFactoryBytecode = linkLibrary(
    projectFactoryJson.bytecode,
    placeholder,
    workflowLibraryReceipt.contractAddress
  );
  
  console.log("Library linked successfully");
  console.log("Template registry address:", templateRegistryReceipt.contractAddress);
  
  const projectFactoryContract = new web3.eth.Contract(projectFactoryJson.abi);
  const projectFactoryDeployTx = projectFactoryContract.deploy({ 
    data: linkedProjectFactoryBytecode,
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

  for (let i = 0; i < templateCount; i++) {
    const template = await templateRegistryInstance.methods.getTemplate(i).call();
    console.log(`Template ${i}: ${template[0]} (${template[2]})`);
  }

  // Print summary
  console.log("\n=== Deployment Summary ===");
  console.log("Deployed Contracts:");
  console.log(`  WorkflowLibrary:          ${workflowLibraryReceipt.contractAddress}`);
  console.log(`  UserMetadataFactory:      ${userMetadataFactoryReceipt.contractAddress}`);
  console.log(`  ProjectTemplateRegistry:  ${templateRegistryReceipt.contractAddress}`);
  console.log(`  ProjectFactory:           ${projectFactoryReceipt.contractAddress}`);
  console.log(`  AssetFactory:             ${assetFactoryReceipt.contractAddress}`);
  console.log(`\nDeployer: ${account.address}`);

  // Register all factories in FactoryRegistry (frontend needs these addresses)
  console.log("\nRegistering all factories in FactoryRegistry...");
  const factories = [
    { name: "WorkflowLibrary", address: workflowLibraryReceipt.contractAddress },
    { name: "UserMetadataFactory", address: userMetadataFactoryReceipt.contractAddress },
    { name: "ProjectTemplateRegistry", address: templateRegistryReceipt.contractAddress },
    { name: "ProjectFactory", address: projectFactoryReceipt.contractAddress },
    { name: "AssetFactory", address: assetFactoryReceipt.contractAddress }
  ];

  try {
    await registerMultipleFactories(factories);
    console.log("\nAll factories registered successfully in FactoryRegistry!");
  } catch (error) {
    console.error("\nError registering factories:", error.message);
  }
};

deploy().catch(console.error);
