import { describe, expect, it } from "vitest";
import { createEmptyAppData, addIsoDays, isoToday, type AppData } from "./finance-data";
import { decide, understand, compactGuideContext, householdIsSetUp, shouldAskWhichReading, readingLabel, expenseProposal, emptyGuideMemory, canCommitGuideSpend, isDatedSpendChoice, type Reading } from "./understand";
import { CORPUS, CORPUS_EXTRA, CORPUS_PARTIAL, type Outcome } from "./understand.corpus";

/** O gospodărie obișnuită: două persoane, patru locuri cu bani, trei plicuri. */
const house = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  data.settings.members.push({ id: "m2", name: "Soția" });
  data.settings.paymentSources = [
    { id: "card", name: "Card debit", kind: "card", memberId: me.id, openingBalance: 4450 },
    { id: "cash", name: "Cash", kind: "cash", memberId: me.id, openingBalance: 0 },
    { id: "tichete", name: "Bonuri de masă", kind: "meal", memberId: me.id, openingBalance: 0 },
    { id: "comun", name: "Transfer comun", kind: "card", openingBalance: 0 },
  ];
  data.settings.salaryPlan.periodStart = "2026-09-11";
  data.settings.salaryPlan.nextPayday = "2026-10-09";
  data.settings.salaryPlan.allocations = [
    { id: "env-food", label: "Alimente", category: "Alimente", amount: 1600, sourceId: "card", weeklyPace: true },
    { id: "env-trans", label: "Transport", category: "Transport", amount: 500, sourceId: "card", weeklyPace: true },
    { id: "env-house", label: "Casă & facturi", category: "Casă & facturi", amount: 900, sourceId: "card", weeklyPace: true },
  ];
  data.recurring = [
    { id: "rec-chirie", name: "Chirie", amount: 1500, dueDay: 5, category: "Casă & facturi", sourceId: "card", memberId: me.id, active: true },
  ];
  data.transactions = [
    { id: "tx-1", title: "Lidl", amount: 240, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: me.name, memberId: me.id, date: "2026-09-08", allocationId: "env-food" },
    { id: "tx-2", title: "Taxi", amount: 50, kind: "expense", category: "Transport", source: "Card debit", sourceId: "card", person: "Soția", memberId: "m2", date: "2026-09-09", allocationId: "env-trans" },
  ];
  return data;
};

/** Ce înseamnă o citire pentru om, dincolo de cine a produs-o. */
const outcomeOf = (reading?: Reading): Outcome => {
  if (!reading) return "none";
  switch (reading.kind) {
    case "confirm": return "confirm";
    case "revise": return "revise";
    case "due": return "due";
    case "question": case "insight": return "answer";
    case "expense": return "expense";
    case "income": return "income";
    case "transfer": return "transfer";
    case "intents": {
      const kind = reading.intents[0].intent.kind;
      return kind === "envelope" ? "envelope" : kind as Outcome;
    }
  }
};

const read = (text: string, data = house()) => outcomeOf(decide(understand(text, data, { asOf: "2026-09-11" })).winner);

describe("corpusul de fraze", () => {
  const results = [...CORPUS, ...CORPUS_EXTRA, ...CORPUS_PARTIAL].map((item) => ({ ...item, got: read(item.text) }));
  const ok = (item: { want: Outcome | Outcome[]; got: Outcome }) => (Array.isArray(item.want) ? item.want.includes(item.got) : item.want === item.got);
  const wrong = results.filter((item) => !ok(item));

  it("spune cât înțelege, de fiecare dată", () => {
    const scor = Math.round(((results.length - wrong.length) / results.length) * 100);
    const raport = wrong.map((item) => `  „${item.text}” → ${item.got}, ar trebui ${[item.want].flat().join(" sau ")}${item.note ? ` (${item.note})` : ""}`).join("\n");
    console.log(`\nînțelegere: ${results.length - wrong.length}/${results.length} (${scor}%)\n${raport}\n`);
    expect(results.length).toBeGreaterThan(50);
  });

  it("nu înțelege mai prost decât ieri", () => {
    // Un caz nou care pică se marchează `pending` pe față, cu motiv — nu se strecoară.
    const regresii = wrong.filter((item) => !item.pending).map((item) => `„${item.text}” → ${item.got}, ar trebui ${[item.want].flat().join(" sau ")}`);
    expect(regresii).toEqual([]);
  });

  it("nu confundă niciodată o întrebare sau o mutare cu o cheltuială", () => {
    // Cele două confuzii care costă bani: scriu în registru ceva ce omul nu a cerut.
    const periculoase = results.filter((item) => item.got === "expense" && ["answer", "transfer"].includes([item.want].flat()[0]));
    expect(periculoase.map((item) => item.text)).toEqual([]);
  });
});

