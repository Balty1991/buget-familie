import { describe, expect, it } from "vitest";
import { messageShape, recallPhrasing, rememberPhrasing } from "./guide-learning";

describe("ghidul învață forma frazelor confirmate", () => {
  it("forma scoate suma și diacriticele", () => {
    expect(messageShape("Am câștigat 300 lei la pariuri")).toBe("am castigat # la pariuri");
    expect(messageShape("am câștigat 1.250,50 la pariuri")).toBe("am castigat # la pariuri");
  });

  it("nu învață fraze fără sumă sau cu mai multe sume", () => {
    expect(messageShape("salut")).toBeUndefined();
    expect(messageShape("am dat 50 pe benzina si 30 pe parcare")).toBeUndefined();
    expect(messageShape("300")).toBeUndefined();
  });

  it("un venit confirmat se recunoaște data viitoare, cu suma nouă", () => {
    const learned = rememberPhrasing([], "am câștigat 300 la pariuri", { kind: "income", amount: 300, title: "Câștig pariuri", date: "2026-09-29" });
    expect(recallPhrasing(learned, "am castigat 150 la pariuri", "2026-10-02")).toEqual({ kind: "income", amount: 150, title: "Câștig pariuri", date: "2026-10-02" });
  });

  it("o cheltuială își păstrează categoria", () => {
    const learned = rememberPhrasing([], "am dat 70 la bowling", { kind: "expense", amount: 70, title: "Bowling", category: "Timp liber", date: "2026-09-29" });
    expect(recallPhrasing(learned, "am dat 90 la bowling", "2026-10-01")).toMatchObject({ kind: "expense", amount: 90, category: "Timp liber", title: "Bowling" });
  });

  it("aceeași frază învățată de două ori se întărește, nu se dublează", () => {
    const intent = { kind: "income" as const, amount: 300, title: "Câștig", date: "2026-09-29" };
    const twice = rememberPhrasing(rememberPhrasing([], "am castigat 300 la pariuri", intent), "am câștigat 50 la pariuri", intent);
    expect(twice).toHaveLength(1);
    expect(twice[0].count).toBe(2);
  });

  it("nu învață plicuri, datorii sau alte intenții", () => {
    expect(rememberPhrasing([], "plic mancare 600", { kind: "envelope", label: "Mâncare", amount: 600, weeklyPace: false })).toEqual([]);
  });

  it("o frază diferită nu e recunoscută", () => {
    const learned = rememberPhrasing([], "am castigat 300 la pariuri", { kind: "income", amount: 300, title: "Câștig", date: "2026-09-29" });
    expect(recallPhrasing(learned, "am pierdut 300 la pariuri", "2026-09-29")).toBeUndefined();
  });
});
