/**
 * Traducerile se scriu pe măsură ce se scrie interfața, nu într-o campanie la
 * final. Testul citește codul și cere ca fiecare text trecut prin `t()` să aibă
 * o intrare în dicționar — altfel o funcție nouă ajunge în engleză cu jumătate
 * de ecran în românește, iar nimeni nu observă până nu schimbă cineva limba.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("..", import.meta.url));

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const sourceFiles = walk(SRC).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
const dictionary = readFileSync(join(SRC, "lib/i18n.ts"), "utf8");
const keys = new Set(Array.from(dictionary.matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*"/gm)).map((match) => match[1]));

describe("acoperirea traducerilor", () => {
  it("fiecare text trecut prin t() are o traducere în engleză", () => {
    const missing: string[] = [];
    for (const file of sourceFiles) {
      const code = readFileSync(file, "utf8");
      for (const match of code.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
        if (!keys.has(match[1])) missing.push(`${file.replace(SRC, "")}: ${match[1].slice(0, 70)}`);
      }
    }
    expect(missing, `Texte fără traducere:\n${missing.join("\n")}`).toEqual([]);
  });

  it("dicționarul nu are chei goale sau netraduse", () => {
    const empty = Array.from(dictionary.matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*""/gm)).map((match) => match[1]);
    expect(empty).toEqual([]);
  });

  it("substituțiile din traducere le oglindesc pe cele din original", () => {
    // „{amount}” din textul românesc trebuie să existe și în engleză, altfel
    // suma dispare din propoziție fără niciun semn.
    const broken: string[] = [];
    for (const match of dictionary.matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"/gm)) {
      const [, source, target] = match;
      const holes = (text: string) => Array.from(text.matchAll(/\{(\w+)\}/g)).map((item) => item[1]).sort();
      const from = holes(source);
      const to = holes(target);
      if (from.join(",") !== to.join(",")) broken.push(`${source.slice(0, 60)} → ${target.slice(0, 60)}`);
    }
    expect(broken, `Substituții nepotrivite:\n${broken.join("\n")}`).toEqual([]);
  });
});