describe("o citire nu se ia pe tăcute", () => {
  it("întoarce toate citirile posibile, nu doar prima", () => {
    const readings = understand("am dat 50 lei pe benzină", house(), { asOf: "2026-09-11" });
    expect(readings.length).toBeGreaterThan(0);
    expect(readings.every((item) => typeof item.score === "number" && item.why.length > 3)).toBe(true);
  });

  it("le dă în ordinea scorului", () => {
    const readings = understand("cât pot cheltui pe zi?", house(), { asOf: "2026-09-11" });
    const scores = readings.map((item) => item.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("spune că nu e sigur când primele două sunt aproape la fel", () => {
    const apropiate: Reading[] = [
      { kind: "expense", score: 70, why: "x", proposal: { text: "", choices: [] } },
      { kind: "income", score: 68, why: "y", proposal: { text: "", choices: [] } },
    ];
    expect(decide(apropiate).ambiguous).toBe(true);
    expect(decide(apropiate.slice(0, 1)).ambiguous).toBe(false);
  });

  it("un mesaj gol nu produce nicio citire", () => {
    expect(understand("   ", house())).toEqual([]);
  });
});

/**
 * Cazul raportat de pe telefon: „Am 1800 lei pe care îi împart în plicuri săptămânale
 * până pe 09-10-26” primea înapoi doar data salariului. Cei 1800 și plicurile se
 * pierdeau, iar mesajul nici nu ajungea la modelul online, fiindcă citirea locală
 * câștiga oricum.
 */
describe("când citirea locală nu e destulă, întrebăm modelul", () => {
  const winnerFor = (text: string) => decide(understand(text, house(), { asOf: "2026-09-20" })).winner;

  it("marchează drept parțială citirea care lasă o sumă necitită", () => {
    // 500 nu intră în nicio intenție: rămâne o sumă necitită, deci se întreabă modelul.
    const winner = winnerFor("urmatorul salariu pe 9 octombrie si 500 raman deoparte");
    expect(winner?.kind).toBe("intents");
    expect(winner?.soft).toBe(true);
  });

  /**
   * Fraza care a produs „PESTE LIMITA PLANULUI” pe telefon. Acum e citită întreagă pe loc:
   * banii pe care îi are, plicul cu ritm săptămânal și data salariului.
   */
  it("citește pe telefon fraza cu trei lucruri, fără să mai ceară modelul", () => {
    const winner = winnerFor("Am 1800 lei pe care ii împart în plicuri săptămânale pana pe data de 09-10-26, când iau următorul salariu");
    expect(winner?.kind).toBe("intents");
    expect(winner?.soft).toBeUndefined();
    if (winner?.kind !== "intents") throw new Error("așteptam intenții");
    // Banii, data și plicurile propuse din ce are familia — totul într-o singură confirmare.
    const kinds = new Set(winner.intents.map((item) => item.intent.kind));
    expect([...kinds].sort()).toEqual(["envelope", "funds", "payday"]);
    expect(winner.intents.filter((item) => item.intent.kind === "envelope").length).toBe(house().settings.salaryPlan.allocations.length);
  });

  it("nu marchează o citire care folosește toate sumele spuse", () => {
    expect(winnerFor("fă-mi plic Alimente 1800")?.soft).toBeUndefined();
    expect(winnerFor("am dat 50 lei pe benzină")?.soft).toBeUndefined();
    expect(winnerFor("fă-mi plic Cheltuieli alimentare, 2400, cu limita săptămânala 600 lei")?.soft).toBeUndefined();
  });

  it("trimite mai departe o comandă pe care analistul o revendica drept întrebare", () => {
    const winner = winnerFor("Pai împarte în plic alimente cu limita săptămânala împărțită la perioada rămasa");
    expect(winner?.soft).toBe(true);
  });

  it("lasă întrebările curate să primească răspuns local", () => {
    expect(winnerFor("cât mai am în plicuri?")?.soft).toBeUndefined();
    expect(winnerFor("îmi permit 300 de lei?")?.soft).toBeUndefined();
  });
});

/**
 * „Am 1800 lei de împărțit în plicuri până pe 9 octombrie” ajungea propunere de plată
 * de 1.800 de lei, fiindcă orice propoziție cu „pe ” trecea drept cheltuială.
 */
describe("planificarea nu e cheltuială", () => {
  it("nu propune o plată pentru o frază despre împărțirea banilor", () => {
    const winner = decide(understand("Am 1800 lei de împărțit în plicuri până pe 9 octombrie", house(), { asOf: "2026-09-20" })).winner;
    expect(winner?.kind).not.toBe("expense");
    if (winner?.kind !== "intents") throw new Error("așteptam intenții");
    // 1.800 sunt banii pe care îi are, nu o plată de 1.800 de lei.
    expect(winner.intents.some((item) => item.intent.kind === "funds")).toBe(true);
  });

  it("dar o plată chiar făcută din plic rămâne cheltuială", () => {
    expect(expenseProposal("am dat 50 de lei din plicul de alimente", undefined, house(), emptyGuideMemory())).toBeTruthy();
    expect(expenseProposal("am platit 120 lei, ii scad din plicul de transport", undefined, house(), emptyGuideMemory())).toBeTruthy();
  });
});

/**
 * „Împarte-mi 1800 în plicuri” nu mai fabrică un plic numit „Plic nou” cu toți banii:
 * propune o împărțire adevărată, din ce știe despre familia asta.
 */
/**
 * Pasul de configurare al ghidului pornea mereu de la venituri și rămânea acolo până
 * primea o sumă — inclusiv pentru o familie care avea deja plan, plicuri și salariu.
 * De acolo venea senzația că nu ascultă: orice cifră scrisă devenea „venit lunar”.
 */
describe("ghidul nu reia configurarea unei case deja configurate", () => {
  it("recunoaște o gospodărie pornită, după oricare urmă reală", () => {
    const cuPlic = createEmptyAppData();
    cuPlic.settings.salaryPlan.allocations = [{ id: "a1", label: "Alimente", amount: 900 }];
    expect(householdIsSetUp(cuPlic)).toBe(true);

    const cuSalariu = createEmptyAppData();
    cuSalariu.settings.salaryPlan.nextPayday = "2026-10-09";
    expect(householdIsSetUp(cuSalariu)).toBe(true);

    const cuSold = createEmptyAppData();
    cuSold.settings.paymentSources[0].openingBalance = 1200;
    expect(householdIsSetUp(cuSold)).toBe(true);

    expect(householdIsSetUp(house())).toBe(true);
  });

  it("dar o casă goală chiar are nevoie de primii pași", () => {
    expect(householdIsSetUp(createEmptyAppData())).toBe(false);
  });
});

describe("propunerea de împărțire", () => {
  const cuBaniLiberi = () => {
    const data = house();
    data.settings.paymentSources[0].openingBalance = 9000;
    return data;
  };

  it("propune plicuri cu nume și sume, pornind de la cele existente", () => {
    const winner = decide(understand("imparte-mi 1800 in plicuri", cuBaniLiberi(), { asOf: "2026-09-20" })).winner;
    expect(winner?.kind).toBe("intents");
    if (winner?.kind !== "intents") throw new Error("așteptam o propunere");
    expect(winner.headline).toContain("propun");
    expect(winner.intents.every((item) => item.intent.kind === "envelope")).toBe(true);
    expect(winner.intents.length).toBeGreaterThan(1);
  });

  it("nu propune nimic când nu știe nimic despre familie", () => {
    const gol = createEmptyAppData();
    gol.settings.salaryPlan.periodStart = "2026-09-11";
    gol.settings.salaryPlan.nextPayday = "2026-10-09";
    const winner = decide(understand("imparte-mi 1800 in plicuri", gol, { asOf: "2026-09-20" })).winner;
    expect(winner?.kind).not.toBe("intents");
  });

  it("nu se amestecă atunci când omul a spus deja ce plic vrea", () => {
    const winner = decide(understand("imparte 1800: fă-mi plic Alimente 1800", cuBaniLiberi(), { asOf: "2026-09-20" })).winner;
    if (winner?.kind !== "intents") throw new Error("așteptam intenții");
    expect(winner.headline).toBeUndefined();
    expect(winner.intents).toHaveLength(1);
  });
});

describe("ce pleacă către model", () => {
  it("nu conține mișcările din jurnal", () => {
    const ctx = compactGuideContext(house(), { view: "today", income: 0, expense: 290 });
    const dumped = JSON.stringify(ctx);
    expect(dumped).not.toMatch(/Lidl|Taxi/);
    expect(ctx.envelopes.some((item) => item.label === "Alimente")).toBe(true);
    expect(ctx.members).toContain("Soția");
  });

  /**
   * Fără cifrele perioadei, modelul răspundea la „vreau 600 pe săptămână” socotind săptămâni
   * de calendar, deci și zilele care trecuseră. Contextul îi dă acum zilele rămase, banii
   * liberi și ritmul pe care îl susțin — aceleași cifre pe care le arată ecranul Plan.
   */
  it("duce perioada și ritmul până la model", () => {
    const ctx = compactGuideContext(house(), { view: "plan" });
    expect(ctx.period).toMatchObject({ start: "2026-09-11", end: "2026-10-09", started: true });
    expect(ctx.period!.daysLeft).toBeLessThan(ctx.period!.daysTotal);
    // Casa din fixture are totul repartizat, deci nu are ce ritm să recomande.
    expect(ctx.period!.paceWeekly).toBeNull();

    /**
     * Perioada se așază față de ziua reală, nu pe datele fixe ale fixture-ului:
     * cu 2026-09-11 scris de mână, tranșa curentă începea chiar azi în unele zile
     * ale anului, iar „săptămâna e începută” devenea fals fără ca ceva să fie stricat.
     */
    const spare = house();
    spare.settings.paymentSources[0].openingBalance = 9000;
    const shift = (days: number) => addIsoDays(isoToday(), days);
    spare.settings.salaryPlan.periodStart = shift(-3);
    spare.settings.salaryPlan.nextPayday = shift(18);
    const rich = compactGuideContext(spare, { view: "plan" });
    expect(rich.period!.paceWeekly).toBeGreaterThan(0);
    expect(rich.period!.pacePerDay).toBeGreaterThan(0);
    // Săptămâna e începută de trei zile, deci tranșa curentă primește doar partea celor rămase.
    expect(rich.period!.startedWeek!.daysLeft).toBeLessThan(7);
  });

  /**
   * Evenimentele nu au dată fixă în fixture: se socotesc față de ziua reală a
   * telefonului, la fel ca în aplicație, ca testul să nu pice într-un decembrie.
   */
  it("duce evenimentele viitoare și fondul lor până la model", () => {
    const shift = (days: number) => addIsoDays(isoToday(), days);
    const plain = compactGuideContext(house(), { view: "today" });
    // Fără evenimente notate, câmpul lipsește — modelul nu are ce să inventeze.
    expect(plain.events).toBeNull();

    const withEvents = house();
    withEvents.settings.plannedEvents = [
      { id: "ev-1", name: "Crăciun", date: shift(60), estimate: 1200, kind: "holiday", repeat: "yearly", contributions: [{ id: "p1", amount: 300, date: isoToday() }] },
      { id: "ev-2", name: "Ziua Anei", date: shift(-4), estimate: 400, kind: "anniversary", repeat: "yearly" },
    ];
    const ctx = compactGuideContext(withEvents, { view: "today" });
    expect(ctx.events).toMatchObject({ estimate: 1600, saved: 300, remaining: 1300 });
    expect(ctx.events!.perMonth).toBeGreaterThan(0);
    const craciun = ctx.events!.next.find((item) => item.name === "Crăciun")!;
    expect(craciun).toMatchObject({ estimate: 1200, saved: 300, remaining: 900, daysLeft: 60, passed: false });
    // Ediția trecută rămâne vizibilă ca atare, ca modelul să nu o dea drept viitoare.
    expect(ctx.events!.next.find((item) => item.name === "Ziua Anei")!.passed).toBe(true);
  });

  it("când e nesigur, trebuie întrebat — nu scris tăcut", () => {
    const expense: Reading = { kind: "expense", score: 70, why: "x", proposal: { text: "", choices: [] } };
    const income: Reading = { kind: "income", score: 68, why: "y", proposal: { text: "", choices: [] } };
    expect(shouldAskWhichReading(expense, income)).toBe(true);
    expect(readingLabel(expense)).toBe("Cheltuială");
  });

  it("două citiri de răspuns nu cer o alegere", () => {
    const question: Reading = { kind: "question", score: 80, why: "q", answer: { kind: "next", headline: "x" } };
    const insight: Reading = { kind: "insight", score: 72, why: "i", text: "y" };
    expect(shouldAskWhichReading(question, insight)).toBe(false);
  });
});

describe("cheltuiala din ghid iese din plic, nu din nealocat", () => {
  const tight = (): AppData => {
    const data = createEmptyAppData();
    const me = data.settings.members[0];
    data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", memberId: me.id, openingBalance: 0 }];
    data.settings.salaryPlan.periodStart = "2026-09-12";
    data.settings.salaryPlan.nextPayday = "2026-09-25";
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 500, sourceId: "card", memberId: me.id, weeklyPace: true },
    ];
    data.transactions = [
      { id: "tx-in", title: "Venit rapid", amount: 500, kind: "income", category: "Venit", source: "Card debit", sourceId: "card", person: me.name, memberId: me.id, date: "2026-09-13" },
    ];
    return data;
  };

  it("nu oferă „nealocat” când cei 500 sunt deja în plic", () => {
    const out = expenseProposal("cheltuieli taxi 20 lei", undefined, tight(), emptyGuideMemory(), true);
    expect(out).toBeTruthy();
    expect(out!.choices.map((item) => item.label).join(" | ")).not.toMatch(/nealocat/i);
    expect(out!.choices.every((item) => item.update.kind === "expense" && item.update.allocationId === "env-food")).toBe(true);
  });

  it("oferă ambele săptămâni ale plicului", () => {
    const out = expenseProposal("cheltuieli taxi 20 lei", undefined, tight(), emptyGuideMemory(), true);
    const labels = out?.choices.map((item) => item.label) || [];
    expect(labels.some((label) => /Alimente · S1/.test(label))).toBe(true);
    expect(labels.some((label) => /Alimente · S2/.test(label))).toBe(true);
  });
});

describe("ghidul pe bon spune doar totalul", () => {
  it("la bon, ghidul spune doar totalul și categoria, nu lista de produse", () => {
    const out = expenseProposal("Analizează bonul atașat.", {
      amount: 15.5,
      vendor: "PEPCO",
      title: "PEPCO",
      category: "Timp liber",
      receiptLines: [{ name: "CIORAPI", amount: 6 }, { name: "HANORAC", amount: 9.5 }],
    }, createEmptyAppData(), emptyGuideMemory(), true);
    expect(out?.text).toMatch(/15[,.]50/);
    expect(out?.text).toMatch(/Timp liber/);
    expect(out?.text).toMatch(/Bonuri/);
    expect(out?.text).not.toMatch(/CIORAPI/);
    expect(out?.text).not.toMatch(/HANORAC/);
  });
});

describe("ghidul salvează cheltuiala doar după plic și zi", () => {
  it("nu scrie dacă ai atins doar plicul sau doar ziua", () => {
    expect(canCommitGuideSpend(true, false)).toBe(false);
    expect(canCommitGuideSpend(false, true)).toBe(false);
    expect(canCommitGuideSpend(false, false)).toBe(false);
    expect(canCommitGuideSpend(true, true)).toBe(true);
  });

  it("plicul și venitul cer ziua; un transfer nu", () => {
    expect(isDatedSpendChoice({ label: "Din Alimente", update: { kind: "expense", amount: 10, title: "Taxi", category: "Transport" } })).toBe(true);
    expect(isDatedSpendChoice({ label: "Mută", update: { kind: "transfer", amount: 10, fromId: "a", toId: "b", fromLabel: "A", toLabel: "B" } })).toBe(false);
  });
});

/**
 * Împărțirea spusă pe nume: omul enumeră plicurile și sumele într-o singură frază,
 * iar aplicația trebuie să le facă pe toate, nu unul cu numele întregii fraze.
 */
describe("împarte banii cum spune omul", () => {
  const goala = (): AppData => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", memberId: data.settings.members[0].id, openingBalance: 1800 }];
    data.settings.salaryPlan.periodStart = "2026-09-14";
    data.settings.salaryPlan.nextPayday = "2026-10-09";
    data.settings.salaryPlan.sourceIds = ["card"];
    return data;
  };
  const plicuri = (text: string, data = goala()) => {
    const winner = decide(understand(text, data, { asOf: "2026-09-21" })).winner;
    if (!winner || winner.kind !== "intents") return [];
    return winner.intents
      .map((item) => item.intent)
      .filter((intent): intent is Extract<typeof intent, { kind: "envelope" }> => intent.kind === "envelope")
      .map((intent) => ({ label: intent.label, amount: intent.amount, weekly: intent.weeklyPace }));
  };

  it("face un plic pentru fiecare nume, iar «restul» ia ce rămâne", () => {
    expect(plicuri("imparte-l pe saptamani, alimente 800, transport 300, restul diverse")).toEqual([
      { label: "Alimente", amount: 800, weekly: true },
      { label: "Transport", amount: 300, weekly: true },
      { label: "Diverse", amount: 700, weekly: true },
    ]);
  });

  it("citește și suma scrisă înaintea numelui", () => {
    expect(plicuri("repartizează 1500: 800 alimente, 400 transport, 300 diverse")).toEqual([
      { label: "Alimente", amount: 800, weekly: false },
      { label: "Transport", amount: 400, weekly: false },
      { label: "Diverse", amount: 300, weekly: false },
    ]);
  });

  it("se descurcă și fără virgule", () => {
    expect(plicuri("imparte pe saptamani alimente 800 transport 300")).toEqual([
      { label: "Alimente", amount: 800, weekly: true },
      { label: "Transport", amount: 300, weekly: true },
    ]);
  });

  it("«banii» nu e nume de plic", () => {
    expect(plicuri("imparte-mi banii 600 alimente 400 transport restul economii")).toEqual([
      { label: "Alimente", amount: 600, weekly: false },
      { label: "Transport", amount: 400, weekly: false },
      { label: "Economii", amount: 800, weekly: false },
    ]);
  });

  it("o singură cerere de împărțire rămâne pe seama propunerii, nu inventează nume", () => {
    expect(plicuri("imparte-mi 1800 in plicuri")).toEqual([]);
  });
});

