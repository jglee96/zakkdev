/**
 * Render a contact sheet of bot avatars (light/dark, 40px + 120px).
 * npx tsx tests/finance/render-avatar-contact-sheet.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { renderAvatarSvgMarkup } from "../../features/finance-auth/ui/bot-avatar-art";

const OUT_DIR = "/opt/cursor/artifacts/bot-avatars";
const BOT_IDS = [
  "main-bot",
  "bot-kr-stock",
  "bot-us-stock",
  "bot-index-futures",
  "bot-alpha-01",
  "bot-beta-02",
  "bot-gamma-03",
  "bot-delta-04",
  "bot-epsilon-05",
  "bot-zeta-06",
  "bot-eta-07",
  "bot-theta-08",
];

function rowHtml(botId: string) {
  const cells = (scheme: "light" | "dark", size: number) =>
    `<td style="padding:8px;text-align:center;background:${scheme === "light" ? "#f4f1ec" : "#131110"}">${renderAvatarSvgMarkup(botId, scheme, size)}</td>`;
  return `<tr>
    <td style="padding:8px;font:13px Barlow,sans-serif;color:#5e5a56">${botId}</td>
    ${cells("light", 40)}
    ${cells("dark", 40)}
    ${cells("light", 120)}
    ${cells("dark", 120)}
  </tr>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>body{margin:0;padding:16px;font-family:Barlow,sans-serif;background:#e8e3db}
table{border-collapse:collapse;background:#fdfcf9;border:1px solid #ddd8d2}
th{padding:8px;font-size:12px;font-weight:500;color:#5e5a56;border-bottom:1px solid #ddd8d2}
</style></head><body>
<h1 style="font-size:15px;font-weight:400;color:#1c1917">Bot avatar contact sheet</h1>
<table>
<thead><tr>
<th>botId</th><th>light 40px</th><th>dark 40px</th><th>light 120px</th><th>dark 120px</th>
</tr></thead>
<tbody>${BOT_IDS.map(rowHtml).join("")}</tbody>
</table></body></html>`;

  const htmlPath = path.join(OUT_DIR, "contact-sheet.html");
  await writeFile(htmlPath, html);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
  const pngPath = path.join(OUT_DIR, "avatar-contact-sheet.png");
  await page.screenshot({ path: pngPath, fullPage: true });
  await browser.close();
  console.log(`Saved ${pngPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
