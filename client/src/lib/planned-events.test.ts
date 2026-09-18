/**
 * Evenimentele viitoare sunt bani promiși unei date. Testele apără exact asta:
 * data corectă a ediției următoare (inclusiv Paștele, care se mută), ritmul calculat
 * pe zilele rămase și faptul că nimic nu se rostogolește singur peste banii strânși.
 */
import { describe, expect, it } from "vitest";
import {
  addContribution,
  daysBetween,
  eventSaved,
  followingOccurrence,
  nextOccurrence,
  occurrenceInMonth,
  orthodoxEaster,
  plannedEventStatus,
  plannedEventSuggestions,
  plannedEventsPressure,
  removeContribution,
  rollPlannedEvent,
  upcomingPlannedEvents,
  type PlannedEvent,
} from "./planned-events";

const event = (patch: Partial<PlannedEvent> = {}): PlannedEvent => ({
  id: "event-1",
  name: "Crăciun",
  date: "2026-12-25",
  estimate: 1200,
  kind: "holiday",
  repeat: "yearly",
  ...patch,
});

describe("Paștele ortodox", () => {
  it("dă datele reale ale anilor din jur", () => {
    expect(orthodoxEaster(2026)).toBe("2026-04-12");
    expect(orthodoxEaster(2027)).toBe("2027-05-02");
    expect(orthodoxEaster(2028)).toBe("2028-04-16");
    expect(orthodoxEaster(2025)).toBe("2025-04-20");
  });

  it("ține decalajul iulian pe secol, nu fix 13 zile", () => {
    // 2100 este primul an în care decalajul crește la 14 zile.
    expect(orthodoxEaster(2100)).toBe("2100-05-02");
  });
});

describe("proiecția în calendar", () => {
  it("păstrează data cât timp nu a trecut", () => {
    expect(nextOccurrence(event(), "2026-09-18")).toBe("2026-12-25");
  });

  it("arată ediția din anul următor pentru o zi de după sărbătoare", () => {
    expect(nextOccurrence(event(), "2026-12-26")).toBe("2027-12-25");
  });

  it("pune evenimentul anual în fiecare decembrie, nu doar în anul scris", () => {
    expect(occurrenceInMonth(event(), 2029, 11)).toBe("2029-12-25");
    expect(occurrenceInMonth(event(), 2029, 10)).toBe("");
  });

  it("proiectează Paștele în luna lui reală din fiecare an", () => {
    const paste = event({ date: orthodoxEaster(2026), anchor: "easter" });
    expect(occurrenceInMonth(paste, 2027, 4)).toBe("2027-05-02");
    expect(occurrenceInMonth(paste, 2027, 3)).toBe("");
  });

  it("nu proiectează în alt an un eveniment care se întâmplă o singură dată", () => {
    expect(occurrenceInMonth(event({ repeat: "once" }), 2029, 11)).toBe("");
    expect(followingOccurrence(event({ repeat: "once" }))).toBe("");
  });

  it("nu mișcă un eveniment care se întâmplă o singură dată", () => {
    expect(nextOccurrence(event({ repeat: "once", date: "2026-05-02" }), "2026-09-18")).toBe("2026-05-02");
  });

  it("recalculează Paștele în loc să mute ziua și luna", () => {
    const paste = event({ name: "Paște", date: orthodoxEaster(2026), anchor: "easter" });
    expect(nextOccurrence(paste, "2026-09-18")).toBe("2027-05-02");
  });

  it("păstrează distanța față de Paște pentru zilele legate de el", () => {
    // Florii: cu o săptămână înainte de Paște, deci tot mobile.
    const florii = event({ name: "Florii", date: "2026-04-05", anchor: "easter" });
    expect(nextOccurrence(florii, "2026-09-18")).toBe("2027-04-25");
  });

  it("aduce 29 februarie pe 28 în anii fără bisect", () => {
    expect(nextOccurrence(event({ date: "2028-02-29" }), "2028-03-01")).toBe("2029-02-28");
  });
});

describe("starea unui eveniment", () => {
  it("rămâne pe ediția scrisă, ca banii strânși să nu pară ai anului viitor", () => {
    const spent = addContribution(event({ estimate: 1200 }), 900, "2026-12-01");
    const status = plannedEventStatus(spent, "2026-12-26");
    expect(status.date).toBe("2026-12-25");
    expect(status.passed).toBe(true);
    expect(status.saved).toBe(900);
    expect(status.following).toBe("2027-12-25");
  });

  it("cere ritmul pe zilele rămase, nu pe un an întreg", () => {
    const status = plannedEventStatus(event({ estimate: 700 }), "2026-11-13");
    expect(status.daysLeft).toBe(42);
    expect(status.remaining).toBe(700);
    expect(status.perWeek).toBe(116.67);
    expect(status.perMonth).toBe(500);
  });

  it("scade din estimare banii puși deoparte", () => {
    const withMoney = addContribution(event({ estimate: 1200 }), 500, "2026-10-01");
    const status = plannedEventStatus(withMoney, "2026-11-13");
    expect(status.saved).toBe(500);
    expect(status.remaining).toBe(700);
    expect(status.covered).toBe(false);
  });

  it("marchează evenimentul acoperit și oprește ritmul", () => {
    const covered = addContribution(event({ estimate: 400 }), 400, "2026-10-01");
    const status = plannedEventStatus(covered, "2026-11-13");
    expect(status.covered).toBe(true);
    expect(status.remaining).toBe(0);
    expect(status.perWeek).toBe(0);
  });

  it("nu împarte la zero în ziua evenimentului", () => {
    const status = plannedEventStatus(event({ estimate: 300 }), "2026-12-25");
    expect(status.daysLeft).toBe(0);
    expect(status.perWeek).toBe(2100);
    expect(Number.isFinite(status.perMonth)).toBe(true);
  });

  it("arată ca trecut un eveniment unic rămas în urmă", () => {
    const status = plannedEventStatus(event({ repeat: "once", date: "2026-08-01" }), "2026-09-18");
    expect(status.passed).toBe(true);
    expect(status.daysLeft).toBe(0);
    expect(status.following).toBe("");
  });
});

