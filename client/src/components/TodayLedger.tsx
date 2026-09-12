import { EnvelopeDeskScene, EnvelopeMark, EnvelopeStack } from "@/components/EnvelopeMark";
import { CashNote, PaydayStrip } from "@/components/LedgerArt";
import { envelopeLane, lastDaysPulse, liquidSafeToSpend, paydayTrack } from "@/lib/household-insights";
import { type AppData } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";

type Go = (view: "plan" | "journal") => void;

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

export function TodayLedger({ data, onGo, compact = false }: { data: AppData; onGo: Go; compact?: boolean }) {
  const pulse = lastDaysPulse(data);
  const maxExpense = Math.max(1, ...pulse.map((day) => day.expense));
  const track = paydayTrack(data);
  const envelopes = envelopeLane(data);
  const weekSpend = pulse.reduce((sum, day) => sum + day.expense, 0);
  const safe = liquidSafeToSpend(data);

  return (
    <section className="bf-ledger-desk" aria-label="Registrul vizual al casei">
      <header className="bf-desk-heading">
        <div>
          <p className="bf-kicker">{t("MASA DE LUCRU")}</p>
          <h2>{t("Banii, așezați pe hârtie.")}</h2>
        </div>
        <button type="button" onClick={() => onGo("plan")}>Deschide plicurile</button>
      </header>

      {!compact && (
        <div className="bf-desk-top">
          <CashNote amount={money(safe.available)} caption="Disponibil prudent" />
          <div className="bf-today-pulse">
            <div className="bf-today-pulse-copy">
              <p className="bf-kicker">{t("PULSUL SĂPTĂMÂNII")}</p>
              <h2>{weekSpend > 0 ? money(weekSpend) : t("Fără ieșiri")}</h2>
              <p>{t("Cerneală din registru — ultimele 7 zile, nu din bancă.")}</p>
            </div>
            <div className="bf-today-pulse-chart" role="img" aria-label={`Cheltuieli pe 7 zile, total ${money(weekSpend)}`}>
              {pulse.map((day) => (
                <span key={day.date} className={day.isToday ? "today" : ""}>
                  <i className={day.expense <= 0 ? "empty" : ""} style={{ height: `${Math.max(12, (day.expense / maxExpense) * 100)}%` }} />
                  <b>{day.weekday}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {track && <PaydayStrip elapsed={track.elapsed} total={track.total} remaining={track.remaining} />}

      <div className="bf-today-envelopes">
        <div className="bf-today-envelopes-heading">
          <div>
            <p className="bf-kicker">{t("PLICURILE PE MASĂ")}</p>
            <h2>{t("Cât mai e în fiecare loc.")}</h2>
          </div>
        </div>
        {envelopes.length ? (
          <ul className="bf-envelope-fan">
            {envelopes.map((entry) => (
              <li key={entry.item.id} className={entry.state}>
                <button type="button" className="bf-plic-card" onClick={() => onGo("plan")}>
                  <span className="bf-plic-flap" aria-hidden="true" />
                  <EnvelopeMark remaining={Math.max(0, 1 - entry.usage)} state={entry.state} size={108} />
                  <b>{entry.item.label}</b>
                  <strong>{money(Math.max(0, entry.remaining))}</strong>
                  <span className="bf-plic-bar" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, Math.max(4, entry.usage * 100))}%` }} />
                  </span>
                  <small>
                    <span>{Math.round(entry.usage * 100)}%</span>
                    <span>din {money(entry.budget)}</span>
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <button type="button" className="bf-today-envelopes-empty" onClick={() => onGo("plan")}>
            <EnvelopeDeskScene size={220} />
            <span>
              <EnvelopeStack fill={0.35} size={72} />
              <b>{t("Masa e pregătită, plicurile încă nu.")}</b>
              <small>{t("Așază prima categorie în Plan — alimente, transport, facturi. Totalul e suma lor.")}</small>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
