const { captureFromHtml } = require("./domCapture");

const convertBtn = document.getElementById("convert");
const jsxArea = document.getElementById("jsx");
const statusEl = document.getElementById("status");
const showHiddenMenusEl = document.getElementById("showHiddenMenus");
const multiViewEl = document.getElementById("multiView");

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
  const multiView = !multiViewEl || multiViewEl.checked;

  let captured;
  try {
    captured = await captureFromHtml(html, {
      width: 1440,
      waitMs: 2000,
      showHiddenMenus,
      multiView,
    });
  } catch (err) {
    setStatus("Capture failed: " + (err && err.message ? err.message : err), true);
    convertBtn.disabled = false;
    return;
  }

  const screens = captured.screens || [];
  const totalAtoms = screens.reduce((n, s) => n + (s.atoms ? s.atoms.length : 0), 0);
  const libNote = formatLibrariesNote(captured.libraries);
  setStatus(
    "Captured " + screens.length + " screen(s), " + totalAtoms + " atoms." + libNote + " Sending to Figma...",
    false
  );

  parent.postMessage(
    {
      pluginMessage: {
        type: "renderAtoms",
        screens,
      },
    },
    "*"
  );

  setStatus("Sent. Switch to Figma to see the result.", false);
  setTimeout(() => { convertBtn.disabled = false; }, 1500);
};
