import ts from 'typescript';
import fs from 'fs';
export function parseAST(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);
    const nodes = [];
    function visit(node) {
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
