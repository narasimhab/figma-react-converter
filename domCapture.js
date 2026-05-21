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
  const showHiddenMenus = opts.showHiddenMenus !== false;
  const multiView = opts.multiView !== false;
  const viewSelector = opts.viewSelector || ".view-section";
  const baseUrl = normalizeBaseUrl(opts.baseUrl);

  const iframe = document.createElement("iframe");
  // Width is fixed by both attribute and CSS so the inner viewport reports
  // the value we want regardless of browser quirks. opacity:0 (not
  // visibility:hidden) keeps the iframe in normal layout flow so its
  // descendants compute their box sizes against the full requested width.
  iframe.setAttribute("width", String(width));
  iframe.style.cssText =
    "position:fixed;top:0;left:-99999px;width:" + width + "px;" +
    "min-width:" + width + "px;max-width:" + width + "px;" +
    "height:2000px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const libs = resolveLibrariesForHtml(html, options);
  const wrapped = wrapHtml(html, { showHiddenMenus, libs, baseUrl });

  // Longer default wait when external CSS/font CDNs were injected — icon
  // webfonts (Bootstrap Icons, Font Awesome) can take 1-2s to download
  // and apply their `content: "\fXXX"` to ::before pseudo-elements.
  const cdnInjected =
    libs.bootstrap || libs.bootstrapIcons || libs.fontAwesome || libs.tailwind;
  const waitMs = opts.waitMs || (cdnInjected ? 2600 : 1800);

  await new Promise((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = wrapped;
    setTimeout(resolve, 8000);
  });

  await new Promise((r) => setTimeout(r, waitMs));

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error("Iframe did not initialize");
  }

  // Wait for icon webfonts to finish loading so ::before content resolves.
  await waitForFonts(doc, win, cdnInjected ? 4000 : 1500);

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
  const nextId = makeIdGenerator();
  walk(doc.body, containerRect, win, atoms, null, nextId);

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
  const baseUrl = opts && opts.baseUrl;

  const forceMenusCss = buildMenuForceCss(showHiddenMenus);
  const cdnTags = buildCdnHeadTags(libs);
  const baseStyle = "<style>body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;}</style>";

  // <base href> makes the browser resolve every relative URL (img src,
  // background-image url(...), link href, etc.) against the supplied path.
  // Without it, an srcdoc iframe resolves "./logo.png" to "about:srcdoc/logo.png"
  // and the request fails.
  const baseTag = baseUrl ? "<base href=\"" + escapeAttr(baseUrl) + "\">" : "";

  const headInject = baseTag + forceMenusCss + cdnTags + baseStyle;

  const hasHtml = /^<!doctype|^<html/i.test(trimmed);
  if (hasHtml) {
    let out = trimmed;
    if (/<head[^>]*>/i.test(out)) {
      // If the source already declares <base>, leave it; otherwise inject ours
      // right after <head> so it applies to all subsequent links.
      if (baseUrl && !/<base\s+href=/i.test(out)) {
        out = out.replace(/<head([^>]*)>/i, "<head$1>" + baseTag);
      }
      // Remove baseTag from headInject if we already inserted it above
      const restHead = headInject.startsWith(baseTag) ? headInject.slice(baseTag.length) : headInject;
      out = out.replace(/<head([^>]*)>/i, "<head$1>" + restHead);
    } else {
      out = headInject + out;
    }
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

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function normalizeBaseUrl(url) {
  if (!url) return null;
  let u = String(url).trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u) && !u.startsWith("//")) {
    // Treat bare hosts (example.com) as https
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(u)) u = "https://" + u;
    else return null;
  }
  // Ensure trailing slash so <base> treats it as a directory
  if (!/[/?#]$/.test(u) && !/\.[a-z0-9]{1,6}$/i.test(u.split("?")[0].split("#")[0])) {
    u += "/";
  }
  return u;
}

async function waitForFonts(doc, win, maxMs) {
  try {
    if (doc && doc.fonts && typeof doc.fonts.ready === "object") {
      await Promise.race([
        doc.fonts.ready,
        new Promise((r) => setTimeout(r, maxMs)),
      ]);
    }
  } catch (e) { /* ignore */ }
  // One more rAF tick so any final ::before re-paint settles.
  await new Promise((r) => setTimeout(r, 80));
}

// Tags we always materialize as a group/section even when they have no
// own visible styling. Helps reproduce the source structure in Figma.
const SEMANTIC_CONTAINER_TAGS = new Set([
  "header", "nav", "main", "section", "article", "footer", "aside",
  "ul", "ol", "form", "fieldset", "figure", "address",
]);

// Class-name patterns that signal a layout container. Bootstrap row/col,
// Tailwind grid/flex, generic "card"/"container"/"group" wrappers.
const LAYOUT_CLASS_RE = /\b(row|col|col-[\w-]+|grid|grid-cols-\d+|grid-rows-\d+|flex|inline-flex|flex-row|flex-col|flex-wrap|container|container-fluid|card|panel|section|wrapper|stack|hstack|vstack|navbar|nav-bar|btn-group|input-group|breadcrumb|list-group|accordion|carousel|modal-content|offcanvas-body)\b/;

