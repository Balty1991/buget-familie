import { EnvelopeDeskScene, EnvelopeMark, EnvelopeStack } from "@/components/EnvelopeMark";
import { CashNote, PaydayStrip } from "@/components/LedgerArt";
import { envelopeLane, lastDaysPulse, liquidSafeToSpend, paydayTrack } from "@/lib/household-insights";
import { type AppData } from "@/lib/finance-data";

type Go = (view: "plan" | "journal") => void;

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

export function TodayLedger({ data, onGo }: { data: AppData; onGo: Go }) {
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
          <p className="bf-kicker">MASA DE LUCRU</p>
          <h2>Banii, așezați pe hârtie.</h2>
        </div>
        <button type="button" onClick={() => onGo("plan")}>Deschide plicurile</button>
      </header>

      <div className="bf-desk-top">
        <CashNote amount={money(safe.available)} caption="Disponibil prudent" />
        <div className="bf-today-pulse">
          <div className="bf-today-pulse-copy">
            <p className="bf-kicker">PULSUL SĂPTĂMÂNII</p>
            <h2>{weekSpend > 0 ? money(weekSpend) : "Fără ieșiri"}</h2>
            <p>Cerneală din registru — ultimele 7 zile, nu din bancă.</p>
          </div>
          <div className="bf-today-pulse-chart" role="img" aria-label={`Cheltuieli pe 7 zile, total ${money(weekSpend)}`}>
            {pulse.map((day) => (
              <span key={day.date} className={day.isToday ? "today" : ""}>
                <i style={{ height: `${Math.max(8, (day.expense / maxExpense) * 100)}%` }} />
                <b>{day.weekday}</b>
              </span>
            ))}
          </div>
        </div>
      </div>

      {track && <PaydayStrip elapsed={track.elapsed} total={track.total} remaining={track.remaining} />}

      <div className="bf-today-envelopes">
        <div className="bf-today-envelopes-heading">
          <div>
            <p className="bf-kicker">PLICURILE PE MASĂ</p>
            <h2>Cât mai e în fiecare loc.</h2>
          </div>
        </div>
        {envelopes.length ? (
          <ul className="bf-envelope-fan">
            {envelopes.map((entry) => (
              <li key={entry.item.id} className={entry.state}>
                <button type="button" onClick={() => onGo("plan")}>
                  <EnvelopeMark remaining={Math.max(0, 1 - entry.usage)} state={entry.state} size={86} />
                  <b>{entry.item.label}</b>
                  <strong>{money(Math.max(0, entry.remaining))}</strong>
                  <small>{Math.round(entry.usage * 100)}% folosit din {money(entry.budget)}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <button type="button" className="bf-today-envelopes-empty" onClick={() => onGo("plan")}>
            <EnvelopeDeskScene size={220} />
            <span>
              <EnvelopeStack fill={0.35} size={72} />
              <b>Masa e pregătită, plicurile încă nu.</b>
              <small>Așază prima categorie în Plan — alimente, transport, facturi. Totalul e suma lor.</small>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
