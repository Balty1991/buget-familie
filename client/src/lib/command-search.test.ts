
import { describe, expect, it } from "vitest";
import { matchCommandQuery, recentLedger, searchLedgerHits, takeJournalQuery, writeJournalQuery } from "./command-search";

describe("căutarea din bara de sus", () => {
  it("găsește mișcări fără diacritice", () => {
    const hits = searchLedgerHits([
      { id: "1", title: "Kaufland Piață", category: "Alimente", person: "Eu", amount: 120 },
      { id: "2", title: "Netflix", category: "Abonamente", amount: 55 },
    ], "kaufland");
    expect(hits.map((item) => item.id)).toEqual(["1"]);
  });

  it("ia cele mai noi mișcări, fără să schimbe lista", () => {
    const items = [
      { id: "old", title: "Lidl", category: "Alimente", amount: 10, date: "2026-09-01" },
      { id: "mid", title: "Mega", category: "Alimente", amount: 15, date: "2026-09-04" },
      { id: "new", title: "Kaufland", category: "Alimente", amount: 20, date: "2026-09-08" },
    ];
    expect(recentLedger(items, 2).map((item) => item.id)).toEqual(["new", "mid"]);
    expect(items.map((item) => item.id)).toEqual(["old", "mid", "new"]);
  });

  it("fără interogare nu pretinde rezultate din registru", () => {
    expect(searchLedgerHits([{ id: "1", title: "Lidl", category: "Alimente", amount: 40 }], "")).toEqual([]);
  });

  it("potrivește diacritice pliate", () => {
    expect(matchCommandQuery("Înregistrează o mișcare", "miscare")).toBe(true);
  });

  it("păstrează interogarea pentru registru o singură dată", () => {
    const store: Record<string, string> = {};
    const storage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    };
    writeJournalQuery(storage, "lidl");
    expect(takeJournalQuery(storage)).toBe("lidl");
    expect(takeJournalQuery(storage)).toBe("");
  });
});