function classListOf(el) {
  const cls = (el && el.getAttribute && el.getAttribute("class")) || "";
  return cls.split(/\s+/).filter(Boolean);
}

function isLayoutContainer(el, classes) {
  if (!el) return false;
  if (SEMANTIC_CONTAINER_TAGS.has(el.tagName.toLowerCase())) return true;
  const cls = classes.join(" ");
  return LAYOUT_CLASS_RE.test(cls);
}

function detectLayoutMode(cs, classes) {
  const display = cs.display;
  const cls = classes.join(" ");
  if (/\bgrid\b/.test(cls) || display === "grid" || display === "inline-grid") {
    const m = cls.match(/\bgrid-cols-(\d+)\b/);
    return { mode: "GRID", direction: "HORIZONTAL", cols: m ? parseInt(m[1], 10) : null };
  }
  if (/\brow\b/.test(cls) || display === "flex" || display === "inline-flex") {
    const fd = cs.flexDirection || "row";
    const direction = fd.startsWith("column") ? "VERTICAL" : "HORIZONTAL";
    return { mode: "FLEX", direction };
  }
  if (/\bflex-col\b/.test(cls)) return { mode: "FLEX", direction: "VERTICAL" };
  if (/\bflex(?:-row)?\b/.test(cls)) return { mode: "FLEX", direction: "HORIZONTAL" };
  // Bootstrap col-* implies vertical stack inside it
  if (/\bcol(-\w+)?(-\d+)?\b/.test(cls)) return { mode: "STACK", direction: "VERTICAL" };
  return null;
}

function makeIdGenerator() {
  let n = 0;
  return () => ++n;
}

function walk(el, containerRect, win, atoms, parentId, nextId) {
  if (!el || el.nodeType !== 1) return;
  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "link" || tag === "meta" || tag === "title" || tag === "noscript") return;

  const cs = win.getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return;

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && tag !== "br") return;

  const classes = classListOf(el);
  const myId = nextId();

  let atom = extractBoxStyle(el, cs, rect, containerRect, tag, win);

  // Even if extractBoxStyle filtered the element out (no visible styling),
  // promote it to a synthetic "group" atom when it is a layout container
  // with multiple element children. This is what gives us row/col/grid
  // grouping in Figma without forcing every <div> to become a frame.
  if (!atom) {
    const elementChildCount = Array.from(el.children).filter((c) => c.nodeType === 1).length;
    const wantsGroup =
      (isLayoutContainer(el, classes) && elementChildCount >= 1) ||
      elementChildCount >= 2;
    if (wantsGroup) {
      atom = {
        type: "group",
        tag,
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
        w: rect.width,
        h: rect.height,
      };
    }
  }

  let surviveParentId = parentId;
  if (atom) {
    atom.id = myId;
    atom.parentId = parentId;
    atom.classes = classes;
    atom.role = el.getAttribute && el.getAttribute("role");
    atom.layout = detectLayoutMode(cs, classes);
    atom.cssGap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 0;
    atom.cssRowGap = parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0;
    atom.padding = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
    // Capture CSS layout properties needed for fidelity.
    atom.cssPosition = cs.position;
    atom.cssJustifyContent = cs.justifyContent;
    atom.cssAlignItems = cs.alignItems;
    atom.cssTextAlign = cs.textAlign;
    atom.cssOverflow = cs.overflow;
    atoms.push(atom);
    surviveParentId = myId;
  }

  for (const childNode of el.childNodes) {
    if (childNode.nodeType === 1) {
      walk(childNode, containerRect, win, atoms, surviveParentId, nextId);
    } else if (childNode.nodeType === 3) {
      const text = childNode.nodeValue || "";
      if (!text.trim()) continue;
      captureTextNode(childNode, text, cs, containerRect, atoms, surviveParentId, nextId);
    }
  }
}

