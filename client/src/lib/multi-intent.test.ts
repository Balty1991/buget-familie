import { describe, expect, it } from "vitest";
import { parseAssistantMessage } from "./assistant-intents";
import { repeatFactor } from "./assistant-intents";
import { spendDate } from "./understand";

const AZI = "2026-09-11";
const la = (raw: string) => parseAssistantMessage(raw, { asOf: AZI }).map((item) => item.intent);

describe("un mesaj cu mai multe sume înseamnă mai multe intrări", () => {
  it("două cheltuieli despărțite de «și»", () => {
    const out = la("am dat 50 la Lidl și 30 la farmacie");
    expect(out).toHaveLength(2);
    expect(out.map((item) => "amount" in item && item.amount)).toEqual([50, 30]);
  });

  it("două cheltuieli despărțite de virgulă", () => {
    const out = la("am dat cafea 12 lei, croissant 8 lei");
    expect(out.map((item) => "amount" in item && item.amount)).toEqual([12, 8]);
  });

  it("fiecare bucată își păstrează titlul ei", () => {
    const out = la("am platit 20 lei benzina si 15 lei parcare");
    expect(out).toHaveLength(2);
    expect(out.map((item) => "title" in item && item.title)).toEqual(["Benzina", "Parcare"]);
  });

  it("două venituri în același mesaj", () => {
    const out = la("am primit salariu 5000 și bonus 700");
    expect(out).toHaveLength(2);
    expect(out.map((item) => "amount" in item && item.amount)).toEqual([5000, 700]);
  });

  it("o dată spusă o singură dată se aplică întregii fraze", () => {
    const out = la("ieri am dat 40 pe taxi și 25 pe cafea");
    expect(out.every((item) => "date" in item && item.date === "2026-09-10")).toBe(true);
  });

  it("fiecare bucată își poate avea data ei", () => {
    const out = la("am cheltuit 100 ieri și 200 azi");
    expect(out.map((item) => "date" in item && item.date)).toEqual(["2026-09-10", AZI]);
  });

  it("o singură sumă rămâne o singură intrare", () => {
    expect(la("am dat 50 lei pe benzină și mi-a plăcut")).toHaveLength(1);
  });

  it("un «și» fără sumă de partea cealaltă nu taie fraza", () => {
    const out = la("am dat 50 lei pe pâine și lapte");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ amount: 50 });
  });
});

describe("„pe N săptămâni” este o durată, nu o limită", () => {
  it("1600 pe 4 săptămâni înseamnă 400 pe săptămână, nu o limită de 4 lei", () => {
    const [envelope] = la("plic alimente 1600 pe 4 saptamani");
    expect(envelope).toMatchObject({ kind: "envelope", amount: 1600, weeklyLimit: 400, weeklyPace: true });
  });

  it("o limită scrisă pe față rămâne cea scrisă", () => {
    const [envelope] = la("fă-mi plic Alimente 2400 cu limită săptămânală 600");
    expect(envelope).toMatchObject({ amount: 2400, weeklyLimit: 600 });
  });
});

describe("înmulțirea spusă în cuvinte", () => {
  it("«de trei ori câte» înmulțește", () => {
    expect(repeatFactor("de trei ori câte 25 de lei la cafea")).toBe(3);
    expect(repeatFactor("de 4 ori câte 10 lei")).toBe(4);
  });

  it("o frază obișnuită nu se înmulțește", () => {
    expect(repeatFactor("am dat 50 lei pe benzină")).toBe(1);
    expect(repeatFactor("de la Lidl, 30 de lei")).toBe(1);
  });
});

describe("data spusă cu luna în litere", () => {
  it("«pe 3 septembrie» nu mai cade pe ziua de azi", () => {
    expect(spendDate("50 lei alimente pe 3 septembrie")).toMatch(/-09-03$/);
  });

  it("zilele apropiate rămân cum erau", () => {
    expect(spendDate("ieri am dat 40 pe taxi")).not.toBe(spendDate("azi am dat 40 pe taxi"));
  });
});

describe("data spusă înaintea verbului", () => {
  it("«ieri am dat …» chiar se trece pe ieri", () => {
    const [out] = la("ieri am dat 60 lei pe alimente");
    expect(out).toMatchObject({ date: "2026-09-10" });
  });

  it("«pe 3 septembrie am plătit …» se trece pe acea zi", () => {
    const [out] = la("pe 3 septembrie am plătit 120 lei la dentist");
    expect(out).toMatchObject({ date: "2026-09-03" });
  });

  it("fără dată în mesaj, rămâne ziua curentă", () => {
    const [out] = la("am dat 60 lei pe alimente");
    expect(out).toMatchObject({ date: AZI });
  });
});

describe("ziua și luna fără an înseamnă cea mai apropiată", () => {
  it("o cheltuială de acum o săptămână rămâne anul acesta", () => {
    expect(la("pe 3 septembrie am plătit 120 lei la dentist")[0]).toMatchObject({ date: "2026-09-03" });
    expect(la("pe 28 august am dat 90 de lei pe alimente")[0]).toMatchObject({ date: "2026-08-28" });
  });

  it("o dată de salariu de peste o lună este în viitor", () => {
    expect(la("salariul vine pe 15 octombrie")[0]).toMatchObject({ kind: "payday", date: "2026-10-15" });
  });

  it("o dată din ianuarie, în septembrie, se duce la ianuarie următor", () => {
    expect(la("salariul vine pe 10 ianuarie")[0]).toMatchObject({ date: "2027-01-10" });
  });

  it("un an scris pe față bate orice socoteală", () => {
    expect(la("următorul salariu pe 07.10.2026")[0]).toMatchObject({ date: "2026-10-07" });
  });
});

describe("înmulțirea ajunge în suma scrisă, nu doar în socoteală", () => {
  it("«de trei ori câte 25» înregistrează 75", () => {
    expect(la("am dat de trei ori câte 25 de lei pe cafea")[0]).toMatchObject({ kind: "expense", amount: 75 });
  });

  it("numele plicului nu păstrează cuvintele de umplutură", () => {
    expect(la("plic Consumabile 1600 pe 4 saptamani")[0]).toMatchObject({ label: "Consumabile" });
  });
});
