import { describe, expect, it } from "vitest";
import { checkFamilyPassword } from "./family-password";

const verdict = (value: string) => checkFamilyPassword(value);

describe("parola de familie", () => {
  it("respinge orice sub 12 caractere", () => {
    expect(verdict("scurta").ok).toBe(false);
    expect(verdict("unsprezece1").ok).toBe(false);
    expect(verdict("scurta").advice[0]).toMatch(/Mai adaugă/);
  });

  it("respinge parolele lungi dar previzibile", () => {
    for (const weak of ["123456789012", "aaaaaaaaaaaa", "abababababab", "parolaparola", "qwertyqwerty"]) {
      expect(verdict(weak).ok, weak).toBe(false);
    }
  });

  it("respinge numele aplicației și cuvintele evidente", () => {
    expect(verdict("bugetfamilie2024").ok).toBe(false);
    expect(verdict("familiamea12345").ok).toBe(false);
  });

  it("semnalează datele de naștere", () => {
    expect(verdict("mihai01011990").advice.some((item) => /dat/i.test(item))).toBe(true);
  });

  it("acceptă o parolă lungă din cuvinte obișnuite", () => {
    // Lungimea și varietatea bat regulile de felul „o majusculă și un simbol”.
    const good = verdict("pisicaVerdeSareGardul7");
    expect(good.ok).toBe(true);
    expect(good.score).toBeGreaterThanOrEqual(3);
  });

  it("nu cere simboluri ca să treacă", () => {
    expect(verdict("caisaMovMerge42").ok).toBe(true);
  });

  it("dă sfaturi doar cât timp sunt de folos", () => {
    expect(verdict("pisicaVerdeSareGardul7").advice).toEqual([]);
    expect(verdict("123456789012").advice.length).toBeGreaterThan(0);
  });

  it("punctajul rămâne între 0 și 4", () => {
    for (const value of ["", "a", "123456789012", "pisicaVerdeSareGardul7", "x".repeat(200)]) {
      const result = verdict(value);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(4);
    }
  });

  it("tratează diacriticele româneşti ca litere", () => {
    expect(verdict("ștrandulRoșu99").ok).toBe(true);
  });
});
