import { describe, expect, it } from "vitest";
import { USAGE_GLOSSARY, USAGE_LESSONS, USAGE_TUTORIAL_EVENT } from "./usage-tutorial";

describe("tutorial de folosire", () => {
  it("are șase lecții cu id-uri unice, un gest concret și un salt către ecran", () => {
    expect(USAGE_LESSONS.map((item) => item.id)).toEqual(["today", "capture", "envelopes", "review", "family", "guide"]);
    expect(new Set(USAGE_LESSONS.map((item) => item.id)).size).toBe(USAGE_LESSONS.length);
    expect(USAGE_LESSONS.every((item) => item.title && item.how && item.nav && item.paragraphs.length >= 1)).toBe(true);
    expect(USAGE_LESSONS.every((item) => item.action)).toBe(true);
    expect(USAGE_LESSONS.at(-1)?.action?.go).toBe("ghid");
  });

  it("glosarul acoperă plicul, reperul și „în afara plicurilor”", () => {
    const terms = USAGE_GLOSSARY.map((item) => item.term);
    expect(terms).toEqual(expect.arrayContaining(["Plic", "Reper", "Sursă", "Ciclu", "În afara plicurilor"]));
  });

  it("evenimentul de deschidere e stabil, ca butoanele din Astăzi să-l găsească", () => {
    expect(USAGE_TUTORIAL_EVENT).toBe("buget-familie:open-usage-tutorial");
  });
});
