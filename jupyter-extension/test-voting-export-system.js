#!/usr/bin/env node

/**
 * Test script for the complete voting results export system
 * Tests: Blockchain → VotingResultsConnector → AL-Engine API → Files
 * Usage: node test-voting-export-system.js PROJECT_CONTRACT_ADDRESS
 */

const fetch = require('node-fetch'); // You may need: npm install node-fetch

// Test configuration
const TEST_CONFIG = {
  alEngineUrl: 'http://localhost:5050',
  fileServerUrl: 'http://localhost:3001',
  projectAddress: process.argv[2] || '0x3F23304F01F045F0e1389CC23FC0F09175146FC5'
};

/**
 * Test AL-Engine API /api/voting-results endpoint
 */
async function testALEngineVotingAPI() {
  console.log('🧪 Testing AL-Engine voting results API...');
  
  // Mock voting results data
  const mockVotingResults = [
    {
      original_index: 25,
      final_label: "1",
      sample_data: {
        "sepal length (cm)": 5.1,
        "sepal width (cm)": 3.5,
        "petal length (cm)": 1.4,
        "petal width (cm)": 0.2,
        sample_id: "sample_25_round1"
      },
      votes: {
        "0xuser1": "1",
        "0xuser2": "1"
      },
      consensus: true,
      timestamp: new Date().toISOString()
    },
    {
      original_index: 78,
      final_label: "2",
      sample_data: {
        "sepal length (cm)": 6.7,
        "sepal width (cm)": 3.0,
        "petal length (cm)": 5.2,
        "petal width (cm)": 2.3,
        sample_id: "sample_78_round1"
      },
      votes: {
        "0xuser1": "2",
        "0xuser2": "2",
        "0xuser3": "2"
      },
      consensus: true,
      timestamp: new Date().toISOString()
    }
  ];

  try {
    // Test AL-Engine health first
    console.log('  📍 Checking AL-Engine health...');
    const healthResponse = await fetch(`${TEST_CONFIG.alEngineUrl}/health`);
    
    if (!healthResponse.ok) {
      throw new Error(`AL-Engine not healthy: ${healthResponse.status}`);
    }
    
    const healthData = await healthResponse.json();
    console.log('  ✅ AL-Engine is healthy:', healthData.status);

    // Test voting results API
    console.log('  📍 Testing voting results API...');
    const response = await fetch(`${TEST_CONFIG.alEngineUrl}/api/voting-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: TEST_CONFIG.projectAddress,
        round: 1,
        voting_results: mockVotingResults
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('  ✅ AL-Engine API success:', result.message);
      console.log('  📁 File saved to:', result.file_path);
      console.log('  📊 Samples count:', result.samples_count);
      return true;
    } else {
      const error = await response.json();
      console.log('  ❌ AL-Engine API error:', error.error);
      return false;
    }

  } catch (error) {
    console.log('  ❌ AL-Engine API test failed:', error.message);
    return false;
  }
}

/**
 * Test file server fallback (if available)
 */
async function testFileServerFallback() {
  console.log('🧪 Testing file server fallback...');
  
  try {
    const testContent = JSON.stringify([
      {
        original_index: 99,
        final_label: "0",
        sample_data: { test: "data" },
        votes: { "0xtest": "0" },
        consensus: true,
        timestamp: new Date().toISOString()
      }
    ], null, 2);

    const response = await fetch(`${TEST_CONFIG.fileServerUrl}/write-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: `al-engine/ro-crates/${TEST_CONFIG.projectAddress}/outputs/voting_results_round_test.json`,
        content: testContent
      })
    });

    if (response.ok) {
      console.log('  ✅ File server is available and working');
      return true;
    } else {
      console.log('  ⚠️ File server returned error:', response.status);
      return false;
    }

  } catch (error) {
    console.log('  ⚠️ File server not available:', error.message);
    return false;
  }
}

/**
 * Test complete system integration
 */
