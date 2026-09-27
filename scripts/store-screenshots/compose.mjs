/* global document */
import { chromium } from "/home/user/buget-familie/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const F = "/home/user/buget-familie/client/src/assets/fonts/";
const OUT = "/home/user/buget-familie/docs/play-store-assets/screenshots/";
const font = (f) => `data:font/woff2;base64,${fs.readFileSync(F + f).toString("base64")}`;
const C = {
  today: { ro: ["Cât poți cheltui", "azi", "O singură cifră pe zi, până la salariu."], en: ["What you can spend", "today", "One number a day, until payday."] },
  split: { ro: ["A intrat salariul?", "Se împarte singur.", "Întâi obligațiile, apoi restul, pe plicuri."], en: ["Payday?", "It splits itself.", "Bills first, then the rest, into envelopes."] },
  plan: { ro: ["Fiecare leu", "are un loc.", "Plicuri pentru chirie, mâncare, economii."], en: ["Every leu", "has a place.", "Envelopes for rent, groceries, savings."] },
  needs: { ro: ["Două salarii,", "zile diferite.", "Fiecare salariu umple plicurile în ziua în care intră."], en: ["Two salaries,", "different days.", "Each salary fills the envelopes on the day it arrives."] },
  add: { ro: ["Notezi în", "3 secunde.", "Suma, magazinul, gata. Categoria se alege singură."], en: ["Log it in", "3 seconds.", "Amount, shop, done. The category picks itself."] },
  journal: { ro: ["Toate mișcările", "familiei.", "Comune sau personale, pe zile, cu căutare."], en: ["Every family", "transaction.", "Shared or personal, by day, searchable."] },
  obligations: { ro: ["Rate și facturi", "la timp.", "Vezi ce urmează și confirmi cu o atingere."], en: ["Bills and loans", "on time.", "See what's next and confirm with one tap."] },
  insights: { ro: ["Vezi unde", "se duc banii.", "Pe categorii, pentru ciclul curent."], en: ["See where", "the money goes.", "By category, for the current cycle."] },
};
// DEVICE=tablet → capturi de tabletă (1440×2560) din raw/tab-*.png, în screenshots/tableta-<limbă>.
const tablet = process.env.DEVICE === "tablet";
const LANGS = (process.env.LANGS || "ro,en").split(",");
const order = ["today", "split", "plan", "needs", "add", "journal", "obligations", "insights"];
const html = (img, [a, b, sub], i) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Fr;src:url(${font("fraunces-640-latin.woff2")});unicode-range:U+0000-00FF}
@font-face{font-family:Fr;src:url(${font("fraunces-640-ro.woff2")});unicode-range:U+0100-02FF}
@font-face{font-family:Px;src:url(${font("ibm-plex-sans-latin.woff2")})}
@font-face{font-family:Px;src:url(${font("ibm-plex-sans-latin-ext.woff2")});unicode-range:U+0100-02FF}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;background:${i % 2 ? "linear-gradient(170deg,#F4EFE4 0%,#EAE2CF 100%)" : "linear-gradient(170deg,#1A5248 0%,#143c36 100%)"};font-family:Px;position:relative}
.t{position:absolute;left:0;right:0;top:120px;text-align:center;padding:0 70px}
h1{font-family:Fr;font-weight:640;font-size:92px;line-height:1.02;letter-spacing:-.025em;color:${i % 2 ? "#143c36" : "#F7F3E8"}}
h1 em{font-style:normal;color:${i % 2 ? "#2F7D63" : "#E6B84A"};display:block}
p{margin-top:30px;font-size:38px;line-height:1.3;font-weight:500;color:${i % 2 ? "#4f5f58" : "rgba(247,243,232,.78)"}}
.ph{position:absolute;left:50%;top:${tablet ? 470 : 480}px;width:${tablet ? 860 : 650}px;transform:translateX(-50%);border-radius:${tablet ? 44 : 78}px;padding:${tablet ? 18 : 16}px;background:#0e1f1b;box-shadow:0 40px 90px rgba(10,30,25,.35),0 0 0 2px rgba(255,255,255,.08) inset}
.ph img{display:block;width:100%;border-radius:${tablet ? 26 : 62}px}
</style></head><body><div class="t"><h1>${a}<em>${b}</em></h1><p>${sub}</p></div><div class="ph"><img src="data:image/png;base64,${img}"></div></body></html>`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: tablet ? 4 / 3 : 1 });
for (const lang of LANGS) {
  const dir = tablet ? `tableta-${lang}` : lang;
  fs.mkdirSync(OUT + dir, { recursive: true });
  for (const [i, name] of order.entries()) {
    const img = fs.readFileSync(`${new URL("./raw/", import.meta.url).pathname}${tablet ? "tab-" : ""}${lang}-${name}.png`).toString("base64");
    await page.setContent(html(img, C[name][lang], i), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${OUT}${dir}/${String(i + 1).padStart(2, "0")}-${name}.png` });
    console.log("✓", lang, name);
  }
}
await browser.close();
