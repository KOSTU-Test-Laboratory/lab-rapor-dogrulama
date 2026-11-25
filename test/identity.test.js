const test = require('node:test');
const assert = require('node:assert/strict');
const {serialFromHash,isHashSerial,validDate} = require('../lib/identity');
const {isPlaceholderSecret} = require('../lib/secret-validation');

test('new serials use a 32-character SHA-256 prefix', () => {
 const serial = serialFromHash('0123456789abcdef'.repeat(4));
 assert.equal(serial, 'KTLAB-0123456789ABCDEF0123456789ABCDEF');
 assert.equal(serial.length, 38);
});

test('new and previously issued full-hash serials remain valid', () => {
 assert.equal(isHashSerial('KTLAB-' + 'A'.repeat(32)), true);
 assert.equal(isHashSerial('KTLAB-' + 'B'.repeat(64)), true);
 assert.equal(isHashSerial('KTLAB-' + 'C'.repeat(40)), false);
});

test('dates must be real ISO calendar dates', () => {
 assert.equal(validDate('2026-11-25'), true);
 assert.equal(validDate('2026-02-31'), false);
 assert.equal(validDate('2026-99-99'), false);
 assert.equal(validDate('not-a-date'), false);
});

test('known setup placeholders are rejected while random secrets remain allowed', () => {
 assert.equal(isPlaceholderSecret('BURAYA_GUCLU_PAROLA'), true);
 assert.equal(isPlaceholderSecret('GENERATE_RANDOM_KEY'), true);
 assert.equal(isPlaceholderSecret('a'.repeat(64)), false);
});
