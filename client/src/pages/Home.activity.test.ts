import { describe, expect, it } from "vitest";
import { recentActivityMoves } from "./Home";

const row = (id: string, date: string, createdAt: string) => ({ id, date, createdAt });

describe("ultimele mișcări nu ascund ce tocmai s-a notat", () => {
  it("pune cheltuiala de azi în listă chiar dacă ciclul de salariu s-a închis", () => {
    const moves = recentActivityMoves(
      [
        row("vechi", "2026-09-10", "2026-09-10T10:00:00.000Z"),
        row("azi", "2026-09-23", "2026-09-23T18:00:00.000Z"),
      ],
      ["vechi"],
      "2026-09-23",
      2,
    );
    expect(moves.map((item) => item.id)).toEqual(["azi", "vechi"]);
  });

  it("nu dublează mișcarea care e deja în ciclu", () => {
    const moves = recentActivityMoves(
      [row("azi", "2026-09-23", "2026-09-23T18:00:00.000Z")],
      ["azi"],
      "2026-09-23",
      2,
    );
    expect(moves.map((item) => item.id)).toEqual(["azi"]);
  });

  it("la o singură persoană rămâne recența, nu filtrul de ciclu", () => {
    const moves = recentActivityMoves(
      [
        row("a", "2026-09-01", "2026-09-01T10:00:00.000Z"),
        row("b", "2026-09-23", "2026-09-23T10:00:00.000Z"),
      ],
      [],
      "2026-09-23",
      1,
    );
    expect(moves.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
