/**
 * Bon → coadă de revizuire: liniile propun plicuri, registrul se scrie doar după confirmare.
 */
import {
  addReviewDrafts,
  matchingAllocationsForExpense,
  newId,
  resolveReceiptLines,
  type AppData,
  type Receipt,
  type ReviewDraft,
  type Transaction,
} from "./finance-data";
import { t } from "./i18n";

export function buildReceiptReviewDrafts(data: AppData, receipt: Receipt): ReviewDraft[] {
  const member = data.settings.members.find((entry) => entry.id === receipt.memberId) || data.settings.members[0];
  const source = data.settings.paymentSources.find((entry) => entry.id === receipt.sourceId) || data.settings.paymentSources[0];
  if (!member || !source) return [];
  const lines = resolveReceiptLines(
    receipt.lines?.length ? receipt.lines : [{ id: "whole", category: receipt.category, amount: receipt.amount }],
    receipt.amount,
  );
  const now = new Date().toISOString();
  return lines.map((line) => {
    const matched = matchingAllocationsForExpense(data, {
      category: line.category,
      memberId: member.id,
      sourceId: source.id,
    })[0];
    const allocationId = line.allocationId || matched?.id || "outside";
    const title = `Bon — ${receipt.vendor}${line.label ? ` · ${line.label}` : ""}`;
    const transaction: Transaction = {
      id: `receipt-tx-${receipt.id}-${line.id}`,
      receiptId: receipt.id,
      title,
      amount: line.amount,
      kind: "expense",
      category: line.category,
      sourceId: source.id,
      source: source.name,
      memberId: member.id,
      person: member.name,
      date: receipt.date,
      note: receipt.note,
      allocationId,
      createdAt: now,
    };
    const envelopeLabel = matched?.label || t("în afara plicurilor");
    return {
      id: newId("review"),
      origin: "bon" as const,
      reason: t("Bon {vendor} · {category} → {envelope}", {
        vendor: receipt.vendor,
        category: t(line.category),
        envelope: envelopeLabel,
      }),
      createdAt: now,
      transaction,
    };
  });
}

/** Salvează bonul și pune liniile în coada de revizuire — registrul rămâne neatins până la confirmare. */
export function queueReceiptForReview(data: AppData, receipt: Receipt): AppData {
  const formerIds = new Set(
    (data.receipts.find((entry) => entry.id === receipt.id)?.linkedTransactionIds
      || [receipt.linkedTransactionId, `receipt-tx-${receipt.id}`].filter((value): value is string => Boolean(value))),
  );
  const lines = resolveReceiptLines(
    receipt.lines?.length ? receipt.lines : [{ id: "whole", category: receipt.category, amount: receipt.amount }],
    receipt.amount,
  );
  const transactionIds = lines.map((line) => `receipt-tx-${receipt.id}-${line.id}`);
  const stored: Receipt = {
    ...receipt,
    lines,
    linkedTransactionId: undefined,
    linkedTransactionIds: transactionIds,
    updatedAt: new Date().toISOString(),
  };
  const withoutFormer: AppData = {
    ...data,
    receipts: [stored, ...data.receipts.filter((entry) => entry.id !== receipt.id)],
    transactions: data.transactions.filter((entry) => !formerIds.has(entry.id) && entry.receiptId !== receipt.id),
    pendingReview: data.pendingReview.filter(
      (draft) => draft.transaction.receiptId !== receipt.id && !formerIds.has(draft.transaction.id),
    ),
  };
  return addReviewDrafts(withoutFormer, buildReceiptReviewDrafts(withoutFormer, stored));
}
