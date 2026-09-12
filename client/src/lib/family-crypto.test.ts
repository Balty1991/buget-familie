/**
 * Pachetul trimis la sincronizare trebuie să treacă de regulile Firestore din
 * `firestore.rules`. Regulile verifică lungimile exacte ale sării și ale
 * vectorului de inițializare; dacă formatul se schimbă aici și acolo nu,
 * sincronizarea se oprește tăcut pe telefoanele familiei. Testul leagă cele două.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createEmptyAppData } from "./finance-data";
import { encryptFamilyData, decryptFamilyData, deriveFamilyRoomId, mergeFamilyData } from "./family-crypto";

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


describe("unirea planului pe plicuri, nu pe obiect întreg", () => {
  it("păstrează plicuri create pe telefoane diferite", () => {
    const local = createEmptyAppData();
    const remote = createEmptyAppData();
    local.settings.salaryPlan = {
      ...local.settings.salaryPlan,
      updatedAt: "2026-09-12T10:00:00.000Z",
      allocations: [{ id: "alloc-local", label: "Alimente", amount: 1200, category: "Alimente", updatedAt: "2026-09-12T10:00:00.000Z" }],
    };
    remote.settings.salaryPlan = {
      ...remote.settings.salaryPlan,
      updatedAt: "2026-09-12T09:00:00.000Z",
      allocations: [{ id: "alloc-remote", label: "Transport", amount: 400, category: "Transport", updatedAt: "2026-09-12T09:00:00.000Z" }],
      transfers: [{ id: "tr-1", fromAllocationId: "alloc-remote", toAllocationId: "alloc-remote", amount: 10, createdAt: "2026-09-12T09:00:00.000Z" }],
      salaryAllocationRules: [{ id: "rule-1", label: "10% economii", allocationId: "alloc-remote", mode: "percent", value: 10, active: true, updatedAt: "2026-09-12T09:00:00.000Z" }],
    };
    // Fix invalid transfer for remote — use two ids; transfer filter may keep same-from-to? normalize might filter
    remote.settings.salaryPlan.transfers = [{ id: "tr-1", fromAllocationId: "alloc-remote", toAllocationId: "alloc-local", amount: 10, createdAt: "2026-09-12T09:00:00.000Z" }];

    const merged = mergeFamilyData(local, remote);
    const ids = merged.settings.salaryPlan.allocations.map((item) => item.id).sort();
    expect(ids).toEqual(["alloc-local", "alloc-remote"]);
    expect(merged.settings.salaryPlan.transfers.map((item) => item.id)).toContain("tr-1");
    expect(merged.settings.salaryPlan.salaryAllocationRules?.map((item) => item.id)).toContain("rule-1");
  });

  it("la același plic câștigă varianta mai recentă", () => {
    const local = createEmptyAppData();
    const remote = createEmptyAppData();
    local.settings.salaryPlan.allocations = [{ id: "alloc-1", label: "Alimente", amount: 1500, category: "Alimente", updatedAt: "2026-09-12T12:00:00.000Z" }];
    remote.settings.salaryPlan.allocations = [{ id: "alloc-1", label: "Alimente", amount: 900, category: "Alimente", updatedAt: "2026-09-12T08:00:00.000Z" }];
    local.settings.salaryPlan.updatedAt = "2026-09-12T08:00:00.000Z";
    remote.settings.salaryPlan.updatedAt = "2026-09-12T12:00:00.000Z";
    const merged = mergeFamilyData(local, remote);
    expect(merged.settings.salaryPlan.allocations).toHaveLength(1);
    expect(merged.settings.salaryPlan.allocations[0].amount).toBe(1500);
  });
});
