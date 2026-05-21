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
  // Name encodes alt text and src so the user can find unloaded images
  // in the Figma layer panel and fix the base URL.
  const labelBits = ["img"];
  if (atom.alt) labelBits.push(JSON.stringify(atom.alt));
  if (atom.srcAttr) labelBits.push(atom.srcAttr);
  frame.name = labelBits.join(" ");
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
      parent.appendChild(frame);
      return frame;
    } catch (e) { /* fall through to placeholder */ }
  }

  // Placeholder: clean neutral-gray fill at the captured dimensions. The
  // border-radius (applyCorners above) is honored, so circular avatars
  // render as circles, not dashed squares. Error details live in the
  // layer name to keep the canvas visually clean.
  frame.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.92, b: 0.95 } }];
  frame.strokes = [];
  if ("dashPattern" in frame) {
    try { frame.dashPattern = []; } catch (e) { /* */ }
  }
  const reason = atom.loadFailedReason || "image not loaded";
  frame.name = "[missing] " + frame.name + " — " + reason;
  parent.appendChild(frame);

  // Draw a tiny picture-icon glyph centered in the frame, but only when
  // the frame is big enough that a glyph won't dominate (e.g. >= 32px on
  // both axes — avatars 24px and smaller stay as a plain dot).
  if (atom.w >= 32 && atom.h >= 32) {
    try {
      const icon = figma.createText();
      icon.fontName = { family: "Inter", style: "Regular" };
      icon.fontSize = Math.min(24, Math.max(12, Math.min(atom.w, atom.h) * 0.35));
      icon.characters = "\u2B1C"; // unicode picture-frame glyph
      icon.fills = [{ type: "SOLID", color: { r: 0.62, g: 0.66, b: 0.72 } }];
      icon.textAlignHorizontal = "CENTER";
      icon.x = Math.round(atom.x + (atom.w - icon.width) / 2);
      icon.y = Math.round(atom.y + (atom.h - icon.height) / 2);
      parent.appendChild(icon);
    } catch (e) { /* font not loaded; the gray fill alone is enough */ }
  }

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

  // Only force a fixed width on multi-line text (i.e. text the browser
  // actually wrapped). Single-line text is left in WIDTH_AND_HEIGHT mode
  // so Inter's slightly different metrics don't cause spurious mid-word
  // wraps like "CORPL / INK" or "Dashbo / ard".
  if (atom.lineCount && atom.lineCount > 1 && atom.w && atom.w > 0) {
    try {
      txt.textAutoResize = "HEIGHT";
      txt.resize(
        Math.max(1, Math.round(atom.w)),
        Math.max(1, Math.round(txt.height || atom.h || 1))
      );
    } catch (e) { /* fall back to default auto-resize */ }
  }

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
    if (atom.type === "group") return renderGroup(parent, atom);
    return renderBox(parent, atom);
  } catch (e) {
    console.error("renderAtom error", atom && atom.tag, e && e.message);
    return null;
  }
}

// Synthetic container with no own styling — emitted by walk() for layout
// containers (row/col/grid/flex/section) that group children.
async function renderGroup(parent, atom) {
  const frame = figma.createFrame();
  frame.name = atom.tag + (atom.classes && atom.classes.length ? " ." + atom.classes[0] : "");
  frame.x = Math.round(atom.x);
  frame.y = Math.round(atom.y);
  frame.resize(Math.max(1, Math.round(atom.w)), Math.max(1, Math.round(atom.h)));
  frame.fills = [];
  frame.clipsContent = false;
  parent.appendChild(frame);
  return frame;
}

// Map CSS justify-content / align-items strings to Figma auto-layout enums.
const JUSTIFY_MAP = {
  "flex-start": "MIN",
  "start": "MIN",
  "left": "MIN",
  "flex-end": "MAX",
  "end": "MAX",
  "right": "MAX",
  "center": "CENTER",
  "space-between": "SPACE_BETWEEN",
};
const ALIGN_MAP = {
  "flex-start": "MIN",
  "start": "MIN",
  "stretch": "MIN",
  "normal": "MIN",
  "flex-end": "MAX",
  "end": "MAX",
  "center": "CENTER",
  "baseline": "CENTER",
};

