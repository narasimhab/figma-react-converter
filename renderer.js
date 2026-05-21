const WEIGHT_TO_STYLE = {
  100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular",
  500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Extra Bold", 900: "Black",
};

const ALL_INTER_STYLES = [
  "Thin", "Thin Italic",
  "Extra Light", "Extra Light Italic",
  "Light", "Light Italic",
  "Regular", "Italic",
  "Medium", "Medium Italic",
  "Semi Bold", "Semi Bold Italic",
  "Bold", "Bold Italic",
  "Extra Bold", "Extra Bold Italic",
  "Black", "Black Italic",
];

function parseCssColor(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s || s === "transparent" || s === "none") return null;
  const m = s.match(/^rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (m) {
    return {
      r: clamp01(parseFloat(m[1]) / 255),
      g: clamp01(parseFloat(m[2]) / 255),
      b: clamp01(parseFloat(m[3]) / 255),
      a: m[4] !== undefined ? clamp01(parseFloat(m[4])) : 1,
    };
  }
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16) / 255,
        g: parseInt(h.slice(2, 4), 16) / 255,
        b: parseInt(h.slice(4, 6), 16) / 255,
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
  }
  return null;
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }

function fontStyleFromWeight(weight, italic) {
  let style = WEIGHT_TO_STYLE[weight] || WEIGHT_TO_STYLE[parseInt(weight, 10)] || "Regular";
  if (italic) {
    if (style === "Regular") style = "Italic";
    else style = style + " Italic";
  }
  return style;
}

function parseFontWeight(weight) {
  if (!weight) return 400;
  const n = parseInt(weight, 10);
  if (!isNaN(n)) return n;
  const map = { normal: 400, bold: 700, lighter: 300, bolder: 700 };
  return map[String(weight).toLowerCase()] || 400;
}

function parseBoxShadow(value) {
  if (!value || value === "none") return null;
  const shadows = [];
  const stack = String(value).split(/,(?![^(]*\))/);
  for (const piece of stack) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const colorMatch = trimmed.match(/(rgba?\([^)]+\)|#[0-9a-f]{3,8})/i);
    if (!colorMatch) continue;
    const color = parseCssColor(colorMatch[1]);
    if (!color) continue;
    const numbers = trimmed
      .replace(colorMatch[0], "")
      .trim()
      .split(/\s+/)
      .map((n) => parseFloat(n))
      .filter((n) => !isNaN(n));
    if (numbers.length < 2) continue;
    shadows.push({
      type: "DROP_SHADOW",
      color,
      offset: { x: numbers[0] || 0, y: numbers[1] || 0 },
      radius: numbers[2] || 0,
      spread: numbers[3] || 0,
      visible: true,
      blendMode: "NORMAL",
    });
  }
  return shadows.length ? shadows : null;
}

async function loadAllFonts() {
  const tasks = ALL_INTER_STYLES.map((style) =>
    figma.loadFontAsync({ family: "Inter", style }).catch(() => null)
  );
  await Promise.all(tasks);
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
}

const { iconSetFromClasses } = require("./libAssets");

// ----- Icon font support (Font Awesome, Bootstrap Icons, Glyphicons) -----
const FA_FAMILY_CANDIDATES = [
  "Font Awesome 6 Free",
  "Font Awesome 6 Pro",
  "Font Awesome 6 Brands",
  "Font Awesome 5 Free",
  "Font Awesome 5 Brands",
  "FontAwesome",
];
const FA_STYLE_CANDIDATES = ["Solid", "Regular", "Light", "Thin", "Brands"];

const BI_FAMILY_CANDIDATES = ["bootstrap-icons", "Bootstrap Icons"];
const BI_STYLE_CANDIDATES = ["Regular", "Normal"];

const GLYPH_FAMILY_CANDIDATES = ["Glyphicons Halflings"];
const GLYPH_STYLE_CANDIDATES = ["Regular"];

const _iconFontsAvailable = { fa: {}, bi: {}, glyph: {} };

