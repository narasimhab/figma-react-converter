const { captureFromHtml } = require("./domCapture");

const convertBtn = document.getElementById("convert");
const jsxArea = document.getElementById("jsx");
const statusEl = document.getElementById("status");
const showHiddenMenusEl = document.getElementById("showHiddenMenus");
const multiViewEl = document.getElementById("multiView");
const useAutoLayoutEl = document.getElementById("useAutoLayout");
const baseUrlEl = document.getElementById("baseUrl");
const extraCssEl = document.getElementById("extraCss");

function formatLibrariesNote(libs) {
  if (!libs) return "";
  const names = [];
  if (libs.bootstrap || (libs.linked && libs.linked.bootstrap)) names.push("Bootstrap CSS");
  if (libs.bootstrapIcons || (libs.linked && libs.linked.bootstrapIcons)) names.push("Bootstrap Icons");
  if (libs.fontAwesome || (libs.linked && libs.linked.fontAwesome)) names.push("Font Awesome");
  if (libs.tailwind || (libs.linked && libs.linked.tailwind)) names.push("Tailwind");
  if (!names.length) return "";
  return " Libraries: " + names.join(", ") + ".";
}

function collectRelativeImgPaths(html) {
  const out = [];
  const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = m[1].trim();
    if (!src) continue;
    if (/^(https?:|data:|blob:|file:|\/\/)/i.test(src)) continue;
    out.push(src);
  }
  return out;
}

function setStatus(message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.style.color = isError ? "#c53030" : "#2f855a";
}

function jsxToHtml(code) {
  let s = code;
  s = s.replace(/^[\s\S]*?return\s*\(\s*/, "");
  s = s.replace(/\)\s*;?\s*\}\s*\}?\s*$/, "");
  s = s.replace(/<>\s*/g, "<div>");
  s = s.replace(/\s*<\/>/g, "</div>");
  s = s.replace(/className=/g, "class=");
  s = s.replace(/\{[^{}]*\}/g, "");
  return s.trim();
}

function looksLikeJsx(code) {
  return /export\s+default|=>\s*\(|function\s+\w+\s*\(/.test(code) || /<>/.test(code);
}

convertBtn.onclick = async () => {
  const code = jsxArea.value;
  if (!code.trim()) {
    setStatus("Paste HTML or JSX first.", true);
    return;
  }

  setStatus("Rendering HTML in hidden iframe...", false);
  convertBtn.disabled = true;

  let html = code;
  if (looksLikeJsx(code)) {
    setStatus("Converting JSX to HTML...", false);
    try {
      html = jsxToHtml(code);
    } catch (e) {
      setStatus("JSX conversion failed: " + e.message, true);
      convertBtn.disabled = false;
      return;
    }
  }

  const showHiddenMenus = !showHiddenMenusEl || showHiddenMenusEl.checked;
  // Multi-view defaults to OFF — opt-in only. Otherwise dashboards with
  // multiple .view-section blocks produce N frames per click, which feels
  // like duplicates.
  const multiView = multiViewEl ? multiViewEl.checked : false;
  // Auto-layout is opt-in. Default is plain frames + captured absolute
  // coordinates, which matches the browser pixel-for-pixel.
  const useAutoLayout = useAutoLayoutEl ? useAutoLayoutEl.checked : false;
  const baseUrl = baseUrlEl ? (baseUrlEl.value || "").trim() : "";
  const extraCss = extraCssEl ? (extraCssEl.value || "") : "";

  // Detect relative image paths in the source and warn if no base URL.
  const relImgPaths = collectRelativeImgPaths(html);
  if (relImgPaths.length && !baseUrl) {
    setStatus(
      "Heads up: " + relImgPaths.length + " <img> tag(s) use relative paths (e.g. \"" +
        relImgPaths[0] + "\") but Base URL is empty — those will render as placeholders. " +
        "Set Base URL to where the images are HTTP-served and re-convert.",
      false
    );
    await new Promise((r) => setTimeout(r, 50));
  }

  let captured;
  try {
    captured = await captureFromHtml(html, {
      width: 1440,
      showHiddenMenus,
      multiView,
      baseUrl: baseUrl || null,
      extraCss: extraCss || null,
    });
  } catch (err) {
    setStatus("Capture failed: " + (err && err.message ? err.message : err), true);
    convertBtn.disabled = false;
    return;
  }

  const screens = captured.screens || [];
  const totalAtoms = screens.reduce((n, s) => n + (s.atoms ? s.atoms.length : 0), 0);
  const libNote = formatLibrariesNote(captured.libraries);

  let imgTotal = 0;
  let imgFailed = 0;
  for (const s of screens) {
    for (const a of s.atoms || []) {
      if (a && a.type === "image") {
        imgTotal++;
        if (!a.imageBytes) imgFailed++;
      }
    }
  }
  const imgNote = imgTotal
    ? " Images: " + (imgTotal - imgFailed) + "/" + imgTotal + " loaded" +
      (imgFailed ? " (" + imgFailed + " failed — check Base URL)." : ".")
    : "";

  const missingCss = captured.unreachableStylesheets || [];
  const fallbacks = captured.templateFallbacks || [];
  const fallbackNote = fallbacks.length
    ? " Applied fallback styles for " + fallbacks.join(", ") + " classes."
    : "";
  const cssNote = missingCss.length
    ? " ⚠ Could not load stylesheet(s): " + missingCss.slice(0, 3).join(", ") +
      (missingCss.length > 3 ? " (+" + (missingCss.length - 3) + " more)" : "") +
      (fallbacks.length
        ? " Paste their contents in 'Additional CSS' for exact match."
        : " Set Base URL or paste their contents in 'Additional CSS'.")
    : "";

  setStatus(
    "Captured " + screens.length + " screen(s), " + totalAtoms + " atoms." +
      imgNote + cssNote + fallbackNote + libNote + " Sending to Figma...",
    false
  );

  parent.postMessage(
    {
      pluginMessage: {
        type: "renderAtoms",
        screens,
        useAutoLayout,
      },
    },
    "*"
  );

  setStatus("Sent. Switch to Figma to see the result.", false);
  setTimeout(() => { convertBtn.disabled = false; }, 1500);
};
