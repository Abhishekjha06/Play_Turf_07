export function calculateShannonEntropy(str) {
    if (!str)
        return 0;
    const len = str.length;
    const frequencies = {};
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies[char] = (frequencies[char] || 0) + 1;
    }
    let entropy = 0;
    for (const char in frequencies) {
        const p = frequencies[char] / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}
export function scanStringForHighEntropy(str, threshold = 4.5) {
    // Check typical hexadecimal or base64 patterns that are 16+ characters long
    const wordPattern = /[a-zA-Z0-9+/=_-]{16,}/g;
    let match;
    while ((match = wordPattern.exec(str)) !== null) {
        const candidate = match[0];
        const entropy = calculateShannonEntropy(candidate);
        if (entropy > threshold) {
            return true;
        }
    }
    return false;
}
