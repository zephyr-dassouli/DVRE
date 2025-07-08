require("dotenv").config();
const { Web3 } = require("web3");

/**
 * Hook to register a factory in the FactoryRegistry contract
 * @param {string} factoryName - The name to register the factory under
 * @param {string} factoryAddress - The deployed factory contract address
 * @param {string} registryAddress - The FactoryRegistry contract address (optional, defaults to standard address)
 * @returns {Promise<string>} - Transaction hash of the registration
 */
async function registerFactory(factoryName, factoryAddress, registryAddress = "0x0000000000000000000000000000000000001000") {
    const rpcURL = process.env.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;
    
    if (!rpcURL || !privateKey) {
        throw new Error("Missing RPC_URL or PRIVATE_KEY in environment variables");
    }

    const web3 = new Web3(rpcURL);
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);

    // FactoryRegistry ABI - only the register function
    const factoryRegistryABI = [
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "name",
                    "type": "string"
                },
                {
                    "internalType": "address",
                    "name": "factory",
                    "type": "address"
                }
            ],
            "name": "register",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    try {
        console.log(`Registering factory "${factoryName}" at address ${factoryAddress}...`);
        
        const registryContract = new web3.eth.Contract(factoryRegistryABI, registryAddress);
        
        // Estimate gas for the registration
        const gasEstimate = await registryContract.methods.register(factoryName, factoryAddress).estimateGas({
            from: account.address
        });

        // Create and send the transaction
        const tx = {
            from: account.address,
            to: registryAddress,
            gas: Math.floor(Number(gasEstimate) * 1.2), // Add 20% buffer
            gasPrice: 0, // Assuming free gas like in your deploy script
            data: registryContract.methods.register(factoryName, factoryAddress).encodeABI()
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        console.log(`   Factory "${factoryName}" registered successfully!`);
        console.log(`   Transaction hash: ${receipt.transactionHash}`);
        console.log(`   Block number: ${receipt.blockNumber}`);

        return receipt.transactionHash;

    } catch (error) {
        console.error(`Failed to register factory "${factoryName}":`, error.message);
        throw error;
    }
}

/**
 * Convenience function to register multiple factories at once
 * @param {Array<{name: string, address: string}>} factories - Array of factory objects with name and address
 * @param {string} registryAddress - The FactoryRegistry contract address (optional)
 * @returns {Promise<Array<string>>} - Array of transaction hashes
 */
async function registerMultipleFactories(factories, registryAddress = "0x0000000000000000000000000000000000001000") {
    const txHashes = [];
    
    console.log(`Registering ${factories.length} factories in FactoryRegistry...`);
    console.log("=".repeat(60));

    for (const factory of factories) {
        try {
            const txHash = await registerFactory(factory.name, factory.address, registryAddress);
            txHashes.push(txHash);
        } catch (error) {
            console.error(`Failed to register ${factory.name}: ${error.message}`);
            // Continue with other factories even if one fails
        }
    }

    console.log("\nRegistration Summary:");
    console.log("=".repeat(30));
    console.log(`Successfully registered: ${txHashes.length}/${factories.length} factories`);
    
    return txHashes;
}

module.exports = {
    registerFactory,
    registerMultipleFactories
};
