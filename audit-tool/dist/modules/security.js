import ts from 'typescript';
import { parseAST } from '../parsers/ts-parser.js';
import { calculateShannonEntropy } from './entropy.js';
import { SECRET_PATTERNS } from '../config.js';
export function runASTCodeAudit(filePath, projectRoot) {
    const findings = [];
    let astData;
    try {
        astData = parseAST(filePath);
    }
    catch {
        // Return empty if parsing fails (e.g. non-JS/TS files)
        return findings;
    }
    const { sourceFile, nodes } = astData;
    nodes.forEach(nodeInfo => {
        const { node, line, text } = nodeInfo;
        // 1. Secrets & Credentials Detection (Regex + Entropy)
        for (const [keyName, pattern] of Object.entries(SECRET_PATTERNS)) {
            if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
                const val = node.text;
                if (pattern.test(val)) {
                    findings.push({
                        severity: 'CRITICAL',
                        category: 'Hardcoded Secret',
                        file: filePath,
                        line,
                        description: `Potential ${keyName} hardcoded secret/credential detected: "${val.substring(0, 10)}..."`,
                        recommendation: 'Move sensitive credentials, secrets, or tokens to environment variables.'
                    });
                }
                else if (val.length > 20 && !/\s/.test(val) && !val.startsWith('http://') && !val.startsWith('https://') && calculateShannonEntropy(val) > 4.7) {
                    findings.push({
                        severity: 'HIGH',
                        category: 'High-Entropy Secret',
                        file: filePath,
                        line,
                        description: `High-entropy string detected ("${val.substring(0, 8)}..."), potential secret key.`,
                        recommendation: 'Verify if this string contains a secret, and refactor it into configuration variables if so.'
                    });
                }
            }
        }
        // 2. Dangerous API / Dynamic Code Execution Detection
        if (ts.isCallExpression(node)) {
            const expText = node.expression.getText(sourceFile);
            if (expText === 'eval') {
                findings.push({
                    severity: 'CRITICAL',
                    category: 'Dangerous Code',
                    file: filePath,
                    line,
                    description: 'Usage of eval() detected, allowing dynamic code execution.',
                    recommendation: 'Refactor code to avoid eval(). Use secure parsing (e.g. JSON.parse) or lookup maps.'
                });
            }
            if (['exec', 'execSync', 'spawn', 'spawnSync'].includes(expText)) {
                findings.push({
                    severity: 'HIGH',
                    category: 'Dangerous Code',
                    file: filePath,
                    line,
                    description: `Command execution API (${expText}) detected.`,
                    recommendation: 'Avoid dynamic command generation to prevent Command Injection risks.'
                });
            }
        }
        if (ts.isNewExpression(node)) {
            const expText = node.expression.getText(sourceFile);
            if (expText === 'Function') {
                findings.push({
                    severity: 'HIGH',
                    category: 'Dangerous Code',
                    file: filePath,
                    line,
                    description: 'Usage of new Function() constructor detected, enabling dynamic code execution.',
                    recommendation: 'Refactor code to use standard functions or static logic structures.'
                });
            }
        }
        // 3. XSS Security Checks
        if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === 'dangerouslySetInnerHTML') {
            findings.push({
                severity: 'HIGH',
                category: 'XSS Risk',
                file: filePath,
                line,
                description: 'dangerouslySetInnerHTML attribute detected in JSX component.',
                recommendation: 'Sanitize content before rendering or use safer components.'
            });
        }
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const leftText = node.left.getText(sourceFile);
            if (leftText.endsWith('.innerHTML')) {
                findings.push({
                    severity: 'HIGH',
                    category: 'XSS Risk',
                    file: filePath,
                    line,
                    description: 'Assignment to innerHTML detected, leading to potential DOM XSS.',
                    recommendation: 'Use textContent, innerText, or sanitize inputs prior to binding.'
                });
            }
        }
        // 4. Path Traversal & Safety Check
        if (ts.isCallExpression(node)) {
            const expText = node.expression.getText(sourceFile);
            if (expText.includes('path.resolve') || expText.includes('path.join')) {
                const args = node.arguments.map(arg => arg.getText(sourceFile));
                if (args.some(arg => arg.includes('..'))) {
                    findings.push({
                        severity: 'MEDIUM',
                        category: 'Path Traversal',
                        file: filePath,
                        line,
                        description: `Relative path resolution containing '..' navigation in ${expText}`,
                        recommendation: 'Use safe path resolution and sanitize input variables using path.normalize or custom sandbox checkers.'
                    });
                }
            }
        }
        // 5. React Specific Security Checks
        if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'useEffect') {
            const args = node.arguments;
            if (args.length > 1 && ts.isArrayLiteralExpression(args[1]) && args[1].elements.length === 0) {
                // Empty dependency array — verify there are no missing state updates/subscriptions
            }
        }
        // Storage of tokens in localStorage/sessionStorage
        if (ts.isCallExpression(node)) {
            const expText = node.expression.getText(sourceFile);
            if (expText.includes('localStorage.setItem') || expText.includes('sessionStorage.setItem')) {
                const argsText = node.arguments.map(arg => arg.getText(sourceFile)).join(', ');
                if (['token', 'jwt', 'auth', 'secret'].some(t => argsText.toLowerCase().includes(t))) {
                    findings.push({
                        severity: 'MEDIUM',
                        category: 'React Security',
                        file: filePath,
                        line,
                        description: 'Sensitive token stored inside browser web storage API.',
                        recommendation: 'Store sensitive authorization session states in secure, HttpOnly, SameSite cookies.'
                    });
                }
            }
        }
        // 6. OWASP / API Security / Endpoint Audit
        if (ts.isCallExpression(node)) {
            const expText = node.expression.getText(sourceFile);
            if (expText === 'fetch' || expText.includes('axios')) {
                const argText = node.arguments[0]?.getText(sourceFile) || '';
                if (argText.includes('http://') && !argText.includes('http://localhost')) {
                    findings.push({
                        severity: 'HIGH',
                        category: 'API Security',
                        file: filePath,
                        line,
                        description: 'Insecure HTTP protocol endpoint request detected instead of HTTPS.',
                        recommendation: 'Migrate endpoint requests to secure HTTPS protocol.'
                    });
                }
            }
        }
    });
    return findings;
}
