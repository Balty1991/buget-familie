import { useState } from "react";
import { Scale } from "lucide-react";
import { applySettlement, pickSettlementSources, settleUp } from "@/lib/settle-up";
import { formatDate, type AppData } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";
import "../settle-up.css";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

export function SettleUpCard({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const socoteala = settleUp(data);
  const [fromSourceId, setFromSourceId] = useState("");
  const [toSourceId, setToSourceId] = useState("");
  if (!socoteala || (socoteala.total <= 0 && !socoteala.settledAt)) return null;
  const debt = socoteala.debt;
  const wallets = debt ? pickSettlementSources(data, debt.fromId, debt.toId, { fromSourceId, toSourceId }) : undefined;
  const alese = data.settings.paymentSources.filter((item) => item.kind !== "transfer" && item.kind !== "meal");
  const echilibreaza = () => {
    if (!debt) return;
    onChange(applySettlement(data, undefined, { fromSourceId: wallets?.from?.id, toSourceId: wallets?.to?.id }));
  };

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
      {debt ? (
        <>
          <p className="bf-settle-verdict">
            {t("{from} dă {amount} către {to}.", { from: debt.fromName, amount: money(debt.amount), to: debt.toName })}
          </p>
          {!wallets?.ok && (
            <div className="bf-settle-wallets">
              <p>{t("Alege portofelul fiecăruia — altfel banii se anulează pe același card.")}</p>
              <label>
                <span>{t("Din portofelul lui {name}", { name: debt.fromName })}</span>
                <select value={fromSourceId || wallets?.from?.id || ""} onChange={(event) => setFromSourceId(event.target.value)} aria-label={t("Din portofelul lui {name}", { name: debt.fromName })}>
                  <option value="">{t("Alege")}</option>
                  {alese.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>
                <span>{t("În portofelul lui {name}", { name: debt.toName })}</span>
                <select value={toSourceId || wallets?.to?.id || ""} onChange={(event) => setToSourceId(event.target.value)} aria-label={t("În portofelul lui {name}", { name: debt.toName })}>
                  <option value="">{t("Alege")}</option>
                  {alese.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            </div>
          )}
          <button type="button" className="bf-primary bf-settle-action" disabled={!wallets?.ok} onClick={echilibreaza}>
            <Scale size={16} aria-hidden="true" /> {t("Am echilibrat")}
          </button>
          <small>
            {wallets?.ok
              ? t("Se trec două mișcări: iese din {from}, intră în {to}. Socoteala repornește de azi.", { from: wallets.from?.name || "", to: wallets.to?.name || "" })
              : t("Alege două portofele diferite ca banii să treacă de la unul la altul.")}
          </small>
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