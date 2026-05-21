const {
  buildCdnHeadTags,
  buildMenuForceCss,
  resolveLibrariesForHtml,
  isIconElement,
  iconSetFromClasses,
} = require("./libAssets");

async function captureFromHtml(html, options) {
  const opts = options || {};
  const width = opts.width || 1440;
  const waitMs = opts.waitMs || 1800;
  const showHiddenMenus = opts.showHiddenMenus !== false;
  const multiView = opts.multiView !== false;
  const viewSelector = opts.viewSelector || ".view-section";

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;top:0;left:-99999px;width:" +
    width +
    "px;height:1px;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const libs = resolveLibrariesForHtml(html, options);
  const wrapped = wrapHtml(html, { showHiddenMenus, libs });

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

  const pageBg = win.getComputedStyle(doc.body).backgroundColor;

  // Multi-view mode: detect .view-section elements (or user-specified
  // selector) and capture each one as its own screen. Each "screen" becomes
  // a separate frame in Figma, and onclick navigateTo('X') wires up
  // prototype reactions between them.
  const views = multiView ? Array.from(doc.querySelectorAll(viewSelector)) : [];
  const screens = [];

  if (views.length > 0) {
    for (let i = 0; i < views.length; i++) {
      const view = views[i];

      views.forEach((v) => v.classList.remove("active"));
      view.classList.add("active");

      // Animations/transitions are already disabled by the injected style;
      // we still wait a tick for layout to settle.
      await new Promise((r) => setTimeout(r, 200));
      iframe.style.height = doc.documentElement.scrollHeight + "px";
      await new Promise((r) => setTimeout(r, 120));

      const screen = await captureOne(doc, win, width, pageBg, {
        name: viewName(view),
      });
      screens.push(screen);
    }
  } else {
    iframe.style.height = doc.documentElement.scrollHeight + "px";
    await new Promise((r) => setTimeout(r, 300));
    const screen = await captureOne(doc, win, width, pageBg, { name: "screen" });
    screens.push(screen);
  }

  document.body.removeChild(iframe);

  return { screens, libraries: libs };
}

async function captureOne(doc, win, width, pageBg, meta) {
  const containerRect = doc.body.getBoundingClientRect();
  const pageWidth = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth, width);
  const pageHeight = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);

  const atoms = [];
  walk(doc.body, containerRect, win, atoms);

  const imgAtoms = atoms.filter((a) => a.tag === "img" && a.src);
  const bgAtoms = atoms.filter((a) => a.bgImageUrls && a.bgImageUrls.length);
  await Promise.all([
    ...imgAtoms.map((a) => loadImageBytes(a)),
    ...bgAtoms.map((a) => loadBgImageBytes(a)),
  ]);

  return {
    name: meta.name,
    atoms,
    width: pageWidth,
    height: pageHeight,
    background: pageBg,
  };
}

function viewName(viewEl) {
  const id = viewEl.id || viewEl.getAttribute("data-view") || "";
  if (id) return id.replace(/^view-/, "");
  return "view";
}

function wrapHtml(html, opts) {
  const trimmed = (html || "").trim();
  const showHiddenMenus = !opts || opts.showHiddenMenus !== false;
  const libs = (opts && opts.libs) || resolveLibrariesForHtml(trimmed, opts);
  const forceMenusCss = buildMenuForceCss(showHiddenMenus);
  const cdnTags = buildCdnHeadTags(libs);
  const baseStyle = "<style>body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;}</style>";

  const headInject = forceMenusCss + cdnTags + baseStyle;

  const hasHtml = /^<!doctype|^<html/i.test(trimmed);
  if (hasHtml) {
    let out = trimmed;
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, "<head$1>" + headInject);
    } else {
      out = headInject + out;
    }
    // Full documents may reference Bootstrap/BI in <head> already; inject only
    // missing CDN tags when detection asked for them (buildCdnHeadTags handles that).
    return out;
  }
  if (/^<body/i.test(trimmed)) {
    return "<!doctype html><html><head><meta charset='utf-8'>" + headInject + "</head>" + trimmed + "</html>";
  }
  return (
    "<!doctype html><html><head><meta charset='utf-8'>" +
    headInject +
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

function captureIconGlyph(el, tag, cs, win) {
  let glyph = null;
  let fontFamily = cs.fontFamily;
  let fontWeight = cs.fontWeight;
  let fontSize = parseFloat(cs.fontSize) || 14;

  if (tag !== "svg" && win) {
    try {
      const before = win.getComputedStyle(el, "::before");
      const content = before && before.content;
      if (content && content !== "none" && content !== "normal" && content !== '""' && content !== "''") {
        let s = content;
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
          s = s.slice(1, -1);
        }
        s = s.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) =>
          String.fromCodePoint(parseInt(hex, 16))
        );
        if (s) glyph = s;
      }
      if (before) {
        if (before.fontFamily) fontFamily = before.fontFamily;
        if (before.fontWeight) fontWeight = before.fontWeight;
        const beforeSize = parseFloat(before.fontSize);
        if (beforeSize) fontSize = beforeSize;
      }
    } catch (e) { /* ignore */ }
  }

  return { glyph, fontFamily, fontWeight, fontSize };
}

