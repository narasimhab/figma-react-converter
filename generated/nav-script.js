// Figma Plugin script — builds the CorpLink navigation from ui.html (lines 33-71)
// Paste this into the Figma Plugin Console, or import via your plugin's code.js.
// Output: a 1440x620 "Web Navigation" frame at (0, 900) on the current page,
// containing the deep-blue gradient header, logo, 4 nav buttons, and all 3
// expanded dropdowns with colored icon placeholders matching the Tailwind palette.

(async () => {
  await Promise.all([
    figma.loadFontAsync({ family: "Inter", style: "Regular" }),
    figma.loadFontAsync({ family: "Inter", style: "Medium" }),
    figma.loadFontAsync({ family: "Inter", style: "Semi Bold" }),
    figma.loadFontAsync({ family: "Inter", style: "Bold" }),
    figma.loadFontAsync({ family: "Inter", style: "Extra Bold" }),
    figma.loadFontAsync({ family: "Inter", style: "Black" }),
  ]);

  const created = [];

  const C = {
    bg: { r: 0.941, g: 0.957, b: 0.973 },          // #f0f4f8
    grad1: { r: 0.008, g: 0.078, b: 0.365, a: 1 }, // #02145d
    grad2: { r: 0.016, g: 0.133, b: 0.549, a: 1 }, // #04228c
    white: { r: 1, g: 1, b: 1 },
    border: { r: 0.886, g: 0.910, b: 0.941 },      // #e2e8f0
    divider: { r: 0.973, g: 0.980, b: 0.988 },     // #f8fafc
    text: { r: 0.278, g: 0.337, b: 0.412 },        // #475569 slate-600
    header: { r: 0.580, g: 0.639, b: 0.722 },      // #94a3b8 slate-400
    blue500:    { r: 0.231, g: 0.510, b: 0.965 },
    purple500:  { r: 0.659, g: 0.333, b: 0.969 },
    orange500:  { r: 0.976, g: 0.451, b: 0.086 },
    emerald500: { r: 0.063, g: 0.725, b: 0.506 },
    pink500:    { r: 0.925, g: 0.282, b: 0.600 },
    yellow500:  { r: 0.918, g: 0.702, b: 0.031 },
    red500:     { r: 0.937, g: 0.267, b: 0.267 },
    slate500:   { r: 0.392, g: 0.455, b: 0.545 },
    indigo500:  { r: 0.388, g: 0.400, b: 0.945 },
    teal500:    { r: 0.078, g: 0.722, b: 0.651 },
  };

  // Root wrapper
  const root = figma.createFrame();
  root.name = "Web Navigation";
  root.resize(1440, 620);
  root.x = 0;
  root.y = 900;
  root.fills = [{ type: "SOLID", color: C.bg }];
  root.clipsContent = true;
  figma.currentPage.appendChild(root);
  created.push(root.id);

  // Header bar with gradient
  const header = figma.createFrame();
  header.name = "Header";
  header.resize(1440, 72);
  header.fills = [{
    type: "GRADIENT_LINEAR",
    gradientTransform: [[1, 0, 0], [0, 1, 0]],
    gradientStops: [
      { position: 0, color: C.grad1 },
      { position: 1, color: C.grad2 },
    ],
  }];
  header.effects = [{
    type: "DROP_SHADOW",
    color: { r: 0, g: 0, b: 0, a: 0.1 },
    offset: { x: 0, y: 4 },
    radius: 8,
    spread: 0,
    visible: true,
    blendMode: "NORMAL",
  }];
  root.appendChild(header);
  created.push(header.id);

  // 3x3 dot logo box
  const logoBox = figma.createFrame();
  logoBox.name = "Logo Dots";
  logoBox.resize(34, 34);
  logoBox.x = 32;
  logoBox.y = (72 - 34) / 2;
  logoBox.cornerRadius = 8;
  logoBox.fills = [{ type: "SOLID", color: C.white, opacity: 0.1 }];
  header.appendChild(logoBox);
  created.push(logoBox.id);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const dot = figma.createEllipse();
      dot.resize(5, 5);
      dot.x = 7 + c * 8;
      dot.y = 7 + r * 8;
      dot.fills = [{ type: "SOLID", color: C.white }];
      logoBox.appendChild(dot);
    }
  }

  // CORPLINK wordmark
  const word = figma.createText();
  word.fontName = { family: "Inter", style: "Black" };
  word.characters = "CORPLINK";
  word.fontSize = 18;
  word.fills = [{ type: "SOLID", color: C.white }];
  word.letterSpacing = { unit: "PIXELS", value: -0.5 };
  word.x = 32 + 34 + 12;
  word.y = (72 - word.height) / 2;
  header.appendChild(word);
  created.push(word.id);

  // Nav buttons row
  let navX = 32 + 34 + 12 + word.width + 24;
  const navY = (72 - 32) / 2;

  function makeNavButton(label, isActive, hasChevron) {
    const padH = 16;
    const txt = figma.createText();
    txt.fontName = { family: "Inter", style: "Bold" };
    txt.characters = label;
    txt.fontSize = 12;
    txt.fills = [{ type: "SOLID", color: C.white, opacity: isActive ? 1 : 0.8 }];
    const textW = txt.width;
    const chevW = hasChevron ? 16 : 0;
    const btnW = padH * 2 + textW + chevW;

    const btn = figma.createFrame();
    btn.name = label + " Button";
    btn.resize(btnW, 32);
    btn.x = navX;
    btn.y = navY;
    btn.cornerRadius = 12;
    btn.fills = isActive ? [{ type: "SOLID", color: C.white, opacity: 0.15 }] : [];
    header.appendChild(btn);
    created.push(btn.id);

    txt.x = padH;
    txt.y = (32 - txt.height) / 2;
    btn.appendChild(txt);

    if (hasChevron) {
      const chev = figma.createText();
      chev.fontName = { family: "Inter", style: "Bold" };
      chev.characters = "\u25BE";
      chev.fontSize = 10;
      chev.fills = [{ type: "SOLID", color: C.white, opacity: 0.8 }];
      chev.x = padH + textW + 8;
      chev.y = (32 - chev.height) / 2;
      btn.appendChild(chev);
    }

    const result = { leftX: navX, width: btnW };
    navX += btnW + 4;
    return result;
  }

  makeNavButton("Dashboard", true, false);
  const btnPeople = makeNavButton("People", false, true);
  const btnMgmt = makeNavButton("Management", false, true);
  const btnAtt = makeNavButton("Attendance", false, true);

  // Dropdown builder
  function makeDropdown(buttonInfo, items) {
    const dd = figma.createFrame();
    dd.name = "Dropdown";
    dd.resize(240, 100);
    dd.x = buttonInfo.leftX;
    dd.y = 72 + 5;
    dd.cornerRadius = 12;
    dd.fills = [{ type: "SOLID", color: C.white }];
    dd.strokes = [{ type: "SOLID", color: C.border }];
    dd.strokeWeight = 1;
    dd.effects = [{
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.15 },
      offset: { x: 0, y: 10 },
      radius: 25,
      spread: -5,
      visible: true,
      blendMode: "NORMAL",
    }];
    dd.clipsContent = false;
    root.appendChild(dd);
    created.push(dd.id);

    let y = 12;
    let firstItem = true;
    for (const item of items) {
      if (item.type === "header") {
        if (!firstItem) {
          const div = figma.createRectangle();
          div.resize(240 - 24, 1);
          div.x = 12;
          div.y = y;
          div.fills = [{ type: "SOLID", color: C.divider }];
          dd.appendChild(div);
          y += 1;
        }
        const padTop = firstItem ? 6 : 13;
        const t = figma.createText();
        t.fontName = { family: "Inter", style: "Extra Bold" };
        t.characters = item.text.toUpperCase();
        t.fontSize = 10;
        t.fills = [{ type: "SOLID", color: C.header }];
        t.letterSpacing = { unit: "PIXELS", value: 0.3 };
        t.x = 16;
        t.y = y + padTop;
        dd.appendChild(t);
        y += padTop + t.height + 6;
      } else {
        const linkH = 36;
        const link = figma.createFrame();
        link.name = item.label;
        link.resize(240 - 24, linkH);
        link.x = 12;
        link.y = y;
        link.cornerRadius = 8;
        link.fills = [];
        dd.appendChild(link);

        const ico = figma.createRectangle();
        ico.resize(20, 20);
        ico.x = 4;
        ico.y = (linkH - 20) / 2;
        ico.cornerRadius = 5;
        ico.fills = [{ type: "SOLID", color: item.color, opacity: 0.15 }];
        ico.strokes = [{ type: "SOLID", color: item.color }];
        ico.strokeWeight = 1.5;
        link.appendChild(ico);

        const lbl = figma.createText();
        lbl.fontName = { family: "Inter", style: "Semi Bold" };
        lbl.characters = item.label;
        lbl.fontSize = 12;
        lbl.fills = [{ type: "SOLID", color: C.text }];
        lbl.x = 4 + 20 + 10;
        lbl.y = (linkH - lbl.height) / 2;
        link.appendChild(lbl);
        y += linkH;
      }
      firstItem = false;
    }
    y += 12;
    dd.resize(240, y);
  }

  makeDropdown(btnPeople, [
    { type: "header", text: "People and Organization" },
    { type: "link", label: "Employee Directory", color: C.blue500 },
    { type: "link", label: "Org Chart", color: C.purple500 },
    { type: "link", label: "Announcements", color: C.orange500 },
    { type: "header", text: "Project Management" },
    { type: "link", label: "Projects", color: C.emerald500 },
    { type: "header", text: "Engagement" },
    { type: "link", label: "Surveys", color: C.pink500 },
    { type: "link", label: "Certifications", color: C.yellow500 },
  ]);

  makeDropdown(btnMgmt, [
    { type: "header", text: "User Management" },
    { type: "link", label: "Performance", color: C.blue500 },
    { type: "link", label: "Leaves", color: C.red500 },
    { type: "link", label: "Assets", color: C.slate500 },
    { type: "header", text: "Policies" },
    { type: "link", label: "Policies", color: C.indigo500 },
  ]);

  makeDropdown(btnAtt, [
    { type: "header", text: "Scheduling" },
    { type: "link", label: "Timesheet Entry", color: C.blue500 },
    { type: "link", label: "Holidays", color: C.teal500 },
  ]);

  // Center viewport on the new design
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.notify(`Created Web Navigation (${created.length} nodes)`);
})();
