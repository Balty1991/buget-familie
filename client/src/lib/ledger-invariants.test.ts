import { afterEach, describe, expect, it, vi } from "vitest";
import { addIsoDays, allocationStatus, allocationWeeksStatus, commitLedgerEntry, normalizeAppData, recordDebtPayment, reservedDebtsInPlan, type AppData, type Transaction } from "./finance-data";
import { liquidSafeToSpend, todayBrief } from "./household-insights";
import { CARD, FOOD, ME, PAYDAY, PERIOD_START, familyAtPayday, liveOneDay, seeded } from "./__fixtures__/family-month";
import { CENT, atNoon, checkInvariants, money } from "./__fixtures__/invariants";

/** O lună simulată zi cu zi, pe mai multe semințe: regulile din __fixtures__/invariants.ts trebuie să țină în fiecare zi. */

afterEach(() => { vi.useRealTimers(); });

const liveMonth = (seed: number, onDay?: (data: AppData, day: string) => void) => {
  const random = seeded(seed);
  let data = familyAtPayday();
  for (let day = PERIOD_START; day < PAYDAY; day = addIsoDays(day, 1)) {
    atNoon(day);
    data = liveOneDay(data, day, random);
    onDay?.(data, day);
  }
  return data;
};

describe("regulile banilor, zi cu zi pe o lună întreagă", () => {
  for (const seed of [1, 7, 42, 2026, 90210]) {
    it(`luna cu sămânța ${seed}`, () => {
      liveMonth(seed, (data, day) => { checkInvariants(data, day); });
    });
  }

  it("salvarea și sincronizarea nu schimbă nicio cifră", () => {
    liveMonth(11, (data, day) => {
      if (day.slice(8) !== "15" && day.slice(8) !== "28") return;
      const again = normalizeAppData(JSON.parse(JSON.stringify(data)));
      expect(todayBrief(again, day).spendable).toBeCloseTo(todayBrief(data, day).spendable, 2);
      const food = (value: AppData) => value.settings.salaryPlan.allocations.find((item) => item.id === FOOD)!;
      expect(allocationWeeksStatus(again, food(again)).map((week) => money(week.remaining))).toEqual(allocationWeeksStatus(data, food(data)).map((week) => money(week.remaining)));
      expect(liquidSafeToSpend(again, day).liquidFunds).toBeCloseTo(liquidSafeToSpend(data, day).liquidFunds, 2);
    });
  });
});

describe("ce faci azi mută cifra zilei în direcția corectă", () => {
  const spend = (data: AppData, day: string, amount: number, extra: Partial<Transaction> = {}) =>
    commitLedgerEntry(data, { id: `probe-${amount}-${day}`, title: "Probă", amount, kind: "expense", category: "Alimente", sourceId: CARD, source: "Card Ion", memberId: ME, person: "Ion", date: day, allocationId: FOOD, ...extra });

  it("o cheltuială de azi scade cifra cel mult cu suma ei și n-o crește niciodată", () => {
    liveMonth(3, (data, day) => {
      const before = todayBrief(data, day).spendable;
      for (const amount of [1, 12.5, 80, 400]) {
        const after = todayBrief(spend(data, day, amount), day).spendable;
        expect(after, `${day}: +${amount} a crescut cifra`).toBeLessThanOrEqual(before + CENT);
        expect(before - after, `${day}: +${amount} a scăzut mai mult decât suma`).toBeLessThanOrEqual(amount + CENT);
      }
    });
  });

  it("bifa „pentru toată luna” nu scade cifra zilei mai mult decât fără ea", () => {
    liveMonth(5, (data, day) => {
      const plain = todayBrief(spend(data, day, 160), day).spendable;
      const spread = todayBrief(spend(data, day, 160, { spreadAmount: 120 }), day).spendable;
      expect(spread, `${day}: bonul întins a scăzut mai mult`).toBeGreaterThanOrEqual(plain - CENT);
    });
  });

  it("plata unei rate deja rezervate nu mai scade banii liberi a doua oară", () => {
    let checked = 0;
    liveMonth(13, (data, day) => {
      const before = liquidSafeToSpend(data, day);
      for (const debt of reservedDebtsInPlan(data)) {
        // Doar cât banii ajung pentru toate rezervările: altfel „liber” e plafonat la 0 și nu spune nimic.
        if (before.liquidFunds - before.reservedRecurring < 1) continue;
        const paid = recordDebtPayment(data, { debtId: debt.id, amount: debt.amount, sourceId: CARD, memberId: ME, date: day });
        if (!paid) continue;
        checked += 1;
        expect(Math.abs(liquidSafeToSpend(paid, day).available - before.available), `${day}: ${debt.name} scăzută de două ori`).toBeLessThan(CENT);
      }
    });
    expect(checked).toBeGreaterThan(5);
  });

  it("un venit în plus nu scade cifra zilei", () => {
    liveMonth(8, (data, day) => {
      if (day >= addIsoDays(PAYDAY, -2)) return;
      const before = todayBrief(data, day).spendable;
      const richer = commitLedgerEntry(data, { id: `gift-${day}`, title: "Cadou", amount: 200, kind: "income", category: "Venit", sourceId: CARD, source: "Card Ion", memberId: ME, person: "Ion", date: day });
      expect(todayBrief(richer, day).spendable, `${day}: venitul a scăzut cifra`).toBeGreaterThanOrEqual(before - CENT);
    });
  });
});

describe("cine ascultă de cifra zilei nu rămâne fără bani", () => {
  it("cheltuind exact cât spune Astăzi, plicul de alimente nu iese pe minus în nicio săptămână", () => {
    let data = familyAtPayday();
    const days: number[] = [];
    for (let day = PERIOD_START; day < PAYDAY; day = addIsoDays(day, 1)) {
      atNoon(day);
      const { brief } = checkInvariants(data, day);
      const amount = Math.floor(brief.spendable * 100) / 100;
      days.push(amount);
      if (amount > 0) data = commitLedgerEntry(data, { id: `obey-${day}`, title: "Cât spune Astăzi", amount, kind: "expense", category: "Alimente", sourceId: CARD, source: "Card Ion", memberId: ME, person: "Ion", date: day, allocationId: FOOD });
      for (const week of allocationWeeksStatus(data, data.settings.salaryPlan.allocations.find((item) => item.id === FOOD)!))
        expect(week.remaining, `${day}: S${week.index} pe minus`).toBeGreaterThanOrEqual(-CENT);
    }
    // Și nu stă degeaba: aproape tot plicul ajunge folosit, fără zile cu 0 în mijlocul lunii.
    const food = data.settings.salaryPlan.allocations.find((item) => item.id === FOOD)!;
    expect(allocationStatus(data, food).remaining).toBeLessThan(food.amount * 0.1);
    expect(days.slice(0, -3).filter((amount) => amount <= 0)).toEqual([]);
  });
});
