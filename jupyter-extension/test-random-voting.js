#!/usr/bin/env node

/**
 * Test script for AL training with random voting using numeric labels (0,1,2)
 * This script simulates multiple rounds of random voting to test training progression
 * Usage: node test-random-voting.js PROJECT_CONTRACT_ADDRESS [NUM_ROUNDS]
 */

const fs = require('fs');
const path = require('path');

// Configuration for testing
const TEST_CONFIG = {
  labels: [0, 1, 2],
  labelNames: ['setosa', 'versicolor', 'virginica'], // For reference
  rounds: 3,
  samplesPerRound: 2
};

/**
 * Generate random voting results for a round
 */
function generateRandomVotingResults(round, samplesPerRound = 2) {
  const results = [];
  
  // Generate random sample indices and labels
  for (let i = 0; i < samplesPerRound; i++) {
    const originalIndex = Math.floor(Math.random() * 131) + 10; // Random index from unlabeled pool
    const finalLabel = TEST_CONFIG.labels[Math.floor(Math.random() * TEST_CONFIG.labels.length)];
    
    // Generate 2-3 random votes per sample
    const numVoters = Math.floor(Math.random() * 2) + 2; // 2-3 voters
    const votes = {};
    const voterLabels = [];
    
    for (let v = 0; v < numVoters; v++) {
      const voterAddress = `0xuser${v + 1}`;
      const voterLabel = TEST_CONFIG.labels[Math.floor(Math.random() * TEST_CONFIG.labels.length)];
      votes[voterAddress] = voterLabel;
      voterLabels.push(voterLabel);
    }
    
    // Determine final label by majority vote (or random if tie)
    const labelCounts = {};
    voterLabels.forEach(label => {
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    });
    
    const maxCount = Math.max(...Object.values(labelCounts));
    const majorityLabels = Object.keys(labelCounts).filter(label => labelCounts[label] === maxCount);
    const actualFinalLabel = majorityLabels.length === 1 ? 
      parseInt(majorityLabels[0]) : 
      finalLabel; // Use random if tie
    
    const consensus = majorityLabels.length === 1;
    
    // Generate random sample features (iris-like)
    const sampleData = {
      "sepal length (cm)": (Math.random() * 3 + 4).toFixed(1),
      "sepal width (cm)": (Math.random() * 2 + 2).toFixed(1), 
      "petal length (cm)": (Math.random() * 5 + 1).toFixed(1),
      "petal width (cm)": (Math.random() * 2 + 0.1).toFixed(1),
      original_index: originalIndex
    };
    
    results.push({
      original_index: originalIndex,
      final_label: actualFinalLabel.toString(), // AL-Engine expects string
      sample_data: sampleData,
      votes: votes,
      consensus: consensus,
      timestamp: new Date().toISOString()
    });
  }
  
  return results;
}

/**
 * Update project config to use numeric labels
 */
function updateProjectConfig(projectId) {
  const configPath = path.join(__dirname, '..', 'al-engine', 'ro-crates', projectId, 'config.json');
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Update label space to numeric labels
    config.label_space = ["0", "1", "2"]; // AL-Engine expects strings
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`[SUCCESS] Updated config.json with numeric labels: ${config.label_space}`);
    
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to update config: ${error}`);
    return false;
  }
}

/**
 * Update labeled samples to use numeric labels  
 */
function updateLabeledSamples(projectId) {
  const labeledPath = path.join(__dirname, '..', 'al-engine', 'ro-crates', projectId, 'inputs', 'datasets', 'labeled_samples.csv');
  
  try {
    let csvContent = fs.readFileSync(labeledPath, 'utf8');
    
    // Convert string labels back to numeric
    csvContent = csvContent.replace(/,a$/gm, ',0');
    csvContent = csvContent.replace(/,b$/gm, ',1'); 
    csvContent = csvContent.replace(/,c$/gm, ',2');
    
    fs.writeFileSync(labeledPath, csvContent);
    console.log(`[SUCCESS] Updated labeled_samples.csv with numeric labels (0,1,2)`);
    
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to update labeled samples: ${error}`);
    return false;
  }
}

/**
 * Create voting results for multiple rounds
 */
function createMultiRoundVotingResults(projectId, numRounds) {
  const outputDir = path.join(__dirname, '..', 'al-engine', 'ro-crates', projectId, 'outputs');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const allResults = [];
  
  for (let round = 1; round <= numRounds; round++) {
    const roundResults = generateRandomVotingResults(round, TEST_CONFIG.samplesPerRound);
    const outputPath = path.join(outputDir, `voting_results_round_${round}.json`);
    
    // Write individual round file
    fs.writeFileSync(outputPath, JSON.stringify(roundResults, null, 2));
    
    allResults.push({
      round: round,
      samples: roundResults.length,
      labels: roundResults.map(r => r.final_label),
      file: outputPath
    });
    
    console.log(`[SAVED] Round ${round}: ${roundResults.length} samples → labels [${roundResults.map(r => r.final_label).join(', ')}]`);
  }
  
  return allResults;
}

/**
 * Calculate expected training progression
 */
