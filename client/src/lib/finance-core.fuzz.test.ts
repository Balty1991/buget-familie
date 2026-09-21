/**
 * Miezul de bani, pe case generate.
 *
 * Testele scrise de mână acoperă cazurile la care s-a gândit cineva. Astea acoperă cazurile
 * la care nu s-a gândit nimeni: două sute de gospodării cu sume, plicuri și mișcări la
 * întâmplare, verificate pe invarianți — nicio cifră NaN, niciun leu apărut sau pierdut
 * la o mutare, tranșele care însumează plicul. Seed-ul e determinist, deci un eșec poate
 * fi refăcut exact.
 */
import { describe, expect, it } from "vitest";
import {
  allocationBudget,
  allocationWeeksStatus,
  commitLedgerEntry,
  createEmptyAppData,
  normalizeAppData,
  planAllocationMath,
  sourceBalance,
  transferBetweenEnvelopes,
  transferBetweenWeeks,
  type AppData,
} from "./finance-data";

/** Generator determinist: același seed, aceeași casă — ca un eșec să poată fi refăcut. */
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const houseFor = (seed: number): AppData => {
  const random = rng(seed);
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  const money = (max: number) => Math.round(random() * max * 100) / 100;
  const data = createEmptyAppData();
  data.settings.paymentSources = [
    { id: "card", name: "Card", kind: "card", memberId: "member-me", openingBalance: money(5000) },
    { id: "cash", name: "Cash", kind: "cash", memberId: "member-me", openingBalance: money(1000) },
  ];
  data.settings.salaryPlan.periodStart = "2026-09-14";
  data.settings.salaryPlan.nextPayday = "2026-10-09";
  data.settings.salaryPlan.sourceIds = ["card", "cash"];
  data.settings.salaryPlan.allocations = Array.from({ length: 1 + Math.floor(random() * 4) }, (_, index) => ({
    id: `a${index}`,
    label: `Plic ${index}`,
    category: pick(["Alimente", "Transport", "Casă & facturi", "Timp liber"]),
    amount: money(1500),
    sourceId: pick(["card", "cash"]),
    weeklyPace: random() > 0.5,
  }));
  data.transactions = Array.from({ length: Math.floor(random() * 12) }, (_, index) => ({
    id: `t${index}`,
    title: `Mișcare ${index}`,
    amount: money(300),
    kind: random() > 0.25 ? ("expense" as const) : ("income" as const),
    category: pick(["Alimente", "Transport", "Venit"]),
    source: "Card",
    sourceId: pick(["card", "cash"]),
    person: "Eu",
    memberId: "member-me",
    date: `2026-09-${String(10 + Math.floor(random() * 20)).padStart(2, "0")}`,
    allocationId: random() > 0.5 ? `a0` : "outside",
  }));
  return data;
};

const finite = (value: number) => Number.isFinite(value);

