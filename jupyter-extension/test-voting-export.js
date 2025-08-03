#!/usr/bin/env node

/**
 * Test script to manually export voting results from blockchain to AL-Engine format
 * Usage: node test-voting-export.js PROJECT_CONTRACT_ADDRESS
 */

const fs = require('fs');
const path = require('path');

// Mock voting results for testing (replace with actual blockchain data)
function createMockVotingResults(projectId, round) {
  return [
    {
      original_index: 66,
      final_label: "b",
      sample_data: {
        "sepal length (cm)": 6.2,
        "sepal width (cm)": 3.4,
        "petal length (cm)": 5.4,
        "petal width (cm)": 2.3,
        original_index: 66
      },
      votes: {
        "0xuser1": "b",
        "0xuser2": "b"
      },
      consensus: true,
      timestamp: new Date().toISOString()
    },
    {
      original_index: 94,
      final_label: "c",
      sample_data: {
        "sepal length (cm)": 6.3,
        "sepal width (cm)": 3.4,
        "petal length (cm)": 5.6,
        "petal width (cm)": 2.4,
        original_index: 94
      },
      votes: {
        "0xuser1": "c",
        "0xuser2": "b",
        "0xuser3": "c"
      },
      consensus: true,
      timestamp: new Date().toISOString()
    }
  ];
}

async function exportVotingResults() {
  const projectId = process.argv[2] || '0x3F23304F01F045F0e1389CC23FC0F09175146FC5';
  
  console.log(`🧪 Testing voting results export for project: ${projectId}`);
  
  // Create voting results for round 1
  const round1Results = createMockVotingResults(projectId, 1);
  
  // Determine output path
  const outputDir = path.join(__dirname, '..', 'al-engine', 'ro-crates', projectId, 'outputs');
  const outputPath = path.join(outputDir, 'voting_results_round_1.json');
  
  try {
    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }
    
    // Write voting results
    fs.writeFileSync(outputPath, JSON.stringify(round1Results, null, 2));
    
    console.log(`✅ Successfully created mock voting results:`);
    console.log(`   File: ${outputPath}`);
    console.log(`   Samples: ${round1Results.length}`);
    console.log(`   Labels: ${round1Results.map(r => r.final_label).join(', ')}`);
    
    // Verify file exists
    if (fs.existsSync(outputPath)) {
      console.log(`🔍 Verification: File exists and is readable`);
      
      // Show what AL-Engine will see
      console.log(`\n📄 AL-Engine will see this voting data:`);
      round1Results.forEach((result, index) => {
        console.log(`   Sample ${index + 1}: index ${result.original_index} → label "${result.final_label}"`);
      });
      
      console.log(`\n🔄 Next steps:`);
      console.log(`   1. Restart AL-Engine to pick up the voting results`);
      console.log(`   2. Start iteration 2 in the frontend`);
      console.log(`   3. Check if training data grows from 10 to 12 samples`);
      console.log(`   4. Check if performance scores become more realistic`);
      
    } else {
      console.error(`❌ Failed to create file: ${outputPath}`);
    }
    
  } catch (error) {
    console.error(`❌ Error creating voting results:`, error);
  }
}

exportVotingResults(); 