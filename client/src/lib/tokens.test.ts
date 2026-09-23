import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");

describe("tokenii de temă", () => {
  const css = read("tokens.css");

  it("ține cele cinci teme și scara de text", () => {
    for (const theme of ["theme-white", "theme-dark", "theme-aurora", "theme-navy", "theme-cyber"]) {
      expect(css).toContain(theme);
    }
    expect(css).toContain("--bf-text-min: 12px");
    expect(css).toContain("--bf-hit: 44px");
    expect(css).toContain("--cf-primary: #176b54");
    expect(css).toContain("--cf-primary: #7cffc4");
  });

  it("nu mai definește paletele și în foaia veche de teme", () => {
    const legacy = read("ui-themes-modern-2026.css");
    expect(legacy).not.toContain("--os-mint:#7cffc4!important");
    expect(legacy).not.toContain("--os-mint:#176b54!important");
    expect(css).toContain("--os-mint: #7cffc4");
    expect(legacy).toContain("tokens.css");
  });

  it("câștigă la finalul foilor amânate", () => {
    const deferred = read("deferred-styles.ts");
    const imports = [...deferred.matchAll(/import "\.\/([^"]+)";/g)].map((match) => match[1]);
    expect(imports.at(-2)).toBe("tokens.css");
    expect(imports.at(-1)).toBe("today.css");
  });
});

describe("ecranul Astăzi", () => {
  const css = read("today.css");

  it("nu lipește Notează și nu fixează zilele la 44px lățime", () => {
    expect(css).toContain("position: static");
    expect(css).not.toMatch(/position:\s*sticky/);
    expect(css).not.toMatch(/min-width:\s*44px/);
    expect(css).toContain("repeat(7, minmax(0, 1fr))");
    expect(css).toContain("--bf-text-min");
  });
});
