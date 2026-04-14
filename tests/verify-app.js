#!/usr/bin/env node
// Simple app verification test

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

async function verifyApp() {
  console.log('🔍 Verifying Telegram Gallery App Setup');
  console.log('=======================================\n');
  
  const checks = [];
  
  // Check 1: Package.json
  try {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    checks.push({
      name: 'Package.json',
      status: '✅',
      details: `Version ${pkg.version}, ${Object.keys(pkg.scripts).length} scripts`
    });
  } catch (error) {
    checks.push({
      name: 'Package.json',
      status: '❌',
      details: `Error: ${error.message}`
    });
  }
  
  // Check 2: Test scripts
  try {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    const testScripts = ['test:short', 'test:long', 'test:all'];
    const missingScripts = testScripts.filter(script => !pkg.scripts[script]);
    
    checks.push({
      name: 'Test Scripts',
      status: missingScripts.length === 0 ? '✅' : '❌',
      details: missingScripts.length === 0 
        ? 'All test scripts present' 
        : `Missing: ${missingScripts.join(', ')}`
    });
  } catch (error) {
    checks.push({
      name: 'Test Scripts',
      status: '❌',
      details: `Error: ${error.message}`
    });
  }
  
  // Check 3: Test files
  const testFiles = [
    'tests/test-runner.js',
    'tests/short-test.js', 
    'tests/long-test.js',
    'tests/verify-app.js'
  ];
  const missingFiles = testFiles.filter(file => !existsSync(file));
  
  checks.push({
    name: 'Test Files',
    status: missingFiles.length === 0 ? '✅' : '❌',
    details: missingFiles.length === 0 
      ? 'All test files present'
      : `Missing: ${missingFiles.join(', ')}`
  });
  
  // Check 4: Sample data
  const sampleFiles = [
    'samples/dialogs.json',
    'samples/dialog-media/my_photos.json',
    'samples/dialog-media/work_chat.json'
  ];
  const missingSamples = sampleFiles.filter(file => !existsSync(file));
  
  checks.push({
    name: 'Sample Data',
    status: missingSamples.length === 0 ? '✅' : '❌',
    details: missingSamples.length === 0
      ? 'Sample data files present'
      : `Missing: ${missingSamples.join(', ')}`
  });
  
  // Check 5: Documentation
  const docs = [
    'TESTING_STRATEGY.md',
    'AGENTS.md',
    'APPLICATION_SPEC.md'
  ];
  const missingDocs = docs.filter(file => !existsSync(file));
  
  checks.push({
    name: 'Documentation',
    status: missingDocs.length === 0 ? '✅' : '❌',
    details: missingDocs.length === 0
      ? 'All documentation present'
      : `Missing: ${missingDocs.join(', ')}`
  });
  
  // Check 6: Mock adapter
  const mockFiles = [
    'src/lib/telegram/mock.ts',
    'src/lib/telegram/adapter.ts',
    'src/stores/telegram.ts'
  ];
  const missingMock = mockFiles.filter(file => !existsSync(file));
  
  checks.push({
    name: 'Mock Adapter',
    status: missingMock.length === 0 ? '✅' : '❌',
    details: missingMock.length === 0
      ? 'Mock adapter implementation complete'
      : `Missing: ${missingMock.join(', ')}`
  });
  
  // Display results
  console.log('Verification Results:');
  console.log('====================');
  
  checks.forEach(check => {
    console.log(`${check.status} ${check.name}: ${check.details}`);
  });
  
  console.log('\n' + '='.repeat(50));
  
  const allPassed = checks.every(check => check.status === '✅');
  if (allPassed) {
    console.log('✅ ALL CHECKS PASSED');
    console.log('\n📋 Next Steps:');
    console.log('1. Run short test: npm run test:short');
    console.log('2. Run long test: npm run test:long');
    console.log('3. Test app manually: Open https://localhost:5173');
    console.log('4. Use mock adapter: Set VITE_USE_MOCK_ADAPTER=true');
  } else {
    console.log('❌ SOME CHECKS FAILED');
    console.log('\n🔧 Fix the issues above before proceeding.');
  }
  
  console.log('='.repeat(50));
  
  return allPassed;
}

// Run verification
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyApp().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}

export { verifyApp };