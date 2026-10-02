import { describe, expect, it } from "vitest";
import { CELEBRATED_KEY, markCelebrated, pendingCelebration } from "./goal-celebration";

const store = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }; };
const goal = (id: string, current: number, target = 100) => ({ id, name: id, current, target, due: "", tone: "forest" as const });

describe("obiectiv atins", () => {
  it("la prima rulare notează în tăcere ce era deja atins", () => {
    const storage = store();
    expect(pendingCelebration([goal("vechi", 100), goal("nou", 50)], storage)).toBeUndefined();
    expect(JSON.parse(storage.getItem(CELEBRATED_KEY)!)).toEqual(["vechi"]);
  });

  it("felicită o singură dată obiectivul atins după aceea", () => {
    const storage = store();
    pendingCelebration([goal("nou", 50)], storage);
    const reached = pendingCelebration([goal("nou", 120)], storage);
    expect(reached?.id).toBe("nou");
    markCelebrated(storage, "nou");
    expect(pendingCelebration([goal("nou", 120)], storage)).toBeUndefined();
  });

  it("fără stocare nu felicită", () => {
    expect(pendingCelebration([goal("a", 100)], undefined)).toBeUndefined();
  });
});
