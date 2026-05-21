const { captureFromHtml } = require("./domCapture");

const convertBtn = document.getElementById("convert");
const jsxArea = document.getElementById("jsx");
const statusEl = document.getElementById("status");
const showHiddenMenusEl = document.getElementById("showHiddenMenus");

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

  let captured;
  try {
    captured = await captureFromHtml(html, {
      width: 1440,
      waitMs: 2000,
      showHiddenMenus,
    });
  } catch (err) {
    setStatus("Capture failed: " + (err && err.message ? err.message : err), true);
    convertBtn.disabled = false;
    return;
  }

  setStatus("Captured " + captured.atoms.length + " atoms. Sending to Figma...", false);

  const transferables = [];
  captured.atoms.forEach((a) => {
    if (a.imageBytes) transferables.push(a.imageBytes.buffer);
  });

  parent.postMessage(
    {
      pluginMessage: {
        type: "renderAtoms",
        atoms: captured.atoms,
        width: captured.width,
        height: captured.height,
        background: captured.background,
      },
    },
    "*"
  );

  setStatus("Sent. Switch to Figma to see the result.", false);
  setTimeout(() => { convertBtn.disabled = false; }, 1500);
};
