import { describe, expect, it } from "vitest";
import { parseModelIntents } from "./assistant-intents";

const AZI = "2026-09-11";
const read = (value: unknown) => parseModelIntents(value, { asOf: AZI }).map((item) => item.intent);

describe("ce trece de la model în registru", () => {
  it("citește o cheltuială completă", () => {
    expect(read([{ kind: "expense", amount: 49.9, category: "Alimente", title: "Lidl", date: "2026-09-10" }]))
      .toEqual([{ kind: "expense", amount: 49.9, category: "Alimente", title: "Lidl", date: "2026-09-10" }]);
  });

  it("citește mai multe intenții dintr-un singur mesaj", () => {
    const out = read([
      { kind: "envelope", label: "Alimente", amount: 2400, weeklyLimit: 600, weeklyPace: true },
      { kind: "payday", date: "2026-10-07", flexDays: 3 },
    ]);
    expect(out.map((item) => item.kind)).toEqual(["envelope", "payday"]);
  });

  it("acceptă o sumă scrisă ca text cu virgulă", () => {
    expect(read([{ kind: "expense", amount: "15,50", category: "Alimente" }])[0]).toMatchObject({ amount: 15.5 });
  });
});

describe("evenimente viitoare spuse modelului", () => {
  it("citește un eveniment cu dată și cost", () => {
    expect(read([{ kind: "planned-event", name: "Crăciun", date: "2026-12-25", estimate: 1200 }]))
      .toEqual([{ kind: "planned-event", name: "Crăciun", date: "2026-12-25", estimate: 1200, repeat: "yearly" }]);
  });

  it("acceptă un eveniment fără cost — suma se scrie mai târziu", () => {
    expect(read([{ kind: "planned-event", name: "Ziua Anei", date: "2026-10-18" }])[0])
      .toMatchObject({ estimate: 0, repeat: "yearly" });
  });

  it("păstrează „o singură dată” când așa s-a spus", () => {
    expect(read([{ kind: "planned-event", name: "Nuntă", date: "2027-06-12", estimate: 800, repeat: "once" }])[0])
      .toMatchObject({ repeat: "once" });
  });

  it("primește suma și sub numele folosit de celelalte feluri", () => {
    expect(read([{ kind: "planned-event", label: "Paște", date: "2027-05-02", amount: 500 }])[0])
      .toMatchObject({ name: "Paște", estimate: 500 });
  });

  it("nu notează un eveniment fără dată sau fără nume — ar ateriza în altă zi", () => {
    expect(read([{ kind: "planned-event", name: "Crăciun", estimate: 1200 }])).toEqual([]);
    expect(read([{ kind: "planned-event", date: "2026-12-25", estimate: 1200 }])).toEqual([]);
  });

  it("nu acceptă o dată imposibilă", () => {
    expect(read([{ kind: "planned-event", name: "Crăciun", date: "2026-02-31" }])).toEqual([]);
  });
});

describe("ajustări de plic venite de la model", () => {
  it("păstrează sensul spus de model", () => {
    expect(read([{ kind: "envelope", label: "Alimente", amount: 200, delta: "increase" }])[0])
      .toMatchObject({ kind: "envelope", label: "Alimente", amount: 200, delta: "increase" });
    expect(read([{ kind: "envelope", label: "Transport", amount: 100, delta: "decrease" }])[0])
      .toMatchObject({ delta: "decrease" });
  });

  it("ignoră un sens inventat și tratează suma ca total, ca până acum", () => {
    const intent = read([{ kind: "envelope", label: "Alimente", amount: 1800, delta: "triple" }])[0];
    expect(intent).not.toHaveProperty("delta");
    expect(intent).toMatchObject({ amount: 1800 });
  });
});

describe("ștergerea cerută de model", () => {
  it("trece cu numele plicului", () => {
    expect(read([{ kind: "envelope-delete", label: "Transport" }])[0]).toEqual({ kind: "envelope-delete", label: "Transport" });
  });

  it("nu trece fără nume", () => {
    expect(read([{ kind: "envelope-delete" }])).toEqual([]);
  });
});

