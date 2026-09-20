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

  it("împarte disponibilul pe săptămâni, cu numele plicului Alimente", () => {
    expect(at("Împarte cei 500 disponibili în plicuri de alimente pe 2 săptămâni")[0].intent)
      .toMatchObject({ kind: "envelope", label: "Alimente", amount: 500, weeklyLimit: 250, weeklyPace: true, category: "Alimente" });
  });

  it("corectează o denumire scrisă greșit, tot spre Alimente", () => {
    expect(at("Împarte cei 500 disponibili in plicuri de alimentae pe 2 săptămâni")[0].intent)
      .toMatchObject({ kind: "envelope", label: "Alimente", amount: 500, weeklyLimit: 250, weeklyPace: true });
  });

  /**
   * „600 pe săptămână” e un ritm, nu un total. Fără semnalul `amountIsWeekly`, plicul primea
   * 600 de lei pentru toată perioada — de câteva ori mai puțin decât ceruse omul.
   */
  it("marchează suma drept ritm când singura cifră e săptămânală", () => {
    expect(at("fă-mi plic Alimente cu 600 pe săptămână")[0].intent)
      .toMatchObject({ kind: "envelope", label: "Alimente", amount: 600, weeklyPace: true, amountIsWeekly: true });
  });

  it("nu marchează ritm când s-a spus și totalul", () => {
    expect(at("plic Alimente 2400, limită săptămânală 600")[0].intent)
      .toMatchObject({ kind: "envelope", amount: 2400, weeklyLimit: 600, amountIsWeekly: undefined });
  });

  it("nu marchează ritm pentru o sumă simplă", () => {
    expect(at("creează plic Transport 800 lei")[0].intent).toMatchObject({ kind: "envelope", amountIsWeekly: undefined });
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

/**
 * Evenimentele din calendar au intrat în parser mai târziu decât cheltuielile, iar
 * pericolul e într-o singură direcție: o sărbătoare citită ca plată scoate bani din
 * registru pentru ceva care nu s-a întâmplat încă.
 */
describe("evenimente viitoare scrise în cuvinte", () => {
  it("citește sărbătoarea cu data și costul spuse", () => {
    expect(at("pune-mi Crăciun 1200 pe 25 decembrie")[0].intent)
      .toEqual({ kind: "planned-event", name: "Crăciun", date: "2026-12-25", estimate: 1200, repeat: "yearly" });
  });

  it("completează data unei sărbători știute, fără să o ghicească", () => {
    expect(at("notează-mi Crăciun, cam 1200 de lei")[0].intent)
      .toMatchObject({ kind: "planned-event", name: "Crăciun", date: "2026-12-25" });
    // Paștele nu are zi fixă: data vine din calculul lui, nu dintr-o zi și o lună copiate.
    expect(at("pune deoparte pentru Paște vreo 500")[0].intent)
      .toMatchObject({ kind: "planned-event", name: "Paște", date: "2027-05-02" });
  });

  it("acceptă un eveniment fără sărbătoare în spate, dacă are dată", () => {
    expect(at("adaugă eveniment ziua Anei pe 18 octombrie, 400 lei")[0].intent)
      .toMatchObject({ kind: "planned-event", date: "2026-10-18", estimate: 400, repeat: "once" });
  });

  it("marchează aniversarea ca revenind în fiecare an", () => {
    expect(at("aniversarea soției pe 3 martie, vreo 500")[0].intent).toMatchObject({ kind: "planned-event", repeat: "yearly" });
  });

  it("nu notează un eveniment necunoscut fără dată — ar ateriza într-o zi aleasă de aplicație", () => {
    expect(at("vreau un eveniment pentru botez, 900 de lei").filter((item) => item.intent.kind === "planned-event")).toEqual([]);
  });

  it("lasă cheltuiala deja făcută să rămână cheltuială", () => {
    expect(at("am dat 200 de Crăciun pe cadouri")[0].intent).toMatchObject({ kind: "expense", amount: 200 });
  });

  it("nu fură fraza plicului care pomenește o sărbătoare", () => {
    expect(at("fă-mi plic Alimente 2400")[0].intent).toMatchObject({ kind: "envelope", label: "Alimente" });
  });
});


/**
 * Cea mai scumpă confuzie a plicurilor: „mărește cu 200” citit ca „pune 200”.
 * Un plic de 900 se tăia la 200 — 700 de lei dispăreau din buget, cu toate cifrele
 * la locul lor și un buton de confirmare dedesubt.
 */
describe("ajustarea unui plic, nu înlocuirea lui", () => {
  it("citește mărirea ca sumă în plus", () => {
    expect(at("mareste plicul de alimente cu 200")[0].intent)
      .toMatchObject({ kind: "envelope", label: "Alimente", amount: 200, delta: "increase" });
    expect(at("mai pune 200 la alimente")[0].intent).toMatchObject({ kind: "envelope", amount: 200, delta: "increase" });
  });

  it("citește scăderea, chiar când suma e spusă înaintea cuvântului „plic”", () => {
    expect(at("scade 100 din plicul de transport")[0].intent)
      .toMatchObject({ kind: "envelope", label: "Transport", amount: 100, delta: "decrease" });
  });

  it("nu marchează drept ajustare un plic scris normal", () => {
    expect(at("fă-mi plic Alimente 1800")[0].intent).not.toHaveProperty("delta");
    expect(at("pune 600 pe saptamana la alimente")[0].intent).toMatchObject({ amountIsWeekly: true });
    expect(at("pune 600 pe saptamana la alimente")[0].intent).not.toHaveProperty("delta");
  });

  it("o ajustare nu se traduce în ritm săptămânal — 200 în plus e pe tot ciclul", () => {
    const intent = at("mai pune 200 la alimente")[0].intent;
    expect(intent).not.toHaveProperty("amountIsWeekly");
    expect(intent).not.toHaveProperty("weeklyLimit");
  });
});