function calculateTrainingProgression(initialSamples, roundResults) {
  let totalSamples = initialSamples;
  
  console.log(`\n[STATS] Expected Training Progression:`);
  console.log(`   Initial: ${totalSamples} samples`);
  
  roundResults.forEach((round, index) => {
    totalSamples += round.samples;
    const testSamples = Math.max(2, Math.floor(totalSamples * 0.3));
    const trainSamples = totalSamples - testSamples;
    
    console.log(`   After Round ${round.round}: ${totalSamples} samples (${trainSamples} train, ${testSamples} test)`);
  });
  
  return totalSamples;
}

/**
 * Generate comprehensive test report
 */
function generateTestReport(projectId, roundResults, expectedFinalSamples) {
  const reportPath = path.join(__dirname, '..', 'al-engine', 'ro-crates', projectId, 'TEST_REPORT.md');
  
  const report = `# AL Training Test Report
Generated: ${new Date().toISOString()}
Project: ${projectId}

## Test Configuration
- Label Space: ${TEST_CONFIG.labels.join(', ')} (${TEST_CONFIG.labelNames.join(', ')})
- Rounds: ${TEST_CONFIG.rounds}
- Samples per Round: ${TEST_CONFIG.samplesPerRound}

## Voting Results Generated
${roundResults.map(r => `- Round ${r.round}: ${r.samples} samples with labels [${r.labels.join(', ')}]`).join('\n')}

## Expected Training Progression
- Initial training samples: 10
- Final training samples: ${expectedFinalSamples}
- Training should show realistic performance scores (not 1.0)

## Files Created
${roundResults.map(r => `- ${path.basename(r.file)}`).join('\n')}

## Testing Instructions
1. Restart AL-Engine: \`cd al-engine && python src/server.py\`
2. Start iteration 2 in the frontend
3. Check AL-Engine logs for:
   - "Added sample X with label Y" messages
   - "Updated labeled dataset: 10 → 12 samples"
   - Realistic performance scores (accuracy < 1.0)
4. Continue with iterations 3 and 4
5. Verify training data accumulates: 10 → 12 → 14 → 16 samples

## Expected Performance Evolution
- Round 1: ~1.0 accuracy (overfitting on 10 samples)
- Round 2: ~0.6-0.8 accuracy (12 samples, more realistic)  
- Round 3: ~0.7-0.9 accuracy (14 samples, improving)
- Round 4: ~0.8-0.9 accuracy (16 samples, good performance)

## Debugging
If scores remain 1.0:
- Check if voting_results_round_X.json files exist
- Check AL-Engine logs for sample accumulation messages
- Verify labels match config label_space
`;

  fs.writeFileSync(reportPath, report);
  console.log(`\n[DATA] Test report saved: ${reportPath}`);
}

/**
 * Main test function
 */
async function runRandomVotingTest() {
  const projectId = process.argv[2] || '0x3F23304F01F045F0e1389CC23FC0F09175146FC5';
  const numRounds = parseInt(process.argv[3]) || TEST_CONFIG.rounds;
  
  console.log(`[TEST] Starting Random Voting Test`);
  console.log(`   Project: ${projectId}`);
  console.log(`   Rounds: ${numRounds}`);
  console.log(`   Labels: ${TEST_CONFIG.labels.join(', ')} (${TEST_CONFIG.labelNames.join(', ')})\n`);
  
  // Step 1: Update project configuration
  console.log(`[CONFIG]  Step 1: Updating project configuration...`);
  if (!updateProjectConfig(projectId)) {
    console.error('[ERROR] Failed to update config, aborting test');
    return;
  }
  
  // Step 2: Update labeled samples
  console.log(`[CONFIG]  Step 2: Updating labeled samples...`);
  if (!updateLabeledSamples(projectId)) {
    console.error('[ERROR] Failed to update labeled samples, aborting test');
    return;
  }
  
  // Step 3: Generate random voting results
  console.log(`[CONFIG]  Step 3: Generating random voting results...`);
  const roundResults = createMultiRoundVotingResults(projectId, numRounds);
  
  // Step 4: Calculate expected progression
  const expectedFinalSamples = 10 + (numRounds * TEST_CONFIG.samplesPerRound);
  calculateTrainingProgression(10, roundResults);
  
  // Step 5: Generate test report
  console.log(`[CONFIG]  Step 4: Generating test report...`);
  generateTestReport(projectId, roundResults, expectedFinalSamples);
  
  console.log(`\n[SUCCESS] Random Voting Test Setup Complete!`);
  console.log(`\n[START] Next Steps:`);
  console.log(`   1. Restart AL-Engine to pick up the new config and voting results`);
  console.log(`   2. Start iteration 2 in the frontend`);
  console.log(`   3. Watch for realistic performance scores (not 1.0)`);
  console.log(`   4. Continue with iterations 3 and 4`);
  console.log(`   5. Check TEST_REPORT.md for detailed expectations`);
  
  // Show sample breakdown
  console.log(`\n[STATS] Sample Distribution:`);
  const labelDistribution = {};
  roundResults.forEach(round => {
    round.labels.forEach(label => {
      labelDistribution[label] = (labelDistribution[label] || 0) + 1;
    });
  });
  
  Object.entries(labelDistribution).forEach(([label, count]) => {
    const labelName = TEST_CONFIG.labelNames[parseInt(label)];
    console.log(`   Label ${label} (${labelName}): ${count} samples`);
  });
}

// Run the test
runRandomVotingTest().catch(console.error); 