function captureTextNode(textNode, text, parentCs, containerRect, atoms, parentId, nextId) {
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const rects = range.getClientRects();
  if (!rects.length) {
    range.detach && range.detach();
    return;
  }
  let minX = Infinity, minY = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
  const topPositions = new Set();
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.width === 0 || r.height === 0) continue;
    if (r.left < minX) minX = r.left;
    if (r.top < minY) minY = r.top;
    if (r.right > maxRight) maxRight = r.right;
    if (r.bottom > maxBottom) maxBottom = r.bottom;
    topPositions.add(Math.round(r.top));
  }
  if (!isFinite(minX)) return;

  const cleaned = collapseWhitespace(text);
  // Skip nodes that are purely whitespace (the space between block
  // elements in formatted HTML, etc.).
  if (!cleaned || !cleaned.trim()) return;

  // Count how many lines the browser actually used. Single-line text
  // should NOT be force-wrapped in Figma — different font metrics
  // (browser's font vs Inter) would otherwise cause spurious mid-word
  // wraps like "CORPL / INK".
  const lineCount = Math.max(1, topPositions.size);

  atoms.push({
    id: nextId(),
    parentId,
    type: "text",
    text: maybeTransform(cleaned, parentCs.textTransform),
    x: minX - containerRect.left,
    y: minY - containerRect.top,
    w: maxRight - minX,
    h: maxBottom - minY,
    lineCount,
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
  const bgImageUrls = extractBgImageUrls(bgImage, el.ownerDocument);
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
    const rawAttr = el.getAttribute("src") || "";
    let resolvedSrc = el.currentSrc || el.src || rawAttr;
    // If <base> wasn't set and we're inside an srcdoc iframe, `el.src` looks
    // like "about:srcdoc/02_images/foo.png" — useless for fetch. Try to
    // re-resolve against el.ownerDocument.baseURI as a last attempt.
    if (/^about:srcdoc/i.test(resolvedSrc) && rawAttr) {
      try {
        const doc = el.ownerDocument;
        const baseURI = doc && (doc.baseURI || doc.URL);
        if (baseURI && baseURI !== "about:srcdoc") {
          resolvedSrc = new URL(rawAttr, baseURI).href;
        }
      } catch (e) { /* keep what we had */ }
    }
    return {
      type: "image",
      tag,
      x, y, w, h,
      src: resolvedSrc || null,
      srcAttr: rawAttr || null,
      alt: el.getAttribute("alt") || "",
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
  if (!atom.src && !atom.srcAttr) return;
  const tried = new Set();
  const candidates = [];

  if (atom.src) candidates.push(atom.src);
  if (atom.srcAttr && atom.srcAttr !== atom.src) candidates.push(atom.srcAttr);

  for (const url of candidates) {
    if (!url || tried.has(url)) continue;
    tried.add(url);

    // Skip pseudo-protocols we can't resolve to bytes.
    if (/^(about:|javascript:|chrome:|chrome-extension:|file:)/i.test(url)) continue;

    // Fast path: direct CORS fetch.
    try {
      const resp = await fetch(url, { mode: "cors" });
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        atom.imageBytes = new Uint8Array(buf);
        atom.resolvedSrc = url;
        return;
      }
    } catch (e) { /* try canvas */ }

    // Fallback: canvas-based load via <img crossorigin="anonymous">.
    try {
      const bytes = await imageUrlToBytesViaCanvas(url);
      if (bytes) {
        atom.imageBytes = bytes;
        atom.resolvedSrc = url;
        return;
      }
    } catch (e) { /* try next candidate */ }
  }

  // No bytes obtained — record why so the renderer can label clearly.
  atom.loadFailedReason =
    candidates.length === 0
      ? "no src"
      : candidates.some((u) => /^about:srcdoc/i.test(u))
        ? "relative path — set Base URL"
        : "CORS / not found";
}

function imageUrlToBytesViaCanvas(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return reject(new Error("zero-size image"));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          async (blob) => {
            if (!blob) return reject(new Error("toBlob returned null"));
            try {
              const buf = await blob.arrayBuffer();
              resolve(new Uint8Array(buf));
            } catch (e) { reject(e); }
          },
          "image/png"
        );
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("image load error"));
    img.src = url;
  });
}

async function loadBgImageBytes(atom) {
  if (!atom.bgImageUrls || !atom.bgImageUrls.length) return;
  for (const url of atom.bgImageUrls) {
    if (!url) continue;
    if (url.startsWith("data:")) {
      const bytes = dataUrlToBytes(url);
      if (bytes) {
        atom.bgImageBytes = bytes;
        atom.bgImageUrl = url;
        return;
      }
      continue;
    }
    // Try direct fetch first.
    try {
      const resp = await fetch(url, { mode: "cors" });
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        atom.bgImageBytes = new Uint8Array(buf);
        atom.bgImageUrl = url;
        return;
      }
    } catch (e) { /* fall through to canvas */ }
    // Canvas fallback (same as <img> path)
    try {
      const bytes = await imageUrlToBytesViaCanvas(url);
      if (bytes) {
        atom.bgImageBytes = bytes;
        atom.bgImageUrl = url;
        return;
      }
    } catch (e) { /* try next URL */ }
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

function extractBgImageUrls(bgImage, ownerDoc) {
  if (!bgImage || bgImage === "none") return [];
  const urls = [];
  const re = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]+?))\s*\)/g;
  let m;
  while ((m = re.exec(bgImage)) !== null) {
    let u = (m[1] || m[2] || m[3] || "").trim();
    if (!u) continue;
    // Resolve relative URLs against the iframe document's base. For
    // `<base href>` injected via wrapHtml, this turns "./bg.jpg" into
    // an absolute URL we can fetch.
    if (ownerDoc && !/^(https?:|data:|blob:|file:)/i.test(u) && !u.startsWith("//")) {
      try {
        u = new URL(u, ownerDoc.baseURI || ownerDoc.URL || "").href;
      } catch (e) { /* leave as-is */ }
    }
    urls.push(u);
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
  // Collapse runs of whitespace to a single space but keep leading and
  // trailing spaces. Inline siblings like `<strong>12</strong> Followers`
  // depend on that leading space surviving — trimming it makes "12" run
  // straight into "Followers".
  return s.replace(/\s+/g, " ");
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
