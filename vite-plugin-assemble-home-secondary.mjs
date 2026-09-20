/**
 * Asamblează home-secondary.tsx din părți base64 (MCP-safe) din
 * client/src/pages/home-secondary.parts/*.b64
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const page = path.resolve(root, "../client/src/pages/home-secondary.tsx");
const partsDir = path.resolve(root, "../client/src/pages/home-secondary.parts");

function assemble() {
  if (!fs.existsSync(partsDir)) return null;
  const files = fs.readdirSync(partsDir).filter((f) => f.endsWith(".b64")).sort();
  if (!files.length) return null;
  const b64 = files.map((f) => fs.readFileSync(path.join(partsDir, f), "utf8").trim()).join("");
  return Buffer.from(b64, "base64").toString("utf8");
}

export default function assembleHomeSecondary() {
  return {
    name: "assemble-home-secondary",
    enforce: "pre",
    load(id) {
      const normalized = id.split("?")[0];
      if (normalized !== page && !normalized.endsWith("/pages/home-secondary.tsx")) return null;
      return assemble();
    },
  };
}
