/**
 * „Cine cui datorează.”
 *
 * Unul plătește cumpărăturile, celălalt facturile, iar la sfârșit de ciclu nimeni nu mai
 * știe cine a pus mai mult. Aplicația avea toate cifrele — persoana fiecărei mișcări și
 * deosebirea dintre comun și personal — dar nu făcea niciodată scăderea.
 *
 * Apare doar în casele cu doi adulți și doar când chiar e ceva de echilibrat.
 */
import { Scale } from "lucide-react";
import { applySettlement, settleUp } from "@/lib/settle-up";
import { formatDate, type AppData } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";
import "../settle-up.css";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

export function SettleUpCard({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const socoteala = settleUp(data);
  // Fără cheltuieli comune nu e nimic de arătat — decât dacă tocmai ați echilibrat.
  if (!socoteala || (socoteala.total <= 0 && !socoteala.settledAt)) return null;

  return (
    <section className="bf-settle" aria-labelledby="bf-settle-title">
      <p className="bf-kicker">{t("CINE CUI DATOREAZĂ")}</p>
      <h2 id="bf-settle-title">{t("Cheltuieli comune de pe {date}", { date: formatDate(socoteala.since) })}</h2>
      <p className="bf-settle-lead">
        {t("{total} în total, adică {each} de fiecare.", { total: money(socoteala.total), each: money(socoteala.perPerson) })}
      </p>
      <ul className="bf-settle-rows">
        {socoteala.rows.map((row) => (
          <li key={row.memberId}>
            <b>{row.name}</b>
            <span>{money(row.paid)}</span>
            <em className={row.balance >= 0 ? "up" : "down"}>
              {row.balance >= 0 ? t("+{amount}", { amount: money(row.balance) }) : t("−{amount}", { amount: money(-row.balance) })}
            </em>
          </li>
        ))}
      </ul>
      {socoteala.debt ? (
        <>
          <p className="bf-settle-verdict">
            {t("{from} dă {amount} către {to}.", { from: socoteala.debt.fromName, amount: money(socoteala.debt.amount), to: socoteala.debt.toName })}
          </p>
          <button type="button" className="bf-primary bf-settle-action" onClick={() => onChange(applySettlement(data))}>
            <Scale size={16} aria-hidden="true" /> {t("Am echilibrat")}
          </button>
          <small>{t("Se trec două mișcări personale — una care iese, una care intră — și socoteala repornește de azi.")}</small>
        </>
      ) : (
        <p className="bf-settle-verdict">
          {socoteala.settledAt
            ? t("Ați echilibrat pe {date} — de atunci sunteți chit", { date: formatDate(socoteala.settledAt) })
            : t("Sunteți chit. Nu e nimic de echilibrat.")}
        </p>
      )}
    </section>
  );
}