// Convert captured layout hints into Figma auto-layout settings on a frame.
// Returns { applied: bool, isGrid: bool } so callers know how to size the
// container after children are appended.
function applyAutoLayout(node, atom) {
  if (!node || !atom || !atom.layout) return { applied: false, isGrid: false };
  if (!("layoutMode" in node)) return { applied: false, isGrid: false };
  const layout = atom.layout;
  const isGrid = layout.mode === "GRID";
  const direction = isGrid
    ? "HORIZONTAL"
    : (layout.direction === "VERTICAL" ? "VERTICAL" : "HORIZONTAL");
  try {
    node.layoutMode = direction;
    node.primaryAxisSizingMode = "FIXED";
    node.counterAxisSizingMode = "FIXED";

    if (atom.padding) {
      node.paddingTop = atom.padding.top || 0;
      node.paddingRight = atom.padding.right || 0;
      node.paddingBottom = atom.padding.bottom || 0;
      node.paddingLeft = atom.padding.left || 0;
    }

    const colGap = atom.cssGap || 0;
    const rowGap = atom.cssRowGap || atom.cssGap || 0;
    node.itemSpacing = direction === "HORIZONTAL" ? colGap : rowGap;

    if (isGrid && "layoutWrap" in node) {
      try { node.layoutWrap = "WRAP"; } catch (e) { /* older Figma */ }
      if ("counterAxisSpacing" in node) {
        try { node.counterAxisSpacing = rowGap; } catch (e) { /* */ }
      }
    }

    // Honor CSS justify-content (primary axis) and align-items (counter axis).
    const justify = JUSTIFY_MAP[String(atom.cssJustifyContent || "").toLowerCase()];
    const align = ALIGN_MAP[String(atom.cssAlignItems || "").toLowerCase()];
    if (justify && "primaryAxisAlignItems" in node) {
      try { node.primaryAxisAlignItems = justify; } catch (e) { /* */ }
    }
    if (align && "counterAxisAlignItems" in node) {
      try { node.counterAxisAlignItems = align; } catch (e) { /* */ }
    } else if ("counterAxisAlignItems" in node) {
      node.counterAxisAlignItems = "MIN";
    }
  } catch (e) { /* layoutMode not applicable */ }

  return { applied: true, isGrid };
}

// Decide whether `atom` should host its children as Figma children.
// Containers (group/box) with at least one child atom in the captured tree
// are materialized; text/icon/image/input are always leaves.
function isContainerAtom(atom) {
  if (!atom) return false;
  return atom.type === "group" || atom.type === "box";
}

// Build a parentId-indexed map of atoms.
function buildAtomIndex(atoms) {
  const byId = new Map();
  const childrenOf = new Map();
  for (const a of atoms) {
    if (a.id == null) continue;
    byId.set(a.id, a);
    if (!childrenOf.has(a.parentId)) childrenOf.set(a.parentId, []);
    childrenOf.get(a.parentId).push(a);
  }
  return { byId, childrenOf };
}

// Render atoms hierarchically inside `screenFrame`. Returns array of
// { atom, node } so callers can attach reactions / collect colors.
// When `useAutoLayout` is true, containers become Figma auto-layout frames
// (good for responsive editing). When false (default), every container is a
// plain frame and every child sits at its captured absolute x/y — pixel-
// perfect to the browser render, no Figma-side reflow.
async function renderHierarchical(screenFrame, atoms, useAutoLayout) {
  const { byId, childrenOf } = buildAtomIndex(atoms);
  const created = []; // { atom, node }
  const nodeByAtomId = new Map();

  async function renderOne(parentFigmaNode, atom, originX, originY) {
    const localAtom = {
      ...atom,
      x: atom.x - originX,
      y: atom.y - originY,
    };
    const node = await renderAtom(parentFigmaNode, localAtom);
    if (!node) return null;
    nodeByAtomId.set(atom.id, node);
    created.push({ atom, node });

    const kids = childrenOf.get(atom.id) || [];

    if (useAutoLayout) {
      // Auto-layout path: containers become flex/grid frames; absolute
      // children get layoutPositioning=ABSOLUTE so they don't shove
      // siblings around.
      const isAbsolute =
        atom.cssPosition === "absolute" || atom.cssPosition === "fixed";
      if (isAbsolute && "layoutPositioning" in node) {
        try {
          node.layoutPositioning = "ABSOLUTE";
          if ("x" in node) node.x = Math.round(localAtom.x);
          if ("y" in node) node.y = Math.round(localAtom.y);
        } catch (e) { /* parent isn't auto-layout — no-op is fine */ }
      }

      if (kids.length && isContainerAtom(atom) && "appendChild" in node) {
        const beforeApply = node.layoutMode;
        const al = applyAutoLayout(node, atom);
        const isAutoLayoutNode =
          al.applied || (node.layoutMode && node.layoutMode !== "NONE" && node.layoutMode !== beforeApply);

        for (const kid of kids) {
          await renderOne(node, kid, atom.x, atom.y);
        }

        if (isAutoLayoutNode) {
          for (const child of node.children || []) {
            if (child.layoutPositioning === "ABSOLUTE") continue;
            if ("layoutSizingHorizontal" in child) {
              try { child.layoutSizingHorizontal = "FIXED"; } catch (e) { /* */ }
            }
            if ("layoutSizingVertical" in child) {
              try { child.layoutSizingVertical = "FIXED"; } catch (e) { /* */ }
            }
          }
          try {
            if ("primaryAxisSizingMode" in node) node.primaryAxisSizingMode = "FIXED";
            if ("counterAxisSizingMode" in node) {
              node.counterAxisSizingMode = al.isGrid ? "AUTO" : "FIXED";
            }
            if ("clipsContent" in node) node.clipsContent = false;
          } catch (e) { /* */ }
        }
      } else if (kids.length) {
        for (const kid of kids) {
          await renderOne(parentFigmaNode, kid, originX, originY);
        }
      }
      return node;
    }

    // Absolute-positioning path (default). Every container is a plain
    // frame sized to its captured box; every child sits inside it at its
    // captured x/y. Nothing reflows — what you saw in the browser is
    // what you get in Figma.
    if (kids.length && isContainerAtom(atom) && "appendChild" in node) {
      if ("clipsContent" in node) node.clipsContent = false;
      for (const kid of kids) {
        await renderOne(node, kid, atom.x, atom.y);
      }
    } else if (kids.length) {
      for (const kid of kids) {
        await renderOne(parentFigmaNode, kid, originX, originY);
      }
    }
    return node;
  }

  const roots = childrenOf.get(null) || [];
  for (const root of roots) {
    await renderOne(screenFrame, root, 0, 0);
  }

  // Atoms whose parentId pointed to a filtered-out element have parentId
  // unset; render any leftovers directly on the screen.
  for (const atom of atoms) {
    if (nodeByAtomId.has(atom.id)) continue;
    if (atom.parentId != null && byId.has(atom.parentId)) continue;
    await renderOne(screenFrame, atom, 0, 0);
  }

  return created;
}

