import path from 'path';
import fs from 'fs';
import { walkDirectory } from './utils/files.js';
import { runASTCodeAudit } from './modules/security.js';
import { auditGit } from './modules/git.js';
import { auditDocker } from './modules/docker.js';
import { auditDependencies } from './modules/dependencies.js';
import { scanSensitiveFiles } from './modules/sensitive.js';
import { auditImports } from './modules/imports.js';
import { saveJSONReport, saveCSVReport, saveSARIFReport, saveHTMLReport } from './reports/reporter.js';
// Setup default CLI config options
const args = process.argv.slice(2);
const options = {
    scanSecurity: args.includes('--scan-security') || args.includes('--full-audit'),
    scanImports: args.includes('--scan-imports') || args.includes('--full-audit'),
    fixImports: args.includes('--fix-imports'),
    scanSecrets: args.includes('--scan-secrets') || args.includes('--full-audit'),
    scanXss: args.includes('--scan-xss') || args.includes('--full-audit'),
    scanDependencies: args.includes('--scan-dependencies') || args.includes('--full-audit'),
    fullAudit: args.includes('--full-audit') || args.length === 0,
    json: args.includes('--json') || args.includes('--full-audit') || args.length === 0,
    csv: args.includes('--csv'),
    html: args.includes('--html') || args.includes('--full-audit') || args.length === 0
};
async function run() {
    const startTime = Date.now();
    const rootDir = path.resolve(process.cwd(), '../components'); // Scan components directory
    console.log('\x1b[36m%s\x1b[0m', '==================================================');
    console.log('\x1b[36m%s\x1b[0m', '      ENTERPRISE SECURITY & CODE AUDIT TOOL       ');
    console.log('\x1b[36m%s\x1b[0m', '==================================================');
    console.log(`Scanning Root: ${rootDir}\n`);
    if (!fs.existsSync(rootDir)) {
        console.error(`Root directory does not exist: ${rootDir}`);
        process.exit(1);
    }
    // Load project aliases from components tsconfig/vite.config mapping
    const aliases = [
        { find: '@/assets', replacement: path.resolve(rootDir, '../assets') },
        { find: '@/components', replacement: path.resolve(rootDir, './src/components') },
        { find: '@/ui', replacement: path.resolve(rootDir, './src/ui') },
        { find: '@', replacement: path.resolve(rootDir, './src') }
    ];
    const files = await walkDirectory(rootDir);
    const scannedFiles = files.length;
    console.log(`Found ${scannedFiles} source files to inspect.`);
    let findings = [];
    let importFindings = [];
    // 1. Run git and sensitive file audits
    if (options.scanSecurity || options.fullAudit) {
        console.log('Running Git security checks...');
        findings = findings.concat(auditGit(rootDir));
        console.log('Scanning for exposed sensitive files...');
        findings = findings.concat(scanSensitiveFiles(rootDir));
        console.log('Scanning Docker and deployment configs...');
        findings = findings.concat(auditDocker(rootDir));
    }
    // 2. Scan each file using TypeScript AST
    console.log('Analyzing files using TypeScript AST parser...');
    for (const file of files) {
        const relativePath = path.relative(rootDir, file);
        // Filter relevant JS/TS/JSX/TSX source files
        if (/\.(ts|tsx|js|jsx)$/.test(file)) {
            if (options.scanSecurity || options.fullAudit) {
                const fileFindings = runASTCodeAudit(file, rootDir);
                findings = findings.concat(fileFindings.map(f => ({ ...f, file: relativePath })));
            }
            if (options.scanImports || options.fullAudit) {
                const fileImports = auditImports(file, aliases, rootDir, options.fixImports);
                importFindings = importFindings.concat(fileImports.map(i => ({ ...i, file: relativePath })));
            }
        }
    }
    // 3. Scan dependencies
    if (options.scanDependencies || options.fullAudit) {
        console.log('Auditing dependency vulnerability and license compliance...');
        const depFindings = await auditDependencies(rootDir);
        findings = findings.concat(depFindings);
    }
    const durationMs = Date.now() - startTime;
    // Print results summary to console
    console.log('\n\x1b[32m%s\x1b[0m', '--- Audit Completed ---');
    console.log(`Scan Duration: ${durationMs}ms`);
    console.log(`Files Analyzed: ${scannedFiles}`);
    console.log(`Vulnerabilities Found: ${findings.length}`);
    console.log(`Import Errors Found: ${importFindings.length}\n`);
    findings.forEach(f => {
        const color = f.severity === 'CRITICAL' ? '\x1b[31m' : f.severity === 'HIGH' ? '\x1b[33m' : '\x1b[32m';
        console.log(`${color}%s\x1b[0m`, `[${f.severity}] ${f.category}`);
        console.log(`  File: ${f.file}:${f.line}`);
        console.log(`  Issue: ${f.description}`);
        console.log(`  Recommendation: ${f.recommendation}\n`);
    });
    // Save reports
    const reportDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir);
    }
    if (options.json) {
        const jsonPath = path.join(reportDir, 'security-report.json');
        saveJSONReport(findings, importFindings, jsonPath);
        console.log(`JSON Report generated at: ${jsonPath}`);
    }
    if (options.csv) {
        const csvPath = path.join(reportDir, 'security-report.csv');
        saveCSVReport(findings, csvPath);
        console.log(`CSV Report generated at: ${csvPath}`);
    }
    if (options.html) {
        const htmlPath = path.join(reportDir, 'security-report.html');
        saveHTMLReport(findings, importFindings, scannedFiles, durationMs, htmlPath);
        console.log(`HTML Dashboard generated at: ${htmlPath}`);
        // Create SARIF report
        const sarifPath = path.join(reportDir, 'security-report.sarif');
        saveSARIFReport(findings, sarifPath);
        console.log(`SARIF Report generated at: ${sarifPath}`);
    }
    // Fail build if critical issues are found and running in CI mode
    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    if (criticalCount > 0) {
        console.error('\x1b[31m%s\x1b[0m', `Build failed: ${criticalCount} CRITICAL issues found.`);
        process.exit(1);
    }
}
run().catch(err => {
    console.error('Audit run encountered an error:', err);
    process.exit(1);
});
