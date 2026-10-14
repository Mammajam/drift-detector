import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire("/Users/mammajam/web projects/drift-detector/package.json")("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(`file://${here}/thumbnail.html`);
  await page.evaluate((t) => { if (t === "dark") document.documentElement.setAttribute("data-theme", "dark"); }, theme);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${here}/drift-detector-thumbnail-${theme}.png` });
  console.log("saved", theme);
  await page.close();
}
await browser.close();
