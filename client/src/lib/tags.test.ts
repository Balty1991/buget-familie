import { describe, expect, it } from "vitest";
import { createEmptyAppData, normalizeAppData, type Transaction } from "./finance-data";
import { knownTags, suggestTag, tagTotals } from "./tags";

const tx = (id: string, title: string, amount: number, date: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, title, amount, kind: "expense", category: "Alimente", source: "Card", person: "Eu", date, sourceId: "source-debit", ...extra });

describe("etichetele", () => {
  const data = () => {
    const value = createEmptyAppData();
    value.transactions = [
      tx("a", "Shaorma birou", 28, "2026-10-06", { tag: "Serviciu", createdAt: "2026-10-06T12:00:00Z" }),
      tx("b", "Cafea automat", 6, "2026-10-07", { tag: "Serviciu", category: "Băuturi" }),
      tx("c", "Lidl", 120, "2026-10-07"),
      tx("d", "Pampers", 60, "2026-10-08", { tag: "Copil", category: "Consumabile copil" }),
      tx("e", "Corecție", 50, "2026-10-08", { tag: "Serviciu", adjustment: true }),
      tx("f", "Shaorma birou", 30, "2026-09-20", { tag: "Serviciu" }),
    ];
    return value;
  };

  it("totalurile pe etichetă, fără corecțiile de sold, cu categoriile dinăuntru", () => {
    const rows = tagTotals(data(), "2026-10-01", "2026-10-31");
    expect(rows.map((row) => [row.tag, row.total, row.count])).toEqual([["Copil", 60, 1], ["Serviciu", 34, 2]]);
    expect(rows[1].categories).toEqual([["Alimente", 28], ["Băuturi", 6]]);
  });

  it("aceeași denumire primește eticheta de data trecută", () => {
    expect(suggestTag(data(), "shaorma BIROU ")).toBe("Serviciu");
    expect(suggestTag(data(), "Lidl")).toBeUndefined();
  });

  it("propune întâi etichetele folosite, apoi pe cele obișnuite, fără dubluri", () => {
    expect(knownTags(data())).toEqual(["Serviciu", "Copil", "Casă", "Mașină"]);
  });

  it("se păstrează la salvare și sincronizare, curățată", () => {
    const value = data();
    value.transactions[2] = { ...value.transactions[2], tag: "  Mașină   mare  " };
    const again = normalizeAppData(JSON.parse(JSON.stringify(value)));
    expect(again.transactions.find((item) => item.id === "c")?.tag).toBe("Mașină mare");
    expect(again.transactions.find((item) => item.id === "a")?.tag).toBe("Serviciu");
  });
});
