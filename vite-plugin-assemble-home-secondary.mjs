/**
 * Asamblează client/src/pages/home-secondary.tsx din părțile din
 * client/src/pages/home-secondary.parts/*.txt (ordonate).
 * Necesar după un push MCP care nu poate urca fișierul monolit (~170KB).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const page = path.resolve(root, "../client/src/pages/home-secondary.tsx");
const partsDir = path.resolve(root, "../client/src/pages/home-secondary.parts");

function assemble() {
  if (!fs.existsSync(partsDir)) return null;
  const files = fs.readdirSync(partsDir).filter((f) => f.endsWith(".txt")).sort();
  if (!files.length) return null;
  return files.map((f) => fs.readFileSync(path.join(partsDir, f), "utf8")).join("");
}

export default function assembleHomeSecondary() {
  return {
    name: "assemble-home-secondary",
    enforce: "pre",
    load(id) {
      const normalized = id.split("?")[0];
      if (normalized !== page && !normalized.endsWith("/pages/home-secondary.tsx")) return null;
      const code = assemble();
      return code;
    },
  };
}
