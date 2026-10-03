import { describe, expect, it } from "vitest";
import { growth, monthlyFor, retirement } from "./invest-sim";

describe("simulatorul de investiții", () => {
  it("fără randament, valoarea e suma depusă", () => {
    const points = growth({ start: 1000, monthly: 100, years: 2, annualReturn: 0 });
    expect(points.map((p) => p.value)).toEqual([1000, 2200, 3400]);
    expect(points[2].contributed).toBe(3400);
  });

  it("dobânda compusă: 10.000 la 7% pe 10 ani ajung aproape dublu", () => {
    const end = growth({ start: 10000, monthly: 0, years: 10, annualReturn: 7 }).slice(-1)[0];
    expect(end.value).toBeGreaterThan(19600);
    expect(end.value).toBeLessThan(19700);
  });

  it("comisionul și inflația scad ce rămâne", () => {
    const plain = growth({ start: 0, monthly: 500, years: 20, annualReturn: 6 }).slice(-1)[0];
    const fees = growth({ start: 0, monthly: 500, years: 20, annualReturn: 6, fee: 1.5, inflation: 4 }).slice(-1)[0];
    expect(fees.value).toBeLessThan(plain.value);
    expect(fees.real).toBeLessThan(fees.value);
  });

  it("depunerea care crește în fiecare an adună mai mult", () => {
    const flat = growth({ start: 0, monthly: 500, years: 10, annualReturn: 5 }).slice(-1)[0];
    const raised = growth({ start: 0, monthly: 500, years: 10, annualReturn: 5, raise: 5 }).slice(-1)[0];
    expect(raised.contributed).toBeGreaterThan(flat.contributed);
  });

  it("găsește depunerea lunară pentru o țintă", () => {
    const monthly = monthlyFor(100000, { start: 0, years: 10, annualReturn: 6 });
    const end = growth({ start: 0, monthly, years: 10, annualReturn: 6 }).slice(-1)[0].value;
    expect(end).toBeGreaterThanOrEqual(100000);
    expect(growth({ start: 0, monthly: monthly - 5, years: 10, annualReturn: 6 }).slice(-1)[0].value).toBeLessThan(100000);
  });
});

describe("pensia", () => {
  const input = { age: 35, retireAge: 65, untilAge: 85, desired: 5000, pension: 3000, saved: 10000, monthly: 0, annualReturn: 6.5, fee: 0.5, inflation: 4 };
  it("socotește golul, capitalul și depunerea care îl acoperă", () => {
    const plan = retirement(input);
    expect(plan.gap).toBe(2000);
    expect(plan.needed).toBeGreaterThan(2000 * 12 * 20 * 0.6);
    expect(plan.needed).toBeLessThan(2000 * 12 * 20);
    expect(plan.neededNominal).toBeGreaterThan(plan.needed);
    expect(plan.monthlyNeeded).toBeGreaterThan(0);
    expect(plan.lastsUntil).toBeLessThan(85);
    const covered = retirement({ ...input, monthly: plan.monthlyNeeded });
    expect(covered.projected).toBeGreaterThanOrEqual(plan.needed);
    expect(covered.lastsUntil).toBeGreaterThanOrEqual(84);
  });

  it("dacă pensia de stat acoperă tot, nu mai trebuie nimic", () => {
    const plan = retirement({ ...input, desired: 3000 });
    expect(plan).toMatchObject({ gap: 0, needed: 0, monthlyNeeded: 0, lastsUntil: 100 });
  });
});
