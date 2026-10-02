import { describe, expect, it } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { emergencyFund, findEmergencyGoal } from "./emergency-fund";

const spend = (date: string, amount: number, extra: Partial<Transaction> = {}) => ({ id: `${date}-${amount}`, date, title: "x", amount, kind: "expense" as const, category: "Alimente", ...extra }) as Transaction;

describe("fondul de urgență", () => {
  it("socotește luna din cheltuieli și câte luni acoperă fondul", () => {
    const data = createEmptyAppData();
    data.transactions = [spend("2026-07-05", 3000), spend("2026-08-05", 3000), spend("2026-09-05", 3000), spend("2026-09-06", 999, { transferId: "t" })];
    data.savings = [{ id: "g", name: "Fond de urgență", current: 4500, target: 12000, due: "", tone: "forest" }];
    const fund = emergencyFund(data, "2026-10-02")!;
    expect(fund.basis).toBe("spending");
    expect(fund.monthly).toBe(Math.round((9000 * 30.44) / 90));
    expect(fund.months).toBe(1.4);
    expect(fund.target).toBe(12000);
    expect(fund.step).toBe(630);
  });

  it("fără trei săptămâni de mișcări, folosește plicurile; fără fond propune 3 luni", () => {
    const data = createEmptyAppData();
    data.transactions = [spend("2026-09-28", 500)];
    data.settings.salaryPlan.allocations = [{ id: "a", label: "Mâncare", category: "Alimente", amount: 2450, alertThreshold: 80 }];
    const fund = emergencyFund(data, "2026-10-02")!;
    expect(fund).toMatchObject({ basis: "plan", monthly: 2450, saved: 0, months: 0, target: 7400, step: 620 });
    expect(fund.goal).toBeUndefined();
  });

  it("recunoaște fondul după nume, și în engleză", () => {
    const goal = (name: string) => ({ id: name, name, current: 0, target: 1, due: "", tone: "forest" as const });
    expect(findEmergencyGoal([goal("Vacanță"), goal("Fond de siguranță")])?.name).toBe("Fond de siguranță");
    expect(findEmergencyGoal([goal("Emergency fund")])).toBeTruthy();
    expect(findEmergencyGoal([goal("Mașină")])).toBeUndefined();
  });
});
