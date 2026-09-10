/**
 * Regresii pentru erorile găsite la auditul din 10 septembrie 2026.
 * Fiecare test eșua înainte de corecție și descrie efectul vizibil pentru utilizator.
 */
import { describe, expect, it } from "vitest";
import { mergeFamilyData } from "./family-crypto";
import {
  allocationSpent,
  allocationStatus,
  allocationWeeksStatus,
  confirmRecurringPayment,
  createEmptyAppData,
  isoDate,
  pendingRecurringInPlan,
  recurringDueForMonth,
  transferBetweenEnvelopes,
  weeklySummary,
  type Debt,
  type SavingsGoal,
} from "./finance-data";
import { interpretReceiptText, parseReceiptItems } from "./receipt-utils";
import { checkInRebalance } from "./household-insights";

const planWithFlex = () => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-09-01", nextPayday: "2026-09-28", paydayFlexDays: 3, allocations: [{ id: "alloc-1", label: "Alimente", amount: 1400, category: "Alimente" }] };
  return data;
};

describe("data calendaristică locală", () => {
  it("folosește componentele locale, nu ziua UTC", () => {
    // 31 decembrie la ora 23:00 local rămâne 31 decembrie, indiferent de fusul orar.
    expect(isoDate(new Date(2026, 11, 31, 23, 0, 0))).toBe("2026-12-31");
    // 1 ianuarie la 00:30 local rămâne 1 ianuarie, deși în UTC este încă 31 decembrie în România.
    expect(isoDate(new Date(2027, 0, 1, 0, 30, 0))).toBe("2027-01-01");
  });

  it("păstrează ultima zi a lunii într-un interval calendaristic", () => {
    // `new Date(2026, 9, 0)` este 30 septembrie la miezul nopții local; conversia UTC o ducea pe 29.
    expect(isoDate(new Date(2026, 9, 0))).toBe("2026-09-30");
    expect(isoDate(new Date(2026, 2, 0))).toBe("2026-02-28");
  });

  it("ține scadența de zi 31 în interiorul lunii scurte", () => {
    const item = { id: "r", name: "Chirie", amount: 100, category: "Casă & facturi", sourceId: "s", memberId: "m", dueDay: 31, active: true };
    expect(recurringDueForMonth(item, "2026-02-10")).toBe("2026-02-28");
    expect(recurringDueForMonth(item, "2026-09-10")).toBe("2026-09-30");
  });

  it("închide săptămâna luni–duminică pe zile locale", () => {
    const summary = weeklySummary(createEmptyAppData(), "2026-09-10");
    expect(summary.start).toBe("2026-09-07");
    expect(summary.end).toBe("2026-09-13");
  });
});

describe("unirea a două telefoane", () => {
  it("păstrează datoriile și obiectivele salvate fără marcaj de timp", () => {
    const local = createEmptyAppData();
    const remote = createEmptyAppData();
    const debt: Debt = { id: "debt-1", name: "Card", remaining: 1200, monthly: 200, due: "Nespecificat", tone: "coral" };
    const goal: SavingsGoal = { id: "goal-1", name: "Vacanță", current: 100, target: 1000, due: "Fără termen", tone: "honey" };
    local.debts = [debt];
    local.savings = [goal];
    const merged = mergeFamilyData(local, remote);
    expect(merged.debts.map((item) => item.id)).toEqual(["debt-1"]);
    expect(merged.savings.map((item) => item.id)).toEqual(["goal-1"]);
  });

  it("nu readuce un element șters, chiar dacă nu are marcaj de timp", () => {
    const local = createEmptyAppData();
    const remote = createEmptyAppData();
    remote.debts = [{ id: "debt-1", name: "Card", remaining: 1200, monthly: 200, due: "Nespecificat", tone: "coral" }];
    local.deleted = [{ entity: "debts", id: "debt-1", deletedAt: "2026-09-10T08:00:00.000Z" }];
    expect(mergeFamilyData(local, remote).debts).toEqual([]);
  });
});

describe("plăți recurente", () => {
  const planned = () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-09-01", nextPayday: "2026-09-30" };
    data.recurring = [{ id: "rec-1", name: "Internet", amount: 60, category: "Casă & facturi", sourceId: "source-debit", memberId: "member-me", dueDay: 5, active: true }];
    return data;
  };

  it("înregistrează plata o singură dată pe perioadă", () => {
    const data = planned();
    const once = confirmRecurringPayment(data, "rec-1");
    expect(once?.transactions).toHaveLength(1);
    expect(once?.transactions[0].date).toBe("2026-09-05");
    expect(pendingRecurringInPlan(once!)).toEqual([]);
    expect(confirmRecurringPayment(once!, "rec-1")).toBeUndefined();
  });
});

