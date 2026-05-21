const { renderAtoms } = require("./renderer");

figma.showUI(__html__, {
  width: 560,
  height: 640,
});

figma.ui.onmessage = async (msg) => {
  if (msg.type !== "renderAtoms") return;

  try {
    if (!msg.atoms || !msg.atoms.length) {
      figma.notify("No atoms received.");
      return;
    }
    await renderAtoms(msg.atoms, msg.width || 1440, msg.height || 800, msg.background || "rgb(255,255,255)");
    figma.notify("Rendered " + msg.atoms.length + " atoms.");
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    figma.notify("Render error: " + message, { error: true });
    console.error(err);
  }
};
