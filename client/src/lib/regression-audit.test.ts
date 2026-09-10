/**
 * Regresii pentru erorile găsite la auditul din 10 septembrie 2026.
 * Fiecare test eșua înainte de corecție și descrie efectul vizibil pentru utilizator.
 */
import { describe, expect, it } from "vitest";
import { mergeFamilyData } from "./family-crypto";
import {
  confirmRecurringPayment,
  createEmptyAppData,
  isoDate,
  pendingRecurringInPlan,
  recurringDueForMonth,
  weeklySummary,
  type Debt,
  type SavingsGoal,
} from "./finance-data";
import { interpretReceiptText, parseReceiptItems } from "./receipt-utils";

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
