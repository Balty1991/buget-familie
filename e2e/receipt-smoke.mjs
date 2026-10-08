/**
 * Scanarea bonului pe funcția publicată: trimite pozele din e2e/receipts (așa cum le
 * face omul) și verifică totalul, suma articolelor și câteva categorii știute.
 * Rulează după publicarea funcțiilor; tipărește tot ce a citit modelul.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const config = readFileSync(join(root, "client/src/lib/firebase-config.ts"), "utf8");
const apiKey = /apiKey:\s*"([^"]+)"/.exec(config)?.[1];
const project = process.env.FIREBASE_PROJECT_ID || "buget-familie-a6a0d";
const region = process.env.FUNCTIONS_REGION || "europe-central2";
const origin = "https://balty1991.github.io";
const categories = ["Alimente", "Consumabile copil", "Abonamente", "Băuturi", "Apă", "Dulciuri", "Transport", "Casă & facturi", "Sănătate", "Educație", "Timp liber", "Haine", "SGR", "Sacoșe", "Altele"];

/** Ce trebuie să iasă, pe lângă total: un fragment din nume → categoria lui. */
const expectations = {
  "vodka-39.76.jpg": [[/vodc|vodk|stalinsk/i, "Băuturi"], [/kinder/i, "Dulciuri"], [/sacos|sacoș/i, "Sacoșe"], [/garan/i, "SGR"]],
  "crumpled-44.58.jpg": [[/milka/i, "Dulciuri"], [/salam|crenv/i, "Alimente"], [/garan/i, "SGR"], [/sacos|sacoș/i, "Sacoșe"]],
  "familia-57.30.jpg": [[/perla|harghit/i, "Apă"], [/garan/i, "SGR"], [/p[aâ]ine/i, "Alimente"], [/sacos|sacoș/i, "Sacoșe"]],
  "sinsay-50.97.jpg": [[/ciorap/i, "Haine"], [/teni/i, "Haine"], [/pung/i, "Sacoșe"]],
};

const signUp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: "POST",
  headers: { "content-type": "application/json", referer: `${origin}/` },
  body: JSON.stringify({ returnSecureToken: true }),
});
const { idToken } = await signUp.json();
if (!idToken) throw new Error(`Fără identitate anonimă (HTTP ${signUp.status})`);

let failures = 0;
const providers = (process.env.RECEIPT_PROVIDERS || "gemini").split(",").map((name) => name.trim()).filter(Boolean);
/** Doar furnizorul principal oprește publicarea; ceilalți se compară, fără să o blocheze. */
const primary = process.env.RECEIPT_PRIMARY || providers[0];
const summary = [];
const dir = join(root, "e2e/receipts");
for (const file of readdirSync(dir).filter((name) => name.endsWith(".jpg")).sort()) {
  const expectedTotal = Number(/-(\d+\.\d+)\.jpg$/.exec(file)?.[1]);
  const image = readFileSync(join(dir, file)).toString("base64");
  for (const provider of providers) {
    const started = Date.now();
    const response = await fetch(`https://${region}-${project}.cloudfunctions.net/readReceipt`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ image, mimeType: "image/jpeg", categories, provider }),
    });
    const body = await response.json().catch(() => ({}));
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n=== ${file} · ${provider} · HTTP ${response.status} · ${seconds} s`);
    if (body.code === "receipt_key") {
      console.log(`(${provider}: fără cheie configurată)`);
      summary.push(`${file} · ${provider}: fără cheie`);
      continue;
    }
    const fatal = provider === primary;
    if (!response.ok || !body.receipt) {
      console.log(JSON.stringify(body));
      summary.push(`${file} · ${provider}: eroare ${response.status}`);
      if (fatal) failures++;
      continue;
    }
    const { receipt } = body;
    const sum = Math.round(receipt.items.reduce((total, item) => total + item.amount, 0) * 100) / 100;
    console.log(`model: ${receipt.model || "?"} · magazin: ${receipt.store} · data: ${receipt.date} · total: ${receipt.total} · articole: ${sum} · încredere: ${receipt.confidence}`);
    console.log(`încercări: ${receipt.trail || "?"}`);
    console.log(`plăți: ${receipt.payments.map((payment) => `${payment.method} ${payment.amount}`).join(", ")}`);
    for (const item of receipt.items) console.log(`  ${item.amount.toFixed(2).padStart(7)}  ${item.discount ? `(−${item.discount}) ` : ""}${item.name} [${item.category}] ← ${item.rawName}`);
    const problems = [];
    if (Math.abs(receipt.total - expectedTotal) > 0.009) problems.push(`totalul ${receipt.total}, așteptat ${expectedTotal}`);
    if (Math.abs(sum - expectedTotal) > 0.05) problems.push(`articolele fac ${sum}, așteptat ${expectedTotal}`);
    for (const [pattern, category] of expectations[file] || []) {
      const item = receipt.items.find((entry) => pattern.test(`${entry.name} ${entry.rawName}`));
      if (!item) problems.push(`lipsește ${pattern}`);
      else if (item.category !== category) problems.push(`${item.name} la ${item.category}, nu la ${category}`);
    }
    if (Number(seconds) > 30) problems.push(`prea lent: ${seconds} s`);
    if (problems.length) {
      if (fatal) failures++;
      console.log(`✗ ${problems.join("; ")}`);
      summary.push(`${file} · ${provider}: ✗ ${seconds} s · ${problems.join("; ")}`);
    } else {
      console.log("✓ citit corect");
      summary.push(`${file} · ${provider}: ✓ ${seconds} s`);
    }
  }
}
console.log(`\n--- Rezumat ---\n${summary.join("\n")}`);
if (failures) {
  console.error(`\n${failures} bonuri nu au ieșit cum trebuie.`);
  process.exit(1);
}
console.log("\nToate bonurile au ieșit corect.");
