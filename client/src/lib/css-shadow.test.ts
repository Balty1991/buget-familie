import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

/**
 * Declarații umbrite: aceeași regulă (selector identic), aceeași proprietate, în același context
 * (@media/@supports/@layer), într-un grup de foi care se încarcă mereu împreună. Câștigă ultima
 * declarație !important, altfel ultima; celelalte nu se văd niciodată. Pe 03.10 au ieșit 556 (≈19 KB),
 * cu stilul calculat identic pe 163 de ecrane; testul ține ca ele să nu se adune din nou.
 * Grupuri: foile din main.tsx; cele amânate (deferred-styles.ts, vin la secunde după prima pictare,
 * deci nu umbresc main până atunci); restul, fiecare singură (se încarcă odată cu ecranul lor).
 */
describe("CSS fără declarații umbrite", () => {
  it("nicio declarație nu e acoperită de una identică, mai târziu în același grup", () => {
    const src = fileURLToPath(new URL("..", import.meta.url));
    const imports = (file: string) => Array.from(readFileSync(join(src, file), "utf8").matchAll(/^import "\.\/([^"]+\.css)";/gm)).map((m) => m[1]);
    const main = imports("main.tsx");
    const deferred = imports("deferred-styles.ts").filter((f) => !main.includes(f));
    const all = (readdirSync(src, { recursive: true }) as string[]).map(String).filter((f) => f.endsWith(".css"));
    const groups = [main, deferred, ...all.filter((f) => !main.includes(f) && !deferred.includes(f)).map((f) => [f])];
    const norm = (sel: string) => sel.split(",").map((s) => s.replace(/\s+/g, " ").replace(/\s*([>+~])\s*/g, "$1").trim()).join(",");
    const ctxOf = (node: postcss.Node) => { const parts: string[] = []; for (let p = node.parent; p && p.type !== "root"; p = p.parent) { if (p.type === "atrule") parts.unshift(`@${(p as postcss.AtRule).name} ${(p as postcss.AtRule).params.replace(/\s+/g, " ")}`); else if (p.type === "rule") parts.unshift(norm((p as postcss.Rule).selector)); } return parts.join(" | "); };
    const shadowed: string[] = [];
    for (const group of groups) {
      const decls: Array<{ file: string; d: postcss.Declaration; key: string }> = [];
      for (const file of group) postcss.parse(readFileSync(join(src, file), "utf8")).walkDecls((d) => {
        if (d.parent?.type !== "rule" || d.prop.startsWith("--")) return;
        decls.push({ file, d, key: `${ctxOf(d.parent)} || ${norm((d.parent as postcss.Rule).selector)} || ${d.prop.toLowerCase()}` });
      });
      const win = new Map<string, (typeof decls)[number]>();
      for (const x of decls) { const cur = win.get(x.key); if (!cur || x.d.important || !cur.d.important) win.set(x.key, x); }
      for (const x of decls) {
        const w = win.get(x.key)!;
        // În aceeași regulă, dublurile pot fi rezerve pentru alte browsere.
        if (w !== x && w.d.parent !== x.d.parent) shadowed.push(`${x.file}:${x.d.source?.start?.line} ${x.key} → ${w.file}:${w.d.source?.start?.line}`);
      }
    }
    expect(shadowed.slice(0, 10), `${shadowed.length} declarații umbrite`).toEqual([]);
  });
});
