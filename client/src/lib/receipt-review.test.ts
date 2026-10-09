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

  it("articolul scris în Notează („Lidl · pâine”) păstrează magazinul ca vânzător", () => {
    const data = createEmptyAppData();
    data.transactions = [{ id: "tx", title: "Lidl · pâine", amount: 6.79, kind: "expense", category: "Alimente", source: "Card", sourceId: "source-debit", memberId: "member-me", person: "Eu", date: "2026-10-08" }];
    const next = attachReceiptDetail(data, "tx", [{ id: "a", category: "Alimente", amount: 6.79, label: "pâine" }], undefined, "Lidl");
    expect(next.receipts[0]).toMatchObject({ vendor: "Lidl", amount: 6.79 });
    expect(next.receipts[0].lines?.[0].label).toBe("pâine");
  });
});

describe("bonul legat de o cheltuială notată", () => {
  const base = () => {
    const data = createEmptyAppData();
    data.transactions = [{ id: "tx-user", title: "Kaufland", kind: "expense", category: "Alimente", amount: 100, date: "2026-10-05", sourceId: "source-debit", source: "Card", memberId: "member-me", person: "Eu", createdAt: "2026-10-05T10:00:00.000Z" }];
    return data;
  };
  const receipt = (id: string) => ({ id, vendor: "Kaufland", amount: 100, category: "Alimente", date: "2026-10-05", sourceId: "source-debit", memberId: "member-me", linkedTransactionId: "tx-user", lines: [{ id: "a", category: "Alimente", amount: 100, label: "Pâine" }] });

  it("editarea bonului atașat nu șterge cheltuiala notată de om", () => {
    const attached = queueReceiptForReview(base(), receipt("bon-k"));
    expect(attached.transactions.map((item) => item.id)).toEqual(["tx-user"]);
    const edited = queueReceiptForReview(attached, { ...receipt("bon-k"), note: "corectat" });
    expect(edited.transactions.map((item) => item.id)).toEqual(["tx-user"]);
    expect(edited.deleted.some((item) => item.id === "tx-user")).toBe(false);
    expect(edited.pendingReview).toHaveLength(0);
  });

  it("detaliul pus pe cheltuială, salvat apoi ca bon, nu șterge cheltuiala", () => {
    const detailed = attachReceiptDetail(base(), "tx-user", [{ id: "a", category: "Alimente", amount: 100, label: "Pâine" }]);
    const stored = detailed.receipts[0];
    const saved = queueReceiptForReview(detailed, stored);
    expect(saved.transactions.map((item) => item.id)).toEqual(["tx-user"]);
    expect(saved.deleted.some((item) => item.id === "tx-user")).toBe(false);
  });
});

describe("bonul cu lucruri pentru toată luna, în plicul de alimente pe săptămâni", () => {
  const family = () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-10-09", nextPayday: "2026-11-09", earliestPayday: undefined, paydayFlexDays: 0,
      allocations: [{ id: "food", label: "Alimente", amount: 2744, category: "Alimente", sourceId: "source-debit", weeklyAmount: 600, weeklyPace: true }] };
    return data;
  };
  // Bonul Mega Image din 9 oct: detergentul e cel mai scump articol.
  const mega = {
    id: "mega", vendor: "Mega Image", amount: 165.5, category: "Alimente", date: "2026-10-09", sourceId: "source-debit", memberId: "member-me",
    lines: [
      { id: "l1", label: "PAINE ALBA FELII", category: "Alimente", amount: 2.69 },
      { id: "l2", label: "M&M'S CIOCOLATA 82G", category: "Dulciuri", amount: 8.75 },
      { id: "l3", label: "KINDER JOY 20G", category: "Dulciuri", amount: 6.79 },
      { id: "l4", label: "ACTIMEL ACTIKIDS CAP", category: "Alimente", amount: 12.69 },
      { id: "l5", label: "ARIEL PODS EXTRA CLE", category: "Altele", amount: 32.09 },
      { id: "l6", label: "ONE JUN PISICA PUI", category: "Alimente", amount: 32.49 },
      { id: "l7", label: "ARIEL PODS COLOR, 76", category: "Altele", amount: 70 },
    ],
  };

  it("merge în plicul de alimente, iar detergentul și hrana pisicii se împart singure pe lună", () => {
    const [draft] = buildReceiptReviewDrafts(family(), mega);
    expect(draft.transaction).toMatchObject({ allocationId: "food", category: "Alimente", spreadAmount: 134.58 });
    expect(draft.reason).toMatch(/134\.58|134,58/);
  });

  it("partea întinsă rămâne după confirmare și după salvare", () => {
    const queued = queueReceiptForReview(family(), mega);
    const confirmed = confirmReviewDraft(queued, queued.pendingReview[0].id)!;
    const again = normalizeAppData(JSON.parse(JSON.stringify(confirmed)));
    expect(again.transactions.find((item) => item.receiptId === "mega")?.spreadAmount).toBe(134.58);
  });

  it("fără plic pe săptămâni, bonul rămâne întreg (nimic de întins)", () => {
    const data = family();
    data.settings.salaryPlan.allocations[0] = { ...data.settings.salaryPlan.allocations[0], weeklyPace: false, weeklyAmount: undefined };
    const [draft] = buildReceiptReviewDrafts(data, mega);
    expect(draft.transaction.spreadAmount).toBeUndefined();
  });
});
