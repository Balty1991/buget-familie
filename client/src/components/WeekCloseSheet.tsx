/**
 * „Închide săptămâna”: ce a rămas în fiecare plic pe săptămâni și unde merge, plus soldul
 * de pe card și din portofel, comparat cu banca. Două minute, duminică seara sau luni.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { formatDate, parseRomanianAmount, type AppData } from "@/lib/finance-data";
import { applyDeclaredBalance, balanceCheckRows, markBalanceChecked } from "@/lib/balance-check";
import { applyWeekClose, markWeekClosed, weekToClose, type WeekCloseChoice } from "@/lib/week-close";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import "../safe-spend-sheet.css";
import "../payday.css";

const money = lei;
const day = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });

export function WeekCloseSheet({ data, today, evening, onApply, onClose }: { data: AppData; today: string; evening: boolean; onApply: (change: (current: AppData) => AppData) => void; onClose: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const close = weekToClose(data, today, evening);
  const rows = balanceCheckRows(data);
  const [choices, setChoices] = useState<Record<string, WeekCloseChoice>>({});
  const [declared, setDeclared] = useState<Record<string, string>>({});
  if (!close) return null;

  const apply = () => {
    const typed = rows.map((row) => ({ id: row.id, value: declared[row.id]?.trim() ? parseRomanianAmount(declared[row.id]) : undefined })).filter((row) => row.value != null && Number.isFinite(row.value));
    onApply((current) => {
      const latest = weekToClose(current, today, evening);
      let next = latest ? applyWeekClose(current, latest, choices) : current;
      for (const row of typed) next = applyDeclaredBalance(next, row.id, row.value!, today);
      return next;
    });
    if (typed.length) markBalanceChecked(today);
    markWeekClosed(close.end);
    onClose();
  };
  const later = () => { markWeekClosed(close.end); onClose(); };

  return createPortal(
    <div className="bf-modal-backdrop bf-safe-spend-backdrop" role="presentation" onClick={onClose}>
      <section ref={dialogRef} tabIndex={-1} className="bf-safe-spend-sheet bf-payday" role="dialog" aria-modal="true" aria-labelledby="bf-week-close-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="bf-kicker">{t("ÎNCHIDEREA SĂPTĂMÂNII")}</p>
            <h2 id="bf-week-close-title">{t("{start} – {end}", { start: day(close.start), end: day(close.end) })}</h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}><X size={18} /></button>
        </header>
        <p>{close.spent > close.budget + 0.009
          ? t("Ai cheltuit {spent} din {budget}: {over} peste.", { spent: money(close.spent), budget: money(close.budget), over: money(close.spent - close.budget) })
          : t("Ai cheltuit {spent} din {budget}. Au rămas {left}.", { spent: money(close.spent), budget: money(close.budget), left: money(close.budget - close.spent) })}</p>

        <fieldset>
          <legend>{t("1. Plicurile săptămânii")}</legend>
          {close.envelopes.map((item) => {
            const choice = choices[item.allocationId] ?? "carry";
            const over = item.remaining < -0.009;
            const canMove = item.nextIndex != null && (over ? item.nextRemaining > 0 : item.remaining > 0.009);
            return (
              <div key={item.allocationId} className="bf-payday-row">
                <span>
                  <b>{item.label}</b>
                  <small>{over ? t("{amount} peste săptămână", { amount: money(-item.remaining) }) : t("rămași {amount}", { amount: money(item.remaining) })}</small>
                </span>
                {canMove && (
                  <label className="bf-payday-check">
                    <input type="checkbox" checked={choice === "carry"} onChange={(event) => setChoices((current) => ({ ...current, [item.allocationId]: event.target.checked ? "carry" : "keep" }))} />
                    <span><small>{over
                      ? t("Acoperă din săptămâna următoare (−{amount})", { amount: money(Math.min(-item.remaining, item.nextRemaining)) })
                      : t("Trec în săptămâna următoare (+{amount})", { amount: money(item.remaining) })}</small></span>
                  </label>
                )}
              </div>
            );
          })}
        </fieldset>

        {rows.length > 0 && (
          <fieldset>
            <legend>{t("2. Soldul, ca în bancă")}</legend>
            <p>{t("Scrie cât vezi în aplicația băncii sau în portofel. Dacă diferă, potrivesc soldul cu o corecție; lasă gol ce nu verifici.")}</p>
            {rows.map((row) => (
              <label key={row.id} className="bf-payday-row">
                <span><b>{row.name}</b><small>{t("În aplicație: {amount}", { amount: money(row.balance) })}</small></span>
                <input inputMode="decimal" placeholder={String(row.balance).replace(".", ",")} value={declared[row.id] ?? ""} onChange={(event) => setDeclared((current) => ({ ...current, [row.id]: event.target.value }))} aria-label={t("Sold real pentru {name}", { name: row.name })} />
              </label>
            ))}
          </fieldset>
        )}

        <footer>
          <button type="button" className="bf-secondary" onClick={later}>{t("Nu acum")}</button>
          <button type="button" className="bf-primary" onClick={apply}><Check size={16} aria-hidden="true" /> {t("Închide săptămâna")}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
