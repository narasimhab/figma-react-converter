async function captureFromHtml(html, options) {
  const opts = options || {};
  const width = opts.width || 1440;
  const waitMs = opts.waitMs || 1800;
  const showHiddenMenus = opts.showHiddenMenus !== false;

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;top:0;left:-99999px;width:" +
    width +
    "px;height:1px;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const wrapped = wrapHtml(html, { showHiddenMenus });

  await new Promise((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = wrapped;
    setTimeout(resolve, 6000);
  });

  await new Promise((r) => setTimeout(r, waitMs));

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error("Iframe did not initialize");
  }

  iframe.style.height = doc.documentElement.scrollHeight + "px";
  await new Promise((r) => setTimeout(r, 300));

  const containerRect = doc.body.getBoundingClientRect();
  const pageWidth = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth, width);
  const pageHeight = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);

  const pageBg = win.getComputedStyle(doc.body).backgroundColor;

  const atoms = [];
  walk(doc.body, containerRect, win, atoms);

  const imgAtoms = atoms.filter((a) => a.tag === "img" && a.src);
  await Promise.all(imgAtoms.map((a) => loadImageBytes(a)));

  document.body.removeChild(iframe);

  return { atoms, width: pageWidth, height: pageHeight, background: pageBg };
}

function wrapHtml(html, opts) {
  const trimmed = (html || "").trim();
  const showHiddenMenus = !opts || opts.showHiddenMenus !== false;

  // Style override that forces commonly-hidden menu containers to render.
  // Without this, every CSS :hover dropdown is computed as display:none and
  // never reaches the walker, so menu items go missing in the Figma output.
  const forceMenusCss = showHiddenMenus
    ? "<style>" +
      ".dropdown,.submenu,.flyout,.menu-panel,.nav-dropdown,.has-dropdown>ul," +
      "[class*='dropdown-menu'],[data-dropdown],[role='menu'],[aria-haspopup='true']+ul," +
      ".nav-item:hover .dropdown,.group:hover .dropdown" +
      "{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;}" +
      "</style>"
    : "";

  const hasHtml = /^<!doctype|^<html/i.test(trimmed);
  if (hasHtml) {
    // Inject the override into the existing <head>; fall back to prepend.
    if (/<head[^>]*>/i.test(trimmed)) {
      return trimmed.replace(/<head([^>]*)>/i, "<head$1>" + forceMenusCss);
    }
    return forceMenusCss + trimmed;
  }
  if (/^<body/i.test(trimmed)) {
    return "<!doctype html><html><head><meta charset='utf-8'>" + forceMenusCss + "</head>" + trimmed + "</html>";
  }
  return (
    "<!doctype html><html><head><meta charset='utf-8'>" +
    "<script src='https://cdn.tailwindcss.com'></script>" +
    "<link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css'/>" +
    "<style>body{margin:0;font-family:Inter,system-ui,sans-serif;}</style>" +
    forceMenusCss +
    "</head><body>" +
    trimmed +
    "</body></html>"
  );
}

function walk(el, containerRect, win, atoms) {
  if (!el || el.nodeType !== 1) return;
  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "link" || tag === "meta" || tag === "title" || tag === "noscript") return;

  const cs = win.getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return;

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && tag !== "br") return;

  const box = extractBoxStyle(el, cs, rect, containerRect, tag, win);
  if (box) atoms.push(box);

  for (const childNode of el.childNodes) {
    if (childNode.nodeType === 1) {
      walk(childNode, containerRect, win, atoms);
    } else if (childNode.nodeType === 3) {
      const text = childNode.nodeValue || "";
      if (!text.trim()) continue;
      captureTextNode(childNode, text, cs, containerRect, atoms);
    }
  }
}

function captureTextNode(textNode, text, parentCs, containerRect, atoms) {
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const rects = range.getClientRects();
  if (!rects.length) {
    range.detach && range.detach();
    return;
  }
  let minX = Infinity, minY = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.width === 0 || r.height === 0) continue;
    if (r.left < minX) minX = r.left;
    if (r.top < minY) minY = r.top;
    if (r.right > maxRight) maxRight = r.right;
    if (r.bottom > maxBottom) maxBottom = r.bottom;
  }
  if (!isFinite(minX)) return;

  const cleaned = collapseWhitespace(text);
  if (!cleaned) return;

  atoms.push({
    type: "text",
    text: maybeTransform(cleaned, parentCs.textTransform),
    x: minX - containerRect.left,
    y: minY - containerRect.top,
    w: maxRight - minX,
    h: maxBottom - minY,
    color: parentCs.color,
    fontSize: parseFloat(parentCs.fontSize) || 14,
    fontWeight: parentCs.fontWeight,
    fontFamily: parentCs.fontFamily,
    fontStyle: parentCs.fontStyle,
    textAlign: parentCs.textAlign,
    lineHeight: parentCs.lineHeight,
    letterSpacing: parentCs.letterSpacing,
  });
}

