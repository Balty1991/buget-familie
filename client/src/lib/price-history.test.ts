import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type Receipt } from "./finance-data";
import { basketCandidates, normalizeProductKey, productPriceHistories, referenceBasket } from "./price-history";

const receipt = (id: string, vendor: string, date: string, lines: Array<[string, number, string?]>): Receipt => ({
  id,
  vendor,
  date,
  amount: lines.reduce((sum, [, amount]) => sum + amount, 0),
  category: "Alimente",
  lines: lines.map(([label, amount, category], index) => ({ id: `${id}-${index}`, label, amount, category: category || "Alimente" })),
});

const withReceipts = (receipts: Receipt[]): AppData => ({ ...createEmptyAppData(), receipts });

describe("cheia de potrivire a produselor", () => {
  it("ignoră gramajul, codurile și punctuația", () => {
    expect(normalizeProductKey("LAPTE ZUZU 1,5 L")).toBe(normalizeProductKey("Lapte Zuzu 1.5l"));
    expect(normalizeProductKey("PAINE NEAGRA 500 g")).toBe(normalizeProductKey("Paine neagra 500g"));
    expect(normalizeProductKey("2547841 CAFEA JACOBS")).toBe(normalizeProductKey("Cafea Jacobs"));
  });

  it("nu produce cheie pentru etichete fără conținut", () => {
    expect(normalizeProductKey("1x")).toBeUndefined();
    expect(normalizeProductKey("500 g")).toBeUndefined();
    expect(normalizeProductKey("--")).toBeUndefined();
  });

  it("nu confundă două produse diferite", () => {
    expect(normalizeProductKey("Lapte Zuzu")).not.toBe(normalizeProductKey("Lapte Napolact"));
  });
});

describe("istoricul unui produs", () => {
  const data = withReceipts([
    receipt("b1", "Lidl", "2026-06-02", [["LAPTE ZUZU 1,5 L", 7.49], ["PAINE NEAGRA", 4.5]]),
    receipt("b2", "Kaufland", "2026-07-14", [["Lapte Zuzu 1.5l", 8.2]]),
    receipt("b3", "Lidl", "2026-09-01", [["LAPTE ZUZU 1,5L", 8.99], ["PAINE NEAGRA", 5.2]]),
  ]);

  it("adună observațiile în ordine cronologică și calculează evoluția", () => {
    const lapte = productPriceHistories(data).find((item) => item.key.includes("lapte"));
    expect(lapte?.observations.map((item) => item.amount)).toEqual([7.49, 8.2, 8.99]);
    expect(lapte?.change).toBe(1.5);
    expect(lapte?.changePercent).toBe(20);
  });

  it("arată cel mai mic preț din fiecare magazin", () => {
    const lapte = productPriceHistories(data).find((item) => item.key.includes("lapte"));
    expect(lapte?.cheapest).toMatchObject({ vendor: "Lidl", amount: 7.49 });
    expect(lapte?.dearest).toMatchObject({ vendor: "Kaufland", amount: 8.2 });
    expect(lapte?.byVendor).toHaveLength(2);
  });

  it("cere cel puțin două observații pentru un istoric", () => {
    const singur = withReceipts([receipt("b1", "Lidl", "2026-09-01", [["UNT PRESIDENT", 12.5]])]);
    expect(productPriceHistories(singur)).toEqual([]);
    expect(productPriceHistories(singur, { minObservations: 1 })).toHaveLength(1);
  });

  it("sare peste liniile fără etichetă sau fără sumă", () => {
    const partial = withReceipts([
      { ...receipt("b1", "Lidl", "2026-09-01", [["OUA", 15]]), lines: [{ id: "l1", category: "Alimente", amount: 15 }] },
      receipt("b2", "Lidl", "2026-09-02", [["OUA", 16]]),
    ]);
    expect(productPriceHistories(partial)).toEqual([]);
  });

  it("propune ca reper produsele cumpărate cel mai des", () => {
    expect(basketCandidates(data).map((item) => item.observations.length)).toEqual([3, 2]);
  });
});

describe("coșul etalon", () => {
  const data = withReceipts([
    receipt("vechi-1", "Lidl", "2026-03-05", [["LAPTE ZUZU 1,5 L", 7.0], ["PAINE NEAGRA", 4.0]]),
    receipt("vechi-2", "Lidl", "2026-04-10", [["ULEI FLOAREA SOARELUI 1 L", 9.5]]),
    receipt("nou-1", "Lidl", "2026-09-01", [["LAPTE ZUZU 1,5L", 8.4], ["PAINE NEAGRA", 4.6]]),
  ]);
  const keys = ["lapte zuzu", "paine neagra", "ulei floarea soarelui"];

  it("compară totalul de azi cu cel de acum trei luni", () => {
    const basket = referenceBasket(data, keys, { asOf: "2026-09-10", windowDays: 90 });
    expect(basket.lines.map((line) => line.label)).toEqual(["LAPTE ZUZU 1,5L", "PAINE NEAGRA"]);
    expect(basket.baselineTotal).toBe(11);
    expect(basket.currentTotal).toBe(13);
    expect(basket.change).toBe(2);
    expect(basket.changePercent).toBe(18.2);
  });

  it("raportează ca în așteptare produsele fără un preț destul de vechi", () => {
    const basket = referenceBasket(data, keys, { asOf: "2026-09-10", windowDays: 90 });
    // Uleiul are un singur preț, deci nu se poate compara cu nimic.
    expect(basket.pending).toEqual(["ULEI FLOAREA SOARELUI 1 L"]);
  });

  it("nu compară un produs cu el însuși când toate prețurile sunt recente", () => {
    const recent = withReceipts([
      receipt("r1", "Lidl", "2026-09-01", [["LAPTE ZUZU 1,5 L", 8.0]]),
      receipt("r2", "Lidl", "2026-09-08", [["LAPTE ZUZU 1,5 L", 8.5]]),
    ]);
    const basket = referenceBasket(recent, ["lapte zuzu"], { asOf: "2026-09-10", windowDays: 90 });
    expect(basket.lines).toEqual([]);
    expect(basket.pending).toHaveLength(1);
  });

  it("ignoră observațiile de după data verificată", () => {
    const basket = referenceBasket(data, ["lapte zuzu"], { asOf: "2026-05-01", windowDays: 30 });
    expect(basket.lines).toEqual([]);
    expect(basket.pending).toHaveLength(1);
  });

  it("nu raportează nimic pentru un coș gol", () => {
    const basket = referenceBasket(data, [], { asOf: "2026-09-10" });
    expect(basket).toMatchObject({ lines: [], currentTotal: 0, baselineTotal: 0, change: 0, changePercent: 0, pending: [] });
  });
});
