import { describe, expect, it } from "vitest";
import { confirmAllReviewDrafts, confirmReviewDraft, createEmptyAppData } from "./finance-data";
import { buildReceiptReviewDrafts, queueReceiptForReview } from "./receipt-review";

describe("bon → plicuri + poartă de revizuire", () => {
  it("Lidl lapte + detergent propun Alimente și Casă & facturi cu plicuri", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 800, sourceId: "source-debit", memberId: "member-me" },
      { id: "env-home", label: "Casă", category: "Casă & facturi", amount: 400, sourceId: "source-debit", memberId: "member-me" },
    ];
    const receipt = {
      id: "bon-lidl",
      vendor: "Lidl",
      amount: 42,
      category: "Alimente",
      date: "2026-09-12",
      sourceId: "source-debit",
      memberId: "member-me",
      lines: [
        { id: "milk", category: "Alimente", amount: 18, label: "Lapte" },
        { id: "det", category: "Casă & facturi", amount: 24, label: "Detergent" },
      ],
    };
    const drafts = buildReceiptReviewDrafts(data, receipt);
    expect(drafts).toHaveLength(2);
    expect(drafts[0].transaction).toMatchObject({ category: "Alimente", allocationId: "env-food", amount: 18 });
    expect(drafts[1].transaction).toMatchObject({ category: "Casă & facturi", allocationId: "env-home", amount: 24 });
    expect(drafts.every((item) => item.origin === "bon")).toBe(true);
  });

  it("queueReceiptForReview nu scrie în registru până la confirmare", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 800, sourceId: "source-debit" },
    ];
    const queued = queueReceiptForReview(data, {
      id: "bon-1",
      vendor: "Lidl",
      amount: 30,
      category: "Alimente",
      date: "2026-09-12",
      sourceId: "source-debit",
      memberId: "member-me",
      lines: [{ id: "whole", category: "Alimente", amount: 30, label: "Cumpărături" }],
    });
    expect(queued.transactions).toHaveLength(0);
    expect(queued.pendingReview).toHaveLength(1);
    expect(queued.receipts).toHaveLength(1);
    const confirmed = confirmReviewDraft(queued, queued.pendingReview[0].id)!;
    expect(confirmed.transactions).toHaveLength(1);
    expect(confirmed.transactions[0].allocationId).toBe("env-food");
    expect(confirmed.receipts[0].linkedTransactionIds).toContain(confirmed.transactions[0].id);
    expect(confirmed.pendingReview).toHaveLength(0);
  });

  it("confirmAll trece toate liniile bonului în registru", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 800, sourceId: "source-debit" },
      { id: "env-home", label: "Casă", category: "Casă & facturi", amount: 400, sourceId: "source-debit" },
    ];
    const queued = queueReceiptForReview(data, {
      id: "bon-2",
      vendor: "Lidl",
      amount: 50,
      category: "Alimente",
      date: "2026-09-12",
      sourceId: "source-debit",
      memberId: "member-me",
      lines: [
        { id: "a", category: "Alimente", amount: 20, label: "Lapte" },
        { id: "b", category: "Casă & facturi", amount: 30, label: "Detergent" },
      ],
    });
    const done = confirmAllReviewDrafts(queued);
    expect(done.transactions).toHaveLength(2);
    expect(done.pendingReview).toHaveLength(0);
    expect(new Set(done.transactions.map((item) => item.allocationId))).toEqual(new Set(["env-food", "env-home"]));
  });
});
