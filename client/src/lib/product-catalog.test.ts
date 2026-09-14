import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import {
  catalogSize,
  categoryFromOnlineTags,
  classifyProductLabel,
  dominantReceiptCategory,
  looksLikeProductSearch,
  productSpendBreakdown,
  searchOnlineProducts,
  searchProductCatalog,
  spendGroupOf,
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

  it("mapează etichetele Open Food Facts pe categoriile casei", () => {
    expect(categoryFromOnlineTags(["en:mineral-waters"], "Bucovina")).toBe("Apă");
    expect(categoryFromOnlineTags(["en:chocolates"], "Milka")).toBe("Dulciuri");
    expect(categoryFromOnlineTags(["en:cleaning"], "Ariel")).toBe("Casă & facturi");
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
    expect(hits.some((item) => /ariel/i.test(item.name) && item.category === "Casă & facturi")).toBe(true);
  });

  it("recunoaște un nume de produs fără sumă, nu o conversație cu ghidul", () => {
    expect(looksLikeProductSearch("Napolact")).toBe(true);
    expect(looksLikeProductSearch("detergent Ariel")).toBe(true);
    expect(looksLikeProductSearch("ok")).toBe(false);
    expect(looksLikeProductSearch("am dat 50 lei pe benzină")).toBe(false);
    expect(looksLikeProductSearch("ce fac azi")).toBe(false);
  });
});
