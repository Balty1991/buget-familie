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
