import fs from 'fs';
import path from 'path';
import { SENSITIVE_FILE_NAMES } from '../config.js';
import { AuditFinding } from '../types.js';

export function scanSensitiveFiles(projectRoot: string): AuditFinding[] {
  const findings: AuditFinding[] = [];

  function checkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    
    for (const file of list) {
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (['node_modules', 'dist', 'build', '.git'].includes(file)) continue;
        checkDir(fullPath);
      } else {
        if (SENSITIVE_FILE_NAMES.includes(file)) {
          findings.push({
            severity: 'CRITICAL',
            category: 'Sensitive File Leak',
            file: path.relative(projectRoot, fullPath),
            line: 0,
            description: `Sensitive config/key/backup file "${file}" exposed in project repository directory.`,
            recommendation: 'Move config files to a secure path outside of version control or encrypt private resources.'
          });
        }
      }
    }
  }

  checkDir(projectRoot);
  return findings;
}