async function probeFontFamilies(families, styles, bucket) {
  for (const family of families) {
    for (const style of styles) {
      try {
        await figma.loadFontAsync({ family, style });
        if (!bucket[family]) bucket[family] = [];
        if (bucket[family].indexOf(style) < 0) bucket[family].push(style);
      } catch (e) { /* not installed */ }
    }
  }
}

async function loadIconFonts(setsNeeded) {
  const tasks = [];
  if (!setsNeeded || setsNeeded.has("fontawesome") || setsNeeded.has("unknown")) {
    tasks.push(probeFontFamilies(FA_FAMILY_CANDIDATES, FA_STYLE_CANDIDATES, _iconFontsAvailable.fa));
  }
  if (!setsNeeded || setsNeeded.has("bootstrap-icons")) {
    tasks.push(probeFontFamilies(BI_FAMILY_CANDIDATES, BI_STYLE_CANDIDATES, _iconFontsAvailable.bi));
  }
  if (!setsNeeded || setsNeeded.has("glyphicons")) {
    tasks.push(probeFontFamilies(GLYPH_FAMILY_CANDIDATES, GLYPH_STYLE_CANDIDATES, _iconFontsAvailable.glyph));
  }
  await Promise.all(tasks);
  return _iconFontsAvailable;
}

function pickFromBucket(bucket, familyOrder, preferredStyle) {
  for (const family of familyOrder) {
    const styles = bucket[family];
    if (!styles || !styles.length) continue;
    const style =
      preferredStyle && styles.indexOf(preferredStyle) >= 0 ? preferredStyle : styles[0];
    return { family, style };
  }
  return null;
}

function pickFontAwesomeFont(capturedFamily, capturedWeight) {
  const fam = String(capturedFamily || "").toLowerCase();
  const weight = String(capturedWeight || "").toLowerCase();
  const isBrands = fam.includes("brands");
  const wantRegular = weight === "400" || weight === "normal" || fam.includes("regular");
  const wantLight = weight === "300" || fam.includes("light");
  const wantThin = weight === "100" || fam.includes("thin");

  const familyOrder = isBrands
    ? ["Font Awesome 6 Brands", "Font Awesome 5 Brands"]
    : ["Font Awesome 6 Free", "Font Awesome 6 Pro", "Font Awesome 5 Free", "FontAwesome"];

  let preferredStyle = "Solid";
  if (isBrands) preferredStyle = "Brands";
  else if (wantThin) preferredStyle = "Thin";
  else if (wantLight) preferredStyle = "Light";
  else if (wantRegular) preferredStyle = "Regular";

  return pickFromBucket(_iconFontsAvailable.fa, familyOrder, preferredStyle);
}

function pickBootstrapIconsFont() {
  return pickFromBucket(_iconFontsAvailable.bi, BI_FAMILY_CANDIDATES, "Regular")
    || pickFromBucket(_iconFontsAvailable.bi, BI_FAMILY_CANDIDATES, "Normal");
}

function pickGlyphiconsFont() {
  return pickFromBucket(_iconFontsAvailable.glyph, GLYPH_FAMILY_CANDIDATES, "Regular");
}

function pickIconFont(atom) {
  const set =
    atom.iconSet || iconSetFromClasses(atom.classNames, atom.fontFamily);
  if (set === "bootstrap-icons") return pickBootstrapIconsFont();
  if (set === "glyphicons") return pickGlyphiconsFont();
  if (set === "fontawesome") return pickFontAwesomeFont(atom.fontFamily, atom.fontWeight);
  // Unknown: try BI, then FA, then Glyphicons
  return (
    pickBootstrapIconsFont() ||
    pickFontAwesomeFont(atom.fontFamily, atom.fontWeight) ||
    pickGlyphiconsFont()
  );
}

function collectIconSetsFromScreens(screens) {
  const sets = new Set();
  for (const screen of screens || []) {
    for (const a of screen.atoms || []) {
      if (a && a.type === "icon" && a.glyph) {
        sets.add(a.iconSet || iconSetFromClasses(a.classNames, a.fontFamily));
      }
    }
  }
  return sets;
}

