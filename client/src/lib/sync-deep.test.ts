import { describe, expect, it } from "vitest";
import { createEmptyAppData, normalizeAppData, type AppData } from "./finance-data";
import { decryptFamilyData, encryptFamilyData, mergeFamilyData, syncBaseOf } from "./family-crypto";
import { recordRemovals } from "./sync-removals";

const family = (): AppData => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, allocations: [
    { id: "m", label: "Mâncare", amount: 600, category: "Alimente", updatedAt: "2026-09-01T10:00:00.000Z" },
    { id: "t", label: "Taxi", amount: 500, category: "Transport", updatedAt: "2026-09-01T10:00:00.000Z" },
  ] };
  data.transactions = [{ id: "x", title: "Lidl", amount: 10, kind: "expense", category: "Alimente", source: "", person: "", date: "2026-09-05", allocationId: "m", updatedAt: "2026-09-05T10:00:00.000Z" }];
  return data;
};

describe("sincronizarea, după raportul dezvoltatorului", () => {
  it("un plic șters pe un telefon nu mai revine de pe celălalt", () => {
    const phoneA = family();
    const phoneB = family();
    const afterDelete = recordRemovals(phoneA, { ...phoneA, settings: { ...phoneA.settings, salaryPlan: { ...phoneA.settings.salaryPlan, allocations: phoneA.settings.salaryPlan.allocations.filter((item) => item.id !== "t") } } });
    expect(afterDelete.deleted.some((item) => item.entity === "allocations" && item.id === "t")).toBe(true);
    const onB = mergeFamilyData(phoneB, afterDelete);
    expect(onB.settings.salaryPlan.allocations.map((item) => item.id)).toEqual(["m"]);
  });
  it("o resetare (totul șters deodată) nu șterge și la partener", () => {
    const phone = family();
    const reset = recordRemovals(phone, { ...phone, settings: { ...phone.settings, members: [], salaryPlan: { ...phone.settings.salaryPlan, allocations: [] } } });
    expect(reset.deleted.filter((item) => item.entity === "allocations")).toHaveLength(0);
  });
  it("o categorie readusă își ridică piatra de mormânt", () => {
    const phone = { ...family(), deleted: [{ entity: "categories" as const, id: "Vacanță", deletedAt: "2026-09-01T00:00:00.000Z" }] };
    const next = recordRemovals(phone, { ...phone, settings: { ...phone.settings, customCategories: ["Vacanță"] } });
    expect(next.deleted).toEqual([]);
  });
  it("suma schimbată doar pe A ajunge la B fără conflict", () => {
    const shared = normalizeAppData(normalizeAppData(family()));
    const base = syncBaseOf(shared);
    const phoneA = { ...shared, settings: { ...shared.settings, salaryPlan: { ...shared.settings.salaryPlan, allocations: shared.settings.salaryPlan.allocations.map((item) => item.id === "m" ? { ...item, amount: 700, updatedAt: "2026-09-10T10:00:00.000Z" } : item) } } };
    const phoneAtx = { ...phoneA, transactions: phoneA.transactions.map((item) => ({ ...item, amount: 12, updatedAt: "2026-09-10T10:00:00.000Z" })) };
    const onB = mergeFamilyData(shared, phoneAtx, base);
    expect(onB.settings.salaryPlan.allocations.find((item) => item.id === "m")?.amount).toBe(700);
    expect(onB.transactions[0].amount).toBe(12);
    expect(onB.allocationConflicts || []).toHaveLength(0);
    expect(onB.transactionConflicts || []).toHaveLength(0);
  });
  it("schimbat pe ambele telefoane: rămâne conflict, ca înainte", () => {
    const shared = family();
    const base = syncBaseOf(shared);
    const edit = (amount: number) => ({ ...shared, settings: { ...shared.settings, salaryPlan: { ...shared.settings.salaryPlan, allocations: shared.settings.salaryPlan.allocations.map((item) => item.id === "m" ? { ...item, amount } : item) } } });
    const merged = mergeFamilyData(edit(650), edit(700), base);
    expect(merged.allocationConflicts?.length).toBe(1);
  });
  it("pachetul e comprimat: 3.000 de mișcări încap cu mult sub limită și se citesc înapoi", async () => {
    const data = family();
    data.transactions = Array.from({ length: 3000 }, (_, index) => ({ id: `tx-${index}`, title: `Lidl ${index % 40}`, amount: 10 + (index % 97), kind: "expense" as const, category: "Alimente", source: "Card", person: "Eu", date: `2026-0${1 + (index % 9)}-1${index % 9}`, allocationId: "m", sourceId: "card", memberId: "member-me", createdAt: "2026-09-01T10:00:00.000Z" }));
    const envelope = await encryptFamilyData(data, "parola-de-test-lunga");
    expect(envelope.ciphertext.length).toBeLessThan(400_000);
    const back = await decryptFamilyData(envelope, "parola-de-test-lunga");
    expect(back.transactions).toHaveLength(3000);
  }, 30_000);
});
