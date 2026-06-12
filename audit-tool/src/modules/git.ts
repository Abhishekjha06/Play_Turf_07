import fs from 'fs';
import path from 'path';
import { AuditFinding } from '../types.js';

export function auditGit(projectRoot: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const gitignorePath = path.join(projectRoot, '.gitignore');

  if (!fs.existsSync(gitignorePath)) {
    findings.push({
      severity: 'HIGH',
      category: 'Git Security',
      file: '.gitignore',
      line: 0,
      description: 'Missing .gitignore file in root directory',
      recommendation: 'Create a .gitignore file to prevent checking in sensitive assets.'
    });
    return findings;
  }

  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  const lines = gitignoreContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  const requiredIgnores = ['.env', 'node_modules', 'dist'];
  for (const ignore of requiredIgnores) {
    const isIgnored = lines.some(line => line.includes(ignore));
    if (!isIgnored) {
      findings.push({
        severity: 'HIGH',
        category: 'Git Security',
        file: '.gitignore',
        line: 1,
        description: `"${ignore}" is not ignored in .gitignore`,
        recommendation: `Add "${ignore}" to your .gitignore file to prevent accidental commits.`
      });
    }
  }

  return findings;
}
