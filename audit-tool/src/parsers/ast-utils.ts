import ts from 'typescript';
import { ASTNodeInfo } from './ts-parser.js';

export function findCallExpressions(nodes: ASTNodeInfo[], name: string): ASTNodeInfo[] {
  return nodes.filter(n => {
    if (ts.isCallExpression(n.node)) {
      const expression = n.node.expression;
      return expression.getText() === name;
    }
    return false;
  });
}

export function findJSXAttributes(nodes: ASTNodeInfo[], name: string): ASTNodeInfo[] {
  return nodes.filter(n => {
    if (ts.isJsxAttribute(n.node)) {
      return (n.node as ts.JsxAttribute).name.getText() === name;
    }
    return false;
  });
}

export function findVariableDeclarations(nodes: ASTNodeInfo[]): ASTNodeInfo[] {
  return nodes.filter(n => ts.isVariableDeclaration(n.node));
}
