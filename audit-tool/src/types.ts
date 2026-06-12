export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AuditFinding {
  severity: Severity;
  category: string;
  file: string;
  line: number;
  description: string;
  recommendation: string;
  codeSnippet?: string;
}

export interface ImportFinding {
  type: 'MISSING_IMPORT' | 'CASE_MISMATCH' | 'UNUSED_IMPORT' | 'DYNAMIC_IMPORT_RISK';
  file: string;
  line: number;
  importPath: string;
  resolvedPath?: string;
  description: string;
  recommendation: string;
  isFixable: boolean;
}

export interface AuditConfig {
  scanSecurity: boolean;
  scanImports: boolean;
  fixImports: boolean;
  scanSecrets: boolean;
  scanXss: boolean;
  scanDependencies: boolean;
  fullAudit: boolean;
  outputJson: boolean;
  outputCsv: boolean;
  outputHtml: boolean;
  rootDir: string;
}

export interface AuditResults {
  findings: AuditFinding[];
  imports: ImportFinding[];
  scannedFiles: number;
  durationMs: number;
  dependencyVulnerabilities?: any;
}
