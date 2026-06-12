import fs from 'fs';
import path from 'path';
import { AuditFinding } from '../types.js';

export function auditDocker(projectRoot: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const dockerfilePath = path.join(projectRoot, 'Dockerfile');
  const composePath = path.join(projectRoot, 'docker-compose.yml');

  if (fs.existsSync(dockerfilePath)) {
    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    const lines = content.split('\n');

    let hasUserNodeOrNonRoot = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('FROM') && trimmed.includes(':latest')) {
        findings.push({
          severity: 'MEDIUM',
          category: 'Docker Security',
          file: 'Dockerfile',
          line: index + 1,
          description: 'Base image uses tag "latest"',
          recommendation: 'Use a specific version tag (e.g. node:20-alpine) instead of "latest" to ensure build reproducibility and security stability.'
        });
      }

      if (trimmed.startsWith('USER')) {
        hasUserNodeOrNonRoot = true;
      }
    });

    if (!hasUserNodeOrNonRoot) {
      findings.push({
        severity: 'HIGH',
        category: 'Docker Security',
        file: 'Dockerfile',
        line: 1,
        description: 'No USER instruction specified. Container runs as root by default.',
        recommendation: 'Add "USER node" or create a custom non-root user in the Dockerfile.'
      });
    }
  }

  if (fs.existsSync(composePath)) {
    const content = fs.readFileSync(composePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('ports:') || trimmed.includes('- "0.0.0.0:')) {
        findings.push({
          severity: 'MEDIUM',
          category: 'Docker Security',
          file: 'docker-compose.yml',
          line: index + 1,
          description: 'Port bound to all interfaces (0.0.0.0)',
          recommendation: 'Bind ports to localhost (127.0.0.1) unless external access is specifically required.'
        });
      }
    });
  }

  return findings;
}
