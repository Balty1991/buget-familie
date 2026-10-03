import { describe, expect, it } from "vitest";
import { createEmptyAppData, normalizeAppData, type Transaction } from "./finance-data";
import { mergeAssets, normalizeAssets } from "./asset-data";
import { netWorth } from "./net-worth";

const tx = (id: string, date: string, amount: number, kind: "income" | "expense", extra: Partial<Transaction> = {}) => ({ id, date, amount, kind, title: id, category: "Altele", sourceId: "card", source: "Card", person: "A", ...extra }) as Transaction;

describe("averea familiei", () => {
  const data = () => {
    const d = createEmptyAppData();
    d.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", openingBalance: 1000 }];
    d.settings.assets = [{ id: "car", name: "Mașina", kind: "car", value: 30000, updatedAt: "2026-09-01T00:00:00.000Z" }, { id: "old", name: "Vechi", kind: "other", value: 999, updatedAt: "2026-09-01T00:00:00.000Z", deleted: true }];
    d.debts = [{ id: "d", name: "Credit", remaining: 9000, monthly: 500, due: "", tone: "coral" }];
    d.transactions = [tx("sal", "2026-08-10", 6000, "income"), tx("rata", "2026-09-15", 500, "expense", { debtId: "d" }), tx("chirie", "2026-09-20", 2000, "expense")];
    return d;
  };

  it("adună sursele și bunurile, scade datoriile; bunurile șterse nu intră", () => {
    const worth = netWorth(data(), "2026-10-03");
    expect(worth).toMatchObject({ cash: 4500, assets: 30000, debts: 9000, net: 25500 });
    expect(worth.liveAssets.map((item) => item.id)).toEqual(["car"]);
  });

  it("reface istoricul din mișcări: soldul de atunci și datoria de atunci", () => {
    const worth = netWorth(data(), "2026-10-03");
    const august = worth.history.find((point) => point.key === "2026-08")!;
    // La 31 august: 7000 pe card, mașina 30.000, datoria 9500 (rata din septembrie încă neplătită).
    expect(august.net).toBe(7000 + 30000 - 9500);
    const july = worth.history.find((point) => point.key === "2026-07")!;
    expect(july.net).toBe(1000 + 30000 - 9500);
    expect(worth.history[worth.history.length - 1]).toEqual({ key: "2026-10", net: 25500 });
    expect(worth.yearChange).toBe(25500 - (1000 + 30000 - 9500));
  });

  it("bunurile trec prin normalizare și se unesc după ultima modificare", () => {
    const d = data();
    expect(normalizeAppData(JSON.parse(JSON.stringify(d))).settings.assets).toHaveLength(2);
    expect(normalizeAssets([{ id: "x", name: " ", kind: "car", value: 1, updatedAt: "2026-01-01T00:00:00Z" }])).toEqual([]);
    const older = { id: "car", name: "Mașina", kind: "car" as const, value: 30000, updatedAt: "2026-09-01T00:00:00.000Z" };
    const newer = { ...older, value: 28000, updatedAt: "2026-10-01T00:00:00.000Z" };
    expect(mergeAssets([older], [newer])[0].value).toBe(28000);
    expect(mergeAssets([newer], [older])[0].value).toBe(28000);
  });
});
