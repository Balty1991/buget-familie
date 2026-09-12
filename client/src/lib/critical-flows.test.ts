/**
 * Smoke pe fluxurile critice — rulează cu `pnpm test`.
 * Fără Playwright (CI fără browser flaky); acoperă hydrate, bon→review, safe-to-spend, CSV.
 */
import { describe, expect, it } from "vitest";
import { confirmReviewDraft, createEmptyAppData } from "./finance-data";
import { resolveHydrateMerge } from "./app-storage";
import { queueReceiptForReview } from "./receipt-review";
import { parseStatementCsv, statementDrafts } from "./statement-import";
import { safeSpendBreakdown } from "./household-insights";

const sample = (name: string) => {
  const data = createEmptyAppData();
  data.settings.familyName = name;
  return data;
};

describe("fluxuri critice (smoke)", () => {
  it("hydrate: editarea din memorie înainte de IDB nu e rescrisă de IDB mai vechi", () => {
    const memory = sample("Memorie");
    const indexed = sample("IDB-vechi");
    const picked = resolveHydrateMerge({
      local: { data: sample("LS-vechi"), savedAt: "2026-09-12T10:00:00.000Z", hash: "ls" },
      indexed: { data: indexed, savedAt: "2026-09-12T11:00:00.000Z", hash: "idb" },
      memory,
      editedBeforeHydrate: true,
    });
    expect(picked?.settings.familyName).toBe("Memorie");
  });

  it("hydrate: fără editări, IDB mai nou înlocuiește LS", () => {
    const memory = sample("LS");
    const picked = resolveHydrateMerge({
      local: { data: memory, savedAt: "2026-09-12T10:00:00.000Z", hash: "ls" },
      indexed: { data: sample("IDB-nou"), savedAt: "2026-09-12T12:00:00.000Z", hash: "idb" },
      memory,
      editedBeforeHydrate: false,
    });
    expect(picked?.settings.familyName).toBe("IDB-nou");
  });

  it("bon → De verificat → confirmare în registru", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 800, sourceId: "source-debit" },
    ];
    const queued = queueReceiptForReview(data, {
      id: "bon-smoke",
      vendor: "Lidl",
      amount: 25,
      category: "Alimente",
      date: "2026-09-12",
      sourceId: "source-debit",
      memberId: "member-me",
      lines: [{ id: "l1", category: "Alimente", amount: 25, label: "Lapte" }],
    });
    expect(queued.transactions).toHaveLength(0);
    expect(queued.pendingReview).toHaveLength(1);
    const confirmed = confirmReviewDraft(queued, queued.pendingReview[0].id)!;
    expect(confirmed.transactions).toHaveLength(1);
    expect(confirmed.pendingReview).toHaveLength(0);
  });

  it("safe-to-spend: pași explicabili cu payday", () => {
    const data = createEmptyAppData();
    const source = data.settings.paymentSources[0];
    source.openingBalance = 2500;
    data.settings.salaryPlan.periodStart = "2026-09-01";
    data.settings.salaryPlan.nextPayday = "2026-09-30";
    data.settings.salaryPlan.allocations = [
      { id: "alloc-food", label: "Alimente", amount: 600, category: "Alimente", sourceId: source.id, memberId: "member-me" },
    ];
    const sheet = safeSpendBreakdown(data, "2026-09-12");
    expect(sheet.hasPayday).toBe(true);
    expect(sheet.steps.length).toBeGreaterThanOrEqual(3);
    expect(sheet.spendable).toBeGreaterThanOrEqual(0);
  });

  it("CSV extras: parse + draft-uri pentru review", () => {
    const csv = [
      "Data;Descriere;Suma;Valuta",
      "12.09.2026;Lidl Magazin;-42,50;RON",
      "11.09.2026;Salariu;4.500,00;RON",
    ].join("\n");
    const parsed = parseStatementCsv(csv);
    expect(parsed.rows.length).toBe(2);
    const data = createEmptyAppData();
    const { drafts } = statementDrafts(data, parsed.rows, { sourceId: "source-debit", memberId: "member-me", fileName: "extras.csv" });
    expect(drafts.length).toBe(2);
    expect(drafts.every((item) => item.origin === "import")).toBe(true);
  });
});
