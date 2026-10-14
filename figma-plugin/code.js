// Builds the Drift Detector landing page at 1440 / 768 / 375 px in Light and Dark (6 frames).
// Geometry was measured from the live app, so a capture of a clean build lines up with these frames.
// Run once: Figma desktop app → Plugins → Development → Import plugin from manifest… → pick manifest.json → run.

const LIGHT = "Tokens Light";
const DARK = "Tokens Dark";

const TOKENS = [
  ["color/canvas", "#f6f8fb", "#10131b"],
  ["color/surface", "#ffffff", "#181c27"],
  ["color/tint", "#eef2fe", "#1d2436"],
  ["color/ink", "#151a26", "#eaedf4"],
  ["color/muted", "#5b6478", "#9aa3b6"],
  ["color/line", "#e2e6ee", "#2a3040"],
  ["color/design", "#2f5bea", "#7c9bff"],
  ["color/build", "#e58a1f", "#f2a54a"],
  ["color/build-text", "#9a5206", "#f2a54a"],
  ["color/drift", "#d93f6e", "#ff6f98"],
  ["color/drift-strong", "#c0305c", "#ff6f98"],
  ["color/drift-soft", "#fbe7ee", "#3a1e2a"],
  ["color/resolved", "#1f8a5b", "#4cc28d"],
  ["color/on-accent", "#ffffff", "#10131b"],
];

const M = {
  1440: { H: 71.4, brand: [176, 22.4], navY: 19, navX: [328, 381], signin: [992.2, 22.7, 58.7, 25],
    group: [1074.9, 12], btns: [[1078.9, 16, 56.2, 38.4], [1135.1, 16, 52.8, 38.4], [1187.9, 16, 72.1, 38.4]],
    eyebrow: [176, 151.4],
    h1: { x: 176, y: 186.6, size: 62.4, lh: 68.64, ls: -0.624, lines: ["Catch the gap between", "design and build", "before users do."], em: [[176, 251.2, 492.2, 75]] },
    lede: { x: 176, y: 408.5, lines: ["Drift Detector lays the Figma frame over every Deployxa preview build, flags each", "spacing, type and colour mismatch, and turns it into a fix ticket."] },
    actions: { x: 176, y: 488.5, dir: "HORIZONTAL" }, legend: [176, 544.5] },
  768: { H: 71.4, brand: [16, 22.4], navY: 19, navX: [168, 221], signin: [480.2, 22.7, 58.7, 25],
    group: [562.9, 12], btns: [[566.9, 16, 56.2, 38.4], [623.1, 16, 52.8, 38.4], [675.9, 16, 72.1, 38.4]],
    eyebrow: [16, 151.4],
    h1: { x: 16, y: 186.6, size: 41.472, lh: 45.6192, ls: -0.41472, lines: ["Catch the gap between design", "and build before users do."], em: [[483.5, 183.6, 133.6, 50], [16, 229.2, 184.4, 50]] },
    lede: { x: 16, y: 293.8, lines: ["Drift Detector lays the Figma frame over every Deployxa preview build, flags each", "spacing, type and colour mismatch, and turns it into a fix ticket."] },
    actions: { x: 16, y: 373.8, dir: "HORIZONTAL" }, legend: [16, 429.8] },
  375: { H: 115.8, brand: [16, 15.4], navY: 12, navX: [168, 221], signin: [16, 67.1, 58.7, 25],
    group: [98.7, 56.4], btns: [[102.7, 60.4, 56.2, 38.4], [158.9, 60.4, 52.8, 38.4], [211.7, 60.4, 72.1, 38.4]],
    eyebrow: [16, 195.8],
    h1: { x: 16, y: 231, size: 36.8, lh: 40.48, ls: -0.368, lines: ["Catch the gap", "between design", "and build", "before users do."], em: [[179.1, 269.4, 118.5, 44], [16, 309.9, 163.6, 44]] },
    lede: { x: 16, y: 408.8, lines: ["Drift Detector lays the Figma frame", "over every Deployxa preview build,", "flags each spacing, type and colour", "mismatch, and turns it into a fix ticket."] },
    actions: { x: 16, y: 552.8, dir: "VERTICAL" }, legend: [16, 660.8] },
};

const FONTS = [
  ["Bricolage Grotesque", "Bold"], ["Bricolage Grotesque", "SemiBold"],
  ["Figtree", "Regular"], ["Figtree", "Medium"], ["Figtree", "SemiBold"],
  ["JetBrains Mono", "Medium"],
];

const hex = (h) => { const n = parseInt(h.slice(1), 16); return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }; };

async function ensureCollection(name, valueIndex) {
  const existing = (await figma.variables.getLocalVariableCollectionsAsync()).find((c) => c.name === name);
  const collection = existing || figma.variables.createVariableCollection(name);
  const mode = collection.modes[0].modeId;
  const byName = {};
  for (const id of collection.variableIds) { const v = await figma.variables.getVariableByIdAsync(id); byName[v.name] = v; }
  for (const t of TOKENS) {
    let v = byName[t[0]];
    if (!v) {
      v = figma.variables.createVariable(t[0], collection, "COLOR");
      v.scopes = ["ALL_FILLS", "STROKE_COLOR", "TEXT_FILL"];
      byName[t[0]] = v;
    }
    v.setValueForMode(mode, hex(t[valueIndex]));
  }
  return byName;
}

