import { useMemo, useState } from "react";
import { Check, Sparkles, WalletCards } from "lucide-react";
import type { BudgetAllocation } from "@/lib/finance-data";
import { plannedEnvelopeReserved } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const round2 = (value: number) => Math.round(value * 100) / 100;

type AllocationChange = { id: string; amount: number };

export function MonthlyAllocationWizard({ allocations, available, scheduled, remainingById = {}, periodLabel, onApply }: { allocations: BudgetAllocation[]; available: number; scheduled: number; remainingById?: Record<string, number>; periodLabel: string; onApply: (changes: AllocationChange[]) => void; onChangeGoal?: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const safeAvailable = Math.max(0, available - scheduled);
  const reserved = plannedEnvelopeReserved(allocations, remainingById, Object.fromEntries(allocations.map((item) => [item.id, item.amount])));
  const remainder = round2(safeAvailable - reserved);
  const only = allocations.length === 1 ? allocations[0] : undefined;
  const scaled = useMemo(() => {
    const total = allocations.reduce((sum, item) => sum + item.amount, 0);
    if (total <= 0 || safeAvailable <= 0) return [];
    const factor = safeAvailable / total;
    return allocations.map((item) => ({ id: item.id, label: item.label, from: item.amount, amount: round2(item.amount * factor) })).filter((item) => Math.round(item.amount * 100) !== Math.round(item.from * 100));
  }, [allocations, safeAvailable]);

  if (dismissed || !allocations.length) return null;
  if (remainder > -0.5 && remainder < 0.5) return null;

  const apply = (changes: AllocationChange[]) => {
    if (!changes.length) return;
    onApply(changes);
  };

  return (
    <section className="bf-monthly-wizard" aria-labelledby="monthly-wizard-title">
      <div className="bf-monthly-wizard-head">
        <div>
          <p className="bf-kicker">{t("REPARTIZARE LUNARĂ")}</p>
          <h2 id="monthly-wizard-title">{remainder > 0 ? t("Îți rămân bani fără plic.") : t("Plicurile depășesc disponibilul")}</h2>
          <p>{periodLabel}. {remainder > 0 ? t("Nu e un pas obligatoriu — cei {amount} stau liberi până îi pui într-un plic sau faci unul nou, mai jos.", { amount: money(remainder) }) : t("Scade un plic sau lasă-i așa și revino când ai venitul.")}</p>
        </div>
        <span><WalletCards size={20} /></span>
      </div>
      {remainder > 0 && (
        <div className="bf-wizard-step">
          <div className="bf-wizard-hero">
            <strong>{money(remainder)}</strong>
            <span>{t("rămași de pus în plicuri")}</span>
          </div>
          <div className="bf-wizard-footer" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="bf-primary" onClick={() => setDismissed(true)}>{t("Lasă-i liberi")}</button>
            {only ? (
              <button type="button" onClick={() => apply([{ id: only.id, amount: round2(only.amount + remainder) }])}>
                <Sparkles size={16} /> {t("Pune {amount} în {label}", { amount: money(remainder), label: only.label })}
              </button>
            ) : scaled.length > 0 ? (
              <button type="button" onClick={() => apply(scaled.map((item) => ({ id: item.id, amount: item.amount })))}>
                <Sparkles size={16} /> {t("Distribuie {amount} în plicurile existente", { amount: money(remainder) })}
              </button>
            ) : null}
          </div>
        </div>
      )}
      {remainder < 0 && (
        <div className="bf-wizard-step">
          <p className="bf-wizard-help">{t("Editează un plic mai jos ca sumele să încapă în {amount}.", { amount: money(safeAvailable) })}</p>
          <button type="button" onClick={() => setDismissed(true)}><Check size={16} /> {t("Am înțeles")}</button>
        </div>
      )}
    </section>
  );
}
