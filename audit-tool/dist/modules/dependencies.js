import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
export async function auditDependencies(projectRoot) {
    const findings = [];
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        return findings;
    }
    // 1. License Check
    try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        // Scan license field in package.json dependencies if available locally
        for (const dep of Object.keys(allDeps)) {
            const depPkgPath = path.join(projectRoot, 'node_modules', dep, 'package.json');
            if (fs.existsSync(depPkgPath)) {
                try {
                    const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf-8'));
                    const license = depPkg.license || (depPkg.licenses && depPkg.licenses[0]?.type) || 'Unknown';
                    if (['GPL', 'AGPL', 'LGPL', 'GPL-3.0', 'AGPL-3.0'].some(l => String(license).toUpperCase().includes(l))) {
                        findings.push({
                            severity: 'MEDIUM',
                            category: 'License Compliance',
                            file: 'package.json',
                            line: 1,
                            description: `Dependency "${dep}" uses copyleft license: ${license}`,
                            recommendation: `Verify if copyleft license "${license}" aligns with product licensing requirements.`
                        });
                    }
                }
                catch {
                    // Skip if package.json reading fails
                }
            }
        }
    }
    catch (err) {
        // Skip if root package.json parsing fails
    }
    // 2. npm audit
    return new Promise((resolve) => {
        exec('npm audit --json', { cwd: projectRoot }, (error, stdout, stderr) => {
            try {
                const auditResult = JSON.parse(stdout);
                if (auditResult.vulnerabilities) {
                    for (const [name, vulnData] of Object.entries(auditResult.vulnerabilities)) {
                        const vuln = vulnData;
                        const severityMap = {
                            critical: 'CRITICAL',
                            high: 'HIGH',
                            moderate: 'MEDIUM',
                            low: 'LOW'
                        };
                        findings.push({
                            severity: (severityMap[vuln.severity] || 'MEDIUM'),
                            category: 'Dependency Vulnerability',
                            file: 'package.json',
                            line: 1,
                            description: `Vulnerable dependency "${name}" detected. Range: ${vuln.range}`,
                            recommendation: `Run "npm audit fix" or upgrade "${name}" to a secure version.`
                        });
                    }
                }
            }
            catch {
                // npm audit failed or returned non-JSON
            }
            resolve(findings);
        });
    });
}
