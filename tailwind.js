const TW_COLORS = {
  slate: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a" },
  gray:  { 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db", 400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151", 800: "#1f2937", 900: "#111827" },
  zinc:  { 100: "#f4f4f5", 500: "#71717a", 700: "#3f3f46" },
  red:   { 50: "#fef2f2", 100: "#fee2e2", 300: "#fca5a5", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c" },
  orange:{ 50: "#fff7ed", 100: "#ffedd5", 300: "#fdba74", 400: "#fb923c", 500: "#f97316", 600: "#ea580c" },
  amber: { 100: "#fef3c7", 500: "#f59e0b" },
  yellow:{ 50: "#fefce8", 100: "#fef9c3", 400: "#facc15", 500: "#eab308" },
  lime:  { 500: "#84cc16" },
  green: { 50: "#f0fdf4", 100: "#dcfce7", 500: "#22c55e", 600: "#16a34a", 700: "#15803d" },
  emerald: { 50: "#ecfdf5", 500: "#10b981", 600: "#059669" },
  teal:  { 50: "#f0fdfa", 100: "#ccfbf1", 500: "#14b8a6", 600: "#0d9488" },
  cyan:  { 500: "#06b6d4" },
  sky:   { 500: "#0ea5e9" },
  blue:  { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a" },
  indigo:{ 50: "#eef2ff", 100: "#e0e7ff", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca" },
  violet:{ 500: "#8b5cf6" },
  purple:{ 50: "#faf5ff", 100: "#f3e8ff", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce" },
  fuchsia:{ 500: "#d946ef" },
  pink:  { 50: "#fdf2f8", 100: "#fce7f3", 500: "#ec4899", 600: "#db2777" },
  rose:  { 500: "#f43f5e" },
};

const NAMED_COLORS = {
  white: "#ffffff",
  black: "#000000",
  transparent: null,
};

const TAILWIND_SPACING = {
  0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 5: 20,
  6: 24, 7: 28, 8: 32, 9: 36, 10: 40, 11: 44, 12: 48, 14: 56, 16: 64, 20: 80,
  24: 96, 28: 112, 32: 128, 40: 160, 48: 192, 56: 224, 64: 256, 72: 288, 80: 320, 96: 384,
};

const TEXT_SIZE = {
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60,
};

const FONT_WEIGHT = {
  thin: "Thin",
  extralight: "Extra Light",
  light: "Light",
  normal: "Regular",
  medium: "Medium",
  semibold: "Semi Bold",
  bold: "Bold",
  extrabold: "Extra Bold",
  black: "Black",
};

const ROUNDED = {
  none: 0, sm: 4, DEFAULT: 6, md: 8, lg: 12, xl: 16, "2xl": 24, "3xl": 32, full: 9999,
};

const SHADOW = {
  sm: { offset: { x: 0, y: 1 }, radius: 2, opacity: 0.05 },
  DEFAULT: { offset: { x: 0, y: 1 }, radius: 3, opacity: 0.1 },
  md: { offset: { x: 0, y: 4 }, radius: 6, opacity: 0.1 },
  lg: { offset: { x: 0, y: 10 }, radius: 15, opacity: 0.1 },
  xl: { offset: { x: 0, y: 20 }, radius: 25, opacity: 0.1 },
  "2xl": { offset: { x: 0, y: 25 }, radius: 50, opacity: 0.25 },
};

function hexToRgb(hex) {
  if (!hex) return null;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return { r, g, b };
}

function colorFromName(name) {
  if (NAMED_COLORS[name]) return hexToRgb(NAMED_COLORS[name]);
  const m = name.match(/^([a-z]+)-(\d+)$/);
  if (!m) return null;
  const family = TW_COLORS[m[1]];
  if (!family) return null;
  const hex = family[parseInt(m[2], 10)];
  return hex ? hexToRgb(hex) : null;
}

function spacingPx(key) {
  if (key === undefined || key === "") return 0;
  if (typeof key === "string" && key.startsWith("[") && key.endsWith("]")) {
    return parseLengthPx(key.slice(1, -1));
  }
  const n = parseFloat(key);
  if (TAILWIND_SPACING[n] !== undefined) return TAILWIND_SPACING[n];
  return n * 4;
}

function parseLengthPx(value) {
  if (!value) return 0;
  const v = String(value).trim().toLowerCase();
  if (v === "auto" || v === "none") return 0;
  const m = v.match(/^(-?[\d.]+)(px|rem|em|%)?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2] || "px";
  if (unit === "rem" || unit === "em") return n * 16;
  if (unit === "%") return 0;
  return n;
}

function parseColorValue(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (NAMED_COLORS[v] !== undefined) {
    return NAMED_COLORS[v] ? { ...hexToRgb(NAMED_COLORS[v]), a: 1 } : null;
  }
  if (v.startsWith("#")) {
    const rgb = hexToRgb(v);
    return rgb ? { ...rgb, a: 1 } : null;
  }
  const rgba = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgba) {
    return {
      r: parseInt(rgba[1], 10) / 255,
      g: parseInt(rgba[2], 10) / 255,
      b: parseInt(rgba[3], 10) / 255,
      a: rgba[4] !== undefined ? parseFloat(rgba[4]) : 1,
    };
  }
  return null;
}

function parseColorClass(cls) {
  const m = cls.match(/^(?:text|bg|border|from|to|via)-(.+?)(?:\/(\d+))?$/);
  if (!m) return null;
  let core = m[1];
  const opacityPct = m[2];
  let color = null;
  if (core.startsWith("[") && core.endsWith("]")) {
    color = parseColorValue(core.slice(1, -1));
  } else {
    const rgb = colorFromName(core);
    if (rgb) color = { ...rgb, a: 1 };
  }
  if (!color) return null;
  if (opacityPct) color.a = parseInt(opacityPct, 10) / 100;
  return color;
}

function getClassString(attributes) {
  if (!attributes) return "";
  const attr = attributes.find((a) => a.name === "className" || a.name === "class");
  return attr && typeof attr.value === "string" ? attr.value : "";
}

function setFill(node, color) {
  if (!color || !("fills" in node)) return;
  node.fills = [{ type: "SOLID", color: { r: color.r, g: color.g, b: color.b }, opacity: color.a === undefined ? 1 : color.a }];
}

function setStroke(node, color, weight) {
  if (!("strokes" in node)) return;
  node.strokes = [{ type: "SOLID", color: { r: color.r, g: color.g, b: color.b }, opacity: color.a === undefined ? 1 : color.a }];
  if (weight) node.strokeWeight = weight;
}

function ensureLayoutMode(node, mode) {
  if (!("layoutMode" in node)) return;
  node.layoutMode = mode;
  node.primaryAxisSizingMode = "AUTO";
  node.counterAxisSizingMode = "AUTO";
}

function applyClasses(node, classString, ctx) {
  if (!classString) return;
  const classes = classString.split(/\s+/).filter(Boolean);
  const isText = node.type === "TEXT";

  for (const raw of classes) {
    let c = raw;
    const resp = c.match(/^(?:xl|lg|md|sm|2xl):(.+)$/);
    if (resp) c = resp[1];
    if (c.startsWith("hover:") || c.startsWith("focus:") || c.startsWith("active:")) continue;
    if (c === "hidden" || c === "block" || c === "inline-block" || c === "inline" || c === "cursor-pointer" || c.startsWith("transition") || c.startsWith("animate-") || c.startsWith("duration-") || c.startsWith("ease-")) continue;
    if (c.startsWith("group") || c.startsWith("space-x-") || c.startsWith("col-span-") || c.startsWith("row-span-")) {
      if (c.startsWith("space-x-") && !isText && "itemSpacing" in node) node.itemSpacing = spacingPx(c.slice(8));
      if (c.startsWith("space-y-") && !isText && "itemSpacing" in node) node.itemSpacing = spacingPx(c.slice(8));
      continue;
    }
    if (c.startsWith("space-y-") && !isText && "itemSpacing" in node) {
      ensureLayoutMode(node, "VERTICAL");
      node.itemSpacing = spacingPx(c.slice(8));
      continue;
    }

    if (c === "flex") ensureLayoutMode(node, "HORIZONTAL");
    else if (c === "flex-col") ensureLayoutMode(node, "VERTICAL");
    else if (c === "flex-row") ensureLayoutMode(node, "HORIZONTAL");
    else if (c === "flex-1" && !isText && "layoutGrow" in node) node.layoutGrow = 1;
    else if (c === "grid") {
      ensureLayoutMode(node, "HORIZONTAL");
      if ("layoutWrap" in node) {
        try { node.layoutWrap = "WRAP"; } catch {}
      }
    } else if (c.startsWith("grid-cols-")) {
      ctx.gridCols = parseInt(c.slice(10), 10);
    } else if (c === "items-center" && !isText && "counterAxisAlignItems" in node) node.counterAxisAlignItems = "CENTER";
    else if (c === "items-start" && !isText && "counterAxisAlignItems" in node) node.counterAxisAlignItems = "MIN";
    else if (c === "items-end" && !isText && "counterAxisAlignItems" in node) node.counterAxisAlignItems = "MAX";
    else if (c === "justify-center" && !isText && "primaryAxisAlignItems" in node) node.primaryAxisAlignItems = "CENTER";
    else if (c === "justify-between" && !isText && "primaryAxisAlignItems" in node) node.primaryAxisAlignItems = "SPACE_BETWEEN";
    else if (c === "justify-end" && !isText && "primaryAxisAlignItems" in node) node.primaryAxisAlignItems = "MAX";
    else if (c === "justify-start" && !isText && "primaryAxisAlignItems" in node) node.primaryAxisAlignItems = "MIN";
    else if (c === "text-center" && isText) node.textAlignHorizontal = "CENTER";
    else if (c === "text-right" && isText) node.textAlignHorizontal = "RIGHT";
    else if (c === "text-left" && isText) node.textAlignHorizontal = "LEFT";
    else if (c === "uppercase" && isText) ctx.uppercase = true;
    else if (c === "lowercase" && isText) ctx.lowercase = true;
    else if (c.startsWith("gap-") && !isText && "itemSpacing" in node) node.itemSpacing = spacingPx(c.slice(4));
    else if (c.startsWith("p-") && !isText && "paddingTop" in node) { const v = spacingPx(c.slice(2)); node.paddingTop = v; node.paddingBottom = v; node.paddingLeft = v; node.paddingRight = v; }
    else if (c.startsWith("px-") && !isText && "paddingLeft" in node) { const v = spacingPx(c.slice(3)); node.paddingLeft = v; node.paddingRight = v; }
    else if (c.startsWith("py-") && !isText && "paddingTop" in node) { const v = spacingPx(c.slice(3)); node.paddingTop = v; node.paddingBottom = v; }
    else if (c.startsWith("pt-") && !isText && "paddingTop" in node) node.paddingTop = spacingPx(c.slice(3));
    else if (c.startsWith("pb-") && !isText && "paddingBottom" in node) node.paddingBottom = spacingPx(c.slice(3));
    else if (c.startsWith("pl-") && !isText && "paddingLeft" in node) node.paddingLeft = spacingPx(c.slice(3));
    else if (c.startsWith("pr-") && !isText && "paddingRight" in node) node.paddingRight = spacingPx(c.slice(3));
    else if (c.startsWith("m-")) { const v = spacingPx(c.slice(2)); ctx.marginTop = v; ctx.marginBottom = v; ctx.marginLeft = v; ctx.marginRight = v; }
    else if (c.startsWith("mx-")) { const v = spacingPx(c.slice(3)); ctx.marginLeft = v; ctx.marginRight = v; }
    else if (c.startsWith("my-")) { const v = spacingPx(c.slice(3)); ctx.marginTop = v; ctx.marginBottom = v; }
    else if (c.startsWith("mt-")) ctx.marginTop = spacingPx(c.slice(3));
    else if (c.startsWith("mb-")) ctx.marginBottom = spacingPx(c.slice(3));
    else if (c.startsWith("ml-")) ctx.marginLeft = spacingPx(c.slice(3));
    else if (c.startsWith("mr-")) ctx.marginRight = spacingPx(c.slice(3));
    else if (c.startsWith("w-")) { const v = c.slice(2); if (v === "full") ctx.widthFull = true; else ctx.width = spacingPx(v); }
    else if (c.startsWith("h-")) { const v = c.slice(2); if (v === "full") ctx.heightFull = true; else ctx.height = spacingPx(v); }
    else if (c.startsWith("min-w-")) ctx.minWidth = spacingPx(c.slice(6));
    else if (c.startsWith("min-h-")) ctx.minHeight = spacingPx(c.slice(6));
    else if (c.startsWith("max-w-")) {
      const v = c.slice(6);
      if (v.startsWith("[")) ctx.maxWidth = parseLengthPx(v.slice(1, -1));
      else if (v === "xs") ctx.maxWidth = 320;
      else if (v === "sm") ctx.maxWidth = 384;
      else if (v === "md") ctx.maxWidth = 448;
      else if (v === "lg") ctx.maxWidth = 512;
      else if (v === "xl") ctx.maxWidth = 576;
      else if (v === "2xl") ctx.maxWidth = 672;
      else if (v === "3xl") ctx.maxWidth = 768;
      else if (v === "4xl") ctx.maxWidth = 896;
      else if (v === "5xl") ctx.maxWidth = 1024;
      else if (v === "6xl") ctx.maxWidth = 1152;
      else if (v === "7xl") ctx.maxWidth = 1280;
      else ctx.maxWidth = spacingPx(v);
    }
    else if (c === "rounded" && "cornerRadius" in node) node.cornerRadius = ROUNDED.DEFAULT;
    else if (c.startsWith("rounded-")) {
      const v = c.slice(8);
      if (v.startsWith("[")) {
        if ("cornerRadius" in node) node.cornerRadius = parseLengthPx(v.slice(1, -1));
      } else if (ROUNDED[v] !== undefined) {
        if ("cornerRadius" in node) node.cornerRadius = ROUNDED[v];
      }
    }
    else if (c === "border" && !isText) { ctx.borderWidth = 1; ctx.hasBorder = true; }
    else if (c.startsWith("border-") && !isText) {
      const sub = c.slice(7);
      const numWidth = parseInt(sub, 10);
      if (!isNaN(numWidth) && /^\d+$/.test(sub)) { ctx.borderWidth = numWidth; ctx.hasBorder = true; }
      else {
        const col = parseColorClass("border-" + sub);
        if (col) { ctx.borderColor = col; ctx.hasBorder = true; }
      }
    }
    else if (c.startsWith("shadow")) {
      const key = c === "shadow" ? "DEFAULT" : c.replace("shadow-", "");
      const def = SHADOW[key];
      if (def && "effects" in node) {
        node.effects = [{
          type: "DROP_SHADOW",
          color: { r: 0, g: 0, b: 0, a: def.opacity },
          offset: def.offset,
          radius: def.radius,
          visible: true,
          blendMode: "NORMAL",
        }];
      }
    }
    else if (c.startsWith("text-")) {
      const sub = c.slice(5);
      if (TEXT_SIZE[sub] !== undefined && isText) node.fontSize = TEXT_SIZE[sub];
      else if (sub.startsWith("[") && sub.endsWith("]") && isText) {
        node.fontSize = parseLengthPx(sub.slice(1, -1));
      } else {
        const color = parseColorClass(c);
        if (color) {
          if (isText) setFill(node, color);
          else ctx.textColor = color;
        }
      }
    }
    else if (c.startsWith("font-")) {
      const sub = c.slice(5);
      if (FONT_WEIGHT[sub] && isText) ctx.fontStyle = FONT_WEIGHT[sub];
    }
    else if (c === "italic" && isText) ctx.fontStyle = (ctx.fontStyle || "Regular") + " Italic";
    else if (c.startsWith("bg-")) {
      if (c.startsWith("bg-gradient-to-")) { ctx.gradientDir = c.slice(15); continue; }
      const color = parseColorClass(c);
      if (color) setFill(node, color);
    }
    else if (c.startsWith("from-")) {
      const color = parseColorClass(c);
      if (color) ctx.gradFrom = color;
    }
    else if (c.startsWith("to-")) {
      const color = parseColorClass(c);
      if (color) ctx.gradTo = color;
    }
    else if (c.startsWith("tracking-")) { /* letter-spacing — skip */ }
    else if (c.startsWith("leading-")) { /* line-height — skip */ }
    else if (c.startsWith("overflow")) { /* skip */ }
    else if (c.startsWith("z-")) { /* skip */ }
    else if (c.startsWith("absolute") || c.startsWith("relative") || c.startsWith("sticky") || c.startsWith("fixed") || c.startsWith("top-") || c.startsWith("bottom-") || c.startsWith("left-") || c.startsWith("right-") || c === "translate-y-1/2" || c.startsWith("-translate-")) { /* skip positioning */ }
    else if (c === "object-cover" || c === "object-contain") { /* skip */ }
    else if (c === "active-nav" && !isText) ctx.isActiveNav = true;
    else if (c === "dropdown" && !isText) ctx.isDropdown = true;
    else if (c === "dropdown-header") ctx.isDropdownHeader = true;
    else if (c === "dropdown-link") ctx.isDropdownLink = true;
    else if (c === "nav-item" && !isText) ctx.isNavItem = true;
  }

  if (ctx.gradFrom && ctx.gradTo && ctx.gradientDir && "fills" in node) {
    const dirMap = {
      r:  [[1, 0, 0], [0, 1, 0]],
      l:  [[-1, 0, 1], [0, 1, 0]],
      b:  [[0, 1, 0], [-1, 0, 1]],
      t:  [[0, -1, 1], [1, 0, 0]],
      br: [[1, 0, 0], [0, 1, 0]],
      tr: [[1, 0, 0], [0, -1, 1]],
    };
    const transform = dirMap[ctx.gradientDir] || dirMap.r;
    node.fills = [{
      type: "GRADIENT_LINEAR",
      gradientTransform: transform,
      gradientStops: [
        { position: 0, color: { r: ctx.gradFrom.r, g: ctx.gradFrom.g, b: ctx.gradFrom.b, a: 1 } },
        { position: 1, color: { r: ctx.gradTo.r, g: ctx.gradTo.g, b: ctx.gradTo.b, a: 1 } },
      ],
    }];
  }

  if (ctx.hasBorder && "strokes" in node) {
    setStroke(node, ctx.borderColor || { r: 0.89, g: 0.91, b: 0.94, a: 1 }, ctx.borderWidth || 1);
  }
}

function applyInlineStyle(node, styleString, ctx) {
  if (!styleString) return;
  const decls = styleString.split(";");
  for (const decl of decls) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    applyCssProperty(node, key, val, ctx);
  }
}

function applyCssProperty(node, key, val, ctx) {
  if (!val) return;
  const isText = node.type === "TEXT";

  switch (key) {
    case "background":
    case "background-color": {
      const color = parseColorValue(val);
      if (color) setFill(node, color);
      return;
    }
    case "color": {
      const color = parseColorValue(val);
      if (color) {
        if (isText) setFill(node, color);
        else ctx.textColor = color;
      }
      return;
    }
    case "border-radius": {
      if ("cornerRadius" in node) node.cornerRadius = parseLengthPx(val);
      return;
    }
    case "padding": {
      const parts = val.split(/\s+/).map(parseLengthPx);
      if (!("paddingTop" in node)) return;
      if (parts.length === 1) { node.paddingTop = node.paddingRight = node.paddingBottom = node.paddingLeft = parts[0]; }
      else if (parts.length === 2) { node.paddingTop = node.paddingBottom = parts[0]; node.paddingLeft = node.paddingRight = parts[1]; }
      else if (parts.length === 4) { node.paddingTop = parts[0]; node.paddingRight = parts[1]; node.paddingBottom = parts[2]; node.paddingLeft = parts[3]; }
      return;
    }
    case "padding-top": if ("paddingTop" in node) node.paddingTop = parseLengthPx(val); return;
    case "padding-bottom": if ("paddingBottom" in node) node.paddingBottom = parseLengthPx(val); return;
    case "padding-left": if ("paddingLeft" in node) node.paddingLeft = parseLengthPx(val); return;
    case "padding-right": if ("paddingRight" in node) node.paddingRight = parseLengthPx(val); return;
    case "border": {
      const m = val.match(/^(\d+(?:\.\d+)?)(?:px)?\s+\S+\s+(.+)$/);
      if (m) {
        const color = parseColorValue(m[2]) || { r: 0.89, g: 0.91, b: 0.94, a: 1 };
        setStroke(node, color, parseFloat(m[1]));
      }
      return;
    }
    case "font-size": if (isText) node.fontSize = parseLengthPx(val); return;
    case "font-weight": {
      const map = { 100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Extra Bold", 900: "Black" };
      const w = parseInt(val, 10);
      if (map[w] && isText) ctx.fontStyle = map[w];
      return;
    }
    case "display": {
      if (val === "flex") ensureLayoutMode(node, "HORIZONTAL");
      else if (val === "grid") ensureLayoutMode(node, "HORIZONTAL");
      else if (val === "none") { /* dropdown etc. — keep visible */ }
      return;
    }
    case "flex-direction": {
      if (val === "column") ensureLayoutMode(node, "VERTICAL");
      else if (val === "row") ensureLayoutMode(node, "HORIZONTAL");
      return;
    }
    case "align-items": {
      if ("counterAxisAlignItems" in node) {
        if (val === "center") node.counterAxisAlignItems = "CENTER";
        else if (val === "flex-start") node.counterAxisAlignItems = "MIN";
        else if (val === "flex-end") node.counterAxisAlignItems = "MAX";
      }
      return;
    }
    case "justify-content": {
      if ("primaryAxisAlignItems" in node) {
        if (val === "center") node.primaryAxisAlignItems = "CENTER";
        else if (val === "space-between") node.primaryAxisAlignItems = "SPACE_BETWEEN";
        else if (val === "flex-end") node.primaryAxisAlignItems = "MAX";
      }
      return;
    }
    case "gap": if ("itemSpacing" in node) node.itemSpacing = parseLengthPx(val); return;
    case "width": ctx.width = parseLengthPx(val); return;
    case "height": ctx.height = parseLengthPx(val); return;
    case "text-transform": if (val === "uppercase") ctx.uppercase = true; return;
    default: return;
  }
}

module.exports = {
  getClassString,
  applyClasses,
  applyInlineStyle,
  parseColorValue,
  parseLengthPx,
  spacingPx,
};
