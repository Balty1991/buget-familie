import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { analyze } from "./analyst";

const AZI = "2026-09-11";

const family = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  data.settings.members.push({ id: "m2", name: "Ioana" });
  data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", memberId: me.id, openingBalance: 4000 }];
  data.transactions = [
    { id: "t1", title: "Lidl", amount: 240, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: me.name, memberId: me.id, date: "2026-09-08" },
    { id: "t2", title: "Farmacie", amount: 95, kind: "expense", category: "Sănătate", source: "Card debit", sourceId: "card", person: "Ioana", memberId: "m2", date: "2026-09-09" },
    { id: "t3", title: "Taxi", amount: 35, kind: "expense", category: "Transport", source: "Card debit", sourceId: "card", person: "Ioana", memberId: "m2", date: "2026-09-10" },
  ];
  return data;
};

describe("cât a cheltuit fiecare", () => {
  it("socotește doar cheltuielile persoanei întrebate", () => {
    const out = analyze("cât a cheltuit soția luna asta?", family(), AZI);
    expect(out?.headline).toContain("130");
    expect(out?.headline).toContain("Ioana");
  });

  it("o recunoaște și după nume, nu doar după «soția»", () => {
    expect(analyze("cât a cheltuit Ioana luna asta?", family(), AZI)?.headline).toContain("130");
  });

  it("pe ce a dat banii, tot pe persoana întrebată", () => {
    const out = analyze("pe ce a dat soția banii?", family(), AZI);
    expect(out?.headline).toMatch(/Sănătate|Transport/);
    expect(out?.headline).not.toMatch(/Alimente/);
  });

  it("fără persoană în întrebare, răspunde despre toți", () => {
    expect(analyze("cât am cheltuit luna asta?", family(), AZI)?.headline).toContain("370");
  });

  it("spune pe față când persoana întrebată nu e în familie", () => {
    const singur = family();
    singur.settings.members = [singur.settings.members[0]];
    const out = analyze("cât a cheltuit soția luna asta?", singur, AZI);
    expect(out?.headline).toMatch(/singur/i);
  });
});
