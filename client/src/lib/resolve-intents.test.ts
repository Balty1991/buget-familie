/**
 * Poarta dintre ce spune modelul și ce există în registrul omului.
 *
 * Cazul care a cerut fișierul: modelul răspundea „am mutat 200 din Transport în Alimente”
 * la o familie care nu are plicul „Transport”. Intenția era aruncată în tăcere, iar omul
 * rămânea cu textul care povestea o mutare ce nu s-a întâmplat.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { resolveIntents } from "./understand";
import { parseModelIntents } from "./assistant-intents";

const house = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", memberId: me.id, openingBalance: 3000 }];
  data.settings.salaryPlan.periodStart = "2026-09-14";
  data.settings.salaryPlan.nextPayday = "2026-10-09";
  data.settings.salaryPlan.allocations = [
    { id: "env-food", label: "Alimente", category: "Alimente", amount: 900, sourceId: "card" },
    { id: "env-trans", label: "Transport", category: "Transport", amount: 400, sourceId: "card" },
  ];
  data.settings.plannedEvents = [{ id: "ev-craciun", name: "Crăciun", date: "2026-12-25", estimate: 1200, repeat: "yearly" }];
  data.recurring = [{ id: "rec-chirie", name: "Chirie", amount: 1500, dueDay: 5, category: "Casă & facturi", sourceId: "card", memberId: me.id, active: true }];
  return data;
};

const read = (value: unknown, data = house()) => resolveIntents(parseModelIntents(value, { asOf: "2026-09-21" }), data);

describe("ce spune modelul se leagă de registru sau se spune pe față", () => {
  it("leagă mutarea de plicurile reale și le scrie numele exact", () => {
    const { kept, missing } = read([{ kind: "transfer", from: "transport", to: "alimente", amount: 200 }]);
    expect(missing).toEqual([]);
    expect(kept[0].intent).toEqual({ kind: "transfer", from: "Transport", to: "Alimente", amount: 200 });
  });

  it("spune ce plic lipsește, în loc să arunce cererea", () => {
    const { kept, missing } = read([{ kind: "transfer", from: "Benzină", to: "Alimente", amount: 200 }]);
    expect(kept).toEqual([]);
    expect(missing.join(" ")).toMatch(/Benzină/);
  });

  it("găsește evenimentul și scadența după rădăcina numelui", () => {
    const pus = read([{ kind: "event-contribution", name: "craciun", amount: 300 }]);
    expect(pus.kept[0].intent).toMatchObject({ kind: "event-contribution", name: "Crăciun", amount: 300 });
    const platit = read([{ kind: "due-paid", name: "chiria" }]);
    expect(platit.kept[0].intent).toMatchObject({ kind: "due-paid", name: "Chirie" });
  });

  it("un eveniment nenotat nu primește bani deoparte", () => {
    const { kept, missing } = read([{ kind: "event-contribution", name: "Vacanța în Grecia", amount: 300 }]);
    expect(kept).toEqual([]);
    expect(missing.join(" ")).toMatch(/Vacanța/);
  });

  it("ce nu se leagă de nimic existent trece neatins", () => {
    const { kept, missing } = read([{ kind: "expense", amount: 50, category: "Alimente", title: "Lidl" }]);
    expect(missing).toEqual([]);
    expect(kept).toHaveLength(1);
  });

  it("păstrează ce se poate și spune separat ce nu", () => {
    const { kept, missing } = read([
      { kind: "expense", amount: 50, category: "Alimente", title: "Lidl" },
      { kind: "transfer", from: "Pisici", to: "Alimente", amount: 10 },
    ]);
    expect(kept).toHaveLength(1);
    expect(missing).toHaveLength(1);
  });
});
