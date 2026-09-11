/**
 * Pachetul trimis la sincronizare trebuie să treacă de regulile Firestore din
 * `firestore.rules`. Regulile verifică lungimile exacte ale sării și ale
 * vectorului de inițializare; dacă formatul se schimbă aici și acolo nu,
 * sincronizarea se oprește tăcut pe telefoanele familiei. Testul leagă cele două.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createEmptyAppData } from "./finance-data";
import { encryptFamilyData, decryptFamilyData, deriveFamilyRoomId } from "./family-crypto";

const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8");
const ruleNumber = (field: string) => {
  const match = new RegExp(`envelope\\.${field}\\.size\\(\\) == (\\d+)`).exec(rules);
  return match ? Number(match[1]) : undefined;
};

const SECRET = "pisicaVerdeSareGardul7";

describe("pachetul de sincronizare respectă regulile serverului", () => {
  it("cheile pachetului sunt exact cele permise de reguli", async () => {
    const envelope = await encryptFamilyData(createEmptyAppData(), SECRET);
    expect(Object.keys(envelope).sort()).toEqual(["ciphertext", "createdAt", "iv", "salt", "version"]);
    expect(envelope.version).toBe(1);
  });

  it("sarea are lungimea cerută de reguli", async () => {
    const envelope = await encryptFamilyData(createEmptyAppData(), SECRET);
    expect(ruleNumber("salt")).toBeDefined();
    expect(envelope.salt.length).toBe(ruleNumber("salt"));
  });

  it("vectorul de inițializare are lungimea cerută de reguli", async () => {
    const envelope = await encryptFamilyData(createEmptyAppData(), SECRET);
    expect(ruleNumber("iv")).toBeDefined();
    expect(envelope.iv.length).toBe(ruleNumber("iv"));
  });

  it("identificatorul camerei are 64 de caractere, cât cer regulile", async () => {
    const roomId = await deriveFamilyRoomId(SECRET);
    expect(roomId).toHaveLength(64);
    expect(rules).toContain("roomId.size() == 64");
  });

  it("regulile nu mai permit ștergerea documentului", () => {
    expect(rules).toMatch(/allow create, update:/);
    expect(rules).not.toMatch(/allow write:/);
  });

  it("regulile nu permit interogarea colecției", () => {
    expect(rules).toMatch(/allow get:/);
    expect(rules).not.toMatch(/allow read:/);
  });

  it("pachetul se deschide cu parola lui și nu cu alta", async () => {
    const data = createEmptyAppData();
    data.settings.familyName = "Familia Probă";
    const envelope = await encryptFamilyData(data, SECRET);
    const opened = await decryptFamilyData(envelope, SECRET);
    expect(opened.settings.familyName).toBe("Familia Probă");
    await expect(decryptFamilyData(envelope, "altaParolaLunga99")).rejects.toBeTruthy();
  });
});
