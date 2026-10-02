/* global window, document */
import { chromium } from "/home/user/buget-familie/node_modules/playwright-core/index.mjs";
import { makeSeed } from "./seed.mjs";
const OUT = new URL("./raw/", import.meta.url).pathname;
import fs from "node:fs"; fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
// DEVICE=tablet → tabletă 10" în picioare; LANGS=ro → doar română.
const tablet = process.env.DEVICE === "tablet";
const VIEW = tablet ? { width: 800, height: 1280 } : { width: 390, height: 844 };
const DPR = tablet ? 2 : 3;
const PREFIX = tablet ? "tab-" : "";
const LANGS = (process.env.LANGS || "ro,en").split(",");

async function open(lang, opts = {}) {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR, locale: lang === "ro" ? "ro-RO" : "en-GB" });
  await ctx.addInitScript(([lang]) => {
    if (sessionStorage.getItem("store-init")) return; sessionStorage.setItem("store-init", "1");
    const set = { "buget-familie:setup-complete": "true", "buget-familie:onboarding-complete": "true", "buget-familie:first-week-tour-dismissed": "1", "buget-familie:theme": "white", "buget-familie:whats-new-2026-10b": "1", "buget-familie:language": lang, "buget-familie:envelope-glossary-seen": "1", "buget-familie:last-balance-check": new Date().toISOString().slice(0, 10) };
    for (const [k, v] of Object.entries(set)) localStorage.setItem(k, v);
    for (const k of ["catalog", "ink", "atelier", "premium", "ui-chrome"]) localStorage.setItem(`buget-familie:theme-migrated-${k}-2026-09`, "1");
  }, [lang]);
  // Recunoașterea vocală a telefonului, simulată: fraza vine după o clipă, ca la o ascultare reală.
  await ctx.addInitScript((phrase) => { window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => this.onresult?.({ results: [[{ transcript: phrase }]] }), 400); } abort() {} }; }, lang === "ro" ? "cincizeci de lei la Lidl" : "Lidl 50");
  const page = await ctx.newPage();
  // O zi obișnuită din săptămână (joi), nu ultima zi a săptămânii plicului: cifra zilei e cea tipică.
  if (process.env.STORE_DAY !== "real") await page.clock.setFixedTime(new Date(process.env.STORE_DAY || "2026-09-24T10:00:00"));
  await page.goto("http://127.0.0.1:5174/"); await page.waitForTimeout(1500);
  await page.evaluate(async (src) => {
    const storage = await import("/src/lib/app-storage.ts"); const fd = await import("/src/lib/finance-data.ts");
    const data = new Function("fd", "return " + src)(fd);
    const later = new Date(Date.now() + 3_600_000).toISOString();
    await storage.writeAppData(data, later); storage.writeLocalStorageSnapshot(JSON.stringify(data), later);
  }, makeSeed(lang, opts));
  await page.reload(); await page.waitForTimeout(2500);
  // Fără cursor care clipește și fără bara „Anulează” în capturi.
  await page.addStyleTag({ content: "* { caret-color: transparent !important; } .bf-undo-bar, .bf-offline-banner, .bf-update-banner { display: none !important; }" });
  return { browser, page };
}
const TOP = [/^(Astăzi|Today)$/, /^(Plicuri|Envelopes)$/, /(Notează|Log it)/, /^(Mișcări|Movements)$/];
// Pe tabletă meniul stă sus, în antet; pe telefon e bara de jos.
const dock = (page, i) => tablet ? page.locator("button:visible", { hasText: TOP[i] }).first() : page.locator(".os-dock button").nth(i);
const more = async (page, re) => { if (tablet) { await page.locator("header button:visible", { hasText: re }).first().click(); await page.waitForTimeout(1500); return; } await dock(page, 4).click(); await page.waitForTimeout(800); await page.locator("button:visible", { hasText: re }).first().click(); await page.waitForTimeout(1500); };
const shot = async (page, name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}${name}.png` }); console.log("✓", name); };

const frames = {
  async today(page) { await page.evaluate(() => window.scrollTo(0, 0)); },
  async split(page) { await page.evaluate(() => { const c = document.querySelector("[class*='income-split']"); c?.scrollIntoView({ block: "start" }); window.scrollBy(0, -86); }); },
  async plan(page) { await dock(page, 1).click(); await page.waitForTimeout(1600); await page.evaluate(() => window.scrollTo(0, 0)); },
  async needs(page) { await dock(page, 1).click(); await page.waitForTimeout(1600); await page.evaluate(() => { const el = document.querySelector(".bf-needs-item")?.closest("section") || document.querySelector(".bf-needs-item"); el?.scrollIntoView({ block: "start" }); window.scrollBy(0, -80); }); },
  async add(page) { await dock(page, 2).click(); await page.waitForTimeout(1200); const amount = page.locator(".bf-quick-entry-panel input[inputmode=decimal]").first(); await amount.fill("86,40"); const shop = page.locator(".bf-quick-entry-panel input[placeholder]").nth(1); if (await shop.count()) await shop.fill("Lidl"); await page.keyboard.press("Tab"); },
  async journal(page) { await dock(page, 3).click(); await page.waitForTimeout(1600); },
  async voice(page) { await dock(page, 2).click(); await page.waitForTimeout(1200); await page.locator(".bf-voice-button").click(); await page.waitForTimeout(1500); await page.evaluate(() => { const box = document.querySelector(".bf-quick-entry-scroll"); if (box) box.scrollTop = 0; document.activeElement?.blur?.(); }); await page.waitForTimeout(300); },
  async shopping(page) { await page.evaluate(() => window.dispatchEvent(new Event("buget-familie:open-shopping"))); await page.waitForTimeout(1500); await page.evaluate(() => window.scrollTo(0, 0)); },
  async year(page) { await more(page, /Analiză|Analysis|Insights/); await page.getByRole("tab", { name: /Gospodărie|Household/ }).first().click(); await page.waitForTimeout(1200); await page.locator(".bf-year-cta").first().click(); await page.waitForTimeout(1200); await page.locator(".bf-year-tap.is-next").click(); await page.waitForTimeout(500); await page.locator(".bf-year-tap.is-next").click(); await page.waitForTimeout(900); },
  async obligations(page) { await more(page, /Obligații|Obligations|Bills/); },
  async month(page) { await more(page, /Analiză|Analysis|Insights/); await page.getByRole("tab", { name: /Gospodărie|Household/ }).first().click(); await page.waitForTimeout(1200); await page.locator("button:visible", { hasText: /Imaginea lunii|Picture of the month/ }).first().click(); await page.waitForTimeout(2200); },
  async insights(page) { await more(page, /Analiză|Analysis|Insights/); await page.evaluate(() => { document.querySelector(".bf-spend-compass")?.scrollIntoView({ block: "start" }); window.scrollBy(0, -80); }); },
};

for (const lang of LANGS) {
  for (const [name, go] of Object.entries(frames)) {
    if (only && only !== name) continue;
    const { browser, page } = await open(lang, { pendingIncome: name === "split" || name === "month", yearHistory: name === "year" });
    try { await go(page); await shot(page, `${PREFIX}${lang}-${name}`); } catch (e) { console.log("✗", lang, name, e.message.split("\n")[0]); }
    await browser.close();
  }
}