function setFill(node, color) {
  if (!color || !("fills" in node)) return;
  node.fills = [{
    type: "SOLID",
    color: { r: color.r, g: color.g, b: color.b },
    opacity: color.a === undefined ? 1 : color.a,
  }];
}

function applyCorners(frame, radii) {
  if (!radii) return;
  const same = radii.tl === radii.tr && radii.tr === radii.br && radii.br === radii.bl;
  if (same) {
    frame.cornerRadius = radii.tl;
  } else {
    frame.topLeftRadius = radii.tl;
    frame.topRightRadius = radii.tr;
    frame.bottomRightRadius = radii.br;
    frame.bottomLeftRadius = radii.bl;
  }
}

function applyBorder(frame, border) {
  if (!border) return;
  const widths = [border.top.w, border.right.w, border.bottom.w, border.left.w];
  const maxW = Math.max.apply(null, widths);
  if (maxW <= 0) return;
  const colorSrc =
    (border.top.w > 0 && border.top.c) ||
    (border.bottom.w > 0 && border.bottom.c) ||
    (border.left.w > 0 && border.left.c) ||
    (border.right.w > 0 && border.right.c) ||
    "rgb(226, 232, 240)";
  const color = parseCssColor(colorSrc);
  if (!color || color.a === 0) return;
  if (!("strokes" in frame)) return;
  frame.strokes = [{
    type: "SOLID",
    color: { r: color.r, g: color.g, b: color.b },
    opacity: color.a,
  }];
  frame.strokeWeight = maxW;
  if ("strokeAlign" in frame) frame.strokeAlign = "INSIDE";
  if (Math.abs(border.top.w - border.bottom.w) > 0.1 || Math.abs(border.left.w - border.right.w) > 0.1) {
    if ("strokeTopWeight" in frame) {
      try {
        frame.strokeTopWeight = border.top.w;
        frame.strokeRightWeight = border.right.w;
        frame.strokeBottomWeight = border.bottom.w;
        frame.strokeLeftWeight = border.left.w;
      } catch {}
    }
  }
}

function applyShadow(frame, boxShadow) {
  if (!boxShadow || boxShadow === "none") return;
  if (!("effects" in frame)) return;
  const effects = parseBoxShadow(boxShadow);
  if (effects) frame.effects = effects;
}

function applyOpacity(frame, opacity) {
  if (opacity === undefined || opacity === null) return;
  const n = parseFloat(opacity);
  if (!isNaN(n) && n < 1 && "opacity" in frame) frame.opacity = n;
}

function parseBackgroundGradient(bgImage) {
  if (!bgImage || bgImage === "none") return null;
  const m = bgImage.match(/^linear-gradient\(\s*(?:([^,]+),\s*)?(.+)\)$/i);
  if (!m) return null;
  const direction = m[1] ? m[1].trim() : "to bottom";
  const stopsStr = m[2];
  const stops = parseGradientStops(stopsStr);
  if (stops.length < 2) return null;
  const transform = gradientTransform(direction);
  return {
    type: "GRADIENT_LINEAR",
    gradientTransform: transform,
    gradientStops: stops,
  };
}

function parseGradientStops(s) {
  const parts = splitTopLevel(s);
  const result = [];
  parts.forEach((p, idx) => {
    const m = p.trim().match(/^(rgba?\([^)]+\)|#[0-9a-f]{3,8}|\w+)(?:\s+(\d+(?:\.\d+)?)%?)?/i);
    if (!m) return;
    const color = parseCssColor(m[1]);
    if (!color) return;
    const pos = m[2] ? parseFloat(m[2]) / 100 : idx / Math.max(1, parts.length - 1);
    result.push({
      position: clamp01(pos),
      color: { r: color.r, g: color.g, b: color.b, a: color.a },
    });
  });
  return result;
}

function splitTopLevel(s) {
  const result = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) {
      result.push(s.slice(start, i));
      start = i + 1;
    }
  }
  result.push(s.slice(start));
  return result;
}