async function renderAtoms(atoms, width, height, background) {
  // Backwards-compatible single-screen entry point.
  return renderScreens([{ name: "screen", atoms, width, height, background }]);
}

async function renderScreens(screens, options) {
  await loadAllFonts();

  const opts = options || {};
  const useAutoLayout = !!opts.useAutoLayout;

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

    // Capture atom IDs were assigned by domCapture; if missing (legacy
    // payload), bail to the original flat renderer.
    const hasIds = (screen.atoms || []).some((a) => a && a.id != null);
    if (hasIds) {
      const rendered = await renderHierarchical(frame, screen.atoms || [], useAutoLayout);
      for (const { atom, node } of rendered) {
        if (atom.onclickTarget && node) {
          interactiveBindings.push({ nodeId: node.id, target: atom.onclickTarget });
        }
      }
    } else {
      for (const atom of screen.atoms || []) {
        const node = await renderAtom(frame, atom);
        if (!node) continue;
        if (atom.onclickTarget) {
          interactiveBindings.push({ nodeId: node.id, target: atom.onclickTarget });
        }
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

  // Brand color schema: collect unique non-neutral colors used as backgrounds
  // / strokes / text fills across every screen and create a Figma variable
  // collection "Theme" so the user has a starting palette to bind from.
  try {
    await createThemeColorCollection(screens);
  } catch (e) {
    console.error("Theme creation skipped:", e && e.message);
  }

  figma.viewport.scrollAndZoomIntoView(createdFrames);
  return createdFrames.length;
}

// ---- Theme / brand color collection ----------------------------------------

function rgbToHex(r, g, b) {
  const to2 = (n) => {
    const v = Math.max(0, Math.min(255, Math.round(n * 255)));
    return v.toString(16).padStart(2, "0");
  };
  return ("#" + to2(r) + to2(g) + to2(b)).toUpperCase();
}

function isNeutralColor(c) {
  if (!c) return true;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const sat = max === 0 ? 0 : (max - min) / max;
  // Pure neutral (gray/white/black) or extreme light/dark with no chroma.
  if (sat < 0.08) return true;
  if (max < 0.04) return true;     // near-black
  if (min > 0.96) return true;     // near-white
  return false;
}

function collectColorFrequency(screens) {
  const freq = new Map();
  const bump = (color) => {
    if (!color) return;
    const c = parseCssColor(color);
    if (!c || c.a === 0) return;
    if (isNeutralColor(c)) return;
    const hex = rgbToHex(c.r, c.g, c.b);
    freq.set(hex, (freq.get(hex) || 0) + 1);
  };
  for (const screen of screens || []) {
    for (const atom of screen.atoms || []) {
      if (!atom) continue;
      bump(atom.bg);
      bump(atom.color);
      if (atom.border) {
        bump(atom.border.top && atom.border.top.c);
        bump(atom.border.right && atom.border.right.c);
      }
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex, count]) => ({ hex, count }));
}

function hexToRgb01(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

async function createThemeColorCollection(screens) {
  if (!figma.variables || typeof figma.variables.createVariableCollection !== "function") {
    return; // Variables API not available in this Figma client
  }
  const palette = collectColorFrequency(screens).slice(0, 8);
  if (!palette.length) return;

  // Reuse "Theme" collection if it exists, else create fresh.
  let collection = null;
  try {
    const existing = typeof figma.variables.getLocalVariableCollectionsAsync === "function"
      ? await figma.variables.getLocalVariableCollectionsAsync()
      : figma.variables.getLocalVariableCollections();
    collection = existing.find((c) => c.name === "Theme");
  } catch (e) { /* fall through */ }
  if (!collection) {
    collection = figma.variables.createVariableCollection("Theme");
  }
  const modeId = collection.modes[0].modeId;

  // Index existing variables by name so reruns update in place instead of
  // creating brand/color-01, brand/color-01 2, brand/color-01 3, etc.
  const existingByName = new Map();
  try {
    const allVars = typeof figma.variables.getLocalVariablesAsync === "function"
      ? await figma.variables.getLocalVariablesAsync("COLOR")
      : figma.variables.getLocalVariables("COLOR");
    for (const v of allVars || []) {
      if (v.variableCollectionId === collection.id) existingByName.set(v.name, v);
    }
  } catch (e) { /* */ }

  const created = [];
  palette.forEach((entry, idx) => {
    const name = "brand/color-" + String(idx + 1).padStart(2, "0");
    let v = existingByName.get(name);
    if (!v) {
      try {
        v = figma.variables.createVariable(name, collection, "COLOR");
      } catch (e) { return; }
    }
    if (!v) return;
    try {
      v.setValueForMode(modeId, hexToRgb01(entry.hex));
      v.description = "Detected from imported HTML — used " + entry.count + " time(s).";
      v.scopes = ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"];
      created.push({ name, hex: entry.hex });
    } catch (e) { /* */ }
  });

  // Sample swatches: small frame on the page showing each brand color, so
  // the variables are discoverable visually. Reuse an existing one if
  // present so reruns don't pile up duplicate palettes on the canvas.
  if (created.length && screens.length) {
    const existingPalette = figma.currentPage.findOne((n) => n.name === "Theme Palette");
    if (existingPalette) {
      try { existingPalette.remove(); } catch (e) { /* */ }
    }

    const swatchFrame = figma.createFrame();
    swatchFrame.name = "Theme Palette";
    swatchFrame.layoutMode = "HORIZONTAL";
    swatchFrame.primaryAxisSizingMode = "AUTO";
    swatchFrame.counterAxisSizingMode = "AUTO";
    swatchFrame.itemSpacing = 12;
    swatchFrame.paddingTop = swatchFrame.paddingBottom = 16;
    swatchFrame.paddingLeft = swatchFrame.paddingRight = 16;
    swatchFrame.cornerRadius = 12;
    swatchFrame.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];

    for (const item of created) {
      const cell = figma.createFrame();
      cell.name = item.name;
      cell.layoutMode = "VERTICAL";
      cell.primaryAxisSizingMode = "AUTO";
      cell.counterAxisSizingMode = "AUTO";
      cell.itemSpacing = 6;
      cell.fills = [];

      const swatch = figma.createFrame();
      swatch.name = item.name + "-swatch";
      swatch.resize(64, 64);
      swatch.cornerRadius = 8;
      swatch.fills = [{ type: "SOLID", color: hexToRgb01(item.hex) }];
      cell.appendChild(swatch);

      try {
        const label = figma.createText();
        label.fontName = { family: "Inter", style: "Regular" };
        label.fontSize = 10;
        label.characters = item.hex;
        cell.appendChild(label);
      } catch (e) { /* font not loaded */ }

      swatchFrame.appendChild(cell);
    }

    // Place the palette above the leftmost imported screen.
    let minX = Infinity;
    let minY = Infinity;
    for (const child of figma.currentPage.children) {
      if (child === swatchFrame) continue;
      if (typeof child.x === "number" && child.x < minX) minX = child.x;
      if (typeof child.y === "number" && child.y < minY) minY = child.y;
    }
    if (!isFinite(minX)) minX = 0;
    if (!isFinite(minY)) minY = 0;
    figma.currentPage.appendChild(swatchFrame);
    swatchFrame.x = minX;
    swatchFrame.y = minY - swatchFrame.height - 60;
  }
}

module.exports = { renderAtoms, renderScreens };
