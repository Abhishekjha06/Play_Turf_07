import fs from 'fs';
export function saveJSONReport(findings, imports, destPath) {
    const data = {
        generatedAt: new Date().toISOString(),
        summary: {
            totalFindings: findings.length,
            critical: findings.filter(f => f.severity === 'CRITICAL').length,
            high: findings.filter(f => f.severity === 'HIGH').length,
            medium: findings.filter(f => f.severity === 'MEDIUM').length,
            low: findings.filter(f => f.severity === 'LOW').length,
            importIssues: imports.length
        },
        findings,
        imports
    };
    fs.writeFileSync(destPath, JSON.stringify(data, null, 2), 'utf-8');
}
export function saveCSVReport(findings, destPath) {
    const headers = ['Severity', 'Category', 'File', 'Line', 'Description', 'Recommendation'];
    const rows = findings.map(f => [
        f.severity,
        f.category,
        f.file,
        f.line.toString(),
        `"${f.description.replace(/"/g, '""')}"`,
        `"${f.recommendation.replace(/"/g, '""')}"`
    ]);
    const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    fs.writeFileSync(destPath, content, 'utf-8');
}
export function saveSARIFReport(findings, destPath) {
    const sarif = {
        $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json',
        version: '2.1.0',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'Enterprise Security & Code Auditor',
                        version: '1.0.0',
                        rules: []
                    }
                },
                results: findings.map((f, index) => {
                    const ruleId = `SEC-${f.category.toUpperCase().replace(/\s+/g, '-')}`;
                    return {
                        ruleId,
                        message: {
                            text: f.description
                        },
                        level: f.severity === 'CRITICAL' || f.severity === 'HIGH' ? 'error' : 'warning',
                        locations: [
                            {
                                physicalLocation: {
                                    artifactLocation: {
                                        uri: f.file
                                    },
                                    region: {
                                        startLine: f.line || 1
                                    }
                                }
                            }
                        ]
                    };
                })
            }
        ]
    };
    fs.writeFileSync(destPath, JSON.stringify(sarif, null, 2), 'utf-8');
}
export function saveHTMLReport(findings, imports, scannedFiles, durationMs, destPath) {
    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const highCount = findings.filter(f => f.severity === 'HIGH').length;
    const mediumCount = findings.filter(f => f.severity === 'MEDIUM').length;
    const lowCount = findings.filter(f => f.severity === 'LOW').length;
    const findingsListHtml = findings.map((f, i) => `
    <div class="card severity-${f.severity.toLowerCase()}">
      <div class="card-header">
        <span class="badge badge-${f.severity.toLowerCase()}">${f.severity}</span>
        <strong>${f.category}</strong>
        <span class="file-info">${f.file}:${f.line}</span>
      </div>
      <div class="card-body">
        <p class="description">${f.description}</p>
        <p class="recommendation"><strong>Recommendation:</strong> ${f.recommendation}</p>
      </div>
    </div>
  `).join('');
    const importsListHtml = imports.map(i => `
    <div class="card import-card">
      <div class="card-header">
        <span class="badge badge-warning">${i.type}</span>
        <strong>Import Issue</strong>
        <span class="file-info">${i.file}:${i.line}</span>
      </div>
      <div class="card-body">
        <p class="description">${i.description}</p>
        <p class="recommendation"><strong>Recommendation:</strong> ${i.recommendation}</p>
      </div>
    </div>
  `).join('');
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enterprise Code Audit Report</title>
  <style>
    :root {
      --bg-dark: #0f172a;
      --card-bg: #1e293b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --critical: #ef4444;
      --high: #f97316;
      --medium: #eab308;
      --low: #3b82f6;
    }
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: 'Outfit', sans-serif;
      margin: 0;
      padding: 24px;
    }
    header {
      border-bottom: 1px solid #334155;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    h1 { margin: 0; font-size: 2rem; background: linear-gradient(to right, #60a5fa, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .meta-summary {
      display: flex;
      gap: 16px;
      margin-top: 8px;
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background-color: var(--card-bg);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-num { font-size: 2rem; font-weight: bold; margin-top: 8px; }
    .stat-num.critical { color: var(--critical); }
    .stat-num.high { color: var(--high); }
    .stat-num.medium { color: var(--medium); }
    .stat-num.low { color: var(--low); }
    .section-title { font-size: 1.5rem; margin-bottom: 16px; border-left: 4px solid #3b82f6; padding-left: 8px; }
    .card {
      background-color: var(--card-bg);
      border-radius: 8px;
      margin-bottom: 16px;
      border-left: 6px solid var(--text-muted);
      overflow: hidden;
    }
    .card.severity-critical { border-left-color: var(--critical); }
    .card.severity-high { border-left-color: var(--high); }
    .card.severity-medium { border-left-color: var(--medium); }
    .card.severity-low { border-left-color: var(--low); }
    .card.import-card { border-left-color: var(--medium); }
    .card-header {
      padding: 12px 16px;
      background-color: rgba(255,255,255,0.02);
      border-bottom: 1px solid rgba(255,255,255,0.05);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge-critical { background-color: var(--critical); color: #fff; }
    .badge-high { background-color: var(--high); color: #fff; }
    .badge-medium { background-color: var(--medium); color: #000; }
    .badge-low { background-color: var(--low); color: #fff; }
    .badge-warning { background-color: var(--medium); color: #000; }
    .file-info { margin-left: auto; font-size: 0.85rem; color: var(--text-muted); }
    .card-body { padding: 16px; }
    .description { margin: 0 0 8px 0; font-size: 0.95rem; }
    .recommendation { margin: 0; font-size: 0.9rem; color: var(--text-muted); }
  </style>
</head>
<body>
  <header>
    <h1>Enterprise Code Audit Dashboard</h1>
    <div class="meta-summary">
      <span>Files Scanned: <strong>${scannedFiles}</strong></span> |
      <span>Scan Duration: <strong>${durationMs}ms</strong></span> |
      <span>Report Generated: <strong>${new Date().toLocaleDateString()}</strong></span>
    </div>
  </header>

  <div class="grid">
    <div class="stat-card">
      <div>CRITICAL</div>
      <div class="stat-num critical">${criticalCount}</div>
    </div>
    <div class="stat-card">
      <div>HIGH</div>
      <div class="stat-num high">${highCount}</div>
    </div>
    <div class="stat-card">
      <div>MEDIUM</div>
      <div class="stat-num medium">${mediumCount}</div>
    </div>
    <div class="stat-card">
      <div>LOW</div>
      <div class="stat-num low">${lowCount}</div>
    </div>
  </div>

  <h2 class="section-title">Vulnerability Findings</h2>
  ${findingsListHtml || '<p>No vulnerability issues detected.</p>'}

  <h2 class="section-title">Import & Alias Findings</h2>
  ${importsListHtml || '<p>No import validation errors detected.</p>'}
</body>
</html>
  `;
    fs.writeFileSync(destPath, htmlContent, 'utf-8');
}
