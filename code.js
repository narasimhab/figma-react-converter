const { renderScreens } = require("./renderer");

figma.showUI(__html__, {
  width: 560,
  height: 720,
});

figma.ui.onmessage = async (msg) => {
  if (msg.type !== "renderAtoms") return;

  try {
    // New payload: { screens: [{ name, atoms, width, height, background }, ...] }
    // Legacy payload: { atoms, width, height, background }
    let screens = msg.screens;
    if (!screens && msg.atoms) {
      screens = [{
        name: "screen",
        atoms: msg.atoms,
        width: msg.width || 1440,
        height: msg.height || 800,
        background: msg.background || "rgb(255,255,255)",
      }];
    }
    if (!screens || !screens.length) {
      figma.notify("No screens received.");
      return;
    }

    const totalAtoms = screens.reduce((n, s) => n + (s.atoms ? s.atoms.length : 0), 0);
    const count = await renderScreens(screens);
    figma.notify("Rendered " + count + " screen(s), " + totalAtoms + " atoms.");
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    figma.notify("Render error: " + message, { error: true });
    console.error(err);
  }
};
