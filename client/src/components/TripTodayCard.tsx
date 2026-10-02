/** Pe Astăzi, cât ține vacanța (și cu două zile înainte): cât mai e din bugetul ei și pe zi. */
import { Plane } from "lucide-react";
import { addIsoDays, type AppData } from "@/lib/finance-data";
import { tripStats } from "@/lib/trip";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

export function TripTodayCard({ data, today }: { data: AppData; today: string }) {
  const trip = data.settings.trip;
  if (!trip || trip.closedAt || today > trip.end || addIsoDays(today, 2) < trip.start) return null;
  const stats = tripStats(data, trip, today);
  return (
    <button type="button" className="bf-challenge bf-trip-today" onClick={() => window.dispatchEvent(new Event("buget-familie:open-trip"))}>
      <span className="bf-challenge-icon" aria-hidden="true"><Plane size={18} /></span>
      <span>
        <span className="bf-challenge-kicker">{stats.dayIndex ? t("VACANȚĂ · ZIUA {day} DIN {days}", { day: stats.dayIndex, days: stats.days }) : t("VACANȚA ÎNCEPE CURÂND")}</span>
        <b>{stats.left < 0 ? t("{name}: peste buget cu {amount}.", { name: trip.name, amount: lei(-stats.left) }) : t("{name}: mai aveți {left}, ~{perDay} pe zi.", { name: trip.name, left: lei(stats.left), perDay: lei(stats.perDayLeft) })}</b>
        <small>{t("{spent} din {budget}", { spent: lei(stats.spent), budget: lei(trip.budget) })}</small>
      </span>
    </button>
  );
}
