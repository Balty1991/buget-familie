import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Pluginul Capacitor (`registerPlugin`) e un Proxy care răspunde la orice nume, și la „then”.
 * Întors dintr-o funcție async sau dintr-un `.then(...)`, `await` îl ia drept promisiune și cheamă
 * metoda nativă „then”, care nu răspunde niciodată: așa a rămas „Se salvează…” pe ecran (1.1.192).
 * Sunt voie doar: apelul direct al unei metode sau cutia `{ api: … }`. O variabilă cu pluginul gol e
 * tocmai ce s-a întors din funcția async care se agăța, așa că nici ea nu trece.
 */
describe("pluginurile native nu ajung în promisiuni", () => {
  it("registerPlugin e folosit doar în forme sigure", () => {
    const src = fileURLToPath(new URL("..", import.meta.url));
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
      }
    };
    walk(src);
    const unsafe: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/registerPlugin\b/g)) {
        const before = text.slice(Math.max(0, match.index - 40), match.index);
        const after = text.slice(match.index, match.index + 120);
        if (/\{\s*(?:[\w,\s]*,\s*)?$/.test(before) && /^registerPlugin\s*[,}]/.test(after)) continue; // import / destructurare
        if (/^registerPlugin<[^>]+>\("[^"]+"\)\.\w+\(/.test(after)) continue; // apel direct
        if (/api:\s*$/.test(before)) continue; // în cutie
        unsafe.push(`${relative(src, file)}: …${before.slice(-30)}${after.slice(0, 50)}…`);
      }
    }
    expect(unsafe).toEqual([]);
  });
});
