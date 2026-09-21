/**
 * Închiderea ciclului: ce a rămas, ce am învățat, ce urmează.
 *
 * Apare doar după ce ciclul s-a terminat și dispare în clipa în care începe următorul.
 * Schimbările propuse sunt bifate din start, fiindcă omul le vede aici cu cifre cu tot —
 * dar nimic nu se aplică fără apăsarea lui.
 */
import { useState } from "react";
import { CalendarCheck, Check } from "lucide-react";
import { cycleClose, startNextCycle } from "@/lib/cycle-close";
import { formatDate, type AppData } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";
import "../cycle-close.css";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const zi = (iso: string) => formatDate(iso, { day: "2-digit", month: "short" });

export function CycleClosePanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const close = cycleClose(data);
  const [refuzate, setRefuzate] = useState<string[]>([]);
  if (!close) return null;
  const alese = close.lessons.filter((item) => !refuzate.includes(item.allocationId)).map((item) => item.allocationId);
  const comuta = (id: string) => setRefuzate((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <section className="bf-cycle-close" aria-labelledby="bf-cycle-close-title">
      <p className="bf-kicker">{t("CICLUL S-A ÎNCHEIAT")}</p>
      <h2 id="bf-cycle-close-title">{zi(close.periodStart)} – {zi(close.periodEnd)}</h2>
      <p className="bf-cycle-close-lead">
        {t("Ai cheltuit {spent} și au rămas {left} în plicuri.", { spent: money(close.spent), left: money(close.leftInEnvelopes) })}
      </p>

      {close.envelopes.length > 0 && (
        <ul className="bf-cycle-close-list">
          {close.envelopes.map((item) => (
            <li key={item.id} className={item.left < 0 ? "over" : ""}>
              <div>
                <b>{item.label}</b>
                <small>{t("{spent} din {budget}", { spent: money(item.spent), budget: money(item.budget) })}</small>
              </div>
              <span>{item.left < 0 ? t("{amount} peste", { amount: money(-item.left) }) : t("{amount} rămași", { amount: money(item.left) })}</span>
            </li>
          ))}
        </ul>
      )}

      {close.lessons.length > 0 && (
        <div className="bf-cycle-close-lessons">
          <b>{t("Ce arată cheltuielile tale")}</b>
          {close.lessons.map((item) => (
            <label key={item.allocationId} className={refuzate.includes(item.allocationId) ? "off" : ""}>
              <input
                type="checkbox"
                checked={!refuzate.includes(item.allocationId)}
                onChange={() => comuta(item.allocationId)}
              />
              <span>
                <b>{item.label}: {money(item.current)} → {money(item.suggested)}</b>
                <small>
                  {item.direction === "down"
                    ? t("ai cheltuit în medie {amount} pe ciclu, din {budget}", { amount: money(item.suggested), budget: money(item.current) })
                    : t("ai cheltuit în medie {amount} pe ciclu, peste plicul de {budget}", { amount: money(item.suggested), budget: money(item.current) })}
                </small>
              </span>
            </label>
          ))}
        </div>
      )}

      <button type="button" className="bf-primary bf-cycle-close-start" onClick={() => onChange(startNextCycle(data, alese))}>
        <CalendarCheck size={16} aria-hidden="true" />
        {t("Începe ciclul {start} – {end}", { start: zi(close.nextStart), end: zi(close.nextPayday) })}
      </button>
      <small className="bf-cycle-close-note">
        {alese.length === 1
          ? t("Se aplică o schimbare de plic; mișcările rămân neatinse.")
          : alese.length > 1
            ? t("Se aplică {count} schimbări de plicuri; mișcările rămân neatinse.", { count: String(alese.length) })
            : t("Plicurile rămân cum sunt; mișcările rămân neatinse.")}
        {" "}
        <Check size={12} aria-hidden="true" />
      </small>
    </section>
  );
}
