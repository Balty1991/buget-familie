import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { paidRecurringProposal, reviseProposal, correctPendingSpend, receiptDetails } from "./understand";

const house = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", memberId: me.id, openingBalance: 3000 }];
  data.settings.salaryPlan.periodStart = "2026-09-01";
  data.settings.salaryPlan.nextPayday = "2026-10-01";
  data.recurring = [{ id: "rec-chirie", name: "Chirie", amount: 1500, dueDay: 5, category: "Casă & facturi", sourceId: "card", memberId: me.id, active: true }];
  // Mișcările noi se pun în față: prima este cea mai recentă.
  data.transactions = [
    { id: "tx-nou", title: "Cafea", amount: 50, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: me.name, memberId: me.id, date: "2026-09-10" },
    { id: "tx-vechi", title: "Lidl", amount: 240, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: me.name, memberId: me.id, date: "2026-09-08" },
  ];
  return data;
};

const alege = (raw: string, data = house()) => reviseProposal(raw, data)?.choices[0]?.update;

describe("ștergerea ultimei mișcări", () => {
  it("propune ștergerea celei mai recente, numind-o", () => {
    expect(alege("șterge ultima cheltuială")).toMatchObject({ kind: "delete-transaction", id: "tx-nou", title: "Cafea" });
    expect(reviseProposal("șterge ultima cheltuială", house())?.text).toContain("Cafea");
  });

  it("merge și fără diacritice, și cu «anulează»", () => {
    expect(alege("sterge ultima miscare")).toMatchObject({ id: "tx-nou" });
    expect(alege("anulează ce am adăugat")).toMatchObject({ id: "tx-nou" });
  });

  it("nu confundă o cerere de ștergere cu altceva", () => {
    expect(reviseProposal("am dat 50 lei pe cafea", house())).toBeUndefined();
    expect(reviseProposal("șterge", house())).toBeUndefined();
  });

  it("spune pe față când nu are ce șterge", () => {
    const gol = house();
    gol.transactions = [];
    const out = reviseProposal("șterge ultima cheltuială", gol);
    expect(out?.choices).toEqual([]);
    expect(out?.text).toMatch(/nu am ce șterge/i);
  });
});

describe("corectarea sumei", () => {
  it("«era 60 nu 50» găsește mișcarea de 50 și o face 60", () => {
    expect(alege("am greșit, era 60 nu 50")).toMatchObject({ kind: "amend-transaction", id: "tx-nou", amount: 60, was: 50 });
  });

  it("«schimbă suma în 75» se aplică pe ultima mișcare", () => {
    expect(alege("schimbă suma în 75")).toMatchObject({ kind: "amend-transaction", id: "tx-nou", amount: 75 });
  });

  it("spune când nu găsește suma greșită, în loc să corecteze altceva", () => {
    const out = reviseProposal("era 60 nu 999", house());
    expect(out?.choices).toEqual([]);
    expect(out?.text).toContain("999");
  });
});

describe("o scadență plătită, fără să repeți suma", () => {
  it("propune suma din Plan, deși fraza nu are cifre", () => {
    const out = paidRecurringProposal("am plătit chiria", house());
    expect(out?.choices[0]?.update).toMatchObject({ kind: "expense", amount: 1500, title: "Chirie" });
  });

  it("nu o propune a doua oară în aceeași perioadă", () => {
    const data = house();
    data.transactions.unshift({ id: "tx-chirie", title: "Chirie", amount: 1500, kind: "expense", category: "Casă & facturi", source: "Card debit", sourceId: "card", person: data.settings.members[0].name, memberId: data.settings.members[0].id, date: "2026-09-05", recurringId: "rec-chirie" });
    const out = paidRecurringProposal("am plătit chiria", data);
    expect(out?.choices).toEqual([]);
    expect(out?.text).toMatch(/deja trecută/i);
  });

  it("cu sumă scrisă, o lasă cheltuielii obișnuite", () => {
    expect(paidRecurringProposal("am plătit chiria 1400", house())).toBeUndefined();
  });

  it("leagă plata de scadență și de plicul categoriei", () => {
    const data = house();
    data.settings.salaryPlan.allocations = [{ id: "env-house", label: "Casă & facturi", category: "Casă & facturi", amount: 2000, sourceId: "card", weeklyPace: false }];
    const out = paidRecurringProposal("am plătit chiria", data);
    expect(out?.choices[0]?.update).toMatchObject({
      kind: "expense",
      amount: 1500,
      title: "Chirie",
      recurringId: "rec-chirie",
      allocationId: "env-house",
    });
  });
});

describe("corectura propunerii încă deschise", () => {
  const pending = { amount: 7.99, title: "Jud. teleorman", category: "Alimente", date: "2026-09-29", vendor: "Jud. teleorman", receipt: true };

  it("«nu e 7,99, e 66» schimbă totalul, nu caută o mișcare salvată", () => {
    const out = correctPendingSpend("nu e 7,99, e 66", pending, createEmptyAppData());
    expect(out?.spend?.amount).toBe(66);
    expect(out?.text).toMatch(/66/);
    expect(out?.text).not.toMatch(/7[,.]99/);
    expect(out?.text).toMatch(/Total bon/);
  });

  it("«totalul e 66» și «the total is 66» spun aceeași sumă", () => {
    expect(correctPendingSpend("totalul e 66 lei", pending, createEmptyAppData())?.spend?.amount).toBe(66);
    expect(correctPendingSpend("the total is 66", pending, createEmptyAppData())?.spend?.amount).toBe(66);
    expect(correctPendingSpend("nu, e 66", pending, createEmptyAppData())?.spend?.amount).toBe(66);
  });

  it("«magazinul e Mega Image» înlocuiește județul", () => {
    const out = correctPendingSpend("magazinul e Mega Image", pending, createEmptyAppData());
    expect(out?.spend?.title).toBe("Mega Image");
    expect(out?.text).toMatch(/Mega Image/);
    expect(out?.text).not.toMatch(/teleorman/i);
  });

  it("«nu e teleorman, e mega image» e magazin, iar «categoria e transport» e categorie", () => {
    expect(correctPendingSpend("nu e teleorman, e mega image", pending, createEmptyAppData())?.spend?.title).toBe("Mega Image");
    const moved = correctPendingSpend("categoria e transport", { ...pending, title: "Mega Image" }, createEmptyAppData());
    expect(moved?.spend?.category).toBe("Transport");
    expect(moved?.text).toMatch(/Transport/);
  });

  it("nu confundă o cheltuială nouă și nici corectura unei mișcări deja salvate", () => {
    expect(correctPendingSpend("am dat 20 lei pe pâine", pending, createEmptyAppData())).toBeUndefined();
    expect(correctPendingSpend("era 60 nu 50", pending, createEmptyAppData())).toBeUndefined();
    expect(correctPendingSpend("era 66 nu 7,99", pending, createEmptyAppData())?.spend?.amount).toBe(66);
  });

  it("când poza nu se închide, spune cum se corectează suma", () => {
    expect(receiptDetails({ amount: 7.99, confidence: "low" })).toMatch(/totalul e/);
  });
});
