/**
 * Pachetul trimis la sincronizare trebuie să treacă de regulile Firestore din
 * `firestore.rules`. Regulile verifică lungimile exacte ale sării și ale
 * vectorului de inițializare; dacă formatul se schimbă aici și acolo nu,
 * sincronizarea se oprește tăcut pe telefoanele familiei. Testul leagă cele două.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createEmptyAppData } from "./finance-data";
import { encryptFamilyData, decryptFamilyData, deriveFamilyRoomId, mergeFamilyData, applyAllocationConflictChoice, undoAllocationConflictChoice, applyTransactionConflictChoice, undoTransactionConflictChoice } from "./family-crypto";

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

  it("la același plic cu sume diferite nu aplică LWW tăcut — păstrează local și înregistrează conflict", () => {
    const local = createEmptyAppData();
    const remote = createEmptyAppData();
    local.settings.salaryPlan.allocations = [{ id: "alloc-1", label: "Alimente", amount: 1500, category: "Alimente", updatedAt: "2026-09-12T12:00:00.000Z" }];
    remote.settings.salaryPlan.allocations = [{ id: "alloc-1", label: "Alimente", amount: 900, category: "Alimente", updatedAt: "2026-09-12T08:00:00.000Z" }];
    local.settings.salaryPlan.updatedAt = "2026-09-12T08:00:00.000Z";
    remote.settings.salaryPlan.updatedAt = "2026-09-12T12:00:00.000Z";
    const merged = mergeFamilyData(local, remote);
    expect(merged.settings.salaryPlan.allocations).toHaveLength(1);
    expect(merged.settings.salaryPlan.allocations[0].amount).toBe(1500);
    expect(merged.allocationConflicts).toHaveLength(1);
    expect(merged.allocationConflicts[0].remoteAmount).toBe(900);
    expect(merged.allocationConflicts[0].localAmount).toBe(1500);
  });

  it("plicuri cu aceeași sumă se unesc fără conflict", () => {
    const local = createEmptyAppData();
    const remote = createEmptyAppData();
    local.settings.salaryPlan.allocations = [{ id: "alloc-1", label: "Alimente", amount: 900, category: "Alimente", updatedAt: "2026-09-12T12:00:00.000Z", note: "local" }];
    remote.settings.salaryPlan.allocations = [{ id: "alloc-1", label: "Alimente", amount: 900, category: "Alimente", updatedAt: "2026-09-12T08:00:00.000Z", note: "remote" }];
    const merged = mergeFamilyData(local, remote);
    expect(merged.allocationConflicts).toHaveLength(0);
    expect(merged.settings.salaryPlan.allocations[0].note).toBe("local");
  });
});

describe("rezolvarea conflictelor de plic", () => {
  it("Keep remote aplică suma remote și Undo o readuce", () => {
    const base = createEmptyAppData();
    base.settings.salaryPlan.allocations = [{ id: "alloc-1", label: "Alimente", amount: 1500, category: "Alimente" }];
    base.allocationConflicts = [{
      id: "conflict-alloc-1",
      allocationId: "alloc-1",
      label: "Alimente",
      localAmount: 1500,
      remoteAmount: 900,
      detectedAt: "2026-09-12T12:00:00.000Z",
    }];
    const kept = applyAllocationConflictChoice(base, "conflict-alloc-1", "remote");
    expect(kept.settings.salaryPlan.allocations[0].amount).toBe(900);
    expect(kept.allocationConflicts[0].resolvedChoice).toBe("remote");
    const undone = undoAllocationConflictChoice(kept, "conflict-alloc-1");
    expect(undone.settings.salaryPlan.allocations[0].amount).toBe(1500);
    expect(undone.allocationConflicts[0].resolvedChoice).toBeUndefined();
  });
});

describe("conflicte pe aceeași mișcare", () => {
  it("la același id cu sumă diferită păstrează local și înregistrează conflict", () => {
    const local = createEmptyAppData();
    const remote = createEmptyAppData();
    const base = {
      title: "Lidl",
      kind: "expense" as const,
      category: "Alimente",
      source: "Card",
      person: "Eu",
      date: "2026-09-10",
      sourceId: "source-debit",
      memberId: "member-me",
    };
    local.transactions = [{ id: "tx-1", ...base, amount: 120, updatedAt: "2026-09-12T12:00:00.000Z" }];
    remote.transactions = [{ id: "tx-1", ...base, amount: 80, updatedAt: "2026-09-12T11:00:00.000Z" }];
    const merged = mergeFamilyData(local, remote);
    expect(merged.transactions).toHaveLength(1);
    expect(merged.transactions[0].amount).toBe(120);
    expect(merged.transactionConflicts).toHaveLength(1);
    expect(merged.transactionConflicts[0].remoteAmount).toBe(80);
  });

  it("Keep remote aplică snapshot-ul remote și Undo readuce localul", () => {
    const base = createEmptyAppData();
    const localTx = {
      id: "tx-1",
      title: "Lidl",
      amount: 120,
      kind: "expense" as const,
      category: "Alimente",
      source: "Card",
      person: "Eu",
      date: "2026-09-10",
      sourceId: "source-debit",
      memberId: "member-me",
      updatedAt: "2026-09-12T12:00:00.000Z",
    };
    const remoteTx = { ...localTx, amount: 80, updatedAt: "2026-09-12T11:00:00.000Z" };
    base.transactions = [localTx];
    base.transactionConflicts = [{
      id: "tx-conflict-tx-1",
      transactionId: "tx-1",
      label: "Lidl",
      localAmount: 120,
      remoteAmount: 80,
      localKind: "expense",
      remoteKind: "expense",
      localDate: "2026-09-10",
      remoteDate: "2026-09-10",
      localTitle: "Lidl",
      remoteTitle: "Lidl",
      remoteSnapshot: remoteTx,
      detectedAt: "2026-09-12T12:00:00.000Z",
    }];
    const kept = applyTransactionConflictChoice(base, "tx-conflict-tx-1", "remote");
    expect(kept.transactions[0].amount).toBe(80);
    expect(kept.transactionConflicts[0].resolvedChoice).toBe("remote");
    const undone = undoTransactionConflictChoice(kept, "tx-conflict-tx-1");
    expect(undone.transactions[0].amount).toBe(120);
  });
});

describe("pendingReviewMeta partajabil", () => {
  it("criptarea exclude ciornele complete dar include meta fără imagini", async () => {
    const data = createEmptyAppData();
    data.pendingReview = [{
      id: "review-1",
      origin: "bon",
      reason: "Bon Lidl",
      createdAt: "2026-09-12T10:00:00.000Z",
      transaction: {
        id: "review-tx-1",
        title: "Bon — Lidl",
        amount: 45,
        kind: "expense",
        category: "Alimente",
        source: "Card",
        person: "Eu",
        date: "2026-09-12",
      },
    }];
    const envelope = await encryptFamilyData(data, SECRET);
    const opened = await decryptFamilyData(envelope, SECRET);
    expect(opened.pendingReview).toEqual([]);
    expect(opened.pendingReviewMeta).toHaveLength(1);
    expect(opened.pendingReviewMeta[0].amount).toBe(45);
    expect(opened.pendingReviewMeta[0].title).toBe("Bon — Lidl");
  });

  it("unirea păstrează ciornele locale și meta de pe ambele telefoane", () => {
    const local = createEmptyAppData();
    const remote = createEmptyAppData();
    local.pendingReview = [{
      id: "review-local",
      origin: "import",
      reason: "CSV",
      createdAt: "2026-09-12T10:00:00.000Z",
      transaction: {
        id: "tx-local-draft",
        title: "CSV local",
        amount: 10,
        kind: "expense",
        category: "Altele",
        source: "Card",
        person: "Eu",
        date: "2026-09-11",
      },
    }];
    remote.pendingReviewMeta = [{
      id: "review-remote",
      origin: "bon",
      reason: "Bon partener",
      createdAt: "2026-09-12T09:00:00.000Z",
      amount: 22,
      title: "Bon partener",
      date: "2026-09-11",
      kind: "expense",
      deviceLabel: "Telefon 2",
    }];
    const merged = mergeFamilyData(local, remote);
    expect(merged.pendingReview.map((item) => item.id)).toEqual(["review-local"]);
    expect(merged.pendingReviewMeta.some((item) => item.id === "review-remote")).toBe(true);
    expect(merged.pendingReviewMeta.some((item) => item.id === "review-local")).toBe(true);
  });
});
