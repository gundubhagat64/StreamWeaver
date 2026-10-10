import assert from 'node:assert/strict';
import { executeSandboxTransformation } from './src/services/sandboxService.js';

async function runTests() {
  // Test 1: Successful JavaScript transformation
  const result = await executeSandboxTransformation({
    sourceCode: 'return value.toUpperCase()',
    value: 'aman',
    row: { name: 'aman' },
  });

  assert.equal(result, 'AMAN');
  console.log('PASS: Successful transformation');

  // Test 2: Invalid JavaScript must be rejected
  await assert.rejects(
    executeSandboxTransformation({
      sourceCode: 'return (',
      value: 'aman',
      row: {},
    }),
  );
  console.log('PASS: Invalid JavaScript rejected');

  // Test 3: Infinite loop must time out
  await assert.rejects(
    executeSandboxTransformation({
      sourceCode: 'while (true) {}',
      value: 'aman',
      row: {},
      timeoutMs: 50,
    }),
  );
  console.log('PASS: Sandbox timeout protection');

  console.log('\nAll Week 3 sandbox tests passed.');
}

runTests().catch((error) => {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
});
