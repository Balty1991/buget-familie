import { Check, ListOrdered } from "lucide-react";
import { debtSnowball, type AppData, type Debt } from "@/lib/finance-data";

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

/**
 * Minge de zăpadă: cea mai mică datorie rămasă întâi.
 * Recomandă următoarea plată; nu o înregistrează până la confirmare.
 */
export function DebtSnowballCard({ data, onPay }: { data: AppData; onPay: (debt: Debt) => void }) {
  const ball = debtSnowball(data);
  if (!ball.next) return null;
  const next = ball.next;

  return (
    <section className="bf-snowball" aria-labelledby="snowball-title">
      <div className="bf-snowball-head">
        <div>
          <p className="bf-kicker">MINGE DE ZĂPADĂ</p>
          <h2 id="snowball-title">Plătește întâi <em>{next.debt.name}.</em></h2>
          <p>Cea mai mică datorie rămasă. După ce o închizi, treci la următoarea — fără dobândă estimată, doar ordine clară.</p>
        </div>
        <ListOrdered size={22} aria-hidden="true" />
      </div>
      <div className="bf-snowball-next">
        <span>01 · următoarea</span>
        <strong>{money(next.remaining)}</strong>
        <small>rată {money(next.monthly)}{next.monthsAtMinimum ? ` · ~${next.monthsAtMinimum} luni la minim` : ""}</small>
        <button type="button" className="pay" onClick={() => onPay(next.debt)}><Check size={16} /> Confirmă {money(next.recommended)}</button>
      </div>
      {ball.order.length > 1 && (
        <ol className="bf-snowball-list">
          {ball.order.slice(1).map((step) => (
            <li key={step.debt.id}>
              <span>{String(step.rank).padStart(2, "0")}</span>
              <b>{step.debt.name}</b>
              <strong>{money(step.remaining)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
