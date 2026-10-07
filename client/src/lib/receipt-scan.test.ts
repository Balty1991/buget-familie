import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { receiptCategories, scanToPrefill, type ScannedReceipt } from "./receipt-scan";

function family(): AppData {
  const data = createEmptyAppData();
  return {
    ...data,
    settings: {
      ...data.settings,
      members: [{ id: "m1", name: "Andrei" }, { id: "m2", name: "Ana" }] as AppData["settings"]["members"],
      paymentSources: [
        { id: "card-a", name: "Card Andrei", kind: "card", memberId: "m1", openingBalance: 0 },
        { id: "cash-a", name: "Cash Andrei", kind: "cash", memberId: "m1", openingBalance: 0 },
        { id: "cash-b", name: "Cash Ana", kind: "cash", memberId: "m2", openingBalance: 0 },
        { id: "sgr", name: "Voucher SGR", kind: "voucher", openingBalance: 0 },
      ],
    },
  };
}

/** Bonul mototolit din Roșiori, așa cum îl citește modelul: 10 articole, 44,58 lei, numerar. */
const crumpled: ScannedReceipt = {
  store: "Robert I.I.",
  date: "2026-10-07",
  total: 44.58,
  confidence: "high",
  payments: [{ method: "cash", amount: 44.58 }],
  items: [
    { name: "Ulei Spornic bun la toate 1 L", quantity: 1, amount: 8.19, category: "Alimente" },
    { name: "Pepsi Cola Twist 1,5 L", quantity: 1, amount: 6.51, category: "Băuturi" },
    { name: "Napolitane Milka Choco 30 g", quantity: 1, amount: 2.69, category: "Dulciuri" },
    { name: "Sticks Croco ciocolată 80 g", quantity: 1, amount: 3, category: "Dulciuri" },
    { name: "Sacoșă", quantity: 1, amount: 1, category: "SGR și sacoșe" },
    { name: "Salam șuncă feliat Cristim 100 g", quantity: 2, amount: 6.4, category: "Alimente" },
    { name: "Salam Victoria Cristim feliat 100 g", quantity: 1, amount: 3.5, category: "Alimente" },
    { name: "Crenvurști piept pui extra Cristim 250 g", quantity: 1, amount: 9.5, category: "Alimente" },
    { name: "Napolitane Dare ciocolată neagră 44 g", quantity: 1, amount: 3.29, category: "Dulciuri" },
    { name: "Garanție SGR", quantity: 1, amount: 0.5, category: "SGR și sacoșe" },
  ],
};

/** Bonul cu vodca: 39,76 lei, 28,50 din vouchere Returo și 11,26 numerar. */
const twoSources: ScannedReceipt = {
  store: "Sales Consulting",
  date: null,
  total: 39.76,
  confidence: "high",
  payments: [{ method: "cash", amount: 11.26 }, { method: "voucher", amount: 28.5 }],
  items: [
    { name: "Vodcă Stalinskaya 40% 0,5 L", quantity: 1, amount: 34.88, category: "Băuturi" },
    { name: "Garanție sticlă SGR", quantity: 1, amount: 0.5, category: "SGR și sacoșe" },
    { name: "Kinder Delice 39 g", quantity: 1, amount: 3.38, category: "Dulciuri" },
    { name: "Sacoșă maieu bio 35×60 cm", quantity: 1, amount: 1, category: "SGR și sacoșe" },
  ],
};

describe("scanToPrefill", () => {
  it("pune fiecare produs al bonului mototolit la categoria lui și păstrează totalul", () => {
    const prefill = scanToPrefill(crumpled, family(), "m1", "2026-10-07");
    expect(prefill.count).toBe(10);
    expect(prefill.amount).toBe(44.58);
    expect(prefill.lines.reduce((sum, line) => sum + line.amount, 0)).toBeCloseTo(44.58, 2);
    expect(prefill.category).toBe("Alimente");
    expect(prefill.lines.find((line) => line.label.startsWith("Salam șuncă"))?.label).toBe("Salam șuncă feliat Cristim 100 g × 2");
    expect(prefill.lines.filter((line) => line.category === "SGR și sacoșe")).toHaveLength(2);
    expect(prefill.sourceId).toBe("cash-a");
    expect(prefill.second).toBeUndefined();
    expect(prefill.date).toBe("2026-10-07");
    expect(prefill.warning).toBeUndefined();
    expect(prefill.title).toContain("Robert");
  });

  it("împarte plata pe voucher SGR și numerar, cu un singur bon", () => {
    const prefill = scanToPrefill(twoSources, family(), "m2", "2026-10-07");
    expect(prefill.amount).toBe(39.76);
    expect(prefill.sourceId).toBe("sgr");
    expect(prefill.second).toEqual({ sourceId: "cash-b", amount: 11.26 });
    expect(prefill.category).toBe("Băuturi");
    expect(prefill.lines.map((line) => line.category)).toEqual(["Băuturi", "SGR și sacoșe", "Dulciuri", "SGR și sacoșe"]);
    expect(prefill.date).toBeUndefined();
  });

  it("avertizează când articolele nu dau totalul și ignoră categoriile necunoscute", () => {
    const prefill = scanToPrefill({ ...crumpled, total: 50, items: [...crumpled.items.slice(0, 2), { name: "Ceva", quantity: 1, amount: 1, category: "Inventată" }] }, family(), "m1", "2026-10-07");
    expect(prefill.warning).toMatch(/Verifică/);
    expect(prefill.lines[2].category).toBe("Altele");
  });

  it("nu ia o dată din viitor sau prea veche", () => {
    expect(scanToPrefill({ ...crumpled, date: "2026-10-09" }, family(), "m1", "2026-10-07").date).toBeUndefined();
    expect(scanToPrefill({ ...crumpled, date: "2025-01-02" }, family(), "m1", "2026-10-07").date).toBeUndefined();
  });

  it("fără sursă de felul plății, lasă sursa aleasă de om", () => {
    const data = family();
    data.settings.paymentSources = data.settings.paymentSources.filter((source) => source.kind !== "voucher");
    const prefill = scanToPrefill(twoSources, data, "m1", "2026-10-07");
    expect(prefill.sourceId).toBeUndefined();
    expect(prefill.second).toBeUndefined();
  });
});

describe("receiptCategories", () => {
  it("trimite categoriile de cumpărături, fără credite, plus cele ale familiei", () => {
    const data = family();
    data.settings.customCategories = ["Animale"];
    const list = receiptCategories(data);
    expect(list).toContain("SGR și sacoșe");
    expect(list).toContain("Animale");
    expect(list).not.toContain("Credite");
  });
});
