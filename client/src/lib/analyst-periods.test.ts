import { describe, expect, it } from "vitest";
import { analyze, readComparison, readPeriod } from "./analyst";
import { createEmptyAppData, newId, type AppData } from "./finance-data";

const ASOF = "2026-09-30";

const house = (): AppData => {
  const data = createEmptyAppData();
  const source = data.settings.paymentSources[0];
  const me = data.settings.members[0];
  data.settings.members.push({ id: "m-ana", name: "Ana" });
  const tx = (title: string, amount: number, category: string, date: string, memberId = me.id) => ({
    id: newId("tx"), title, amount, kind: "expense" as const, category, source: source.name, sourceId: source.id, person: "", memberId, date,
  });
  data.transactions = [
    tx("Lidl", 400, "Alimente", "2026-08-10"),
    tx("Kaufland", 200, "Alimente", "2026-08-20"),
    tx("Lidl", 300, "Alimente", "2026-09-05"),
    tx("Profi", 100, "Alimente", "2026-09-20"),
    tx("Zara", 250, "Haine", "2026-03-15", "m-ana"),
    tx("H&M", 150, "Haine", "2026-09-12", "m-ana"),
    tx("Decathlon", 90, "Haine", "2026-09-12"),
  ];
  return data;
};

describe("perioade citite din întrebare", () => {
  it("„între 1 și 15 septembrie”", () => {
    expect(readPeriod("cat am cheltuit intre 1 si 15 septembrie", ASOF)).toMatchObject({ start: "2026-09-01", end: "2026-09-15" });
    expect(readPeriod("de la 3 la 10 august", ASOF)).toMatchObject({ start: "2026-08-03", end: "2026-08-10" });
  });

  it("„anul trecut”, „luna trecută”", () => {
    expect(readPeriod("anul trecut", ASOF)).toMatchObject({ start: "2025-01-01", end: "2025-12-31" });
    expect(readPeriod("luna trecuta", ASOF)).toMatchObject({ start: "2026-08-01", end: "2026-08-31" });
  });

  it("„față de august” desparte perioada de referință", () => {
    const { period, reference } = readComparison("cat am cheltuit pe alimente fata de august", ASOF);
    expect(period).toMatchObject({ start: "2026-09-01", end: "2026-09-30" });
    expect(reference).toMatchObject({ start: "2026-08-01", end: "2026-08-31" });
  });

  it("„cea mai mare” nu e luna mai", () => {
    expect(readPeriod("care e cea mai mare cheltuiala", ASOF).label).toBe("luna asta");
  });
});

describe("răspunsuri pe perioade", () => {
  it("cheltuiala între două date", () => {
    expect(analyze("cat am cheltuit intre 1 si 15 septembrie?", house(), ASOF)?.headline).toMatch(/^540 RON/);
  });

  it("alimente luna asta față de august", () => {
    const answer = analyze("cat am cheltuit pe alimente fata de august?", house(), ASOF);
    expect(answer?.headline).toMatch(/400 RON pe Alimente/);
    expect(answer?.headline).toMatch(/200 RON mai puțin decât în august 2026/);
  });

  it("cât a dat Ana pe haine anul ăsta", () => {
    expect(analyze("cat a dat Ana pe haine anul asta?", house(), ASOF)?.headline).toMatch(/^400 RON pe haine, Ana/);
  });
});
