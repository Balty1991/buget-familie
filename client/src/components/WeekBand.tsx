/**
 * Banda S1–S5: câte o coloană pe săptămână, umplută cât s-a cheltuit din tranșă.
 * Săptămâna curentă e conturată, cea depășită e roșie, iar reportul apare sub sumă.
 * Pe bandă sumele sunt rotunjite ca să încapă cinci coloane; cititorul de ecran primește suma exactă.
 */
import { formatDate, type allocationWeeksStatus } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

type Week = ReturnType<typeof allocationWeeksStatus>[number];

export function WeekBand({ weeks, currentIndex }: { weeks: Week[]; currentIndex?: number }) {
  return <ol className="bf-week-band" aria-label={t("Săptămânile plicului")}>
    {weeks.map((week) => {
      const fill = week.budget > 0 ? Math.min(100, Math.max(0, (week.spent / week.budget) * 100)) : week.spent > 0 ? 100 : 0;
      const past = currentIndex !== undefined && week.index < currentIndex;
      const current = week.index === currentIndex;
      const label = t("S{index}, {start} – {end}: {spent} cheltuiți din {budget}, rămași {left}", { index: week.index, start: formatDate(week.start), end: formatDate(week.end), spent: lei(week.spent), budget: lei(week.budget), left: lei(Math.max(0, week.remaining)) });
      return <li key={week.index} className={`${current ? "is-current" : ""}${past ? " is-past" : ""}${week.remaining < 0 ? " is-over" : ""}`} aria-current={current ? "true" : undefined} aria-label={label}>
        <span className="bf-week-band-bar" aria-hidden="true"><i style={{ height: `${fill}%` }} /></span>
        <b aria-hidden="true">S{week.index}</b>
        <small aria-hidden="true">{week.remaining < 0 ? `−${lei(Math.round(-week.remaining))}` : lei(Math.round(week.remaining))}</small>
        {week.carry ? <em aria-hidden="true">{week.carry > 0 ? `+${lei(Math.round(week.carry))}` : `−${lei(Math.round(-week.carry))}`}</em> : null}
      </li>;
    })}
  </ol>;
}