describe("ce NU trece — registrul omului nu se scrie din ghicite", () => {
  it("nu crede o formă care nu e listă", () => {
    for (const bad of [null, undefined, {}, "expense", 7, true]) expect(read(bad)).toEqual([]);
  });

  it("aruncă rândurile care nu sunt obiecte", () => {
    expect(read(["expense", null, 3, []])).toEqual([]);
  });

  it("aruncă un fel de intenție necunoscut", () => {
    expect(read([{ kind: "stergeTot", amount: 10 }])).toEqual([]);
  });

  it("aruncă sumele lipsă, zero sau negative", () => {
    expect(read([{ kind: "expense", category: "Alimente" }])).toEqual([]);
    expect(read([{ kind: "expense", amount: 0, category: "Alimente" }])).toEqual([]);
    expect(read([{ kind: "expense", amount: -40, category: "Alimente" }])).toEqual([]);
  });

  it("aruncă sumele care nu sunt numere", () => {
    for (const bad of [NaN, Infinity, "multe", {}, []]) {
      expect(read([{ kind: "income", amount: bad, title: "Salariu" }])).toEqual([]);
    }
  });

  it("aruncă o cheltuială fără categorie", () => {
    expect(read([{ kind: "expense", amount: 40, title: "Ceva" }])).toEqual([]);
  });

  it("cade pe ziua de azi când data e stricată, dar nu inventează o dată imposibilă", () => {
    expect(read([{ kind: "expense", amount: 40, category: "Alimente", date: "2026-02-30" }])[0]).toMatchObject({ date: AZI });
    expect(read([{ kind: "expense", amount: 40, category: "Alimente", date: "mâine" }])[0]).toMatchObject({ date: AZI });
    expect(read([{ kind: "expense", amount: 40, category: "Alimente", date: "1899-01-01" }])[0]).toMatchObject({ date: AZI });
  });

  it("o zi de scadență în afara lunii aruncă scadența", () => {
    expect(read([{ kind: "recurring", name: "Chirie", amount: 1500, dueDay: 45 }])).toEqual([]);
    expect(read([{ kind: "recurring", name: "Chirie", amount: 1500, dueDay: 0 }])).toEqual([]);
  });

  it("o dată de salariu imposibilă aruncă intenția, nu o repară", () => {
    expect(read([{ kind: "payday", date: "2026-13-01" }])).toEqual([]);
    expect(read([{ kind: "payday" }])).toEqual([]);
  });

  it("nu lasă limita săptămânală să depășească plicul", () => {
    expect(read([{ kind: "envelope", label: "Alimente", amount: 500, weeklyLimit: 9000 }])[0]).toMatchObject({ weeklyLimit: undefined });
  });

  it("nu lasă suma strânsă să depășească ținta", () => {
    expect(read([{ kind: "goal", name: "Concediu", target: 1000, current: 5000 }])[0]).toMatchObject({ current: undefined });
  });

  it("păstrează ce e bun și aruncă doar ce e stricat", () => {
    const out = read([
      { kind: "expense", amount: 40, category: "Alimente" },
      { kind: "expense", amount: -1, category: "Alimente" },
      { kind: "income", amount: 5000, title: "Salariu" },
    ]);
    expect(out.map((item) => item.kind)).toEqual(["expense", "income"]);
  });

  it("nu acceptă un răspuns nesfârșit", () => {
    const many = Array.from({ length: 50 }, () => ({ kind: "expense", amount: 10, category: "Alimente" }));
    expect(read(many).length).toBeLessThanOrEqual(8);
  });

  it("taie textele lungi în loc să le lase să umple ecranul", () => {
    const out = read([{ kind: "expense", amount: 40, category: "Alimente", title: "x".repeat(500) }]);
    expect(out[0]).toMatchObject({ kind: "expense" });
    expect((out[0] as { title: string }).title.length).toBeLessThanOrEqual(80);
  });
});

/**
 * Modelul întoarce uneori doar jumătate din ce a spus omul. Aplicația are mesajul original,
 * deci poate completa ce e scris acolo negru pe alb — fără să ghicească nimic în plus.
 */
describe("reparația din cuvintele omului", () => {
  const cu = (value: unknown, message: string) => parseModelIntents(value, { asOf: AZI, message }).map((item) => item.intent);

  it("pune ritmul săptămânal când fraza îl cere, iar modelul l-a uitat", () => {
    const mesaj = "Am un buget de 1800, îl pui în plic alimente și în părți pe săptămâni până iau salariul";
    expect(cu([{ kind: "envelope", label: "Alimente", amount: 1800 }], mesaj)[0]).toMatchObject({ weeklyPace: true });
  });

  it("nu inventează ritm acolo unde nimeni nu l-a cerut", () => {
    expect(cu([{ kind: "envelope", label: "Alimente", amount: 1800 }], "pune 1800 în plic alimente")[0]).toMatchObject({ weeklyPace: false });
  });

  it("nu atinge o ajustare de plic", () => {
    expect(cu([{ kind: "envelope", label: "Alimente", amount: 200, delta: "increase" }], "mai pune 200 pe saptamani")[0]).toMatchObject({ delta: "increase" });
  });
});

