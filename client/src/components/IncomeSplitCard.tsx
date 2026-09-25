/**
 * Propunerea de repartizare pentru un salariu intrat: ce acoperă acum, ce rămâne pentru
 * salariul următor, cât e liber. Nimic nu se schimbă până la „Aplică repartizarea”.
 */
import "../monthly-needs.css";
import { useMemo, useState } from "react";
import { Check, WalletCards } from "lucide-react";
import { formatDate, type AppData } from "@/lib/finance-data";
import { applyIncomeSplit, proposeIncomeSplit } from "@/lib/monthly-needs";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

const money = lei;

export function IncomeSplitCard({ data, incomeId, onChange, onDismiss }: { data: AppData; incomeId: string; onChange: (next: AppData) => void; onDismiss?: () => void }) {
  const split = useMemo(() => proposeIncomeSplit(data, incomeId), [data, incomeId]);
  const [error, setError] = useState("");
  if (!split.ok) return null;
  const member = data.settings.members.find((item) => item.id === split.income.memberId)?.name;
  const shown = split.lines.filter((line) => line.amount > 0 || line.remaining > 0);
  const apply = () => {
    const result = applyIncomeSplit(data, incomeId);
    if (result.error) setError(result.error);
    else onChange(result.data);
  };
  return (
    <section className="bf-income-split" aria-labelledby={`split-${incomeId}`}>
      <header>
        <WalletCards size={19} aria-hidden="true" />
        <div>
          <p className="bf-kicker">{t("A INTRAT UN VENIT")}</p>
          <h3 id={`split-${incomeId}`}>{t("{title}{who} · {amount}", { title: split.income.title, who: member ? ` (${member})` : "", amount: money(split.income.amount) })}</h3>
          <p>{t("Propunere după cheltuielile lunare: obligațiile întâi, apoi restul, cât ajung banii.")}</p>
        </div>
      </header>
      <ul>
        {shown.map((line) => (
          <li key={line.need.id} className={line.amount <= 0 ? "is-later" : line.remaining > 0 ? "is-partial" : ""}>
            <span>
              <b>{line.need.label}</b>
              <small>
                {line.weeks ? t("{weeks} săpt. × {weekly} = {target}", { weeks: line.weeks, weekly: money(line.target / line.weeks), target: money(line.target) }) : money(line.target)}
                {line.fundedBefore > 0 ? ` · ${t("{amount} deja acoperiți", { amount: money(line.fundedBefore) })}` : ""}
                {line.remaining > 0 ? ` · ${line.skipped === "other-payer" ? t("din celălalt salariu") : t("rămân {amount}", { amount: money(line.remaining) })}` : ""}
              </small>
            </span>
            <strong>{line.amount > 0 ? money(line.amount) : "—"}</strong>
          </li>
        ))}
      </ul>
      <footer>
        <p>
          {split.free > 0 ? t("Liberi după repartizare: {amount}.", { amount: money(split.free) }) : t("Tot venitul are un loc.")}
          {split.uncovered > 0 ? ` ${split.nextIncome
            ? t("Rămân {amount} pentru {label} ({date}).", { amount: money(split.uncovered), label: split.nextIncome.label, date: formatDate(split.nextIncome.date, { day: "numeric", month: "long" }) })
            : t("Rămân neacoperiți {amount} — venitul nu ajunge pentru tot ce ai declarat.", { amount: money(split.uncovered) })}` : ""}
        </p>
        {error && <p className="bf-form-error" role="alert">{error}</p>}
        <div>
          {onDismiss && <button type="button" className="bf-secondary" onClick={onDismiss}>{t("Nu acum")}</button>}
          <button type="button" className="bf-primary" onClick={apply} disabled={split.covered <= 0}><Check size={16} /> {t("Aplică repartizarea")}</button>
        </div>
      </footer>
    </section>
  );
}
