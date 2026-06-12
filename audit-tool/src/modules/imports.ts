import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { parseAST } from '../parsers/ts-parser.js';
import { ImportFinding } from '../types.js';

interface Alias {
  find: string;
  replacement: string;
}

export function auditImports(
  filePath: string,
  aliases: Alias[],
  projectRoot: string,
  fixMode: boolean = false
): ImportFinding[] {
  const findings: ImportFinding[] = [];
  let astData;

  try {
    astData = parseAST(filePath);
  } catch {
    return findings;
  }

  const { sourceFile, nodes } = astData;
  const fileDir = path.dirname(filePath);

  nodes.forEach(nodeInfo => {
    const { node, line } = nodeInfo;

    // Detect standard imports and dynamic imports
    let importPath = '';
    let isDynamic = false;

    if (ts.isImportDeclaration(node)) {
      importPath = (node.moduleSpecifier as ts.StringLiteral).text;
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      isDynamic = true;
      if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        importPath = node.arguments[0].text;
      }
    }

    if (!importPath) return;

    // Skip absolute module dependencies (like 'react', 'path', etc)
    if (!importPath.startsWith('.') && !aliases.some(alias => importPath.startsWith(alias.find))) {
      return;
    }

    // Resolve Vite alias to physical system paths
    let resolvedPath = importPath;
    let aliasUsed = false;

    for (const alias of aliases) {
      if (importPath.startsWith(alias.find)) {
        resolvedPath = importPath.replace(alias.find, alias.replacement);
        aliasUsed = true;
        break;
      }
    }

    // Resolve relative imports to absolute disk path location
    let absoluteTarget = aliasUsed ? resolvedPath : path.resolve(fileDir, resolvedPath);

    // Try resolving file extensions (.ts, .tsx, .js, .jsx, /index.ts, etc)
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
    let finalPath = '';
    
    for (const ext of extensions) {
      const candidate = absoluteTarget + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        finalPath = candidate;
        break;
      }
    }

    if (!finalPath) {
      findings.push({
        type: 'MISSING_IMPORT',
        file: filePath,
        line,
        importPath,
        description: `Import target "${importPath}" cannot be resolved.`,
        recommendation: 'Verify the import relative path reference or check alias mapping configuration.',
        isFixable: false
      });
      return;
    }

    // Verify Case-Sensitivity mismatches (Crucial for Linux server compatibility)
    const originalDir = path.dirname(finalPath);
    const targetFileBasename = path.basename(finalPath);

    try {
      const actualFiles = fs.readdirSync(originalDir);
      const exactMatch = actualFiles.includes(targetFileBasename);
      const caseMismatch = actualFiles.some(f => f.toLowerCase() === targetFileBasename.toLowerCase() && f !== targetFileBasename);

      if (caseMismatch && !exactMatch) {
        const correctFilename = actualFiles.find(f => f.toLowerCase() === targetFileBasename.toLowerCase());
        
        findings.push({
          type: 'CASE_MISMATCH',
          file: filePath,
          line,
          importPath,
          resolvedPath: finalPath,
          description: `Case sensitivity mismatch: file system has "${correctFilename}", code imports "${targetFileBasename}".`,
          recommendation: `Update the import string to exactly match "${correctFilename}" case sensitivity.`,
          isFixable: true
        });

        if (fixMode && correctFilename) {
          // Perform auto-fix of casing mismatch in source file
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          const targetLine = lines[line - 1];
          
          // Construct corrected import statement
          const fixedLine = targetLine.replace(importPath, importPath.replace(targetFileBasename, correctFilename));
          lines[line - 1] = fixedLine;
          
          fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        }
      }
    } catch {
      // Ignore if directory readdir fails
    }
  });

  return findings;
}
