const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

/**
 * Convert React JSX into a nested tree structure
 * Suitable for UI / Figma / layout conversion
 */

function parseReact(code) {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx"]
  });

  let rootNodes = [];

  // ---------- Helpers ----------
  function getTagName(node) {
    if (!node) return "unknown";

    if (node.type === "JSXIdentifier") {
      return node.name;
    }

    if (node.type === "JSXMemberExpression") {
      return (
        getTagName(node.object) +
        "." +
        getTagName(node.property)
      );
    }

    if (node.type === "JSXFragment") {
      return "Fragment";
    }

    return "unknown";
  }

  function getAttributes(attrs = []) {
    return attrs.map(attr => {
      if (attr.type !== "JSXAttribute") return null;

      let value;

      if (!attr.value) {
        value = true;
      } else if (attr.value.type === "StringLiteral") {
        value = attr.value.value;
      } else {
        value = "{expr}";
      }

      return {
        name: attr.name.name,
        value
      };
    }).filter(Boolean);
  }

  function getChildren(children = []) {
    const result = [];

    children.forEach(child => {
      // TEXT
      if (child.type === "JSXText") {
        const text = child.value.replace(/\s+/g, " ").trim();
        if (text) {
          result.push({
            type: "text",
            value: text
          });
        }
      }

      // EXPRESSION
      else if (child.type === "JSXExpressionContainer") {
        result.push({
          type: "expression",
          value: "{expr}"
        });
      }

      // ELEMENT
      else if (child.type === "JSXElement") {
        result.push(buildNode(child));
      }

      // FRAGMENT
      else if (child.type === "JSXFragment") {
        result.push(buildNode(child));
      }
    });

    return result;
  }

  function buildNode(node) {
    // FRAGMENT SUPPORT
    if (node.type === "JSXFragment") {
      return {
        tag: "Fragment",
        attributes: [],
        children: getChildren(node.children)
      };
    }

    return {
      tag: getTagName(node.openingElement.name),
      attributes: getAttributes(node.openingElement.attributes),
      children: getChildren(node.children)
    };
  }

  // ---------- Traverse AST ----------
  traverse(ast, {
    JSXElement(path) {
      const parent = path.parentPath;

      // only capture root JSX nodes
      if (
        parent.type !== "JSXElement" &&
        parent.type !== "JSXFragment"
      ) {
        rootNodes.push(buildNode(path.node));
      }
    },

    JSXFragment(path) {
      const parent = path.parentPath;

      if (
        parent.type !== "JSXElement" &&
        parent.type !== "JSXFragment"
      ) {
        rootNodes.push(buildNode(path.node));
      }
    }
  });

  return rootNodes;
}

module.exports = {
  parseReact
};