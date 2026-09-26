import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");

describe("tokenii de temă", () => {
  const css = read("tokens.css");

  it("ține cele trei teme și scara de text", () => {
    for (const theme of ["theme-white", "theme-dark", "theme-navy"]) {
      expect(css).toContain(theme);
    }
    // Aurora și Cyber au fost scoase (se convertesc la Navy și Întunecat la pornire).
    expect(css).not.toContain("theme-aurora");
    expect(css).not.toContain("theme-cyber");
    expect(css).toContain("--bf-text-min: 12px");
    expect(css).toContain("--bf-hit: 44px");
    expect(css).toContain("--cf-primary: #176b54");
  });

  it("nu mai definește paletele și în foaia veche de teme", () => {
    const legacy = read("ui-themes-modern-2026.css");
    expect(legacy).not.toContain("--os-mint:#7cffc4!important");
    expect(legacy).not.toContain("--os-mint:#176b54!important");
    expect(legacy).toContain("tokens.css");
  });

  it("câștigă la finalul foilor amânate", () => {
    const deferred = read("deferred-styles.ts");
    const imports = [...deferred.matchAll(/import "\.\/([^"]+)";/g)].map((match) => match[1]);
    expect(imports.at(-7)).toBe("tokens.css");
    expect(imports.at(-6)).toBe("today.css");
    expect(imports.at(-5)).toBe("movements.css");
    expect(imports.at(-4)).toBe("plan.css");
    expect(imports.at(-3)).toBe("obligations.css");
    expect(imports.at(-2)).toBe("analysis.css");
    expect(imports.at(-1)).toBe("design-system-37.css");
  });
});

describe("plafonul de !important", () => {
  it("nu crește peste valoarea din re-audit", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
      }
      return out;
    };
    const count = walk(root)
      .filter((file) => file.endsWith(".css"))
      .reduce((sum, file) => sum + (readFileSync(file, "utf8").split("!important").length - 1), 0);
    // 8.344 la re-audit → 5.410 (curățenie verificată) → 3.819 (reguli moarte) → 3.426 (a doua rundă) → 3442 (ținte de atingere în @layer ds) → 3446 (eticheta de pe bannerul scadențelor, opacitatea etichetelor și a „RON”, descrierea temelor) → 3448 (codul de recuperare) → 3369 (reguli cu clase inexistente în cod) → 3364 (declarații umbrite în același fișier) → 3320 (temele Aurora și Cyber, trei texturi); vezi docs/CSS_IMPORTANT_CLEANUP.md.
    // Curățenia poate scădea numărul; o foaie nouă nu are voie să-l urce.
    expect(count).toBeLessThanOrEqual(3320);
  });
});

describe("ecranul Astăzi", () => {
  const css = read("today.css");

  it("nu lipește Notează și nu fixează zilele la 44px lățime", () => {
    expect(css).toContain("position: static");
    expect(css).not.toMatch(/position:\s*sticky/);
    expect(css).not.toMatch(/min-width:\s*44px/);
    expect(css).toContain("repeat(var(--bf-rhythm-days, 7), minmax(0, 1fr))");
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