async function main() {
  for (const [family, style] of FONTS) await figma.loadFontAsync({ family, style });
  const vars = { light: await ensureCollection(LIGHT, 1), dark: await ensureCollection(DARK, 2) };
  const page = figma.currentPage;
  page.name = "Landing";

  const paint = (theme, key) => figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", vars[theme][key]);
  const fill = (node, theme, key) => { node.fills = [paint(theme, key)]; };
  const stroke = (node, theme, key) => { node.strokes = [paint(theme, key)]; node.strokeWeight = 1; node.strokeAlign = "INSIDE"; };

  function text(parent, theme, o) {
    const t = figma.createText();
    t.fontName = { family: o.family, style: o.style };
    t.fontSize = o.size;
    t.lineHeight = o.lh ? { unit: "PIXELS", value: o.lh } : { unit: "AUTO" };
    t.letterSpacing = { unit: "PIXELS", value: o.ls || 0 };
    t.characters = o.chars;
    t.textAutoResize = "WIDTH_AND_HEIGHT";
    t.name = o.name || o.chars.slice(0, 24);
    fill(t, theme, o.color);
    if (o.underline) {
      t.textDecoration = "UNDERLINE";
      try { t.textDecorationOffset = { unit: "PIXELS", value: 3 }; } catch { /* older API: default offset */ }
    }
    parent.appendChild(t);
    if (o.x !== undefined) { t.x = o.x; t.y = o.y; }
    return t;
  }

  function box(parent, theme, o) {
    const r = figma.createFrame();
    r.name = o.name;
    r.fills = [];
    r.clipsContent = false;
    r.resize(o.w, o.h);
    parent.appendChild(r);
    r.x = o.x; r.y = o.y;
    if (o.fill) fill(r, theme, o.fill);
    if (o.stroke) stroke(r, theme, o.stroke);
    if (o.radius !== undefined) r.cornerRadius = o.radius;
    return r;
  }

  function row(name, dir, gap) {
    const f = figma.createFrame();
    f.name = name;
    f.fills = [];
    f.layoutMode = dir;
    f.primaryAxisSizingMode = "AUTO";
    f.counterAxisSizingMode = "AUTO";
    f.itemSpacing = gap;
    f.clipsContent = false;
    return f;
  }

  const xs = { 1440: 0, 768: 1540, 375: 2408 };
  const made = [];

  for (const theme of ["light", "dark"]) {
    for (const W of [1440, 768, 375]) {
      const m = M[W];
      const f = figma.createFrame();
      f.name = "Landing / " + W + " / " + (theme === "light" ? "Light" : "Dark");
      f.resize(W, 900);
      f.clipsContent = true;
      page.appendChild(f);
      f.x = xs[W];
      f.y = theme === "light" ? 0 : 1100;
      fill(f, theme, "color/canvas");

      // Header
      const hd = box(f, theme, { name: "Header", x: 0, y: 0, w: W, h: m.H });
      const hl = figma.createRectangle();
      hl.name = "Header border"; hl.resize(W, 1); hd.appendChild(hl); hl.x = 0; hl.y = m.H - 1; fill(hl, theme, "color/line");

      const brand = box(hd, theme, { name: "Brand", x: m.brand[0], y: m.brand[1], w: 128, h: 25.6 });
      const accent = figma.createRectangle();
      accent.name = "Mark accent"; accent.resize(12, 12); accent.cornerRadius = 3; brand.appendChild(accent); accent.x = 6; accent.y = 11.8; fill(accent, theme, "color/build");
      const mark = figma.createRectangle();
      mark.name = "Mark"; mark.resize(14, 14); mark.cornerRadius = 4; brand.appendChild(mark); mark.x = 0; mark.y = 5.8; fill(mark, theme, "color/design");
      text(brand, theme, { chars: "Drift Detector", family: "Bricolage Grotesque", style: "SemiBold", size: 16, lh: 25.6, color: "color/ink", x: 22, y: 0, name: "Brand name" });

      const nav = box(hd, theme, { name: "Nav", x: m.navX[0], y: m.navY, w: m.navX[1] + 60.2 - m.navX[0], h: 32.4 });
      text(nav, theme, { chars: "Board", family: "Figtree", style: "Medium", size: 14, lh: 22.4, color: "color/muted", x: 0, y: 4 });
      text(nav, theme, { chars: "Inspector", family: "Figtree", style: "Medium", size: 14, lh: 22.4, color: "color/muted", x: m.navX[1] - m.navX[0], y: 4 });

      const si = box(hd, theme, { name: "Sign in", x: m.signin[0], y: m.signin[1], w: m.signin[2], h: m.signin[3] });
      text(si, theme, { chars: "Sign in", family: "Figtree", style: "Medium", size: 14, color: "color/ink", x: 8, y: 4, underline: true });

      const grp = box(hd, theme, { name: "Theme switch", x: m.group[0], y: m.group[1], w: 189.1, h: 46.4, fill: "color/canvas", stroke: "color/line", radius: 999 });
      [["Light", false], ["Dark", false], ["System", true]].forEach((item, i) => {
        const b = m.btns[i];
        const on = item[1];
        const btn = box(grp, theme, { name: "Theme / " + item[0], x: b[0] - m.group[0], y: b[1] - m.group[1], w: b[2], h: b[3], radius: 999, fill: on ? "color/ink" : undefined });
        const tx = text(btn, theme, { chars: item[0], family: "Figtree", style: on ? "SemiBold" : "Medium", size: 14, lh: 22.4, color: on ? "color/canvas" : "color/muted" });
        tx.x = (b[2] - tx.width) / 2; tx.y = 8;
      });

      // Hero
      const hero = box(f, theme, { name: "Hero", x: 0, y: 0, w: W, h: 900 });
      text(hero, theme, { chars: "VISUAL QA FOR PREVIEW BUILDS", family: "JetBrains Mono", style: "Medium", size: 12, lh: 19.2, ls: 1.44, color: "color/muted", x: m.eyebrow[0], y: m.eyebrow[1], name: "Eyebrow" });
      m.h1.em.forEach((e, i) => {
        const hi = figma.createRectangle();
        hi.name = "Headline highlight " + (i + 1);
        hi.resize(e[2], e[3] * 0.38);
        hero.appendChild(hi);
        hi.x = e[0]; hi.y = e[1] + e[3] * 0.62;
        fill(hi, theme, "color/drift-soft");
      });
      text(hero, theme, { chars: m.h1.lines.join("\n"), family: "Bricolage Grotesque", style: "Bold", size: m.h1.size, lh: m.h1.lh, ls: m.h1.ls, color: "color/ink", x: m.h1.x, y: m.h1.y, name: "Headline" });
      text(hero, theme, { chars: m.lede.lines.join("\n"), family: "Figtree", style: "Regular", size: 20, lh: 32, color: "color/muted", x: m.lede.x, y: m.lede.y, name: "Lede" });

      const act = row("Actions", m.actions.dir, 12);
      hero.appendChild(act); act.x = m.actions.x; act.y = m.actions.y;
      [["Open the overlay inspector", 206.7, true], ["View the project board", 181, false]].forEach((item) => {
        const primary = item[2];
        const b = figma.createFrame();
        b.name = primary ? "Button / Primary" : "Button / Secondary";
        b.layoutMode = "HORIZONTAL";
        b.primaryAxisSizingMode = "FIXED";
        b.counterAxisSizingMode = "FIXED";
        b.resize(item[1], 40);
        b.primaryAxisAlignItems = "CENTER";
        b.counterAxisAlignItems = "CENTER";
        b.cornerRadius = 10;
        fill(b, theme, primary ? "color/design" : "color/surface");
        stroke(b, theme, primary ? "color/design" : "color/muted");
        act.appendChild(b);
        text(b, theme, { chars: item[0], family: "Figtree", style: "SemiBold", size: 14, color: primary ? "color/on-accent" : "color/ink" });
      });

      const lg = row("Legend", "HORIZONTAL", 16);
      lg.counterAxisAlignItems = "CENTER";
      hero.appendChild(lg); lg.x = m.legend[0]; lg.y = m.legend[1];
      [["Design", "color/design"], ["Build", "color/build"], ["Drift", "color/drift"], ["Resolved", "color/resolved"]].forEach((item) => {
        const it = row("Legend / " + item[0], "HORIZONTAL", 8);
        it.counterAxisAlignItems = "CENTER";
        lg.appendChild(it);
        const sw = figma.createRectangle();
        sw.name = "Swatch"; sw.resize(10, 10); sw.cornerRadius = 3; it.appendChild(sw); fill(sw, theme, item[1]);
        text(it, theme, { chars: item[0], family: "Figtree", style: "Regular", size: 14, lh: 22.4, color: "color/muted" });
      });

      made.push({ id: f.id, name: f.name });
    }
  }

  // A readable list of the node IDs, for pasting into the capture request.
  const note = figma.createFrame();
  note.name = "Node IDs";
  note.layoutMode = "VERTICAL"; note.primaryAxisSizingMode = "AUTO"; note.counterAxisSizingMode = "AUTO";
  note.itemSpacing = 6; note.paddingLeft = note.paddingRight = note.paddingTop = note.paddingBottom = 16;
  note.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  page.appendChild(note); note.x = 0; note.y = 2200;
  await figma.loadFontAsync({ family: "Figtree", style: "Regular" });
  const list = figma.createText();
  list.fontName = { family: "Figtree", style: "Regular" };
  list.fontSize = 14;
  list.characters = made.map((m) => m.name + "  =  " + m.id).join("\n");
  note.appendChild(list);

  figma.viewport.scrollAndZoomIntoView(page.children);
  figma.closePlugin("Created " + made.length + " frames. IDs are listed in the 'Node IDs' frame.");
}

main().catch((e) => figma.closePlugin("Failed: " + (e && e.message ? e.message : e)));