function gradientTransform(direction) {
  const d = direction.toLowerCase();
  if (d.includes("to right")) return [[1, 0, 0], [0, 1, 0]];
  if (d.includes("to left")) return [[-1, 0, 1], [0, 1, 0]];
  if (d.includes("to bottom")) return [[0, 1, 0], [-1, 0, 1]];
  if (d.includes("to top")) return [[0, -1, 1], [1, 0, 0]];
  if (d.includes("to bottom right")) return [[0.7, 0.7, 0], [-0.7, 0.7, 0.5]];
  if (d.includes("to top right")) return [[0.7, -0.7, 0.5], [0.7, 0.7, 0]];
  return [[1, 0, 0], [0, 1, 0]];
}

function applyBackground(frame, atom) {
  if (!("fills" in frame)) return;
  const bg = atom && atom.bg;
  const bgImage = atom && atom.bgImage;
  const fills = [];

  const solid = parseCssColor(bg);
  if (solid && solid.a > 0) {
    fills.push({
      type: "SOLID",
      color: { r: solid.r, g: solid.g, b: solid.b },
      opacity: solid.a,
    });
  }

  // CSS background-image: url(...) — bytes loaded by domCapture.loadBgImageBytes
  if (atom && atom.bgImageBytes) {
    try {
      const bytes =
        atom.bgImageBytes instanceof Uint8Array
          ? atom.bgImageBytes
          : new Uint8Array(atom.bgImageBytes);
      const image = figma.createImage(bytes);
      const sizeStr = String(atom.bgSize || "").toLowerCase();
      const repeatStr = String(atom.bgRepeat || "").toLowerCase();
      let scaleMode = "FILL";
      if (sizeStr.includes("contain")) scaleMode = "FIT";
      else if (sizeStr.includes("cover")) scaleMode = "FILL";
      else if (repeatStr && repeatStr !== "no-repeat") scaleMode = "TILE";
      fills.push({ type: "IMAGE", scaleMode, imageHash: image.hash });
    } catch (e) {
      /* image decode failed - keep solid/gradient fills */
    }
  }

  const gradient = parseBackgroundGradient(bgImage);
  if (gradient) fills.push(gradient);

  if (fills.length === 0) {
    frame.fills = [];
  } else {
    frame.fills = fills;
  }
}

async function renderBox(parent, atom) {
  const frame = figma.createFrame();
  let label = atom.tag || "div";
  if (atom.onclickTarget) label += " \u2192 " + atom.onclickTarget;
  else if (atom.href) label += " \u2192 " + atom.href;
  frame.name = label;
  frame.x = Math.round(atom.x);
  frame.y = Math.round(atom.y);
  frame.resize(Math.max(1, Math.round(atom.w)), Math.max(1, Math.round(atom.h)));
  frame.clipsContent = false;
  applyBackground(frame, atom);
  applyCorners(frame, atom.radii);
  applyBorder(frame, atom.border);
  applyShadow(frame, atom.boxShadow);
  applyOpacity(frame, atom.opacity);
  parent.appendChild(frame);
  return frame;
}

async function renderImage(parent, atom) {
  const frame = figma.createFrame();
  frame.name = "img";
  frame.x = Math.round(atom.x);
  frame.y = Math.round(atom.y);
  frame.resize(Math.max(1, Math.round(atom.w)), Math.max(1, Math.round(atom.h)));
  applyCorners(frame, atom.radii);
  applyBorder(frame, atom.border);
  applyShadow(frame, atom.boxShadow);
  applyOpacity(frame, atom.opacity);

  if (atom.imageBytes) {
    try {
      const bytes = atom.imageBytes instanceof Uint8Array ? atom.imageBytes : new Uint8Array(atom.imageBytes);
      const image = figma.createImage(bytes);
      frame.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];
    } catch (e) {
      frame.fills = [{ type: "SOLID", color: { r: 0.91, g: 0.93, b: 0.96 } }];
    }
  } else {
    frame.fills = [{ type: "SOLID", color: { r: 0.91, g: 0.93, b: 0.96 } }];
  }
  parent.appendChild(frame);
  return frame;
}

