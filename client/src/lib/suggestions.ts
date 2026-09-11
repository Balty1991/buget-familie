/**
 * Ce merită întrebat acum.
 *
 * Butoanele de sub conversație erau o listă fixă, aceeași pentru toată lumea și
 * în orice zi: „Unde se duc banii?”, „Cât plătesc pe abonamente?” — chiar dacă
 * omul n-avea niciun abonament, sau tocmai își depășise plicul de alimente.
 *
 * Aici se construiesc din registrul lui: un plic aproape gol, un salariu care
 * vine peste trei zile, o datorie, bani nerepartizați, un magazin în care intră
 * des. Ordinea este dată de cât de presantă e situația, nu de cum au fost scrise.
 * Fiecare sugestie este o frază pe care asistentul chiar știe să o răspundă.
 */
import {
  allocationStatus,
  allocationWeekStatus,
  isoToday,
  sourceBalance,
  type AppData,
} from "./finance-data";

export type Suggestion = { text: string; why: string; urgency: number };

const money = (value: number) => `${Math.round(value).toLocaleString("ro-RO")} RON`;

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000);

/** Magazinul în care a intrat cel mai des în ultimele două luni. */
function frequentVendor(data: AppData, asOf: string): string | undefined {
  const since = new Date(`${asOf}T12:00:00`);
  since.setMonth(since.getMonth() - 2);
  const from = since.toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const item of data.transactions) {
    if (item.kind !== "expense" || item.date < from) continue;
    const title = item.title.trim();
    if (title.length < 3) continue;
    counts.set(title, (counts.get(title) || 0) + 1);
  }
  const ranked = Array.from(counts.entries()).filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0];
}

export function buildSuggestions(data: AppData, asOf = isoToday()): Suggestion[] {
  const out: Suggestion[] = [];
  const plan = data.settings.salaryPlan;

  // Un registru gol nu are nimic de analizat; are nevoie de primul pas.
  if (!data.transactions.length) {
    return [
      { text: "Salariul meu e 5000 de lei", why: "registru gol — învață cum se vorbește cu el", urgency: 100 },
      { text: "Am dat 50 de lei pe benzină", why: "registru gol — exemplu de cheltuială", urgency: 90 },
    ];
  }

  for (const allocation of plan.allocations) {
    const week = allocation.weeklyPace !== false ? allocationWeekStatus(data, allocation) : undefined;
    const status = allocationStatus(data, allocation);
    const left = week ? week.remaining : status.remaining;
    const budget = week ? week.budget : status.budget;
    if (budget <= 0) continue;
    const used = 1 - left / budget;
    if (left < 0) out.push({ text: `Cât mai am la ${allocation.label}?`, why: "plic depășit", urgency: 95 });
    else if (used >= 0.8) out.push({ text: `Cât mai am la ${allocation.label}?`, why: "plic aproape gol", urgency: 80 });
  }

  const payday = plan.nextPayday || plan.earliestPayday;
  if (payday) {
    const days = daysBetween(asOf, payday);
    if (days >= 0 && days <= 7) out.push({ text: "Ajung până la salariu?", why: "salariul e aproape", urgency: 85 });
    else if (days > 7) out.push({ text: "Cât pot cheltui pe zi?", why: "are un plan cu dată de salariu", urgency: 45 });
  }

  if (data.debts.some((item) => item.remaining > 0)) {
    out.push({ text: "Cât mai am la datorii?", why: "are datorii deschise", urgency: 60 });
  }

  if (data.recurring.some((item) => item.active !== false)) {
    out.push({ text: "Ce scadențe urmează?", why: "are plăți recurente", urgency: 55 });
  }

  const liquid = data.settings.paymentSources.reduce((sum, source) => sum + sourceBalance(data, source.id), 0);
  const reserved = plan.allocations.reduce((sum, item) => sum + allocationStatus(data, item).remaining, 0);
  const loose = liquid - reserved;
  if (plan.allocations.length && loose > liquid * 0.25 && loose > 100) {
    out.push({ text: "Cât am nerepartizat?", why: "bani în afara plicurilor", urgency: 65 });
  }

  const vendor = frequentVendor(data, asOf);
  if (vendor) out.push({ text: `Cât am dat la ${vendor}?`, why: "magazin frecvent", urgency: 40 });

  if (data.savings.length) out.push({ text: "Cât am strâns?", why: "are obiective", urgency: 35 });
  if (data.settings.members.length > 1) {
    out.push({ text: `Cât a cheltuit ${data.settings.members[1].name}?`, why: "familie cu mai mulți membri", urgency: 38 });
  }

  // Întrebări de fundal, ca lista să nu rămână scurtă într-o lună liniștită.
  out.push({ text: "Unde se duc banii?", why: "întrebare de bază", urgency: 30 });
  out.push({ text: "Cea mai mare cheltuială?", why: "întrebare de bază", urgency: 25 });
  out.push({ text: "Compară cu luna trecută", why: "întrebare de bază", urgency: 20 });

  const seen = new Set<string>();
  return out
    .filter((item) => (seen.has(item.text) ? false : seen.add(item.text)))
    .sort((left, right) => right.urgency - left.urgency)
    .slice(0, 6);
}
