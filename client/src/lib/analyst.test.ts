import { describe, expect, it } from "vitest";
import { analyze, answerToText, readPeriod } from "./analyst";
import { createEmptyAppData, newId, type AppData } from "./finance-data";

const ASOF = "2026-09-11"; // vineri

const house = (): AppData => {
  const data = createEmptyAppData();
  const source = data.settings.paymentSources[0];
  const member = data.settings.members[0];
  const tx = (title: string, amount: number, kind: "income" | "expense", category: string, date: string) => ({
    id: newId("tx"), title, amount, kind, category, source: source.name, sourceId: source.id,
    person: member.name, memberId: member.id, date,
  });
  data.settings.salaryPlan.periodStart = "2026-08-25";
  data.settings.salaryPlan.nextPayday = "2026-09-25";
  data.settings.salaryPlan.allocations = [
    { id: "env-food", label: "Alimente", category: "Alimente", amount: 1600, sourceId: source.id, weeklyPace: false },
    { id: "env-car", label: "Transport", category: "Transport", amount: 500, sourceId: source.id, weeklyPace: false },
  ];
  data.transactions = [
    tx("Salariu august", 5200, "income", "Venit", "2026-08-25"),
    // august (perioada dinainte, pentru comparații)
    tx("Lidl", 400, "expense", "Alimente", "2026-08-10"),
    tx("Benzină", 200, "expense", "Transport", "2026-08-12"),
    // septembrie
    tx("Lidl", 240, "expense", "Alimente", "2026-09-02"),
    tx("Kaufland", 315, "expense", "Alimente", "2026-09-05"),
    tx("Profi", 180, "expense", "Alimente", "2026-09-09"),
    tx("Benzină", 300, "expense", "Transport", "2026-09-03"),
    tx("Curent", 420, "expense", "Casă & facturi", "2026-09-08"),
    tx("Farmacie", 95, "expense", "Sănătate", "2026-09-10"),
  ] as AppData["transactions"];
  data.recurring = [
    { id: newId("r"), name: "Internet", amount: 60, category: "Casă & facturi", sourceId: source.id, memberId: member.id, dueDay: 15, active: true },
    { id: newId("r"), name: "Netflix", amount: 55, category: "Abonamente", sourceId: source.id, memberId: member.id, dueDay: 20, active: true },
  ] as AppData["recurring"];
  data.debts = [{ id: "d1", name: "Card de credit", remaining: 3400, monthly: 350 }] as AppData["debts"];
  data.savings = [{ id: "g1", name: "Vacanță", target: 6000, current: 1500 }] as AppData["savings"];
  return data;
};

const ask = (question: string, data = house()) => analyze(question, data, ASOF);

describe("perioada cerută în text", () => {
  it("citește luna asta, implicit", () => {
    expect(readPeriod("cat am cheltuit", ASOF)).toMatchObject({ start: "2026-09-01", end: "2026-09-30" });
  });
  it("citește luna trecută", () => {
    expect(readPeriod("cat am cheltuit luna trecuta", ASOF)).toMatchObject({ start: "2026-08-01", end: "2026-08-31" });
  });
  it("citește săptămâna asta, de luni până duminică", () => {
    expect(readPeriod("saptamana asta", ASOF)).toMatchObject({ start: "2026-09-07", end: "2026-09-13" });
  });
  it("citește azi și ieri", () => {
    expect(readPeriod("azi", ASOF)).toMatchObject({ start: ASOF, end: ASOF });
    expect(readPeriod("ieri", ASOF)).toMatchObject({ start: "2026-09-10", end: "2026-09-10" });
  });
  it("citește ultimele N zile", () => {
    expect(readPeriod("ultimele 7 zile", ASOF)).toMatchObject({ start: "2026-09-05", end: ASOF });
  });
  it("citește o lună numită", () => {
    expect(readPeriod("in august", ASOF)).toMatchObject({ start: "2026-08-01", end: "2026-08-31" });
  });
});

describe("cât am cheltuit", () => {
  it("adună totalul lunii", () => {
    const answer = ask("cât am cheltuit luna asta")!;
    // 240 + 315 + 180 + 300 + 420 + 95
    expect(answer.headline).toContain("1.550");
    expect(answer.kind).toBe("spend");
  });

  it("filtrează pe categorie", () => {
    const answer = ask("cât am cheltuit pe alimente")!;
    expect(answer.headline).toContain("735");
    expect(answer.headline).toContain("Alimente");
  });

  it("înțelege o categorie numită indirect", () => {
    const answer = ask("cât dau pe benzină")!;
    expect(answer.headline).toContain("Transport");
    expect(answer.headline).toContain("300");
  });

  it("filtrează pe magazin", () => {
    const answer = ask("cât am dat la Kaufland")!;
    expect(answer.headline).toContain("315");
    expect(answer.headline).toContain("Kaufland");
  });

  it("compară cu perioada dinainte", () => {
    const answer = ask("cât am cheltuit pe alimente luna asta")!;
    // 735 în septembrie față de 400 în august (aceeași lungime, luna dinainte)
    expect(answer.detail).toMatch(/mai mult|nu am cu ce compara/i);
  });

  it("spune cinstit când nu există nimic", () => {
    const answer = ask("cât am cheltuit pe sănătate luna trecută")!;
    expect(answer.headline).toMatch(/Nicio cheltuială/);
  });
});