describe("miezul de bani, pe 200 de case generate", () => {
  it("nicio cifră nu iese NaN sau Infinity", () => {
    const rele: string[] = [];
    for (let seed = 1; seed <= 200; seed += 1) {
      const data = houseFor(seed);
      const math = planAllocationMath(data);
      for (const [nume, valoare] of Object.entries(math)) {
        if (typeof valoare === "number" && !finite(valoare)) rele.push(`seed ${seed}: planAllocationMath.${nume} = ${valoare}`);
      }
      for (const source of data.settings.paymentSources) {
        if (!finite(sourceBalance(data, source.id))) rele.push(`seed ${seed}: sold ${source.id}`);
      }
      for (const allocation of data.settings.salaryPlan.allocations) {
        if (!finite(allocationBudget(data, allocation))) rele.push(`seed ${seed}: buget ${allocation.id}`);
        for (const week of allocationWeeksStatus(data, allocation)) {
          if (!finite(week.budget) || !finite(week.remaining)) rele.push(`seed ${seed}: tranșa ${week.index} din ${allocation.id}`);
        }
      }
    }
    expect(rele.slice(0, 10)).toEqual([]);
  });

  it("mutarea între plicuri nu creează și nu pierde bani", () => {
    const rele: string[] = [];
    for (let seed = 1; seed <= 200; seed += 1) {
      const data = houseFor(seed);
      const [from, to] = data.settings.salaryPlan.allocations;
      if (!from || !to || from.id === to.id) continue;
      const inainte = data.settings.salaryPlan.allocations.reduce((sum, item) => sum + allocationBudget(data, item), 0);
      const next = transferBetweenEnvelopes(data, { fromAllocationId: from.id, toAllocationId: to.id, amount: 50 });
      if (!next) continue;
      const dupa = next.settings.salaryPlan.allocations.reduce((sum, item) => sum + allocationBudget(next, item), 0);
      if (Math.abs(inainte - dupa) > 0.005) rele.push(`seed ${seed}: ${inainte} → ${dupa}`);
    }
    expect(rele.slice(0, 5)).toEqual([]);
  });

  it("mutarea între tranșe păstrează bugetul plicului", () => {
    const rele: string[] = [];
    for (let seed = 1; seed <= 200; seed += 1) {
      const data = houseFor(seed);
      const allocation = data.settings.salaryPlan.allocations[0];
      const weeks = allocationWeeksStatus(data, allocation);
      if (weeks.length < 2) continue;
      const inainte = weeks.reduce((sum, week) => sum + week.budget, 0);
      const next = transferBetweenWeeks(data, { allocationId: allocation.id, fromWeekIndex: weeks[0].index, toWeekIndex: weeks[1].index, amount: 10 });
      if (!next) continue;
      const dupa = allocationWeeksStatus(next, next.settings.salaryPlan.allocations[0]).reduce((sum, week) => sum + week.budget, 0);
      if (Math.abs(inainte - dupa) > 0.02) rele.push(`seed ${seed}: ${inainte} → ${dupa}`);
    }
    expect(rele.slice(0, 5)).toEqual([]);
  });

  it("o cheltuială scade din sursă exact cât scrie pe ea", () => {
    const rele: string[] = [];
    for (let seed = 1; seed <= 200; seed += 1) {
      const data = houseFor(seed);
      const inainte = sourceBalance(data, "card");
      const next = commitLedgerEntry(data, {
        id: `nou-${seed}`, title: "Test", amount: 25, kind: "expense", category: "Alimente",
        source: "Card", sourceId: "card", person: "Eu", memberId: "member-me", date: "2026-09-20", allocationId: "outside",
      });
      const dupa = sourceBalance(next, "card");
      if (Math.abs(inainte - 25 - dupa) > 0.005) rele.push(`seed ${seed}: ${inainte} → ${dupa}`);
    }
    expect(rele.slice(0, 5)).toEqual([]);
  });

  it("normalizarea e stabilă: a doua trecere nu mai schimbă nimic", () => {
    const rele: string[] = [];
    for (let seed = 1; seed <= 200; seed += 1) {
      const odata = normalizeAppData(houseFor(seed));
      const dedoua = normalizeAppData(odata);
      if (JSON.stringify(odata) !== JSON.stringify(dedoua)) rele.push(`seed ${seed}`);
    }
    expect(rele.slice(0, 5)).toEqual([]);
  });

  it("tranșele săptămânale însumează bugetul plicului", () => {
    const rele: string[] = [];
    for (let seed = 1; seed <= 200; seed += 1) {
      const data = houseFor(seed);
      for (const allocation of data.settings.salaryPlan.allocations) {
        const weeks = allocationWeeksStatus(data, allocation);
        if (!weeks.length) continue;
        const suma = weeks.reduce((sum, week) => sum + week.budget, 0);
        const buget = allocationBudget(data, allocation);
        if (Math.abs(suma - buget) > 0.05) rele.push(`seed ${seed}: ${allocation.id} tranșe=${suma} buget=${buget}`);
      }
    }
    expect(rele.slice(0, 5)).toEqual([]);
  });
});
