import { useState } from "react";
import { EnvelopeDeskScene, EnvelopeMark, EnvelopeStack } from "@/components/EnvelopeMark";
import { CashNote, PaydayStrip } from "@/components/LedgerArt";
import { envelopeBurnPace, envelopeLane, lastDaysPulse, liquidSafeToSpend, paydayTrack } from "@/lib/household-insights";
import { type AppData } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";
import { ChartTip } from "@/components/ChartFrame";
import { chartBarHeight, leiLabel } from "@/lib/chart-ui";

type Go = (view: "plan" | "journal") => void;

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

const paceLabel = (pace: "ahead" | "on_track" | "behind" | "over") => {
  if (pace === "ahead") return t("în avans");
  if (pace === "behind") return t("în urmă");
  if (pace === "over") return t("depășit");
  return t("în ritm");
};

export function TodayLedger({ data, onGo, compact = false }: { data: AppData; onGo: Go; compact?: boolean }) {
  const pulse = lastDaysPulse(data);
  const maxExpense = Math.max(1, ...pulse.map((day) => day.expense));
  const track = paydayTrack(data);
  const envelopes = envelopeLane(data);
  const burns = envelopeBurnPace(data);
  const burnById = new Map(burns.map((item) => [item.allocationId, item]));
  const weekSpend = pulse.reduce((sum, day) => sum + day.expense, 0);
  const safe = liquidSafeToSpend(data);
  const [pulseTip, setPulseTip] = useState<string | null>(null);

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
            <div className="bf-today-pulse-chart" role="group" aria-label={t("Cheltuieli pe 7 zile, total {amount}", { amount: leiLabel(weekSpend) })}>
              {pulse.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  className={day.isToday ? "today" : ""}
                  aria-pressed={pulseTip === day.date}
                  aria-label={t("{label}: {amount}", { label: day.weekday, amount: leiLabel(day.expense) })}
                  onClick={() => setPulseTip((current) => current === day.date ? null : day.date)}
                >
                  <i className={day.expense <= 0 ? "empty" : ""} style={{ height: `${chartBarHeight(day.expense, maxExpense, 12)}%` }} />
                  <b>{day.weekday}</b>
                </button>
              ))}
            </div>
            {(() => {
              const day = pulse.find((item) => item.date === pulseTip) || pulse.find((item) => item.isToday);
              if (!day) return null;
              return <ChartTip><b>{day.weekday}</b><span>{day.expense <= 0 ? t("Fără cheltuieli") : t("Cheltuieli {amount}", { amount: leiLabel(day.expense) })}</span></ChartTip>;
            })()}
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
            {envelopes.map((entry) => {
              const burn = burnById.get(entry.item.id);
              return (
                <li key={entry.item.id} className={`${entry.state}${burn ? ` pace-${burn.pace}` : ""}`}>
                  <button type="button" className="bf-plic-card" onClick={() => onGo("plan")}>
                    <span className="bf-plic-flap" aria-hidden="true" />
                    <EnvelopeMark remaining={Math.max(0, 1 - entry.usage)} state={entry.state} size={108} />
                    <b>{entry.item.label}</b>
                    <strong>{money(Math.max(0, entry.remaining))}</strong>
                    <span className="bf-plic-bar" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, Math.max(4, entry.usage * 100))}%` }} />
                      {burn && track ? (
                        <em className="bf-plic-expected" style={{ left: `${Math.min(96, Math.max(4, burn.expectedUsage * 100))}%` }} title={t("Ritm așteptat")} />
                      ) : null}
                    </span>
                    <small>
                      <span>{Math.round(entry.usage * 100)}%</span>
                      <span>din {money(entry.budget)}</span>
                    </small>
                    {burn && (
                      <span className={`bf-plic-pace pace-${burn.pace}`} title={burn.reason}>
                        {paceLabel(burn.pace)}
                        {track ? ` · ${Math.round(burn.expectedUsage * 100)}% așteptat` : ""}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
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
