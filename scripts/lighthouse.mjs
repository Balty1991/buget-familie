import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

const port = Number(process.env.LH_PORT || 4173);
const url = process.env.LH_URL || `http://127.0.0.1:${port}/`;
const preview = spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", String(port)], { stdio: "ignore", detached: true });
let browser;

async function waitForPreview() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Preview-ul încă pornește.
    }
    await sleep(250);
  }
  throw new Error(`Preview-ul nu a pornit la ${url}`);
}

try {
  await waitForPreview();
  browser = await launch({ chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"] });
  const result = await lighthouse(url, {
    port: browser.port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo", "pwa"],
    formFactor: "mobile",
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
  });
  const report = result.lhr;
  const scores = Object.fromEntries(Object.entries(report.categories).map(([key, category]) => [key, Math.round((category.score || 0) * 100)]));
  const metrics = Object.fromEntries(Object.entries(report.audits).filter(([key]) => ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index", "interactive"].includes(key)).map(([key, audit]) => [key, { displayValue: audit.displayValue, numericValue: audit.numericValue }]));
  await mkdir("reports", { recursive: true });
  await writeFile("reports/lighthouse-mobile.json", JSON.stringify(report, null, 2));
  await writeFile("reports/lighthouse-mobile-summary.json", JSON.stringify({ generatedAt: new Date().toISOString(), url, scores, metrics }, null, 2));
  console.log(JSON.stringify({ url, scores, metrics }, null, 2));
  const minimumPerformance = Number(process.env.LH_MIN_PERFORMANCE || 70);
  if ((scores.performance || 0) < minimumPerformance) process.exitCode = 2;
} finally {
  if (browser) await browser.kill();
  if (preview.pid) {
    try {
      process.kill(-preview.pid, "SIGTERM");
    } catch {
      preview.kill("SIGTERM");
    }
  }
}
