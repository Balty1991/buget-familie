import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import {
  catalogSize,
  categoryFromOnlineTags,
  classifyProductLabel,
  dominantReceiptCategory,
  looksLikeProductSearch,
  productSpendBreakdown,
  productSpendSeries,
  searchOnlineProducts,
  searchProductCatalog,
  spendGroupOf,
  spendWindow,
} from "./product-catalog";

describe("catalogul de produse", () => {
  it("are destule articole ca să merite căutarea", () => {
    expect(catalogSize).toBeGreaterThan(80);
  });

  it("clasifică alimente, haine și casă din denumiri reale de bon", () => {
    expect(classifyProductLabel("APA BUCOVINA 2L")).toBe("Apă");
    expect(classifyProductLabel("CIORAPI DAMA")).toBe("Timp liber");
    expect(classifyProductLabel("HANORAC")).toBe("Timp liber");
    expect(classifyProductLabel("LIPICI UNIVERSAL")).toBe("Casă & facturi");
    expect(classifyProductLabel("GARANTIE PET SGR")).toBe("Alimente");
    expect(classifyProductLabel("Pâine albă")).toBe("Alimente");
  });

  it("categoria dominantă urmează suma, nu numărul de linii", () => {
    expect(dominantReceiptCategory([
      { label: "CIORAPI", amount: 12, category: "Timp liber" },
      { label: "SACOSA", amount: 1.5, category: "Casă & facturi" },
    ])).toBe("Timp liber");
    expect(dominantReceiptCategory([
      { label: "APA", amount: 20, category: "Băuturi" },
      { label: "LIPICI", amount: 9, category: "Casă & facturi" },
    ])).toBe("Băuturi");
  });

  it("caută în catalog și pe bonurile salvate", () => {
    const data = createEmptyAppData();
    data.receipts = [{
      id: "r1",
      vendor: "Profi",
      amount: 18.97,
      category: "Alimente",
      date: "2026-09-13",
      lines: [{ id: "l1", category: "Casă & facturi", amount: 8.98, label: "Lipici universal" }],
    }];
    const hits = searchProductCatalog("lipi", data.receipts);
    expect(hits.some((item) => /lipici/i.test(item.name))).toBe(true);
    expect(searchProductCatalog("hanor").some((item) => item.name === "Hanorac")).toBe(true);
    const kinder = searchProductCatalog("Kinder ou");
    expect(kinder.some((item) => /kinder ou/i.test(item.name))).toBe(true);
    expect(searchProductCatalog("kinder").filter((item) => /kinder/i.test(item.name)).length).toBeGreaterThan(5);
    expect(classifyProductLabel("Kinder Bueno")).toBe("Dulciuri");
  });

  it("repartizează alimente vs nealimentare din liniile bonului", () => {
    const data = createEmptyAppData();
    data.receipts = [{
      id: "r1",
      vendor: "Familiaro",
      amount: 57.3,
      category: "Alimente",
      date: "2026-09-10",
      lines: [
        { id: "a", category: "Băuturi", amount: 19.14, label: "Apa Bucovina" },
        { id: "b", category: "Alimente", amount: 32.16, label: "Pâine" },
        { id: "c", category: "Casă & facturi", amount: 6, label: "Sacoșă" },
      ],
    }];
    const split = productSpendBreakdown(data.receipts, "2026-09");
    expect(split.food).toBeCloseTo(51.3, 1);
    expect(split.nonFood).toBeCloseTo(6, 1);
    expect(spendGroupOf("Timp liber")).toBe("Nealimentare");
  });

  it("taie bonurile după interval, nu doar după lună", () => {
    const receipts = [
      { id: "r1", vendor: "Lidl", amount: 10, category: "Alimente", date: "2026-09-01", lines: [{ id: "a", category: "Alimente", amount: 10, label: "Pâine" }] },
      { id: "r2", vendor: "Lidl", amount: 20, category: "Alimente", date: "2026-09-16", lines: [{ id: "b", category: "Alimente", amount: 20, label: "Lapte" }] },
      { id: "r3", vendor: "Pepco", amount: 30, category: "Timp liber", date: "2026-08-20", lines: [{ id: "c", category: "Timp liber", amount: 30, label: "Hanorac" }] },
    ];
    const week = productSpendBreakdown(receipts, { from: "2026-09-14", to: "2026-09-20" });
    expect(week.total).toBe(20);
    expect(week.products[0]?.label).toBe("Lapte");
    const range = productSpendBreakdown(receipts, { from: "2026-08-01", to: "2026-09-30" });
    expect(range.nonFood).toBe(30);
    expect(range.food).toBe(30);
  });

  it("desenează săptămâni și filtrează un articol pe grafic", () => {
    const receipts = [
      { id: "r1", vendor: "Lidl", amount: 10, category: "Alimente", date: "2026-09-08", lines: [{ id: "a", category: "Alimente", amount: 10, label: "Pâine" }] },
      { id: "r2", vendor: "Lidl", amount: 25, category: "Alimente", date: "2026-09-15", lines: [
        { id: "b", category: "Alimente", amount: 20, label: "Lapte" },
        { id: "c", category: "Casă & facturi", amount: 5, label: "Sacoșă" },
      ] },
    ];
    const series = productSpendSeries(receipts, { from: "2026-09-07", to: "2026-09-20", grain: "week" });
    expect(series.length).toBe(2);
    expect(series[0].total).toBe(10);
    expect(series[1].food).toBe(20);
    expect(series[1].nonFood).toBe(5);
    const onlyMilk = productSpendSeries(receipts, { from: "2026-09-07", to: "2026-09-20", grain: "week", productKey: "lapte" });
    expect(onlyMilk[0].total).toBe(0);
    expect(onlyMilk[1].total).toBe(20);
    const window = spendWindow("month", "2026-09-16");
    expect(window.from).toBe("2026-09-01");
    expect(window.grain).toBe("week");
  });

  it("mapează etichetele Open Food Facts pe categoriile casei", () => {
    expect(categoryFromOnlineTags(["en:mineral-waters"], "Bucovina")).toBe("Apă");
    expect(categoryFromOnlineTags(["en:chocolates"], "Milka")).toBe("Dulciuri");
    expect(categoryFromOnlineTags(["en:cleaning"], "Ariel")).toBe("Casă & facturi");
    expect(categoryFromOnlineTags(["en:milks", "en:beverages"], "Napolact lapte")).toBe("Alimente");
  });

  it("citește catalogul online doar după denumire, fără să amestece registrul", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      const products = url.includes("openfoodfacts")
        ? [{ product_name_ro: "Lapte Napolact 1.5%", brands: "Napolact", categories_tags: ["en:milks"] }]
        : [{ product_name: "Detergent Ariel", categories_tags: ["en:cleaning"] }];
      return new Response(JSON.stringify({ products }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const hits = await searchOnlineProducts("lapte", { fetchImpl });
    expect(hits.some((item) => /lapte/i.test(item.name) && item.source === "online")).toBe(true);
    const house = await searchOnlineProducts("ariel", { fetchImpl });
    expect(house.some((item) => /ariel/i.test(item.name) && item.category === "Casă & facturi")).toBe(true);
  });

  it("recunoaște un nume de produs fără sumă, nu o conversație cu ghidul", () => {
    expect(looksLikeProductSearch("Napolact")).toBe(true);
    expect(looksLikeProductSearch("detergent Ariel")).toBe(true);
    expect(looksLikeProductSearch("ok")).toBe(false);
    expect(looksLikeProductSearch("am dat 50 lei pe benzină")).toBe(false);
    expect(looksLikeProductSearch("ce fac azi")).toBe(false);
  });
});

/**
 * Căutarea de produse se declanșează înaintea înțelegerii, deci orice frază pe care o
 * revendică din greșeală nu mai ajunge la ghid. „Șterge plicul de transport” pleca la
 * catalog fiindcă „plicul” nu se potrivea cu tiparul „plic”.
 */
describe("catalogul nu fură frazele despre bani", () => {
  it("lasă în pace plicurile, oricum ar fi scrise", () => {
    for (const text of ["sterge plicul de transport", "imparte-mi 1800 in plicuri", "mareste plicul de alimente cu 200", "nu mai vreau plicul de transport"]) {
      expect(looksLikeProductSearch(text), text).toBe(false);
    }
  });

  it("lasă în pace sumele și verbele de bani", () => {
    for (const text of ["pune deoparte 300", "repartizeaza 1500", "economisesc pentru vacanta"]) {
      expect(looksLikeProductSearch(text), text).toBe(false);
    }
  });

  it("dar recunoaște în continuare un produs căutat pe nume", () => {
    for (const text of ["napolact lapte", "detergent ariel", "kinder bueno"]) {
      expect(looksLikeProductSearch(text), text).toBe(true);
    }
  });
});
