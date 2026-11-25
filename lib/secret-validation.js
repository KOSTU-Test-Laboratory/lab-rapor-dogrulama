const PLACEHOLDER = /^(?:CHANGE_ME|BURAYA_GUCLU_PAROLA|GENERATE_[A-Z0-9_]+|REPLACE_[A-Z0-9_]+)$/i;

function isPlaceholderSecret(value) {
 return PLACEHOLDER.test(value || '');
}

module.exports = {isPlaceholderSecret};