/**
 * Ce spune modelul despre lucruri care există deja: o mutare între plicuri, o punere
 * deoparte pentru un eveniment, o scadență plătită. Forma se verifică aici; existența
 * plicului sau a evenimentului o verifică `resolveIntents`, cu registrul în față.
 */
describe("lucrurile care se leagă de registru", () => {
  it("citește o mutare între două plicuri", () => {
    expect(read([{ kind: "transfer", from: "Transport", to: "Alimente", amount: 200 }]))
      .toEqual([{ kind: "transfer", from: "Transport", to: "Alimente", amount: 200 }]);
  });

  it("nu mută din plic în el însuși și nu mută fără sumă", () => {
    expect(read([{ kind: "transfer", from: "Alimente", to: "alimente", amount: 200 }])).toEqual([]);
    expect(read([{ kind: "transfer", from: "Transport", to: "Alimente" }])).toEqual([]);
  });

  it("citește o punere deoparte pentru un eveniment", () => {
    expect(read([{ kind: "event-contribution", name: "Crăciun", amount: 300 }]))
      .toEqual([{ kind: "event-contribution", name: "Crăciun", amount: 300, date: undefined }]);
  });

  it("citește o scadență plătită, fără sumă de la model", () => {
    expect(read([{ kind: "due-paid", name: "Chirie" }]))
      .toEqual([{ kind: "due-paid", name: "Chirie", date: undefined }]);
  });
});

/**
 * Corecturi, reguli și navigare — lucrurile pe care modelul le putea doar povesti.
 * Registrul nu pleacă de pe telefon: mișcarea se descrie în cuvintele omului, iar
 * potrivirea cu rândul real se face local.
 */
describe("corecturi, reguli, ecrane", () => {
  it("citește o ștergere descrisă în cuvintele omului", () => {
    expect(read([{ kind: "transaction-delete", title: "cafea", amount: 12, date: "2026-09-10" }])[0])
      .toEqual({ kind: "transaction-delete", title: "cafea", amount: 12, date: "2026-09-10", last: undefined });
    expect(read([{ kind: "transaction-delete", last: true }])[0]).toMatchObject({ kind: "transaction-delete", last: true });
  });

  it("nu șterge la întâmplare: fără niciun semn, cererea cade", () => {
    expect(read([{ kind: "transaction-delete" }])).toEqual([]);
  });

  it("citește o corectare de sumă", () => {
    expect(read([{ kind: "transaction-amend", amount: 60, was: 50, title: "Lidl" }])[0])
      .toMatchObject({ kind: "transaction-amend", amount: 60, was: 50, title: "Lidl" });
    // Fără suma corectă nu există corectare.
    expect(read([{ kind: "transaction-amend", was: 50 }])).toEqual([]);
  });

  it("citește o regulă de magazin, dar nu una fără destinație", () => {
    expect(read([{ kind: "merchant-rule", match: "Lidl", category: "Alimente" }])[0])
      .toMatchObject({ kind: "merchant-rule", match: "Lidl", category: "Alimente" });
    expect(read([{ kind: "merchant-rule", match: "Lidl" }])).toEqual([]);
  });

  it("citește o repartizare automată a venitului", () => {
    expect(read([{ kind: "salary-rule", envelope: "Economii", mode: "percent", value: 20 }])[0])
      .toMatchObject({ kind: "salary-rule", envelope: "Economii", mode: "percent", value: 20 });
    // Procentul nu trece de 100.
    expect(read([{ kind: "salary-rule", envelope: "Economii", mode: "percent", value: 140 }])).toEqual([]);
  });

  it("citește doar ecrane care există", () => {
    expect(read([{ kind: "open", screen: "plan" }])[0]).toEqual({ kind: "open", screen: "plan" });
    expect(read([{ kind: "open", screen: "bitcoin" }])).toEqual([]);
  });
});
