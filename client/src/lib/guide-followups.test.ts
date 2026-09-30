import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { addOnSpend, correctPendingSpend } from "./understand";
import { shiftDay } from "./proposal-date";

const house = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  data.settings.paymentSources = [
    { id: "card", name: "Card debit", kind: "card", memberId: me.id, openingBalance: 3000 },
    { id: "cash", name: "Cash", kind: "cash", memberId: me.id, openingBalance: 500 },
  ];
  data.settings.salaryPlan.allocations = [
    { id: "env-food", label: "Alimente", category: "Alimente", amount: 1500, sourceId: "card", weeklyPace: false },
    { id: "env-fun", label: "Distracție", category: "Timp liber", amount: 300, sourceId: "card", weeklyPace: false },
  ];
  return data;
};

const onScreen = { amount: 50, title: "Benzină", category: "Transport", date: shiftDay(0) };

describe("conversația continuă pe propunerea deschisă", () => {
  it("„de fapt 55”, „era 55”, „am vrut să zic 55” schimbă suma", () => {
    for (const text of ["de fapt 55", "era 55", "am vrut sa zic 55", "de fapt au fost 55 lei"]) {
      expect(correctPendingSpend(text, onScreen, house())?.spend?.amount, text).toBe(55);
    }
  });

  it("„a fost ieri” schimbă doar ziua", () => {
    const out = correctPendingSpend("a fost ieri", onScreen, house());
    expect(out?.spend).toMatchObject({ amount: 50, date: shiftDay(-1) });
    expect(out?.choices[0].update).toMatchObject({ date: shiftDay(-1) });
  });

  it("„pune-o pe cash” mută sursa", () => {
    const out = correctPendingSpend("pune-o pe cash", onScreen, house());
    expect(out?.spend?.sourceHint).toBe("cash");
    expect(out?.choices.every((choice) => choice.update.kind === "expense" && choice.update.sourceId === "cash")).toBe(true);
  });

  it("„din plicul distracție” urcă plicul acela primul", () => {
    const out = correctPendingSpend("din plicul distractie", onScreen, house());
    expect(out?.choices[0].update).toMatchObject({ allocationId: "env-fun" });
    expect(out?.spend?.allocationId).toBe("env-fun");
  });

  it("„și 30 parcare” e încă o cheltuială, în ziua primei", () => {
    const out = addOnSpend("și 30 parcare", { ...onScreen, date: shiftDay(-1) }, house());
    expect(out?.spend).toMatchObject({ amount: 30, date: shiftDay(-1) });
    expect(addOnSpend("parcare 30", onScreen, house())).toBeUndefined();
  });

  it("o cheltuială nouă nu e luată drept corectură", () => {
    expect(correctPendingSpend("am dat 20 pe paine", onScreen, house())).toBeUndefined();
  });
});
