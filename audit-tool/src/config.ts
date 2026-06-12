export const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.kiro',
  '.vscode'
];

export const EXCLUDE_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'security-report.json',
  'security-report.csv',
  'security-report.html',
  'security-report.sarif'
];

export const SECRET_PATTERNS = {
  openai: /sk-[a-zA-Z0-9]{32,}/g,
  google: /AIzaSy[a-zA-Z0-9-_]{33}/g,
  aws_key: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
  aws_secret: /([^A-Z0-9]|^)[a-zA-Z0-9+/]{40}([^A-Z0-9]|$)/g, // Context-specific checks needed
  firebase: /"apiKey":\s*"[a-zA-Z0-9-_]{35,}"/g,
  jwt: /eyJ[a-zA-Z0-9-_=]+\.eyJ[a-zA-Z0-9-_=]+\.?[a-zA-Z0-9-_+/=]*/g,
  generic_secret: /(key|secret|password|token|auth|credential|private_key)\s*[:=]\s*["'`][a-zA-Z0-9-_~.+=]{16,}["'`]/gi
};

export const SENSITIVE_FILE_NAMES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'firebase-admin.json',
  'service-account.json',
  'private.pem',
  'private.key',
  'id_rsa',
  'id_ecdsa',
  'id_ed25519',
  'backup.sql',
  'dump.rdb'
];