describe("citirea bonului", () => {
  it("păstrează două produse identice cumpărate împreună", () => {
    const items = parseReceiptItems(["PAINE 3,00", "PAINE 3,00", "LAPTE 7,00", "TOTAL 13,00"]);
    expect(items.map((item) => `${item.label} ${item.amount}`)).toEqual(["PAINE 3", "PAINE 3", "LAPTE 7"]);
  });

  it("elimină o linie citită de două ori din poze suprapuse", () => {
    const items = parseReceiptItems(["PAINE 3,00", "LAPTE 7,00", "LAPTE 7,00", "TOTAL 10,00"]);
    expect(items.map((item) => item.label)).toEqual(["PAINE", "LAPTE"]);
  });

  it("ignoră o dată imposibilă în loc să o salveze", () => {
    expect(interpretReceiptText(["MAGAZIN TEST", "BON 45/45/2026", "PAINE 3,00", "TOTAL 3,00"]).date).toBeUndefined();
    expect(interpretReceiptText(["MAGAZIN TEST", "31/02/2026", "PAINE 3,00", "TOTAL 3,00"]).date).toBeUndefined();
  });

  it("citește o dată românească validă, zi înaintea lunii", () => {
    expect(interpretReceiptText(["MAGAZIN TEST", "07.09.2026 14:22", "PAINE 3,00", "TOTAL 3,00"]).date).toBe("2026-09-07");
  });
});

describe("fereastra de flexibilitate a salariului", () => {
  it("arată în ultima tranșă cheltuiala din zilele de flexibilitate", () => {
    const data = planWithFlex();
    const allocation = data.settings.salaryPlan.allocations[0];
    data.transactions = [{ id: "t1", title: "Piață", amount: 90, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "source-debit", person: "Eu", memberId: "member-me", date: "2026-09-30", allocationId: "alloc-1" }];
    const weeks = allocationWeeksStatus(data, allocation);
    const last = weeks[weeks.length - 1];
    // Cheltuiala scade oricum din totalul plicului; trebuie să apară și într-o tranșă.
    expect(allocationSpent(data, allocation)).toBe(90);
    expect(last.end).toBe("2026-10-01");
    expect(last.spent).toBe(90);
    expect(weeks.reduce((sum, week) => sum + week.spent, 0)).toBe(allocationSpent(data, allocation));
  });

  it("nu schimbă sumele tranșelor când se prelungește ultima", () => {
    const weeks = allocationWeeksStatus(planWithFlex(), planWithFlex().settings.salaryPlan.allocations[0]);
    expect(Math.round(weeks.reduce((sum, week) => sum + week.budget, 0))).toBe(1400);
  });
});

describe("recunoașterea magazinului", () => {
  it("alege lanțul cunoscut, nu primul rând din antetul legal", () => {
    const result = interpretReceiptText(["SC EXPERT MAGAZIN COMPANY", "LIDL DISCOUNT S.R.L.", "STR. GARII NR. 4", "PAINE 3,00", "TOTAL 3,00"]);
    expect(result.vendor).toBe("Lidl");
  });
});

describe("propunerea de reechilibrare din check-in", () => {
  const withEnvelopes = (spent: Array<[string, number]>) => {
    const data = createEmptyAppData();
    data.settings.salaryPlan = {
      ...data.settings.salaryPlan,
      periodStart: "2026-09-01",
      nextPayday: "2026-09-30",
      allocations: [
        { id: "alimente", label: "Alimente", category: "Alimente", amount: 1000 },
        { id: "liber", label: "Timp liber", category: "Timp liber", amount: 600 },
        { id: "transport", label: "Transport", category: "Transport", amount: 300 },
      ],
    };
    data.transactions = spent.map(([allocationId, amount], index) => ({
      id: `t${index}`, title: "Cheltuială", amount, kind: "expense" as const, category: "Alimente",
      source: "Card debit", sourceId: "source-debit", person: "Eu", memberId: "member-me",
      date: "2026-09-08", allocationId,
    }));
    return data;
  };

  it("ia din plicul cu cel mai mult rămas și acoperă deficitul", () => {
    const data = withEnvelopes([["alimente", 1120], ["liber", 100], ["transport", 50]]);
    expect(checkInRebalance(data)).toMatchObject({ fromId: "liber", toId: "alimente", amount: 120, deficit: 120, covers: true });
  });

  it("nu propune mai mult decât a rămas în plicul donator", () => {
    const data = withEnvelopes([["alimente", 1900], ["liber", 300], ["transport", 290]]);
    const proposal = checkInRebalance(data);
    // Timp liber are 300 rămași; deficitul de la Alimente este 900.
    expect(proposal).toMatchObject({ fromId: "liber", amount: 300, deficit: 900, covers: false });
  });

  it("propune un transfer pe care planul chiar îl acceptă", () => {
    const data = withEnvelopes([["alimente", 1120], ["liber", 100], ["transport", 50]]);
    const proposal = checkInRebalance(data)!;
    const next = transferBetweenEnvelopes(data, { fromAllocationId: proposal.fromId, toAllocationId: proposal.toId, amount: proposal.amount });
    expect(next).toBeDefined();
    expect(allocationStatus(next!, next!.settings.salaryPlan.allocations.find((item) => item.id === "alimente")!).remaining).toBe(0);
  });

  it("tace când niciun plic nu este depășit", () => {
    expect(checkInRebalance(withEnvelopes([["alimente", 100]]))).toBeUndefined();
  });

  it("tace când niciun plic nu are de unde da", () => {
    const data = withEnvelopes([["alimente", 1100], ["liber", 600], ["transport", 300]]);
    expect(checkInRebalance(data)).toBeUndefined();
  });
});