async function renderText(parent, atom) {
  const txt = figma.createText();
  const weight = parseFontWeight(atom.fontWeight);
  const italic = (atom.fontStyle || "").includes("italic");
  const style = fontStyleFromWeight(weight, italic);
  try {
    txt.fontName = { family: "Inter", style };
  } catch (e) {
    try {
      txt.fontName = { family: "Inter", style: "Regular" };
    } catch (e2) {}
  }
  txt.fontSize = Math.max(1, atom.fontSize || 14);
  txt.characters = atom.text || " ";

  const color = parseCssColor(atom.color);
  if (color) {
    txt.fills = [{
      type: "SOLID",
      color: { r: color.r, g: color.g, b: color.b },
      opacity: color.a,
    }];
  }
  if (atom.textAlign === "center") txt.textAlignHorizontal = "CENTER";
  else if (atom.textAlign === "right") txt.textAlignHorizontal = "RIGHT";
  else if (atom.textAlign === "justify") txt.textAlignHorizontal = "JUSTIFIED";

  if (atom.letterSpacing && atom.letterSpacing !== "normal") {
    const ls = parseFloat(atom.letterSpacing);
    if (!isNaN(ls) && ls !== 0) {
      try { txt.letterSpacing = { value: ls, unit: "PIXELS" }; } catch {}
    }
  }
  if (atom.lineHeight && atom.lineHeight !== "normal") {
    const lh = parseFloat(atom.lineHeight);
    if (!isNaN(lh) && lh > 0) {
      try { txt.lineHeight = { value: lh, unit: "PIXELS" }; } catch {}
    }
  }

  txt.x = Math.round(atom.x);
  txt.y = Math.round(atom.y);
  parent.appendChild(txt);
  return txt;
}

async function renderInput(parent, atom) {
  const frame = await renderBox(parent, {
    ...atom,
    tag: "input",
  });
  const placeholder = atom.placeholder || atom.value || "";
  if (placeholder) {
    const txt = figma.createText();
    try { txt.fontName = { family: "Inter", style: "Regular" }; } catch {}
    txt.fontSize = atom.fontSize || 14;
    txt.characters = placeholder;
    txt.fills = [{ type: "SOLID", color: { r: 0.58, g: 0.64, b: 0.72 } }];
    txt.x = Math.round(atom.x) + 16;
    txt.y = Math.round(atom.y) + Math.max(0, (atom.h - (atom.fontSize || 14) * 1.2) / 2);
    parent.appendChild(txt);
  }
  return frame;
}

async function renderIcon(parent, atom) {
  // Primary path: icon font glyph from ::before (FA, Bootstrap Icons, Glyphicons).
  if (atom.glyph) {
    const picked = pickIconFont(atom);
    if (picked) {
      try {
        const txt = figma.createText();
        txt.fontName = { family: picked.family, style: picked.style };
        txt.fontSize = Math.max(8, Math.round(atom.fontSize || Math.min(atom.w, atom.h) || 16));
        txt.characters = atom.glyph;
        const color = parseCssColor(atom.color) || { r: 0.39, g: 0.45, b: 0.55, a: 1 };
        txt.fills = [{
          type: "SOLID",
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a === undefined ? 1 : color.a,
        }];
        txt.name = "icon " + (atom.classNames || "").trim();
        txt.x = Math.round(atom.x);
        txt.y = Math.round(atom.y);
        parent.appendChild(txt);
        return txt;
      } catch (e) {
        // Font loaded but the glyph isn't in this style (or another edge case)
        // — fall through to the placeholder.
      }
    }
  }

  // Fallback: rounded square placeholder when no FA font is available.
  // Keeps position + color so layout stays intact and the user can swap icons
  // in Figma later.
  const dot = figma.createFrame();
  dot.name = "icon " + ((atom.classNames || "").trim() || atom.tag || "");
  dot.x = Math.round(atom.x);
  dot.y = Math.round(atom.y);
  const size = Math.min(atom.w, atom.h) || 16;
  dot.resize(Math.max(8, Math.round(size)), Math.max(8, Math.round(size)));
  dot.cornerRadius = Math.round(size / 2);
  const color = parseCssColor(atom.color) || { r: 0.39, g: 0.45, b: 0.55, a: 1 };
  dot.fills = [{
    type: "SOLID",
    color: { r: color.r, g: color.g, b: color.b },
    opacity: (color.a === undefined ? 1 : color.a) * 0.85,
  }];
  parent.appendChild(dot);
  return dot;
}

