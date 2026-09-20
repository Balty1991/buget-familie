/**
 * Asamblează home-secondary.tsx:
 * 1) din părți .b64 locale (dacă sunt complete)
 * 2) altfel descarcă de pe GitHub commit-ul bun + patch Descărcări
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const page = path.resolve(root, "client/src/pages/home-secondary.tsx");
const partsDir = path.resolve(root, "client/src/pages/home-secondary.parts");
const GOOD_COMMIT = "f454d90c720ae8afb42d19bc4a34f607bd50ec1b";
const RAW_URL = `https://raw.githubusercontent.com/Balty1991/buget-familie/${GOOD_COMMIT}/client/src/pages/home-secondary.tsx`;

const PATCHES = [
  [
    "„Salvează pe telefon” scrie fișierul în Documents, fără să deschidă nimic altceva. „Trimite o copie” deschide lista de aplicații, pentru Drive, WhatsApp sau alt telefon.",
    "„Salvează pe telefon” scrie fișierul în Descărcări, fără să deschidă nimic altceva. „Trimite o copie” deschide lista de aplicații, pentru Drive, WhatsApp sau alt telefon.",
  ],
  [
    "Telefonul nu a permis scrierea în Documents, așa că am deschis lista de aplicații. Alege Fișiere, Drive sau altă destinație.",
    "Telefonul nu a permis scrierea în Descărcări, așa că am deschis lista de aplicații. Alege Fișiere, Drive sau altă destinație.",
  ],
];

function fromParts() {
  if (!fs.existsSync(partsDir)) return null;
  const files = fs.readdirSync(partsDir).filter((f) => f.endsWith(".b64")).sort();
  if (files.length < 2) return null;
  try {
    const b64 = files.map((f) => fs.readFileSync(path.join(partsDir, f), "utf8").trim()).join("");
    const text = Buffer.from(b64, "base64").toString("utf8");
    if (!text.includes("function SettingsPanel") && !text.includes("SettingsPanel")) return null;
    if (text.length < 50000) return null;
    return text;
  } catch {
    return null;
  }
}

function applyPatches(text) {
  let out = text;
  for (const [a, b] of PATCHES) out = out.split(a).join(b);
  return out;
}

async function fromGithub() {
  const res = await fetch(RAW_URL);
  if (!res.ok) throw new Error(`Nu am putut descărca home-secondary (${res.status})`);
  return applyPatches(await res.text());
}

export default function assembleHomeSecondary() {
  return {
    name: "assemble-home-secondary",
    enforce: "pre",
    async load(id) {
      const normalized = id.split("?")[0];
      if (normalized !== page && !normalized.endsWith("/pages/home-secondary.tsx") && !normalized.endsWith("\\pages\\home-secondary.tsx")) {
        return null;
      }
      const local = fromParts();
      if (local) return local;
      return await fromGithub();
    },
  };
}
