import { describe, expect, it } from "vitest";
import { analyze } from "./analyst";
import { createEmptyAppData, newId } from "./finance-data";

const house = () => {
  const data = createEmptyAppData();
  const source = data.settings.paymentSources[0];
  const member = data.settings.members[0];
  const tx = (title: string, amount: number, category: string, date: string) => ({ id: newId("tx"), title, amount, kind: "expense" as const, category, source: source.name, sourceId: source.id, person: member.name, memberId: member.id, date });
  data.transactions = [
    tx("Lidl", 1000, "Alimente", "2026-05-10"), tx("Lidl", 1200, "Alimente", "2026-06-10"), tx("Lidl", 1100, "Alimente", "2026-07-10"),
    tx("Lidl", 1300, "Alimente", "2026-08-10"), tx("Kaufland", 1900, "Alimente", "2026-09-10"), tx("OMV", 300, "Transport", "2026-09-12"), tx("Lidl", 200, "Alimente", "2026-10-02"),
  ];
  return data;
};

describe("asistentul: evoluția pe luni, cu grafic", () => {
  it("„cum au evoluat cheltuielile pe alimente” dă media, luna de vârf și graficul lunilor", () => {
    const answer = analyze("Cum au evoluat cheltuielile pe alimente?", house(), "2026-10-03")!;
    expect(answer.kind).toBe("trend");
    expect(answer.headline).toContain("1.300 RON");
    expect(answer.detail).toContain("septembrie 2026");
    expect(answer.chart?.points.map((p) => p.value)).toEqual([1000, 1200, 1100, 1300, 1900, 200]);
    expect(answer.chart?.points[0].long).toBe("mai 2026");
  });

  it("„ultimele 12 luni” la un magazin", () => {
    const answer = analyze("Arată-mi la Lidl în ultimele 12 luni", house(), "2026-10-03")!;
    expect(answer.kind).toBe("trend");
    expect(answer.chart?.points).toHaveLength(12);
    expect(answer.chart?.points.at(-2)?.value).toBe(0);
  });

  it("„cât am cheltuit pe alimente” vine și cu graficul ultimelor 6 luni", () => {
    const answer = analyze("Cât am cheltuit pe alimente luna trecută?", house(), "2026-10-03")!;
    expect(answer.kind).toBe("spend");
    expect(answer.chart?.points).toHaveLength(6);
    expect(answer.chart?.points.at(-2)?.value).toBe(1900);
  });
});
