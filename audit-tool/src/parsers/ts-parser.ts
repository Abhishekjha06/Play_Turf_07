import ts from 'typescript';
import fs from 'fs';

export interface ASTNodeInfo {
  node: ts.Node;
  kind: ts.SyntaxKind;
  line: number;
  character: number;
  text: string;
}

export function parseAST(filePath: string): { sourceFile: ts.SourceFile; nodes: ASTNodeInfo[] } {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const nodes: ASTNodeInfo[] = [];

  function visit(node: ts.Node) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    nodes.push({
      node,
      kind: node.kind,
      line: line + 1, // 1-indexed
      character: character + 1,
      text: node.getText(sourceFile)
    });
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { sourceFile, nodes };
}
