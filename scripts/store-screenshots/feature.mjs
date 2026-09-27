/* global document */
import { chromium } from "/home/user/buget-familie/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const F = "/home/user/buget-familie/client/src/assets/fonts/";
const D = "/home/user/buget-familie/docs/play-store-assets/";
const b64 = (p) => fs.readFileSync(p).toString("base64");
const T = {
  ro: ["Fiecare ban", "are un loc.", "Plicuri · cât poți cheltui azi · toată familia"],
  en: ["Every penny", "has a place.", "Envelopes · daily budget · the whole family"],
};
const html = ([a, b, sub]) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Fr;src:url(data:font/woff2;base64,${b64(F + "fraunces-640-latin.woff2")});unicode-range:U+0000-00FF}
@font-face{font-family:Fr;src:url(data:font/woff2;base64,${b64(F + "fraunces-640-ro.woff2")});unicode-range:U+0100-02FF}
@font-face{font-family:Px;src:url(data:font/woff2;base64,${b64(F + "ibm-plex-sans-latin.woff2")})}
@font-face{font-family:Px;src:url(data:font/woff2;base64,${b64(F + "ibm-plex-sans-latin-ext.woff2")});unicode-range:U+0100-02FF}
*{margin:0;box-sizing:border-box}
body{width:1024px;height:500px;overflow:hidden;background:linear-gradient(160deg,#1A5248 0%,#143c36 100%);font-family:Px;display:flex;align-items:center;gap:56px;padding:0 80px}
img{width:300px;height:300px;border-radius:64px;box-shadow:0 30px 70px rgba(5,20,16,.45);flex:none}
small{display:block;font-size:20px;letter-spacing:.22em;font-weight:600;color:#E6B84A;margin-bottom:18px}
h1{font-family:Fr;font-weight:640;font-size:74px;line-height:1.02;letter-spacing:-.025em;color:#F7F3E8}
h1 em{font-style:normal;color:#E6B84A;display:block}
p{margin-top:22px;font-size:22px;font-weight:500;color:rgba(247,243,232,.78)}
</style></head><body><img src="data:image/png;base64,${b64(D + "icon-512.png")}"><div><small>BUGET FAMILIE</small><h1>${a}<em>${b}</em></h1><p>${sub}</p></div></body></html>`;
const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await br.newPage({ viewport: { width: 1024, height: 500 } });
for (const lang of ["ro", "en"]) {
  await page.setContent(html(T[lang]), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${D}feature-graphic-${lang}.png` });
}
await br.close();