describe("presiunea evenimentelor", () => {
  const events = [
    event({ id: "a", name: "Crăciun", date: "2026-12-25", estimate: 1200 }),
    event({ id: "b", name: "Aniversare", date: "2026-10-18", estimate: 300, kind: "anniversary" }),
  ];

  it("adună estimările și ritmul lunar al fiecărui eveniment", () => {
    const pressure = plannedEventsPressure(events, "2026-09-18");
    expect(pressure.count).toBe(2);
    expect(pressure.estimate).toBe(1500);
    expect(pressure.remaining).toBe(1500);
    expect(pressure.next?.event.id).toBe("b");
    // 300 în 30 de zile plus 1200 în 98 → ritmuri diferite, nu o medie pe an.
    expect(pressure.perMonth).toBe(667.35);
  });

  it("scade banii deja puși deoparte", () => {
    const pressure = plannedEventsPressure([addContribution(events[1], 300, "2026-09-01"), events[0]], "2026-09-18");
    expect(pressure.saved).toBe(300);
    expect(pressure.remaining).toBe(1200);
  });

  it("nu socotește evenimentele din afara orizontului cerut", () => {
    const pressure = plannedEventsPressure(events, "2026-09-18", 60);
    expect(pressure.count).toBe(1);
    expect(pressure.estimate).toBe(300);
  });

  it("întoarce zero pe o listă goală", () => {
    const pressure = plannedEventsPressure([], "2026-09-18");
    expect(pressure).toMatchObject({ count: 0, estimate: 0, remaining: 0, perMonth: 0, next: undefined });
  });
});

describe("lista afișată", () => {
  it("așază edițiile următoare în ordinea datei", () => {
    const list = upcomingPlannedEvents([
      event({ id: "a", date: "2026-12-25" }),
      event({ id: "b", date: "2026-03-08" }),
      event({ id: "c", date: "2026-10-18" }),
    ], "2026-09-18");
    // Ediția din martie a trecut fără să fie închisă, deci stă prima, ca o scadență întârziată.
    expect(list.map((item) => item.event.id)).toEqual(["b", "c", "a"]);
    expect(list[0].passed).toBe(true);
  });
});

describe("banii puși deoparte", () => {
  it("adună contribuțiile și le poate anula", () => {
    const one = addContribution(event(), 200, "2026-10-01", "din salariu", "put-1");
    const two = addContribution(one, 150, "2026-11-01", undefined, "put-2");
    expect(eventSaved(two)).toBe(350);
    expect(eventSaved(removeContribution(two, "put-1"))).toBe(150);
  });

  it("ignoră sumele nule sau negative", () => {
    expect(eventSaved(addContribution(event(), 0, "2026-10-01"))).toBe(0);
    expect(eventSaved(addContribution(event(), -40, "2026-10-01"))).toBe(0);
  });
});

describe("închiderea ediției", () => {
  it("mută evenimentul anual pe ediția următoare și golește jurnalul", () => {
    const spent = addContribution(event(), 900, "2026-12-01");
    const rolled = rollPlannedEvent(spent);
    expect(rolled.date).toBe("2027-12-25");
    expect(eventSaved(rolled)).toBe(0);
  });

  it("mută Paștele pe data lui reală, nu peste un an fix", () => {
    const paste = event({ name: "Paște", date: orthodoxEaster(2026), anchor: "easter" });
    expect(rollPlannedEvent(paste).date).toBe("2027-05-02");
  });

  it("nu atinge un eveniment care se întâmplă o singură dată", () => {
    const once = event({ repeat: "once" });
    expect(rollPlannedEvent(once)).toBe(once);
  });
});

describe("sugestiile de sărbători", () => {
  it("dau următoarea ediție a fiecărei sărbători, niciodată una trecută", () => {
    const suggestions = plannedEventSuggestions("2026-09-18");
    const byId = Object.fromEntries(suggestions.map((item) => [item.id, item]));
    expect(byId["suggest-craciun"].date).toBe("2026-12-25");
    expect(byId["suggest-8-martie"].date).toBe("2027-03-08");
    expect(byId["suggest-paste"].date).toBe("2027-05-02");
    // Vinerea Neagră: ultima vineri din noiembrie.
    expect(byId["suggest-black-friday"].date).toBe("2026-11-27");
    expect(suggestions.every((item) => item.date >= "2026-09-18")).toBe(true);
  });

  it("nu inventează costuri", () => {
    expect(plannedEventSuggestions("2026-09-18").every((item) => !("estimate" in item))).toBe(true);
  });
});

describe("zile între date", () => {
  it("numără diferența, nu zilele inclusive", () => {
    expect(daysBetween("2026-09-18", "2026-09-19")).toBe(1);
    expect(daysBetween("2026-09-18", "2026-09-18")).toBe(0);
    expect(daysBetween("", "2026-09-18")).toBe(0);
  });
});
