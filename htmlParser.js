function parseHtml(input) {
  const doc = new DOMParser().parseFromString(input, "text/html");

  const customStyles = extractStyles(doc);
  const root = doc.body || doc.documentElement;
  const children = [];
  root.childNodes.forEach((child) => {
    const node = elementToNode(child);
    if (node) children.push(node);
  });

  return { tree: children, customStyles };
}

function extractStyles(doc) {
  const out = [];
  doc.querySelectorAll("style").forEach((styleEl) => {
    parseCssText(styleEl.textContent || "", out);
  });
  return out;
}

function parseCssText(css, out) {
  let s = css.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/@keyframes\s+[\w-]+\s*\{[\s\S]*?\}\s*\}/g, "");
  s = s.replace(/@media[^{]+\{([\s\S]*?)\}\s*\}/g, "$1");

  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const rawSelector = m[1].trim();
    const body = m[2].trim();
    if (!rawSelector || rawSelector.startsWith("@")) continue;

    const props = {};
    body.split(";").forEach((decl) => {
      const idx = decl.indexOf(":");
      if (idx < 0) return;
      const k = decl.slice(0, idx).trim().toLowerCase();
      const v = decl.slice(idx + 1).trim();
      if (k && v) props[k] = v;
    });
    if (!Object.keys(props).length) continue;

    rawSelector.split(",").forEach((sel) => {
      const trimmed = sel.trim();
      if (trimmed.includes(":") || trimmed.includes(" ") || trimmed.includes(">")) return;
      const compound = trimmed.match(/^(\.[\w-]+)+$/);
      if (!compound) return;
      const classes = trimmed.split(".").filter(Boolean);
      if (!classes.length) return;
      out.push({ classes, props });
    });
  }
}

function elementToNode(el) {
  if (!el) return null;

  if (el.nodeType === 3) {
    const text = (el.nodeValue || "").replace(/\s+/g, " ");
    if (!text.trim()) return null;
    return { type: "text", value: text.trim() };
  }

  if (el.nodeType !== 1) return null;

  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "meta" || tag === "link" || tag === "title") {
    return null;
  }

  const attributes = [];
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    attributes.push({ name: a.name, value: a.value });
  }

  const children = [];
  el.childNodes.forEach((c) => {
    const n = elementToNode(c);
    if (n) children.push(n);
  });

  return { tag, attributes, children };
}

module.exports = { parseHtml };
