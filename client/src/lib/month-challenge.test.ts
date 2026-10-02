import { describe, expect, it } from "vitest";
import { challengeProgress, readChallenge, saveChallenge, suggestChallenge } from "./month-challenge";

const tx = (date: string, category: string, amount: number, kind = "expense") => ({ date, category, amount, kind });

describe("provocarea lunii", () => {
  it("propune categoria flexibilă cea mai mare de luna trecută, cu 10% mai puțin, rotunjit la 50", () => {
    const items = [tx("2026-09-03", "Timp liber", 300), tx("2026-09-20", "Timp liber", 220), tx("2026-09-10", "Casă & facturi", 1800), tx("2026-09-12", "Transport", 250)];
    expect(suggestChallenge(items, "2026-10-02")).toEqual({ month: "2026-10", category: "Timp liber", target: 450, last: 520 });
  });

  it("nu propune rate, facturi sau sume mici", () => {
    expect(suggestChallenge([tx("2026-09-10", "Credite", 1100), tx("2026-09-11", "Dulciuri", 120)], "2026-10-02")).toBeUndefined();
  });

  it("arată unde ajunge luna la ritmul de acum", () => {
    const challenge = { month: "2026-10", category: "Timp liber", target: 450, last: 520 };
    const items = [tx("2026-10-02", "Timp liber", 100), tx("2026-10-05", "Timp liber", 50), tx("2026-10-04", "Alimente", 400)];
    const now = challengeProgress(items, challenge, "2026-10-10");
    expect(now.spent).toBe(150);
    expect(now.projected).toBe(465); // 150 / 10 × 31
    expect(now.state).toBe("watch");
    expect(now.done).toBe(false);
    expect(challengeProgress(items, challenge, "2026-11-01")).toMatchObject({ state: "good", done: true });
  });

  it("ține alegerea pe telefon: acceptată sau refuzată", () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    expect(readChallenge(storage, "2026-10")).toBeUndefined();
    saveChallenge(storage, "2026-10", "skip");
    expect(readChallenge(storage, "2026-10")).toBe("skip");
    saveChallenge(storage, "2026-11", { month: "2026-11", category: "Alimente", target: 1500, last: 1700 });
    expect(readChallenge(storage, "2026-11")).toMatchObject({ category: "Alimente", target: 1500 });
  });
});

describe("provocarea lunii și categoriile proprii", () => {
  it("nu propune o categorie proprie: poate fi o plată fixă, ca grădinița", () => {
    expect(suggestChallenge([tx("2026-09-08", "Copii", 450), tx("2026-09-09", "Alimente", 300)], "2026-10-02")?.category).toBe("Alimente");
  });
});

describe("provocarea lunii în primele zile", () => {
  it("nu proiectează luna din primele 6 zile", () => {
    const challenge = { month: "2026-10", category: "Alimente", target: 350, last: 400 };
    const now = challengeProgress([tx("2026-10-01", "Alimente", 200)], challenge, "2026-10-01");
    expect(now.early).toBe(true);
    expect(now.state).toBe("good");
    expect(now.projected).toBe(200);
  });
});
