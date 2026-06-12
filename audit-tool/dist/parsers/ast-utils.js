import ts from 'typescript';
export function findCallExpressions(nodes, name) {
    return nodes.filter(n => {
        if (ts.isCallExpression(n.node)) {
            const expression = n.node.expression;
            return expression.getText() === name;
        }
        return false;
    });
}
export function findJSXAttributes(nodes, name) {
    return nodes.filter(n => {
        if (ts.isJsxAttribute(n.node)) {
            return n.node.name.getText() === name;
        }
        return false;
    });
}
export function findVariableDeclarations(nodes) {
    return nodes.filter(n => ts.isVariableDeclaration(n.node));
}
