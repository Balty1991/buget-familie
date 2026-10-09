/**
 * „A intrat salariul”: un singur ecran pentru ziua salariului. Ce a intrat, luna nouă,
 * plicurile pe ea, ratele până la salariul următor și cât rămâne nerepartizat.
 * Nimic nu se scrie până la „Pornește luna”; cifrele de jos sunt cele din Plan după apăsare.
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { addIsoDays, formatDate, parseRomanianAmount, type AppData } from "@/lib/finance-data";
import { envelopeTotal, proposePayday, summarizePayday, type PaydayProposal } from "@/lib/payday";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { daysLabel, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import "../safe-spend-sheet.css";
import "../payday.css";

const money = lei;
const day = (iso: string) => formatDate(iso, { day: "numeric", month: "long" });
const input = (value: number) => (value ? String(value).replace(".", ",") : "");

export function PaydaySheet({ data, today, onApply, onClose }: { data: AppData; today: string; onApply: (proposal: PaydayProposal) => void; onClose: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const [date, setDate] = useState(today);
  const base = useMemo(() => proposePayday(data, date), [data, date]);
  const [nextPayday, setNextPayday] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [envelopes, setEnvelopes] = useState<Record<string, string>>({});

  const end = nextPayday && nextPayday > addIsoDays(date, 6) ? nextPayday : base.nextPayday;
  const proposal: PaydayProposal = {
    date,
    nextPayday: end,
    incomes: base.incomes.map((item) => ({ ...item, amount: skipped[item.key] ? 0 : amounts[item.key] != null ? parseRomanianAmount(amounts[item.key]) : item.amount })),
    envelopes: base.envelopes.map((item) => {
      const typed = envelopes[item.allocationId];
      if (typed == null) return item;
      const value = Math.max(0, parseRomanianAmount(typed));
      return item.weekly != null ? { ...item, weekly: value } : { ...item, amount: value };
    }),
  };
  const summary = summarizePayday(data, proposal);
  const sourceName = (id: string) => data.settings.paymentSources.find((source) => source.id === id)?.name || "";
  const outside = summary.duesList.filter((item) => item.outside);
  const mine = summary.duesList.filter((item) => !item.outside);

  return createPortal(
    <div className="bf-modal-backdrop bf-safe-spend-backdrop" role="presentation" onClick={onClose}>
      <section ref={dialogRef} tabIndex={-1} className="bf-safe-spend-sheet bf-payday" role="dialog" aria-modal="true" aria-labelledby="bf-payday-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="bf-kicker">{t("ZIUA SALARIULUI")}</p>
            <h2 id="bf-payday-title">{t("A intrat salariul")}</h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}><X size={18} /></button>
        </header>

        <fieldset className="bf-payday-block">
          <legend>{t("1. Ce a intrat")}</legend>
          <label className="bf-payday-row">
            <span><b>{t("Data")}</b></span>
            <input type="date" value={date} min={addIsoDays(today, -10)} max={today} onChange={(event) => event.target.value && setDate(event.target.value)} />
          </label>
          {base.incomes.map((item) => (
            <div key={item.key} className="bf-payday-row">
              <label className="bf-payday-check">
                <input type="checkbox" checked={!skipped[item.key]} disabled={Boolean(item.notedId)} onChange={(event) => setSkipped((current) => ({ ...current, [item.key]: !event.target.checked }))} />
                <span><b>{item.title}</b><small>{item.notedId ? t("{source} · deja notat", { source: sourceName(item.sourceId) }) : sourceName(item.sourceId)}</small></span>
              </label>
              <input
                inputMode="decimal"
                aria-label={t("Suma pentru {title}", { title: item.title })}
                value={amounts[item.key] ?? input(item.amount)}
                disabled={Boolean(item.notedId) || skipped[item.key]}
                placeholder="0"
                onChange={(event) => setAmounts((current) => ({ ...current, [item.key]: event.target.value }))}
              />
            </div>
          ))}
        </fieldset>

        <fieldset className="bf-payday-block">
          <legend>{t("2. Luna nouă")}</legend>
          <label className="bf-payday-row">
            <span><b>{t("Următorul salariu")}</b><small>{t("{start} – {end}, {days}", { start: day(date), end: day(end), days: daysLabel(summary.days) })}</small></span>
            <input type="date" value={end} min={addIsoDays(date, 7)} max={addIsoDays(date, 45)} onChange={(event) => setNextPayday(event.target.value)} />
          </label>
        </fieldset>

        {proposal.envelopes.length > 0 && (
          <fieldset className="bf-payday-block">
            <legend>{t("3. Plicurile")}</legend>
            {proposal.envelopes.map((item) => (
              <label key={item.allocationId} className="bf-payday-row">
                <span>
                  <b>{item.label}</b>
                  <small>{item.weekly != null
                    ? t("{total} pe toată luna", { total: money(envelopeTotal(item, date, end)) })
                    : t("luna trecută: {amount}", { amount: money(item.previous) })}</small>
                </span>
                <span className="bf-payday-amount">
                  <input inputMode="decimal" value={envelopes[item.allocationId] ?? input(item.weekly ?? item.amount)} onChange={(event) => setEnvelopes((current) => ({ ...current, [item.allocationId]: event.target.value }))} aria-label={item.weekly != null ? t("{label}, pe săptămână", { label: item.label }) : t("{label}, pe lună", { label: item.label })} />
                  <small>{item.weekly != null ? t("/săpt.") : t("/lună")}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <fieldset className="bf-payday-block">
          <legend>{t("4. De plătit până pe {date}", { date: day(end) })}</legend>
          {!mine.length && !outside.length && <p className="bf-payday-note">{t("Nicio rată sau factură până la salariul următor.")}</p>}
          {mine.length > 0 && (
            <ul className="bf-payday-dues">
              {mine.map((item) => <li key={item.id}><span>{item.name}<small>{day(item.dueDate)}{item.memberName ? ` · ${item.memberName}` : ""}</small></span><strong>{money(item.amount)}</strong></li>)}
            </ul>
          )}
          {outside.length > 0 && (
            <>
              <ul className="bf-payday-dues is-outside">
                {outside.map((item) => <li key={item.id}><span>{item.name}<small>{day(item.dueDate)}{item.memberName ? ` · ${item.memberName}` : ""}</small></span><strong>{money(item.amount)}</strong></li>)}
              </ul>
              <p className="bf-payday-note">{t("Ratele de pe numele {names} nu se scad din banii notați: pe sursele lor nu e niciun venit. Când le plătești tu, confirmă-le în Obligații și intră la socoteală.", { names: Array.from(new Set(outside.map((item) => item.memberName).filter(Boolean))).join(", ") })}</p>
            </>
          )}
        </fieldset>

        <ol className="bf-payday-total" aria-label={t("Socoteala lunii")}>
          <li><span>{t("Pe carduri și cash, cu salariul")}</span><strong>{money(summary.inSources)}</strong></li>
          <li><span>{t("Pus în plicuri")}</span><strong>−{money(summary.inEnvelopes)}</strong></li>
          <li><span>{t("Rate și facturi până la salariu")}</span><strong>−{money(summary.dues)}</strong></li>
          <li className={summary.free < 0 ? "is-warn" : undefined}><span>{summary.free < 0 ? t("Lipsesc") : t("Rămân nerepartizați")}</span><strong>{money(Math.abs(summary.free))}</strong></li>
        </ol>
        {summary.meal > 0 && <p className="bf-payday-note">{t("Pe tichete: {amount}, pentru plicurile care le folosesc.", { amount: money(summary.meal) })}</p>}
        {summary.free < 0 && <p className="bf-payday-note is-warn" role="status">{t("Plicurile și ratele cer mai mult decât ai. Micșorează un plic sau suma pe săptămână.")}</p>}

        <footer>
          <button type="button" className="bf-secondary" onClick={onClose}>{t("Nu acum")}</button>
          <button type="button" className="bf-primary" onClick={() => onApply(proposal)}><Check size={16} aria-hidden="true" /> {t("Pornește luna")}</button>
        </footer>
        <p>{t("Mișcările vechi rămân neatinse. Luna trecută intră în istoric.")}</p>
      </section>
    </div>,
    document.body,
  );
}
