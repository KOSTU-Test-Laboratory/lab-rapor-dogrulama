const PDF_HASH = /^[a-f0-9]{64}$/i;
const HASH_SERIAL = /^KTLAB-(?:[A-F0-9]{32}|[A-F0-9]{64})$/;

function serialFromHash(hash) {
 if (!PDF_HASH.test(hash)) throw new TypeError('Expected a SHA-256 hex digest');
 return 'KTLAB-' + hash.slice(0,32).toUpperCase();
}

function isHashSerial(serial) {
 return HASH_SERIAL.test(serial);
}

function validDate(value) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const date = new Date(value + 'T00:00:00.000Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}

module.exports = {serialFromHash,isHashSerial,validDate};
