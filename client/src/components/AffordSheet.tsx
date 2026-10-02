/**
 * „Îmi permit?”: scrii suma, alegi (dacă vrei) plicul, iar răspunsul se schimbă pe loc, cu
 * prețul în săptămâni de economii pentru primul obiectiv. Nimic nu se salvează.
 */
import { useMemo, useState } from "react";
import { Check, CircleAlert, CircleX, X } from "lucide-react";
import { isoToday, parseRomanianAmount, type AppData } from "@/lib/finance-data";
import { affordCheck, type Afford } from "@/lib/afford";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { daysLabel, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

const TONE = { yes: "var(--cf-primary)", tight: "#c98a1b", no: "var(--cf-danger)" } as const;

function headline(answer: Afford) {
  const env = answer.envelope;
  if (answer.tone === "no") return t("Nu acum: ar lipsi {amount}.", { amount: lei(-answer.freeAfter) });
  if (env && env.after >= 0) return answer.tone === "yes" ? t("Da. În „{label}” rămân {amount}.", { label: env.label, amount: lei(env.after) }) : t("Da, dar „{label}” rămâne aproape gol: {amount}.", { label: env.label, amount: lei(env.after) });
  if (env) return t("Din „{label}” nu încape; cu banii liberi, da. Rămân {amount} liberi.", { label: env.label, amount: lei(answer.freeAfter) });
  return answer.tone === "yes" ? t("Da. Rămân {amount} liberi până la salariu.", { amount: lei(answer.freeAfter) }) : t("Încape, dar rămâneți cu ~{perDay} pe zi pentru {days}.", { perDay: lei(answer.perDayAfter), days: daysLabel(answer.daysLeft) });
}

export function AffordSheet({ data, onClose, onLog }: { data: AppData; onClose: () => void; onLog: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const [amount, setAmount] = useState("");
  const [envelopeId, setEnvelopeId] = useState<string | undefined>(undefined);
  const envelopes = data.settings.salaryPlan.allocations.filter((item) => item.weeklyPace !== false).slice(0, 6);
  const answer = useMemo(() => affordCheck(data, parseRomanianAmount(amount), envelopeId, isoToday()), [amount, data, envelopeId]);
  const Icon = answer?.tone === "yes" ? Check : answer?.tone === "tight" ? CircleAlert : CircleX;
  return (
    <div className="bf-modal-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className="bf-modal bf-afford" role="dialog" aria-modal="true" aria-labelledby="bf-afford-title">
        <header>
          <div><p className="bf-kicker">{t("ÎMI PERMIT?")}</p><h2 id="bf-afford-title">{t("Scrie suma, vezi pe loc")}</h2></div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}><X size={19} /></button>
        </header>
        <label className="bf-field"><span>{t("Cât costă (lei)")}</span><input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" style={{ fontSize: 32, fontWeight: 700, minHeight: 64 }} /></label>
        {envelopes.length > 0 && <div className="bf-hero-chips" role="group" aria-label={t("Din ce plic")}>
          <button type="button" className="bf-hero-chip" aria-pressed={!envelopeId} onClick={() => setEnvelopeId(undefined)}>{t("Din banii liberi")}</button>
          {envelopes.map((item) => <button type="button" key={item.id} className="bf-hero-chip" aria-pressed={envelopeId === item.id} onClick={() => setEnvelopeId(item.id)}>{item.label}</button>)}
        </div>}
        {answer && <div className="bf-afford-answer" aria-live="polite" style={{ display: "grid", gap: 6, padding: 16, borderRadius: 18, border: `2px solid ${TONE[answer.tone]}`, background: `color-mix(in srgb, ${TONE[answer.tone]} 10%, var(--cf-surface))` }}>
          <b style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 18, lineHeight: 1.3 }}><Icon size={24} color={TONE[answer.tone]} aria-hidden="true" style={{ flex: "none" }} />{headline(answer)}</b>
          {answer.envelope?.week && <small>{t("Socotit pe tranșa S{week} a plicului.", { week: answer.envelope.week })}</small>}
          {answer.goal && <small>{t("Echivalentul a ~{weeks} săptămâni de economii pentru „{goal}”.", { weeks: answer.goal.weeks, goal: answer.goal.name })}</small>}
        </div>}
        <div className="bf-whats-new-actions">
          {answer && answer.tone !== "no" && <button type="button" className="bf-primary" onClick={onLog}>{t("Am cumpărat — notează")}</button>}
          <button type="button" className="bf-secondary" onClick={onClose}>{t("Închide")}</button>
        </div>
      </section>
    </div>
  );
}
