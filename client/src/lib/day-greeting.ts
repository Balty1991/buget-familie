/**
 * Salutul de pe Astăzi: „Bună dimineața, Andrei” și o singură frază, cea mai potrivită zilei.
 * Ordinea contează: salariul de azi, vacanța, ultimele zile dinainte de salariu, seria de
 * notat, cum a fost ieri; altfel, un sfat scurt care se schimbă de la o zi la alta.
 */
import { addIsoDays, isBalanceAdjustment, planEndDate, type AppData } from "./finance-data";
import { loggingStreak } from "./logging-habits";
import { selfMemberIdOf } from "./member-identity";
import { activeTrip, tripStats } from "./trip";
import { countLabel, daysLabel, t } from "./i18n";
import { lei } from "./money-format";

export type DayGreeting = { hello: string; line: string };

const TIPS = [
  "O cheltuială notată pe loc e o cheltuială pe care n-o uiți.",
  "Plicul săptămânii e mai ușor de ținut decât bugetul lunii.",
  "Un abonament neuitat e cel mai ieftin abonament.",
  "Banii mărunți adunați pe un an fac o vacanță.",
  "Fondul de urgență e liniștea pe care n-o vezi până nu-ți trebuie.",
  "O zi fără cheltuieli pe săptămână lasă mereu ceva în plic.",
  "Lista de cumpărături scurtează drumul prin magazin.",
];

export const helloFor = (hour: number) => hour >= 5 && hour < 12 ? t("Bună dimineața") : hour >= 12 && hour < 18 ? t("Bună ziua") : hour >= 18 && hour < 23 ? t("Bună seara") : t("Noapte bună");

export function dayGreeting(data: AppData, today: string, hour: number): DayGreeting {
  const me = data.settings.members.find((member) => member.id === selfMemberIdOf(data))?.name || data.settings.memberName;
  const hello = me ? `${helloFor(hour)}, ${me}` : helloFor(hour);
  const payday = planEndDate(data.settings.salaryPlan);
  if (payday === today) return { hello, line: t("Azi vine salariul. Plicurile se umplu din nou.") };
  const trip = activeTrip(data, today);
  if (trip) {
    const stats = tripStats(data, trip, today);
    return { hello, line: stats.left >= 0 ? t("Vacanță plăcută! Mai aveți {left} din bugetul ei.", { left: lei(stats.left) }) : t("Vacanță plăcută! Bugetul ei e depășit cu {amount}.", { amount: lei(-stats.left) }) };
  }
  if (payday && payday > today) {
    const days = Math.round((Date.parse(`${payday}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
    if (days <= 5) return { hello, line: t("Mai sunt {days} până la salariu.", { days: daysLabel(days) }) };
  }
  const streak = loggingStreak(data.transactions, today);
  if (streak >= 3) return { hello, line: countLabel(streak, { one: "O zi cu tot notat. Țineți-o tot așa!", few: "{count} zile la rând cu tot notat. Țineți-o tot așa!", many: "{count} de zile la rând cu tot notat. Țineți-o tot așa!" }) };
  const yesterday = addIsoDays(today, -1);
  const byDay = new Map<string, number>();
  for (const item of data.transactions) {
    if (item.kind !== "expense" || item.transferId || item.tripId || isBalanceAdjustment(item) || item.date < addIsoDays(today, -30) || item.date > yesterday) continue;
    byDay.set(item.date, (byDay.get(item.date) || 0) + item.amount);
  }
  const days = Array.from(byDay.values()).sort((a, b) => a - b);
  const typical = days.length >= 5 ? days[Math.floor(days.length / 2)] : 0;
  const spent = byDay.get(yesterday) || 0;
  if (!spent && days.length >= 3) return { hello, line: t("Ieri a fost o zi fără cheltuieli. Bravo!") };
  if (typical > 0 && spent > 0 && spent < typical * 0.7) return { hello, line: t("Ieri ați cheltuit cu {percent}% sub o zi obișnuită.", { percent: Math.round((1 - spent / typical) * 100) }) };
  const day = Math.floor(Date.parse(`${today}T12:00:00Z`) / 86_400_000);
  return { hello, line: t(TIPS[day % TIPS.length]) };
}