function extractBoxStyle(el, cs, rect, containerRect, tag, win) {
  const x = rect.left - containerRect.left;
  const y = rect.top - containerRect.top;
  const w = rect.width;
  const h = rect.height;

  const bg = cs.backgroundColor;
  const bgImage = cs.backgroundImage;
  const bgImageUrls = extractBgImageUrls(bgImage);
  const bgSize = cs.backgroundSize;
  const bgRepeat = cs.backgroundRepeat;
  const bgPosition = cs.backgroundPosition;
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

  const onclickTarget = parseOnclickTarget(el);
  const href = el.getAttribute && el.getAttribute("href");
  const isInteractive =
    (tag === "button" || tag === "a") && (!!onclickTarget || (!!href && href !== "#" && !href.startsWith("javascript")));

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

  if (isIconElement(el)) {
    const classNames = el.getAttribute("class") || "";
    const iconData = captureIconGlyph(el, tag, cs, win);
    return {
      type: "icon",
      tag,
      x, y, w, h,
      color: cs.color,
      bg,
      fontFamily: iconData.fontFamily,
      fontWeight: iconData.fontWeight,
      fontSize: iconData.fontSize,
      glyph: iconData.glyph,
      classNames,
      iconSet: iconSetFromClasses(classNames, iconData.fontFamily),
    };
  }

  if (
    !hasBg &&
    !hasBgImage &&
    !hasBorder &&
    !hasShadow &&
    !hasRadius &&
    opacity === 1 &&
    !isInteractive
  ) {
    return null;
  }

  return {
    type: "box",
    tag,
    x, y, w, h,
    bg,
    bgImage,
    bgImageUrls,
    bgSize,
    bgRepeat,
    bgPosition,
    radii,
    border,
    opacity,
    boxShadow,
    onclickTarget,
    href: href && href.startsWith("http") ? href : null,
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

async function loadBgImageBytes(atom) {
  if (!atom.bgImageUrls || !atom.bgImageUrls.length) return;
  // Walk URLs in order; first one that loads wins (CSS allows layered images
  // but the most common case is a single url()).
  for (const url of atom.bgImageUrls) {
    if (!url || url.startsWith("data:")) {
      if (url && url.startsWith("data:")) {
        const bytes = dataUrlToBytes(url);
        if (bytes) {
          atom.bgImageBytes = bytes;
          atom.bgImageUrl = url;
          return;
        }
      }
      continue;
    }
    try {
      const resp = await fetch(url, { mode: "cors" });
      if (!resp.ok) continue;
      const buf = await resp.arrayBuffer();
      atom.bgImageBytes = new Uint8Array(buf);
      atom.bgImageUrl = url;
      return;
    } catch (e) {
      /* try next */
    }
  }
}

function dataUrlToBytes(dataUrl) {
  const m = dataUrl.match(/^data:[^;]+;base64,(.*)$/);
  if (!m) return null;
  try {
    const bin = atob(m[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch (e) {
    return null;
  }
}

function extractBgImageUrls(bgImage) {
  if (!bgImage || bgImage === "none") return [];
  const urls = [];
  const re = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]+?))\s*\)/g;
  let m;
  while ((m = re.exec(bgImage)) !== null) {
    const u = (m[1] || m[2] || m[3] || "").trim();
    if (u) urls.push(u);
  }
  return urls;
}

function parseOnclickTarget(el) {
  if (!el || !el.getAttribute) return null;
  const onclick = el.getAttribute("onclick") || "";
  // Accept navigateTo('x'), navigateTo("x"), navigateTo('x', this), etc.
  const m = onclick.match(/navigateTo\(\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
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
