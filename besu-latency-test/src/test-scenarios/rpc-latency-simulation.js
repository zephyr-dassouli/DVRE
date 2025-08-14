import { ethers } from 'ethers';
import { CONFIG } from '../config.js';

export class RPCLatencySimulation {
  constructor(provider, latencyTracker) {
    this.provider = provider;
    this.latencyTracker = latencyTracker;
  }

  // Simulate: Get block number (frequent polling for UI updates)
  async simulateBlockPolling(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'block_polling', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      await this.provider.getBlockNumber();
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Simulate: Get transaction receipt (checking vote confirmations)
  async simulateTransactionCheck(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'transaction_check', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      // Get latest block and check its transactions
      const latestBlock = await this.provider.getBlock('latest', true);
      if (latestBlock && latestBlock.transactions.length > 0) {
        // Get the first transaction receipt as a sample
        const firstTx = latestBlock.transactions[0];
        if (typeof firstTx === 'string') {
          await this.provider.getTransactionReceipt(firstTx);
        }
      }
      
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Simulate: Estimate gas (before submitting transactions)
  async simulateGasEstimation(wallet, accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'gas_estimation', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      // Test different types of gas estimation that would occur during DAL collaboration
      const estimationTests = [
        // Zero-value transaction (should work with unfunded accounts)
        {
          from: wallet.address,
          to: ethers.Wallet.createRandom().address,
          value: '0',
          data: '0x'
        },
        // Realistic DAL contract call simulation (getCurrentRound)
        {
          from: wallet.address,
          to: '0x1234567890123456789012345678901234567890', // Mock contract address
          value: '0',
          data: '0x76671808' // getCurrentRound() method signature
        },
        // Vote submission simulation (submitBatchVote with minimal data)
        {
          from: wallet.address,
          to: '0x1234567890123456789012345678901234567890', // Mock contract address  
          value: '0',
          data: '0x1234abcd' // Mock method signature
        }
      ];

      // Try different estimation scenarios (pick one randomly to simulate variety)
      const testCase = estimationTests[Math.floor(Math.random() * estimationTests.length)];
      
      await this.provider.estimateGas(testCase);
      
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Simulate: Get account balance (frequent UI updates)
  async simulateBalanceCheck(wallet, accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'balance_check', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      await this.provider.getBalance(wallet.address);
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Simulate: Network info check (chain ID, gas price)
  async simulateNetworkInfo(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'network_info', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      const operations = [
        this.provider.getNetwork(),
        this.provider.getFeeData(),
        this.provider.getBlockNumber()
      ];
      
      await Promise.all(operations);
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Simulate: Submit mock transaction (realistic transaction load)
  async simulateMockTransaction(wallet, accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'mock_transaction', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      const targetAddress = ethers.Wallet.createRandom().address;
      
      // Create a realistic transaction but don't submit (to avoid funding issues)
      // This tests transaction preparation latency
      const txRequest = {
        to: targetAddress,
        value: '0', // Zero value so unfunded accounts can sign
        gasLimit: 21000,
        gasPrice: 0,
        nonce: await this.provider.getTransactionCount(wallet.address),
        chainId: CONFIG.CHAIN_ID // Add chain ID for proper signing
      };
      
      // Sign the transaction (tests signing latency)
      await wallet.signTransaction(txRequest);
      
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Simulate realistic user behavior during active voting (read-heavy)
  async simulateRealisticUserActivity(wallet, accountId, concurrentAccounts, nodeInfo = null) {
    const operations = [
      // Read-heavy: decision-making data during active voting
      { type: 'block_poll', weight: 7 },      // Frequent: checking for new rounds/updates
      { type: 'tx_check', weight: 4 },        // Frequent: monitoring vote confirmations
      { type: 'gas', weight: 2 },            // Rare: only when preparing to vote
      { type: 'network', weight: 1 }         // Rare: occasional system health checks
      // Note: balance omitted since gas=0 in academic deployment
      // Note: mock_tx removed from read-heavy scenario
    ];

    // Weighted random selection for read-heavy monitoring
    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    
    let selectedOperation = 'block_poll';
    for (const op of operations) {
      cumulativeWeight += op.weight;
      if (random <= cumulativeWeight) {
        selectedOperation = op.type;
        break;
      }
    }

    try {
      switch (selectedOperation) {
        case 'block_poll':
          return await this.simulateBlockPolling(accountId, concurrentAccounts, nodeInfo);
        case 'tx_check':
          return await this.simulateTransactionCheck(accountId, concurrentAccounts, nodeInfo);
        case 'gas':
          return await this.simulateGasEstimation(wallet, accountId, concurrentAccounts, nodeInfo);
        case 'network':
          return await this.simulateNetworkInfo(accountId, concurrentAccounts, nodeInfo);
        default:
          return await this.simulateBlockPolling(accountId, concurrentAccounts, nodeInfo);
      }
    } catch (error) {
      console.error(`Account ${accountId}: RPC operation (${selectedOperation}) failed:`, error.message);
      return { success: false, operation: selectedOperation };
    }
  }

  // NEW: Write-focused scenario for actual vote submission testing
  async simulateVoteSubmissionBurst(wallet, accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'vote_submission_burst', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      const startTime = Date.now();
      
      // Step 1: Gas estimation (prepare transaction)
      const gasTimingId = this.latencyTracker.startTiming(
        'vote_gas_prep', 
        accountId, 
        { concurrentAccounts, node: nodeInfo?.name }
      );
      
      const targetAddress = ethers.Wallet.createRandom().address;
      const gasEstimate = await this.provider.estimateGas({
        from: wallet.address,
        to: targetAddress,
        value: '0',
        data: '0x1234abcd' // Mock submitBatchVote signature
      });
      
      this.latencyTracker.endTiming(gasTimingId, true);

      // Step 2: Transaction signing and submission
      const submitTimingId = this.latencyTracker.startTiming(
        'vote_submission', 
        accountId, 
        { concurrentAccounts, node: nodeInfo?.name }
      );

      const txRequest = {
        to: targetAddress,
        value: '0',
        gasLimit: gasEstimate,
        gasPrice: 0,
        data: '0x1234abcd', // Mock vote submission
        nonce: await this.provider.getTransactionCount(wallet.address),
        chainId: CONFIG.CHAIN_ID // Add chain ID for proper signing
      };

      // Sign and submit the transaction
      const signedTx = await wallet.signTransaction(txRequest);
      const txResponse = await this.provider.broadcastTransaction(signedTx);
      
      this.latencyTracker.endTiming(submitTimingId, true);

      // Step 3: Wait for confirmation and measure receipt latency
      const receiptTimingId = this.latencyTracker.startTiming(
        'vote_confirmation', 
        accountId, 
        { concurrentAccounts, node: nodeInfo?.name }
      );

      const receipt = await txResponse.wait(1); // Wait for 1 confirmation
      
      this.latencyTracker.endTiming(receiptTimingId, true);

      // Step 4: Measure event retrieval latency
      const eventTimingId = this.latencyTracker.startTiming(
        'vote_event_retrieval', 
        accountId, 
        { concurrentAccounts, node: nodeInfo?.name }
      );

      // Simulate retrieving vote events from the transaction
      const blockWithTx = await this.provider.getBlock(receipt.blockNumber, true);
      
      this.latencyTracker.endTiming(eventTimingId, true);

      const totalLatency = Date.now() - startTime;
      this.latencyTracker.endTiming(timingId, true);
      
      return { 
        success: true, 
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        totalLatency 
      };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // NEW: Run write-focused vote submission testing
  async runVoteSubmissionSession(accounts, submissionCount = 5, nodeInfo = null) {
    console.log('\n[*] Starting write-focused vote submission testing');
    console.log(`   Accounts: ${accounts.length}`);
    console.log(`   Submissions per account: ${submissionCount}`);
    console.log(`   Focus: Submit→receipt→event latency measurement`);
    if (nodeInfo) {
      console.log(`   Node: ${nodeInfo.name}`);
    }

    const promises = accounts.map(async (account) => {
      const wallet = account.wallet.connect(this.provider);
      console.log(`   [+] ${account.id}: Starting vote submission burst...`);

      for (let i = 0; i < submissionCount; i++) {
        try {
          await this.simulateVoteSubmissionBurst(wallet, account.id, accounts.length, nodeInfo);
          
          // Add realistic delay between votes (1-3 seconds)
          const delay = 1000 + Math.random() * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
        } catch (error) {
          console.error(`   [-] ${account.id}: Vote submission ${i+1} failed:`, error.message);
        }
      }

      console.log(`   [+] ${account.id}: Completed ${submissionCount} vote submissions`);
    });

    await Promise.all(promises);
    console.log(`[*] Vote submission session completed`);
  }

  // Run realistic voting session simulation
  async runRealisticVotingSession(accounts, durationMs, nodeInfo = null) {
    console.log('\n[*] Starting realistic voting session RPC simulation');
    console.log('   Duration: ' + (durationMs / 1000) + 's');
    console.log('   Participants: ' + accounts.length);
    console.log('   Focus: RPC call latency during active collaboration');
    if (nodeInfo) {
      console.log('   Node: ' + nodeInfo.name);
    }

    const startTime = Date.now();
    const promises = [];

    // Each account performs realistic RPC operations during the session
    accounts.forEach((account) => {
      const accountPromise = this.runAccountActivity(
        account, 
        startTime, 
        durationMs, 
        accounts.length, 
        nodeInfo
      );
      promises.push(accountPromise);
    });

    await Promise.all(promises);
    
    const actualDuration = Date.now() - startTime;
    console.log(`[*] RPC simulation completed in ${actualDuration.toFixed(2)}s`);
  }

  // Individual account's activity during session
  async runAccountActivity(account, sessionStart, sessionDuration, concurrentAccounts, nodeInfo) {
    const wallet = account.wallet.connect(this.provider);
    const endTime = sessionStart + sessionDuration;
    let operationCount = 0;

    console.log(`   [+] ${account.id}: Starting RPC activity simulation...`);

    while (Date.now() < endTime) {
      try {
        await this.simulateRealisticUserActivity(wallet, account.id, concurrentAccounts, nodeInfo);
        operationCount++;
        
        // Realistic delay between operations
        // Active users: 200ms-1s between operations
        // Occasional longer pauses when users think/read
        const isQuickAction = Math.random() < 0.7; // 70% quick actions
        const delay = isQuickAction 
          ? 200 + Math.random() * 800    // Quick: 200-1000ms
          : 2000 + Math.random() * 3000; // Thoughtful: 2-5s
          
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        this.latencyTracker.endTiming(timingId, false, error.message);
        console.error(`   [-] ${account.id}: RPC operation failed:`, error.message);
      }
    }

    console.log(`   [+] ${account.id}: Completed ${operationCount} RPC operations`);
  }

  // Test specific RPC operation under load
  async runRPCLoadTest(operationType, accounts, iterations = 20, nodeInfo = null) {
    console.log(`\n⚡ RPC Load Testing: ${operationType}`);
    console.log(`   Accounts: ${accounts.length}, Iterations: ${iterations} each`);
    
    const promises = accounts.map(async (account) => {
      const wallet = account.wallet.connect(this.provider);
      
      for (let i = 0; i < iterations; i++) {
        try {
          switch (operationType) {
            case 'block_polling':
              await this.simulateBlockPolling(account.id, accounts.length, nodeInfo);
              break;
            case 'balance_check':
              await this.simulateBalanceCheck(wallet, account.id, accounts.length, nodeInfo);
              break;
            case 'gas_estimation':
              await this.simulateGasEstimation(wallet, account.id, accounts.length, nodeInfo);
              break;
            case 'transaction_check':
              await this.simulateTransactionCheck(account.id, accounts.length, nodeInfo);
              break;
            case 'network_info':
              await this.simulateNetworkInfo(account.id, accounts.length, nodeInfo);
              break;
          }
          
          // Small delay between operations
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
          
        } catch (error) {
          // Continue with other operations
        }
      }
    });

    await Promise.all(promises);
    console.log(`[*] RPC load test completed: ${operationType}`);
  }

  // NEW: Mixed realistic scenario - 85% reads, 15% writes
  async simulateMixedRealisticActivity(wallet, accountId, concurrentAccounts, nodeInfo = null) {
    const operations = [
      // READ OPERATIONS (85% total)
      { type: 'block_poll', weight: 40 },      // 40% - Constant UI updates and round monitoring
      { type: 'tx_check', weight: 25 },        // 25% - Vote confirmations and status checks
      { type: 'gas', weight: 10 },            // 10% - Transaction preparation (read-heavy)
      { type: 'network', weight: 5 },         // 5% - System health monitoring
      { type: 'event_check', weight: 5 },     // 5% - Event log monitoring for vote updates
      
      // WRITE OPERATIONS (15% total)
      { type: 'vote_submit', weight: 15 }     // 15% - Actual vote submissions
    ];

    // Weighted random selection for mixed realistic usage
    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    
    let selectedOperation = 'block_poll';
    for (const op of operations) {
      cumulativeWeight += op.weight;
      if (random <= cumulativeWeight) {
        selectedOperation = op.type;
        break;
      }
    }

    try {
      switch (selectedOperation) {
        case 'block_poll':
          return await this.simulateBlockPolling(accountId, concurrentAccounts, nodeInfo);
        case 'tx_check':
          return await this.simulateTransactionCheck(accountId, concurrentAccounts, nodeInfo);
        case 'gas':
          return await this.simulateGasEstimation(wallet, accountId, concurrentAccounts, nodeInfo);
        case 'network':
          return await this.simulateNetworkInfo(accountId, concurrentAccounts, nodeInfo);
        case 'event_check':
          return await this.simulateEventCheck(accountId, concurrentAccounts, nodeInfo);
        case 'vote_submit':
          return await this.simulateVoteSubmissionBurst(wallet, accountId, concurrentAccounts, nodeInfo);
        default:
          return await this.simulateBlockPolling(accountId, concurrentAccounts, nodeInfo);
      }
    } catch (error) {
      console.error(`Account ${accountId}: Mixed operation (${selectedOperation}) failed:`, error.message);
      return { success: false, operation: selectedOperation };
    }
  }

  // NEW: Event checking simulation (for mixed scenario)
  async simulateEventCheck(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'event_check', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      // Simulate checking for vote events in recent blocks
      const latestBlock = await this.provider.getBlock('latest');
      if (latestBlock && latestBlock.number > 0) {
        // Check previous block for any transactions (simulating event monitoring)
        const prevBlock = await this.provider.getBlock(latestBlock.number - 1, true);
      }
      
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // NEW: Run mixed realistic session (85% read, 15% write)
  async runMixedRealisticSession(accounts, durationMs, nodeInfo = null) {
    console.log('\n[*] Starting mixed realistic DAL collaboration simulation');
    console.log('   Duration: ' + (durationMs / 1000) + 's');
    console.log('   Participants: ' + accounts.length);
    console.log('   Mix: 85% read operations, 15% write operations');
    console.log('   Focus: Complete DAL collaboration workflow');
    if (nodeInfo) {
      console.log('   Node: ' + nodeInfo.name);
    }

    const startTime = Date.now();
    const promises = [];

    // Each account performs mixed realistic operations during the session
    accounts.forEach((account) => {
      const accountPromise = this.runMixedAccountActivity(
        account, 
        startTime, 
        durationMs, 
        accounts.length, 
        nodeInfo
      );
      promises.push(accountPromise);
    });

    await Promise.all(promises);
    
    const actualDuration = Date.now() - startTime;
    console.log(`[*] Mixed realistic simulation completed in ${actualDuration.toFixed(2)}s`);
  }

  // Individual account's mixed activity during session
  async runMixedAccountActivity(account, sessionStart, sessionDuration, concurrentAccounts, nodeInfo) {
    const wallet = account.wallet.connect(this.provider);
    const endTime = sessionStart + sessionDuration;
    let operationCount = 0;
    let readCount = 0;
    let writeCount = 0;

    console.log(`   [+] ${account.id}: Starting mixed DAL activity simulation...`);

    while (Date.now() < endTime) {
      try {
        const result = await this.simulateMixedRealisticActivity(wallet, account.id, concurrentAccounts, nodeInfo);
        operationCount++;
        
        // Track read vs write operations
        if (result.operation === 'vote_submit') {
          writeCount++;
        } else {
          readCount++;
        }
        
        // Realistic delay between operations
        // More varied timing to reflect real user behavior
        const isQuickRead = Math.random() < 0.6; // 60% quick reads
        const delay = isQuickRead 
          ? 300 + Math.random() * 700     // Quick reads: 300-1000ms
          : 1500 + Math.random() * 3500;  // Thoughtful actions: 1.5-5s
          
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        console.error(`   [-] ${account.id}: Mixed operation failed:`, error.message);
      }
    }

    const readPercentage = (readCount / operationCount * 100).toFixed(1);
    const writePercentage = (writeCount / operationCount * 100).toFixed(1);
    console.log(`   [+] ${account.id}: Completed ${operationCount} operations (${readPercentage}% read, ${writePercentage}% write)`);
  }
} 