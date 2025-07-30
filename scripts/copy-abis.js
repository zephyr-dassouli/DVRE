#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to copy all compiled contract ABIs from artifacts to jupyter-extension/src/abis
 * 
 * Usage: node scripts/copy-abis.js
 */

const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts', 'contracts');
const DESTINATION_DIR = path.join(__dirname, '..', 'jupyter-extension', 'src', 'abis');

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dirPath}`);
    }
}

function copyABIFiles(sourceDir, destDir) {
    const copiedFiles = [];
    
    function processDirectory(currentDir, relativePath = '') {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const itemPath = path.join(currentDir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                // Recursively process subdirectories
                processDirectory(itemPath, path.join(relativePath, item));
            } else if (stat.isFile() && item.endsWith('.json') && !item.endsWith('.dbg.json')) {
                // Copy .json files but skip .dbg.json debug files
                const destPath = path.join(destDir, item);
                
                try {
                    fs.copyFileSync(itemPath, destPath);
                    copiedFiles.push({
                        name: item,
                        source: itemPath,
                        dest: destPath,
                        size: (stat.size / 1024).toFixed(1) + 'KB'
                    });
                } catch (error) {
                    console.error(`❌ Failed to copy ${item}:`, error.message);
                }
            }
        }
    }
    
    processDirectory(sourceDir);
    return copiedFiles;
}

function main() {
    console.log('🚀 Starting ABI copy process...\n');
    
    // Check if source directory exists
    if (!fs.existsSync(ARTIFACTS_DIR)) {
        console.error(`❌ Source directory not found: ${ARTIFACTS_DIR}`);
        console.log('💡 Run "npx hardhat compile" first to generate artifacts');
        process.exit(1);
    }
    
    // Ensure destination directory exists
    ensureDirectoryExists(DESTINATION_DIR);
    
    // Copy ABI files
    console.log(`📂 Copying ABIs from: ${ARTIFACTS_DIR}`);
    console.log(`📂 Copying ABIs to: ${DESTINATION_DIR}\n`);
    
    const copiedFiles = copyABIFiles(ARTIFACTS_DIR, DESTINATION_DIR);
    
    if (copiedFiles.length === 0) {
        console.log('⚠️  No ABI files found to copy');
        return;
    }
    
    // Display results
    console.log('✅ Successfully copied the following ABIs:\n');
    
    const contractFiles = copiedFiles.filter(f => !f.name.startsWith('I')); // Main contracts
    const interfaceFiles = copiedFiles.filter(f => f.name.startsWith('I')); // Interfaces
    
    if (contractFiles.length > 0) {
        console.log('📋 Main Contracts:');
        contractFiles.forEach(file => {
            console.log(`   • ${file.name} (${file.size})`);
        });
        console.log('');
    }
    
    if (interfaceFiles.length > 0) {
        console.log('🔗 Interfaces:');
        interfaceFiles.forEach(file => {
            console.log(`   • ${file.name} (${file.size})`);
        });
        console.log('');
    }
    
    console.log(`🎉 Total: ${copiedFiles.length} ABI files copied successfully!`);
    console.log('\n💡 The frontend can now use the updated contract ABIs.');
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { copyABIFiles, ensureDirectoryExists }; 