describe("unde se duc banii", () => {
  it("numește categoria dominantă cu procentul ei", () => {
    const answer = ask("unde se duc banii")!;
    expect(answer.headline).toContain("Alimente");
    expect(answer.headline).toContain("735");
    expect(answer.headline).toMatch(/4[0-9]%/);
  });

  it("dă categoriile în ordine descrescătoare", () => {
    const rows = ask("pe ce dau cel mai mult")!.rows!;
    expect(rows[0].label).toBe("Alimente");
    expect(rows.map((row) => row.label)).toContain("Casă & facturi");
  });
});

describe("îmi permit?", () => {
  it("răspunde din plicul categoriei, când o numește", () => {
    const answer = ask("îmi permit 500 de lei pe alimente")!;
    // plic 1600, consumat 735 → rămân 865; după 500 rămân 365
    expect(answer.headline).toMatch(/^Da\./);
    expect(answer.headline).toContain("365");
  });

  it("spune nu când suma nu încape în plic", () => {
    const answer = ask("îmi permit 2000 de lei pe alimente")!;
    expect(answer.headline).toMatch(/^Nu din plic/);
  });

  it("fără sumă, spune cât e liber și cere suma", () => {
    const answer = ask("îmi permit?")!;
    expect(answer.detail).toMatch(/suma/);
  });
});

describe("ritmul", () => {
  it("spune cât se poate cheltui pe zi până la salariu", () => {
    const answer = ask("cât pot cheltui pe zi")!;
    expect(answer.kind).toBe("pace");
    expect(answer.headline).toMatch(/pe zi până pe/);
  });

  it("nu inventează un ritm fără data salariului", () => {
    const data = house();
    data.settings.salaryPlan.nextPayday = "";
    data.settings.salaryPlan.earliestPayday = undefined;
    const answer = analyze("cât pot cheltui pe zi", data, ASOF)!;
    expect(answer.headline).toMatch(/Nu pot calcula/);
  });
});

describe("restul întrebărilor", () => {
  it("cea mai mare cheltuială", () => {
    const answer = ask("care e cea mai mare cheltuială")!;
    expect(answer.headline).toContain("Curent");
    expect(answer.headline).toContain("420");
  });

  it("abonamente și scadențe, cu totalul anual", () => {
    const answer = ask("cât plătesc pe abonamente")!;
    expect(answer.headline).toContain("115");
    expect(answer.headline).toContain("1.380");
  });

  it("datorii, cu durata la ritmul actual", () => {
    const answer = ask("cât mai am de plătit la datorii")!;
    expect(answer.headline).toContain("3.400");
    expect(answer.detail).toMatch(/10 luni/);
  });

  it("economii, cu procentul", () => {
    const answer = ask("cât am strâns")!;
    expect(answer.headline).toContain("1.500");
    expect(answer.headline).toContain("25%");
  });

  it("câte zile până la salariu", () => {
    const answer = ask("câte zile până la salariu")!;
    expect(answer.headline).toContain("14 zile");
  });

  it("cât mai am", () => {
    const answer = ask("cât mai am")!;
    expect(answer.kind).toBe("remaining");
    expect(answer.rows!.some((row) => row.label === "Alimente")).toBe(true);
  });

  it("comparația cu perioada dinainte", () => {
    const answer = ask("compară cu luna trecută")!;
    expect(answer.kind).toBe("compare");
    expect(answer.rows!.length).toBeGreaterThan(0);
  });
});

describe("ce nu este o întrebare de analiză", () => {
  it("o cerere de înregistrare merge mai departe, neatinsă", () => {
    expect(ask("am dat 50 lei pe benzină")).toBeUndefined();
    expect(ask("adaugă o cheltuială de 30 lei")).toBeUndefined();
    expect(ask("creează plic Alimente 800")).toBeUndefined();
  });

  it("o vorbă oarecare nu primește un răspuns inventat", () => {
    expect(ask("bună ziua")).toBeUndefined();
    expect(ask("")).toBeUndefined();
    expect(ask("mulțumesc")).toBeUndefined();
  });
});

describe("forma răspunsului", () => {
  it("textul plat conține titlul și rândurile", () => {
    const text = answerToText(ask("unde se duc banii")!);
    expect(text).toContain("Alimente");
    expect(text).toContain("•");
  });

  it("un registru gol nu produce împărțiri la zero", () => {
    const empty = createEmptyAppData();
    for (const question of ["cât am cheltuit", "unde se duc banii", "cât pot cheltui pe zi", "cât mai am", "cât am strâns"]) {
      const answer = analyze(question, empty, ASOF);
      if (answer) expect(answer.headline).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

describe("punctuația răspunsurilor", () => {
  it("nu pune punct dublu după o dată prescurtată", () => {
    // `formatDate` întoarce deja „25 sept.”
    const answers = [ask("cât pot cheltui pe zi"), ask("câte zile până la salariu"), ask("care e cea mai mare cheltuială")];
    for (const answer of answers) {
      expect(answer!.headline).not.toMatch(/\.\./);
      if (answer!.detail) expect(answer!.detail).not.toMatch(/\.\./);
    }
  });

  it("nu lipește o frază nouă cu literă mică", () => {
    const answer = ask("cât am cheltuit pe alimente luna asta")!;
    // fiecare propoziție din detaliu începe cu majusculă
    for (const part of answer.detail!.split(/(?<=\.)\s+/)) {
      expect(part.charAt(0)).toBe(part.charAt(0).toLocaleUpperCase("ro-RO"));
    }
  });
});
