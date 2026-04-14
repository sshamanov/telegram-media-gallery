#!/usr/bin/env node
// Test runner for Telegram Gallery UI tests

import { runShortTest } from './short-test.js';
import { runLongTest } from './long-test.js';

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'short';
  
  console.log(`🔧 Telegram Gallery Test Runner`);
  console.log(`===============================\n`);
  
  switch (testType) {
    case 'short':
      console.log('Running SHORT test (basic flows only)...\n');
      return await runShortTest();
      
    case 'long':
      console.log('Running LONG test (full coverage)...\n');
      return await runLongTest();
      
    case 'all':
      console.log('Running ALL tests...\n');
      const shortResult = await runShortTest();
      if (!shortResult.success) {
        return shortResult;
      }
      console.log('\n' + '='.repeat(50) + '\n');
      return await runLongTest();
      
    default:
      console.error(`Unknown test type: ${testType}`);
      console.log('\nUsage:');
      console.log('  node test-runner.js short    # Run short test (basic flows)');
      console.log('  node test-runner.js long     # Run long test (full coverage)');
      console.log('  node test-runner.js all      # Run both tests');
      return { success: false, error: `Unknown test type: ${testType}` };
  }
}

// Run tests
main().then(result => {
  console.log('\n' + '='.repeat(50));
  if (result.success) {
    console.log('✅ TESTS COMPLETED SUCCESSFULLY');
    console.log(`📝 ${result.message}`);
  } else {
    console.log('❌ TESTS FAILED');
    console.log(`💥 Error: ${result.error}`);
    process.exit(1);
  }
  console.log('='.repeat(50));
  process.exit(0);
}).catch(error => {
  console.error('\n❌ UNEXPECTED TEST ERROR:', error);
  process.exit(1);
});