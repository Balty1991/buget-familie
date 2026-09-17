/**
 * Foaia critică din `index.html` pictează primul ecran înainte să ajungă CSS-ul aplicației.
 * Fiindcă regulile ei sunt `!important`, o culoare fixă scrisă pentru tema deschisă rămâne
 * peste temele de noapte pentru totdeauna: exact așa a ajuns ecranul de start cu titlu negru
 * pe negru și carduri albe cu text alb pe Aurora, Navy, Întunecat și Cyber.
 *
 * Testul cere ca regulile care ating text sau suprafețe să treacă prin tokenul temei
 * (`var(--cf-…)`), cu o variantă de boot drept rezervă.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const html = readFileSync(fileURLToPath(new URL("../../index.html", import.meta.url)), "utf8");
const criticalCss = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

/** Regulile de chrome care se văd și după ce tema e aplicată. */
const THEMED_RULES = [".os-start-title", ".os-start-steps button", ".os-hero", ".bf-first-run h2", ".bf-setup-copy p"];

/** Împărțim foaia în reguli ca să prindem și selectorii scriși în listă. */
const rules = criticalCss
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("}")
  .map((chunk) => {
    const [selectors, body] = chunk.split("{");
    return { selectors: (selectors || "").split(",").map((item) => item.trim()), body: body || "" };
  });

const ruleBody = (selector: string) => rules.filter((rule) => rule.selectors.includes(selector)).map((rule) => rule.body).join(";");

describe("CSS-ul critic din index.html", () => {
  it("nu fixează culori de temă deschisă pe blocurile care rămân vizibile", () => {
    const offenders: string[] = [];
    for (const selector of THEMED_RULES) {
      const body = ruleBody(selector);
      expect(body, `regula ${selector} lipsește din foaia critică`).not.toEqual("");
      for (const match of body.matchAll(/(color|background|background-color|box-shadow)\s*:\s*([^;]+);/g)) {
        const [, property, value] = match;
        const hasLiteralColor = /#[0-9a-f]{3,8}\b|rgba?\(/i.test(value);
        const throughToken = value.includes("var(--cf-");
        if (hasLiteralColor && !throughToken) offenders.push(`${selector} → ${property}: ${value.trim()}`);
      }
    }
    expect(offenders, `Culori fixe în foaia critică:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("definește tokenii de boot și varianta lor de noapte", () => {
    expect(criticalCss).toMatch(/--boot-ink:/);
    expect(criticalCss).toMatch(/--boot-surface:/);
    const darkBlock = criticalCss.slice(criticalCss.indexOf("html.dark {"), criticalCss.indexOf("}", criticalCss.indexOf("html.dark {")));
    for (const token of ["--boot-ink", "--boot-muted", "--boot-surface", "--boot-card", "--boot-line"]) {
      expect(darkBlock, `lipsește ${token} din varianta de noapte`).toContain(token);
    }
  });
});