function extractBoxStyle(el, cs, rect, containerRect, tag, win) {
  const x = rect.left - containerRect.left;
  const y = rect.top - containerRect.top;
  const w = rect.width;
  const h = rect.height;

  const bg = cs.backgroundColor;
  const bgImage = cs.backgroundImage;
  const radii = {
    tl: parseFloat(cs.borderTopLeftRadius) || 0,
    tr: parseFloat(cs.borderTopRightRadius) || 0,
    br: parseFloat(cs.borderBottomRightRadius) || 0,
    bl: parseFloat(cs.borderBottomLeftRadius) || 0,
  };
  const border = {
    top: { w: parseFloat(cs.borderTopWidth) || 0, c: cs.borderTopColor, s: cs.borderTopStyle },
    right: { w: parseFloat(cs.borderRightWidth) || 0, c: cs.borderRightColor, s: cs.borderRightStyle },
    bottom: { w: parseFloat(cs.borderBottomWidth) || 0, c: cs.borderBottomColor, s: cs.borderBottomStyle },
    left: { w: parseFloat(cs.borderLeftWidth) || 0, c: cs.borderLeftColor, s: cs.borderLeftStyle },
  };
  const opacity = parseFloat(cs.opacity);
  const boxShadow = cs.boxShadow;

  const hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
  const hasBgImage = bgImage && bgImage !== "none";
  const hasBorder =
    border.top.w > 0 || border.right.w > 0 || border.bottom.w > 0 || border.left.w > 0;
  const hasShadow = boxShadow && boxShadow !== "none";
  const hasRadius = radii.tl + radii.tr + radii.br + radii.bl > 0;

  if (tag === "img") {
    return {
      type: "image",
      tag,
      x, y, w, h,
      src: el.src || el.getAttribute("src") || null,
      bg, bgImage, radii, border, opacity, boxShadow,
    };
  }

  if (tag === "input" || tag === "textarea") {
    return {
      type: "input",
      tag,
      x, y, w, h,
      placeholder: el.placeholder || "",
      value: el.value || "",
      bg, bgImage, radii, border, opacity, boxShadow,
      color: cs.color,
      fontSize: parseFloat(cs.fontSize) || 14,
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
    };
  }

  if (tag === "i" || tag === "svg") {
    const classNames = el.getAttribute("class") || "";
    let glyph = null;
    let glyphFontFamily = cs.fontFamily;
    let glyphFontWeight = cs.fontWeight;
    let glyphFontSize = parseFloat(cs.fontSize) || 14;

    // FontAwesome / Material Icons / Bootstrap Icons inject the glyph via the
    // ::before pseudo-element's `content` property. Read it explicitly.
    if (tag === "i" && win) {
      try {
        const before = win.getComputedStyle(el, "::before");
        const content = before && before.content;
        if (content && content !== "none" && content !== "normal" && content !== '""' && content !== "''") {
          let s = content;
          if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            s = s.slice(1, -1);
          }
          // CSS escape sequences (e.g. "\f0f3") arrive pre-decoded as the
          // actual codepoint in modern browsers, but handle the raw form too.
          s = s.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) =>
            String.fromCodePoint(parseInt(hex, 16))
          );
          if (s) glyph = s;
        }
        if (before) {
          if (before.fontFamily) glyphFontFamily = before.fontFamily;
          if (before.fontWeight) glyphFontWeight = before.fontWeight;
          const beforeSize = parseFloat(before.fontSize);
          if (beforeSize) glyphFontSize = beforeSize;
        }
      } catch (e) { /* ignore */ }
    }

    return {
      type: "icon",
      tag,
      x, y, w, h,
      color: cs.color,
      bg,
      fontFamily: glyphFontFamily,
      fontWeight: glyphFontWeight,
      fontSize: glyphFontSize,
      glyph,
      classNames,
    };
  }

  if (!hasBg && !hasBgImage && !hasBorder && !hasShadow && !hasRadius && opacity === 1) {
    return null;
  }

  return {
    type: "box",
    tag,
    x, y, w, h,
    bg, bgImage, radii, border, opacity, boxShadow,
  };
}

async function loadImageBytes(atom) {
  if (!atom.src) return;
  try {
    const resp = await fetch(atom.src, { mode: "cors" });
    if (!resp.ok) return;
    const buf = await resp.arrayBuffer();
    atom.imageBytes = new Uint8Array(buf);
  } catch (e) {
    /* CORS / network failure - leave as placeholder */
  }
}

function collapseWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

function maybeTransform(text, transform) {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") {
    return text.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return text;
}

module.exports = { captureFromHtml };
