import { describe, expect, it } from "vitest";
import { confirmAllReviewDrafts, confirmReviewDraft, createEmptyAppData, normalizeAppData } from "./finance-data";
import { attachReceiptDetail, buildReceiptReviewDrafts, queueReceiptForReview } from "./receipt-review";

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
    expect(drafts).toHaveLength(1);
    expect(drafts[0].transaction).toMatchObject({ title: "Bon — Lidl", amount: 42, category: "Casă & facturi", allocationId: "env-home" });
    expect(drafts[0].origin).toBe("bon");
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

  it("confirmAll trece bonul ca o singură mișcare, cu totalul", () => {
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
    expect(queued.pendingReview).toHaveLength(1);
    const done = confirmAllReviewDrafts(queued);
    expect(done.transactions).toHaveLength(1);
    expect(done.transactions[0]).toMatchObject({ title: "Bon — Lidl", amount: 50 });
    expect(done.pendingReview).toHaveLength(0);
    expect(done.receipts[0].lines).toHaveLength(2);
  });

  it("un bon legat de o cheltuială deja notată nu mai scrie o mișcare", () => {
    const data = createEmptyAppData();
    data.transactions = [{
      id: "tx-exflor",
      title: "Exflor",
      amount: 64.95,
      kind: "expense",
      category: "Alimente",
      sourceId: "source-debit",
      source: "Card",
      memberId: "member-me",
      person: "Eu",
      date: "2026-10-05",
      allocationId: "outside",
      createdAt: "2026-10-05T10:00:00.000Z",
    }];
    const queued = queueReceiptForReview(data, {
      id: "bon-exflor",
      vendor: "Exflor",
      amount: 64.94,
      category: "Alimente",
      date: "2026-10-05",
      sourceId: "source-debit",
      memberId: "member-me",
      linkedTransactionId: "tx-exflor",
      lines: [
        { id: "a", category: "Alimente", amount: 8.58, label: "Lapte" },
        { id: "b", category: "Altele", amount: 5.5, label: "SGR" },
      ],
    });
    expect(queued.transactions).toHaveLength(1);
    expect(queued.transactions[0].id).toBe("tx-exflor");
    expect(queued.transactions[0].amount).toBe(64.95);
    expect(queued.transactions[0].receiptId).toBe("bon-exflor");
    expect(queued.pendingReview).toHaveLength(0);
    expect(queued.receipts[0].linkedTransactionId).toBe("tx-exflor");
    expect(queued.receipts[0].lines?.length).toBeGreaterThan(1);
  });

  it("la deschidere, bonul deja spart se lipește de cheltuiala notată și duplicatele ies", () => {
    const data = createEmptyAppData();
    data.transactions = [
      { id: "tx-exflor", title: "Exflor", amount: 64.95, kind: "expense", category: "Alimente", sourceId: "source-debit", source: "Card", memberId: "member-me", person: "Eu", date: "2026-10-05", allocationId: "outside", createdAt: "2026-10-05T10:00:00.000Z" },
      { id: "receipt-tx-bon-exflor-lapte", title: "Bon — Exflor · Lapte", amount: 8.58, kind: "expense", category: "Alimente", sourceId: "source-debit", source: "Card", memberId: "member-me", person: "Eu", date: "2026-10-05", receiptId: "bon-exflor", allocationId: "outside", createdAt: "2026-10-05T11:00:00.000Z" },
      { id: "receipt-tx-bon-exflor-sgr", title: "Bon — Exflor · SGR", amount: 5.5, kind: "expense", category: "Altele", sourceId: "source-debit", source: "Card", memberId: "member-me", person: "Eu", date: "2026-10-05", receiptId: "bon-exflor", allocationId: "outside", createdAt: "2026-10-05T11:00:00.000Z" },
    ];
    data.receipts = [{
      id: "bon-exflor", vendor: "Exflor", amount: 64.94, category: "Alimente", date: "2026-10-05", sourceId: "source-debit", memberId: "member-me",
      linkedTransactionIds: ["receipt-tx-bon-exflor-lapte", "receipt-tx-bon-exflor-sgr"],
      lines: [{ id: "lapte", category: "Alimente", amount: 8.58, label: "Lapte" }, { id: "sgr", category: "Altele", amount: 5.5, label: "SGR" }],
    }];
    const next = normalizeAppData(data);
    const expenses = next.transactions.filter((item) => item.kind === "expense" && item.date === "2026-10-05" && /exflor/i.test(item.title));
    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({ id: "tx-exflor", amount: 64.95, receiptId: "bon-exflor" });
    expect(next.receipts[0].linkedTransactionId).toBe("tx-exflor");
    expect(next.deleted.some((item) => item.id === "receipt-tx-bon-exflor-lapte")).toBe(true);
  });

  it("articolele se leagă de cheltuiala notată, fără o a doua mișcare", () => {
    const data = createEmptyAppData();
    data.transactions = [{ id: "tx", title: "Lidl", amount: 95, kind: "expense", category: "Alimente", source: "Card", sourceId: "source-debit", memberId: "member-me", person: "Eu", date: "2026-10-05" }];
    const next = attachReceiptDetail(data, "tx", [
      { id: "a", category: "Alimente", amount: 90, label: "Cumpărături" },
      { id: "b", category: "Altele", amount: 5, label: "Rest bon" },
    ]);
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0]).toMatchObject({ id: "tx", amount: 95, receiptId: "detail-tx" });
    expect(next.receipts[0].linkedTransactionId).toBe("tx");
    expect(next.receipts[0].lines).toHaveLength(2);
  });
});