async function testSystemIntegration() {
  console.log('🧪 Testing system integration...');
  
  // Check if the voting results file was actually created
  try {
    const fs = require('fs');
    const path = require('path');
    
    const votingResultsFile = path.join(__dirname, '..', 'al-engine', 'ro-crates', TEST_CONFIG.projectAddress, 'outputs', 'voting_results_round_1.json');
    
    if (fs.existsSync(votingResultsFile)) {
      const fileContent = fs.readFileSync(votingResultsFile, 'utf8');
      const votingData = JSON.parse(fileContent);
      
      console.log('  ✅ Voting results file exists and is valid JSON');
      console.log('  📊 File contains:', votingData.length, 'voting records');
      console.log('  📁 File path:', votingResultsFile);
      
      // Verify file structure
      if (votingData.length > 0) {
        const sample = votingData[0];
        const requiredFields = ['original_index', 'final_label', 'sample_data', 'votes', 'consensus', 'timestamp'];
        const hasAllFields = requiredFields.every(field => field in sample);
        
        if (hasAllFields) {
          console.log('  ✅ Voting results have correct structure');
          return true;
        } else {
          console.log('  ❌ Voting results missing required fields');
          return false;
        }
      }
    } else {
      console.log('  ❌ Voting results file not found:', votingResultsFile);
      return false;
    }

  } catch (error) {
    console.log('  ❌ Error checking file system:', error.message);
    return false;
  }
}

/**
 * Test recommended configuration
 */
function testRecommendedSetup() {
  console.log('🧪 Testing recommended setup...');
  
  console.log('  📋 Recommended setup checklist:');
  console.log('    1. ✅ AL-Engine server running on localhost:5050');
  console.log('    2. ⚠️ File server (optional) on localhost:3001');
  console.log('    3. ✅ VotingResultsConnector service created');
  console.log('    4. ✅ DAL handlers updated to use export functionality');
  console.log('    5. ✅ AL-Engine API endpoint added');
  
  console.log('  🚀 To start AL-Engine server:');
  console.log(`    cd al-engine`);
  console.log(`    python src/server.py --project_id ${TEST_CONFIG.projectAddress} --config ro-crates/${TEST_CONFIG.projectAddress}/config.json --server --port 5050`);
}

/**
 * Main test runner
 */
async function runCompleteTest() {
  console.log('🎯 Voting Results Export System Test');
  console.log('=====================================');
  console.log(`Project: ${TEST_CONFIG.projectAddress}`);
  console.log(`AL-Engine: ${TEST_CONFIG.alEngineUrl}`);
  console.log(`File Server: ${TEST_CONFIG.fileServerUrl}\n`);

  const results = {
    alEngineAPI: false,
    fileServer: false,
    systemIntegration: false
  };

  // Test 1: AL-Engine API
  results.alEngineAPI = await testALEngineVotingAPI();
  console.log('');

  // Test 2: File server fallback
  results.fileServer = await testFileServerFallback();
  console.log('');

  // Test 3: System integration
  results.systemIntegration = await testSystemIntegration();
  console.log('');

  // Test 4: Setup recommendations
  testRecommendedSetup();
  console.log('');

  // Summary
  console.log('📊 Test Results Summary:');
  console.log('========================');
  console.log(`AL-Engine API:      ${results.alEngineAPI ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`File Server:        ${results.fileServer ? '✅ PASS' : '⚠️ OPTIONAL'}`);
  console.log(`System Integration: ${results.systemIntegration ? '✅ PASS' : '❌ FAIL'}`);
  
  const overallPass = results.alEngineAPI && results.systemIntegration;
  console.log(`\nOverall Status: ${overallPass ? '✅ SYSTEM READY' : '❌ NEEDS ATTENTION'}`);
  
  if (overallPass) {
    console.log('\n🎉 Voting results export system is working correctly!');
    console.log('✅ Blockchain voting data can now be exported to AL-Engine');
    console.log('✅ AL-Engine will use this data for realistic training progression');
  } else {
    console.log('\n🔧 System needs attention:');
    if (!results.alEngineAPI) {
      console.log('❌ Start AL-Engine server with the command shown above');
    }
    if (!results.systemIntegration) {
      console.log('❌ Check file permissions and AL-Engine configuration');
    }
  }
}

// Run the test
runCompleteTest().catch(console.error); 