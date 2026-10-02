import { describe, expect, it } from "vitest";
import { buildDemoData } from "./demo-data";
import { dayGreeting, helloFor } from "./day-greeting";

describe("salutul zilei", () => {
  it("salută după oră", () => {
    expect(helloFor(7)).toBe("Bună dimineața");
    expect(helloFor(13)).toBe("Bună ziua");
    expect(helloFor(20)).toBe("Bună seara");
    expect(helloFor(2)).toBe("Noapte bună");
  });

  it("pe nume, cu fraza cea mai potrivită", () => {
    const data = buildDemoData("2026-10-02");
    const now = dayGreeting(data, "2026-10-02", 8);
    expect(now.hello).toBe("Bună dimineața, Andrei");
    expect(now.line.length).toBeGreaterThan(10);
    expect(dayGreeting(data, "2026-10-18", 8).line).toBe("Azi vine salariul. Plicurile se umplu din nou.");
    expect(dayGreeting(data, "2026-10-15", 8).line).toBe("Mai sunt 3 zile până la salariu.");
    data.settings.trip = { id: "t", name: "Mare", budget: 1000, start: "2026-10-01", end: "2026-10-05", updatedAt: "2026-09-01T00:00:00.000Z" };
    expect(dayGreeting(data, "2026-10-02", 8).line).toMatch(/^Vacanță plăcută! Mai aveți 1\.000\sRON din bugetul ei\.$/);
  });
});
