#!/usr/bin/env node
import { parseCreditsText } from './utils/textHelpers.mjs';

// Test case 1: Multi-line format (your first example)
const multiLine = `DP: Stepan Yiakoupian
Assistant Director: Eleni Koula
Assistant Director: Anastasia Moraiti
Script Supervisor: Stavroula Yiavasoglou
Promotional Photography: Georgia Kourou
Production Assistant: Konstandinos Ignatiades
Starring: Stavros Asimakis`;

console.log('=== Test 1: Multi-line format ===');
const result1 = parseCreditsText(multiLine);
console.log(JSON.stringify(result1, null, 2));
console.log(`✅ Parsed ${result1.length} credits`);

// Test case 2: Comma-separated (your second example)
const commaSeparated = "DOP: Theologos, Sound: Koutanis";

console.log('\n=== Test 2: Comma-separated format ===');
const result2 = parseCreditsText(commaSeparated);
console.log(JSON.stringify(result2, null, 2));
console.log(`✅ Parsed ${result2.length} credits`);

// Test case 3: Mixed format
const mixed = `Director: John Doe
DP: Jane Smith, Sound: Bob Johnson
Editor: Alice Williams`;

console.log('\n=== Test 3: Mixed format ===');
const result3 = parseCreditsText(mixed);
console.log(JSON.stringify(result3, null, 2));
console.log(`✅ Parsed ${result3.length} credits`);

// Verify no issues
if (result2.length !== 2) {
  console.error('\n❌ ERROR: Comma-separated format should produce 2 credits, got', result2.length);
  process.exit(1);
}

if (result2[0].name === 'Theologos, Sound: Koutanis') {
  console.error('\n❌ ERROR: Failed to split on comma correctly');
  process.exit(1);
}

console.log('\n✅ All tests passed!');