/**
 * Ecranele aplicației au nume, iar omul le folosește. „Deschide-mi planul” nu e nimic de
 * înțeles despre bani — e o cerere de navigare, și trebuie să ducă acolo.
 */
describe("du-mă la ecranul cerut", () => {
  const ecran = (text: string) => {
    const winner = decide(understand(text, house(), { asOf: "2026-09-11" })).winner;
    if (!winner || winner.kind !== "intents") return undefined;
    const intent = winner.intents[0].intent;
    return intent.kind === "open" ? intent.screen : undefined;
  };

  it("recunoaște ecranele după numele lor", () => {
    expect(ecran("deschide-mi planul")).toBe("plan");
    expect(ecran("du-ma la miscari")).toBe("journal");
    expect(ecran("mergi la analiza")).toBe("insights");
    expect(ecran("deschide calendarul")).toBe("calendar");
    expect(ecran("deschide setarile")).toBe("utilities");
  });

  it("o întrebare despre bani rămâne întrebare, nu navigare", () => {
    expect(ecran("cât mai am în plicul de alimente?")).toBeUndefined();
    expect(ecran("arată-mi cât am cheltuit luna asta")).toBeUndefined();
  });
});

/**
 * Fraza scrisă pe telefon, cu tot ce are ea: sumă declarată, dată cu spații în ea și
 * plicul numit înaintea verbului. Până acum se citea doar suma, iar restul pleca la model.
 */
describe("fraza lungă, scrisă de mână", () => {
  it("citește banii, ziua venitului și plicul dintr-o singură frază", () => {
    const winner = decide(understand(
      "AM un buget de 1850, pana la următorul venit pe 09 - 10-2026, punei într-un alimente și împarte-i săptămânal pana la acea data",
      createEmptyAppData(),
      { asOf: "2026-09-21" },
    )).winner;
    if (winner?.kind !== "intents") throw new Error("așteptam intenții");
    expect(winner.soft).toBeUndefined();
    expect(winner.intents.map((item) => item.intent)).toEqual([
      { kind: "funds", amount: 1850 },
      { kind: "payday", date: "2026-10-09", flexDays: 0 },
      { kind: "envelope", label: "Alimente", amount: 1850, category: "Alimente", weeklyPace: true },
    ]);
  });
});
