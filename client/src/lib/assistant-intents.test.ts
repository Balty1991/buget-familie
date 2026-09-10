import { describe, expect, it } from "vitest";
import { extractAmounts, extractDates, parseAssistantMessage } from "./assistant-intents";

const at = (raw: string, asOf = "2026-09-10") => parseAssistantMessage(raw, { asOf });

describe("mesajul real care eșua", () => {
  const raw = "Fă-mi plic Cheltuieli alimentare, 2400,cu limita săptămânala 600 lei. Următorul salariu estimativ luna viitoare între data 07/10-10-2026";

  it("găsește ambele intenții, nu una singură", () => {
    expect(at(raw).map((item) => item.intent.kind)).toEqual(["envelope", "payday"]);
  });

  it("nu confundă limita săptămânală cu totalul plicului", () => {
    const [envelope] = at(raw);
    expect(envelope.intent).toMatchObject({ kind: "envelope", label: "Cheltuieli alimentare", amount: 2400, weeklyLimit: 600, weeklyPace: true });
  });

  it("citește intervalul scris de mână ca dată de salariu cu fereastră", () => {
    const payday = at(raw)[1];
    expect(payday.intent).toEqual({ kind: "payday", date: "2026-10-07", flexDays: 3 });
  });

  it("nu inventează un venit de 600 lei", () => {
    expect(at(raw).some((item) => item.intent.kind === "income")).toBe(false);
  });
});

describe("datele din text", () => {
  it("scoate datele înainte de sume, ca zilele să nu fie luate drept lei", () => {
    const { hits, masked } = extractDates("plata pe 07.10.2026 de 250 lei", "2026-09-10");
    expect(hits[0].start).toBe("2026-10-07");
    expect(extractAmounts(masked).map((item) => item.value)).toEqual([250]);
  });

  it("citește zi.lună fără an ca următoarea apariție", () => {
    expect(extractDates("scadența pe 05.01", "2026-09-10").hits[0].start).toBe("2027-01-05");
    expect(extractDates("scadența pe 25.12", "2026-09-10").hits[0].start).toBe("2026-12-25");
  });

  it("înțelege azi, mâine și ieri", () => {
    expect(extractDates("am plătit ieri", "2026-09-10").hits[0].start).toBe("2026-09-09");
    expect(extractDates("plătesc mâine", "2026-09-10").hits[0].start).toBe("2026-09-11");
    expect(extractDates("am dat azi", "2026-09-10").hits[0].start).toBe("2026-09-10");
  });

  it("refuză o dată imposibilă", () => {
    expect(extractDates("codul 45/45/2026", "2026-09-10").hits).toEqual([]);
  });
});

describe("cheltuieli și venituri", () => {
  it("citește o cheltuială simplă, cu categorie propusă", () => {
    expect(at("am cheltuit 50 lei pe benzină")[0].intent).toMatchObject({ kind: "expense", amount: 50, category: "Transport" });
  });

  it("folosește data spusă, nu ziua de azi", () => {
    expect(at("am dat 120 lei la Lidl ieri")[0].intent).toMatchObject({ kind: "expense", amount: 120, category: "Alimente", date: "2026-09-09" });
  });

  it("recunoaște un venit încasat", () => {
    expect(at("am primit 4500 lei salariu")[0].intent).toMatchObject({ kind: "income", amount: 4500, title: "Salariu" });
  });

  it("nu confundă salariul viitor cu unul încasat", () => {
    expect(at("următorul salariu pe 05.10.2026")[0].intent).toEqual({ kind: "payday", date: "2026-10-05", flexDays: 0 });
  });
});

describe("datorii, scadențe și obiective", () => {
  it("separă soldul de rata lunară", () => {
    expect(at("am o datorie la bancă de 18000 lei, rata lunară 750")[0].intent)
      .toMatchObject({ kind: "debt", remaining: 18000, monthly: 750 });
  });

  it("citește o scadență recurentă cu ziua lunii", () => {
    expect(at("abonament Netflix 55 lei pe data de 12")[0].intent)
      .toMatchObject({ kind: "recurring", amount: 55, dueDay: 12 });
  });

  it("citește un obiectiv cu ținta și ce s-a strâns deja", () => {
    expect(at("vreau să strâng 10000 lei pentru vacanță, am strâns deja 2500")[0].intent)
      .toMatchObject({ kind: "goal", target: 10000, current: 2500 });
  });
});

describe("plicuri", () => {
  it("acceptă un plic fără limită săptămânală", () => {
    expect(at("creează plic Transport 800 lei")[0].intent)
      .toMatchObject({ kind: "envelope", label: "Transport", amount: 800, weeklyLimit: undefined, weeklyPace: false });
  });

  it("propune categoria din denumire", () => {
    expect(at("fă-mi un plic pentru benzină 500")[0].intent).toMatchObject({ kind: "envelope", category: "Transport" });
  });
});

describe("mesaje pe care nu le înțelege", () => {
  it("nu propune nimic pentru text fără intenție", () => {
    expect(at("bună ziua")).toEqual([]);
    expect(at("")).toEqual([]);
  });

  it("nu propune nimic când lipsește suma", () => {
    expect(at("fă-mi un plic pentru alimente")).toEqual([]);
    expect(at("am cheltuit la magazin")).toEqual([]);
  });
});
