import "../envelope-transfer.css";
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { allocationStatus, appendAllocationHistory, parseRomanianAmount, transferBetweenEnvelopes, type AppData } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

/**
 * Realocare între plicuri: mută o limită, nu o mișcare bancară.
 * Folosește salaryPlan.transfers — aceeași formă sincronizată între dispozitive.
 */
export function EnvelopeTransferPanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const plan = data.settings.salaryPlan;
  const envelopes = plan.allocations.map((item) => ({ item, ...allocationStatus(data, item) }));
  const sources = envelopes.filter((entry) => entry.remaining > 0);
  const [fromId, setFromId] = useState(sources[0]?.item.id || "");
  const [toId, setToId] = useState(envelopes.find((entry) => entry.item.id !== (sources[0]?.item.id || ""))?.item.id || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  if (envelopes.length < 2) return null;

  const from = envelopes.find((entry) => entry.item.id === fromId);
  const apply = () => {
    const value = parseRomanianAmount(amount);
    if (!fromId || !toId) return setError(t("Alege plicul din care iei și plicul care primește."));
    if (fromId === toId) return setError(t("Alege două plicuri diferite."));
    if (value <= 0) return setError(t("Introdu o sumă mai mare decât zero."));
    const next = transferBetweenEnvelopes(data, { fromAllocationId: fromId, toAllocationId: toId, amount: value, note });
    if (!next) return setError(from ? `Poți muta cel mult ${money(Math.max(0, from.remaining))} din „${from.item.label}”.` : t("Suma depășește ce a rămas în plicul sursă."));
    const transfer = next.settings.salaryPlan.transfers[0];
    const fromLabel = plan.allocations.find((item) => item.id === fromId)?.label || t("Plic sursă");
    const toLabel = plan.allocations.find((item) => item.id === toId)?.label || t("Plic destinație");
    onChange(appendAllocationHistory(next, { kind: "envelope-transfer", referenceId: transfer?.id, fromAllocationId: fromId, fromAllocationLabel: fromLabel, toAllocationId: toId, toAllocationLabel: toLabel, amount: value, note: note.trim() || undefined }));
    setAmount("");
    setNote("");
    setError("");
  };

  return (
    <section className="bf-transfer-panel bf-envelope-move" aria-labelledby="envelope-move-title">
      <div className="bf-section-heading">
        <div>
          <p className="bf-kicker">{t("ÎNTRE PLICURI")}</p>
          <h2 id="envelope-move-title">{t("Mută lei dintr-un plic în altul.")}</h2>
          <p>{t("Schimbă doar limitele. Soldul cardului sau al cash-ului rămâne neschimbat.")}</p>
        </div>
        <ArrowLeftRight size={22} aria-hidden="true" />
      </div>
      <div className="bf-transfer-form">
        <label>
          <span>{t("Din")}</span>
          <select value={fromId} onChange={(event) => {
            const nextFrom = event.target.value;
            setFromId(nextFrom);
            if (toId === nextFrom) setToId(envelopes.find((entry) => entry.item.id !== nextFrom)?.item.id || "");
            setError("");
          }}>
            {envelopes.map((entry) => (
              <option key={entry.item.id} value={entry.item.id} disabled={entry.remaining <= 0}>
                {entry.item.label} · {Math.round(Math.max(0, entry.remaining)).toLocaleString("ro-RO")}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Spre</span>
          <select value={toId} onChange={(event) => { setToId(event.target.value); setError(""); }}>
            {envelopes.filter((entry) => entry.item.id !== fromId).map((entry) => (
              <option key={entry.item.id} value={entry.item.id}>{entry.item.label} · {Math.round(entry.budget).toLocaleString("ro-RO")}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("Sumă")}</span>
          <input value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} inputMode="decimal" placeholder={from ? `max. ${Math.round(Math.max(0, from.remaining))}` : "ex. 100"} />
        </label>
        <label>
          <span>{t("Notă (opțional)")}</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("ex. taxi mai puțin")} />
        </label>
        <button type="button" className="bf-primary" onClick={apply}>{t("Mută între plicuri")}</button>
      </div>
      {error && <p className="bf-form-error" role="alert">{error}</p>}
      {plan.transfers.slice(0, 4).length > 0 && (
        <div className="bf-transfer-history">
          {plan.transfers.slice(0, 4).map((item) => {
            const fromLabel = plan.allocations.find((entry) => entry.id === item.fromAllocationId)?.label || t("Plic eliminat");
            const toLabel = plan.allocations.find((entry) => entry.id === item.toAllocationId)?.label || t("Plic eliminat");
            return <span key={item.id}><b>{fromLabel}</b> → <b>{toLabel}</b> <strong>{money(item.amount)}</strong></span>;
          })}
        </div>
      )}
    </section>
  );
}