async function renderAtom(parent, atom) {
  try {
    if (atom.type === "text") return renderText(parent, atom);
    if (atom.type === "image") return renderImage(parent, atom);
    if (atom.type === "input") return renderInput(parent, atom);
    if (atom.type === "icon") return renderIcon(parent, atom);
    return renderBox(parent, atom);
  } catch (e) {
    console.error("renderAtom error", atom && atom.tag, e && e.message);
    return null;
  }
}

async function renderAtoms(atoms, width, height, background) {
  // Backwards-compatible single-screen entry point.
  return renderScreens([{ name: "screen", atoms, width, height, background }]);
}

async function renderScreens(screens) {
  await loadAllFonts();

  const iconSets = collectIconSetsFromScreens(screens);
  if (iconSets.size) await loadIconFonts(iconSets);

  // Compute a base Y below any pre-existing content so we don't overlap.
  let baseY = 0;
  for (const child of figma.currentPage.children) {
    if (typeof child.y === "number" && typeof child.height === "number") {
      baseY = Math.max(baseY, child.y + child.height + 200);
    }
  }

  const frameByView = new Map();
  const interactiveBindings = []; // { nodeId, target }
  const createdFrames = [];

  const GAP = 240;
  let xOffset = 0;

  for (const screen of screens) {
    const frame = figma.createFrame();
    const name = screen.name || "screen";
    frame.name = "Screen: " + name;
    frame.x = xOffset;
    frame.y = baseY;
    frame.resize(
      Math.max(100, Math.round(screen.width || 1440)),
      Math.max(100, Math.round(screen.height || 800))
    );
    frame.clipsContent = true;
    const bg = parseCssColor(screen.background) || { r: 1, g: 1, b: 1, a: 1 };
    frame.fills = [{
      type: "SOLID",
      color: { r: bg.r, g: bg.g, b: bg.b },
      opacity: bg.a === undefined ? 1 : bg.a,
    }];
    figma.currentPage.appendChild(frame);

    frameByView.set(name, frame);
    createdFrames.push(frame);

    for (const atom of screen.atoms || []) {
      const node = await renderAtom(frame, atom);
      if (!node) continue;
      if (atom.onclickTarget) {
        interactiveBindings.push({ nodeId: node.id, target: atom.onclickTarget });
      }
    }

    xOffset += frame.width + GAP;
  }

  // Wire onclick handlers as Figma prototype reactions. In Present mode,
  // clicking the button will navigate to the destination screen.
  for (const binding of interactiveBindings) {
    const dest = frameByView.get(binding.target);
    if (!dest) continue;
    let node;
    try {
      node = await figma.getNodeByIdAsync(binding.nodeId);
    } catch (e) { continue; }
    if (!node || !("reactions" in node)) continue;
    try {
      node.reactions = [{
        trigger: { type: "ON_CLICK" },
        action: {
          type: "NODE",
          destinationId: dest.id,
          navigation: "NAVIGATE",
          transition: {
            type: "SMART_ANIMATE",
            easing: { type: "EASE_IN_AND_OUT" },
            duration: 0.3,
          },
          preserveScrollPosition: false,
        },
      }];
    } catch (e) {
      // Some Figma node types don't accept reactions (e.g. text). Fail soft.
    }
  }

  // First captured screen becomes the Present-mode entry point.
  if (createdFrames.length > 0 && "prototypeStartNode" in figma.currentPage) {
    try {
      figma.currentPage.prototypeStartNode = createdFrames[0];
    } catch (e) { /* not supported in this file */ }
  }

  figma.viewport.scrollAndZoomIntoView(createdFrames);
  return createdFrames.length;
}

module.exports = { renderAtoms, renderScreens };
