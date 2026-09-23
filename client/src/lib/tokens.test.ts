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
    expect(imports.at(-6)).toBe("tokens.css");
    expect(imports.at(-5)).toBe("today.css");
    expect(imports.at(-4)).toBe("movements.css");
    expect(imports.at(-3)).toBe("plan.css");
    expect(imports.at(-2)).toBe("obligations.css");
    expect(imports.at(-1)).toBe("analysis.css");
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

describe("ecranul Mișcări", () => {
  const css = read("movements.css");

  it("ridică etichetele și sumele, fără să atingă butonul plus", () => {
    expect(css).toContain("--bf-text-min");
    expect(css).toContain("--bf-text-money");
    expect(css).toContain("--bf-hit");
    expect(css).toContain(".bf-movement-actions button");
    expect(css).not.toContain(".bf-movement-add");
    expect(css).not.toMatch(/position:\s*sticky/);
  });
});

describe("ecranul Plan", () => {
  const css = read("plan.css");

  it("ridică etichetele și sumele mici, fără să micșoreze cifra mare", () => {
    expect(css).toContain("--bf-text-min");
    expect(css).toContain("--bf-text-money");
    expect(css).toContain("--bf-hit");
    expect(css).toContain(".bf-plan-header-stat small");
    expect(css).not.toContain(".bf-plan-header-stat b");
    expect(css).not.toContain(".bf-plan-resource-band strong");
    expect(css).not.toContain(".bf-envelope-seal");
    expect(css).not.toMatch(/position:\s*sticky/);
  });
});

describe("ecranul Obligații", () => {
  const css = read("obligations.css");

  it("ridică etichetele și ratele, fără să micșoreze soldul mare", () => {
    expect(css).toContain("--bf-text-min");
    expect(css).toContain("--bf-text-money");
    expect(css).toContain("--bf-hit");
    expect(css).toContain(".bf-goals-link");
    expect(css).not.toContain(".bf-obligation-ledger article b");
    expect(css).not.toContain(".bf-debt-plan-total strong");
    expect(css).not.toContain(".bf-debt-simulator-result strong");
    expect(css).not.toContain(".bf-snowball-next strong");
    expect(css).not.toMatch(/position:\s*sticky/);
  });
});

describe("ecranul Analiză", () => {
  const css = read("analysis.css");

  it("ridică etichetele, fără să lățească lunile din grafic sau cifra mare", () => {
    expect(css).toContain("--bf-text-min");
    expect(css).toContain("--bf-text-money");
    expect(css).toContain("--bf-hit");
    expect(css).toContain(".bf-analysis-snapshot-stats small");
    expect(css).not.toContain(".bf-analysis-snapshot-stats b");
    expect(css).not.toContain(".bf-analysis-month-heading");
    expect(css).not.toContain(".bf-spend-donut b");
    expect(css).not.toMatch(/min-width:\s*var\(--bf-hit/);
    expect(css).not.toMatch(/position:\s*sticky/);
  });
});
