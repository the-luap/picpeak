/**
 * Test script to verify CMS and email formatting improvements
 */

const { formatWelcomeMessage, nl2br } = require('../src/utils/formatters');

console.log('Testing CMS and Email Formatting Improvements\n');

// Test 1: Basic line break conversion
console.log('Test 1: Basic line break conversion');
const basicText = `Hello,
This is line 1.
This is line 2.

This is line 4 with an extra break.`;

console.log('Input:');
console.log(basicText);
console.log('\nOutput (nl2br):');
console.log(nl2br(basicText));
console.log('\n---\n');

// Test 2: Welcome message formatting
console.log('Test 2: Welcome message formatting');
const welcomeMessage = `Dear guests,

We're so excited to share these special moments with you!

Please note:
- Download your photos before the expiration date
- The password is case-sensitive
- Contact us if you have any issues

Thank you for being part of our special day!

Best regards,
Sarah & John`;

console.log('Input:');
console.log(welcomeMessage);
console.log('\nOutput (formatWelcomeMessage):');
console.log(formatWelcomeMessage(welcomeMessage));
console.log('\n---\n');

// Test 3: Empty and edge cases
console.log('Test 3: Edge cases');
console.log('Empty string:', formatWelcomeMessage(''));
console.log('Null:', formatWelcomeMessage(null));
console.log('Only spaces:', formatWelcomeMessage('   \n   \n   '));
console.log('Single line:', formatWelcomeMessage('This is a single line message'));

console.log('\nAll tests completed!');