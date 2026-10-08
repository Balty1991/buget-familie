import { describe, expect, it } from "vitest";
import { lineTotal, splitQuantity, withQuantity } from "./item-quantity";

describe("cantitatea unui articol", () => {
  it("înmulțește prețul cu bucățile sau kilogramele", () => {
    expect(lineTotal("4,55", "2")).toBe(9.1);
    expect(lineTotal("12,90", "0,456")).toBe(5.88);
    expect(lineTotal("6,79")).toBe(6.79);
  });

  it("scrie pe bon un singur rând, ca la bonurile scanate", () => {
    expect(withQuantity("Crenvurști", "4,55", "2")).toEqual({ label: "Crenvurști × 2", amount: "9,1" });
    expect(withQuantity("Roșii", "12,90", "0,456", "kg")).toEqual({ label: "Roșii × 0,456 kg", amount: "5,88" });
    expect(withQuantity("Pâine", "3,20", "1")).toEqual({ label: "Pâine", amount: "3,20" });
    expect(withQuantity("Pâine", "3,20", "")).toEqual({ label: "Pâine", amount: "3,20" });
  });

  it("la corectură desface rândul înapoi în preț și cantitate", () => {
    expect(splitQuantity("Crenvurști × 2", 9.1)).toEqual({ label: "Crenvurști", price: "4,55", qty: "2", unit: "buc" });
    expect(splitQuantity("Roșii × 0,456 kg", 5.88)).toEqual({ label: "Roșii", price: "12,89", qty: "0,456", unit: "kg" });
    expect(splitQuantity("Roșii × 0,456", 4.1)).toMatchObject({ label: "Roșii × 0,456", qty: "" });
    expect(splitQuantity("Pâine", 3.2)).toEqual({ label: "Pâine", price: "3,2", qty: "", unit: "buc" });
  });
});
