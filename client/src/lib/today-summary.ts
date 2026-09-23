import { envelopeDecisionStatus, inPlanPeriod, isoToday, planForecast, sourceBalance, type AppData } from "@/lib/finance-data";
import { dayStripFigure, todayBrief, trackModeHero, weeklyEnvelopeDailyRhythm } from "@/lib/household-insights";
import { daysLabel, moneyFormat, t } from "@/lib/i18n";
import { planCycle } from "@/lib/plan-cycle";

const money = (value: number) => moneyFormat(value, { maximumFractionDigits: 0 });

/**
 * Cifra mare, textul de sub ea și banda de zile. Aceeași sursă pentru toate trei.
 * Nu schimbă regulile: când ritmul e săptămânal, cardul rotunjește la leu,
 * iar căsuța de azi păstrează suma exactă din plic.
 */
export function buildTodaySummary(data: AppData, asOf?: string) {
  const math = planCycle(data);
  const forecast = planForecast(data);
  const brief = todayBrief(data, asOf);
  const rhythm = weeklyEnvelopeDailyRhythm(data, asOf);
  const envelopes = data.settings.salaryPlan.allocations.map((item) => ({ item, ...envelopeDecisionStatus(data, item) }));
  const overPlan = math.remaining < 0;
  const daily = math.plan.nextPayday ? forecast.safeDaily : 0;
  const weeklyEnvelopesRemaining = envelopes.filter((entry) => entry.scope === "week").reduce((sum, entry) => sum + entry.remaining, 0);
  const monthlyEnvelopesRemaining = envelopes.filter((entry) => entry.scope === "cycle").reduce((sum, entry) => sum + entry.remaining, 0);
  const envelopeTotalRemaining = Math.max(0, weeklyEnvelopesRemaining + monthlyEnvelopesRemaining);
  const todayIso = asOf || isoToday();
  const periodIncome = data.transactions.filter((item) => item.kind === "income" && inPlanPeriod(item.date, math.plan)).reduce((sum, item) => sum + item.amount, 0);
  const sourceRows = data.settings.paymentSources.map((source) => sourceBalance(data, source.id));
  const liquidNow = sourceRows.reduce((sum, balance) => sum + Math.max(0, balance), 0);
  const spentToday = data.transactions.filter((item) => item.kind === "expense" && item.date === todayIso).reduce((sum, item) => sum + item.amount, 0);
  const trackHero = trackModeHero({ periodIncome, liquidNow, spentToday });

  const heroLabel = overPlan
    ? t("Peste limita planului")
    : brief.hasPayday
      ? t("Poți folosi azi")
      : data.settings.salaryPlan.allocations.length
        ? t("Rămas în plicuri")
        : trackHero.kind === "income"
          ? t("Venit înregistrat în ciclu")
          : trackHero.kind === "liquid"
            ? t("Ai acum")
            : trackHero.kind === "spent"
              ? t("Cheltuit astăzi")
              : t("Plicuri neconfigurate");
  const heroTracksWeek = !overPlan && brief.hasPayday && !brief.expired && rhythm.hasWeekly;
  const heroValue = overPlan
    ? Math.abs(math.remaining)
    : heroTracksWeek
      ? Math.round(brief.spendable)
      : brief.hasPayday
        ? brief.spendable
        : data.settings.salaryPlan.allocations.length
          ? envelopeTotalRemaining
          : trackHero.value;
  const heroHint = overPlan
    ? t("de acoperit prin limită, plicuri sau cheltuieli flexibile")
    : heroTracksWeek
      ? t("Ritm {pace} lei/zi, din {available} rămași în plicul săptămânii, pe {days}.", { pace: Math.round(brief.spendable), available: Math.round(rhythm.remaining), days: daysLabel(rhythm.remainingDays) })
      : brief.hasPayday
        ? brief.reason
        : data.settings.salaryPlan.allocations.length
          ? t("{weekly} săptămânale · {monthly} lunare/fixe{benchmark}", { weekly: money(Math.max(0, weeklyEnvelopesRemaining)), monthly: money(Math.max(0, monthlyEnvelopesRemaining)), benchmark: math.plan.nextPayday ? t(" · reper {daily}/zi", { daily: money(daily) }) : "" })
          : trackHero.kind === "income"
            ? t("Suma e în Mișcări. Pune plicuri în Plan ca să vezi cât mai rămâne pe categorii.")
            : trackHero.kind === "liquid"
              ? t("Soldul surselor, după mișcările de azi. Pune data venitului în Plan ca să vezi cât poți folosi pe zi.")
              : trackHero.kind === "spent"
                ? t("Nu e un sold. E suma ieșită azi, până pui un venit sau un plic.")
                : t("Adaugă plicuri pentru a urmări cât mai rămâne în fiecare perioadă");
  const explainer = overPlan
    ? t("Planul este depășit: suma arată cât trebuie acoperit, nu bani disponibili pentru cheltuieli.")
    : brief.hasPayday
      ? rhythm.hasWeekly
        ? t("Este limita de azi din plicurile săptămânii. Ce n-are plic stă liber, nu mărește cifra.")
        : t("Reperul zilei este minimul dintre ritmul sigur ({daily}) și lichidul împărțit pe zile. Nu e un sold separat. În plicuri mai sunt {envelopes}; în surse {sources}.", { daily: money(daily), envelopes: money(envelopeTotalRemaining), sources: money(math.availableSources) })
      : data.settings.salaryPlan.allocations.length
        ? t("Este ce mai poți folosi din plicurile alocate. Reperul zilnic împarte suma pe cele {days} până la venit — nu e bani în plus, e ritmul ca să nu golești plicurile înainte.", { days: daysLabel(forecast.remainingDays) })
        : trackHero.kind === "liquid"
          ? t("Este soldul de pe card, cash sau bonuri, după ce ai înregistrat. Fără data venitului nu calculăm un ritm zilnic.")
          : t("Plicurile sunt sume puse deoparte pentru un scop, cum ar fi mâncare, transport sau facturi.");

  const rhythmNote = !rhythm.hasWeekly
    ? t("Nu sunt plicuri cu ritm săptămânal de împărțit pe zile.")
    : rhythm.remaining <= 0 && rhythm.todayLeft <= 0
      ? t("Plicul săptămânii e gol până duminică.")
      : rhythm.days.some((row) => row.isToday && row.over)
        ? t("Azi a trecut peste partea de {share}. Mai rămân {remaining}, cam {daily} pe zi până duminică.", { share: money(rhythm.todayShare), remaining: money(rhythm.remaining), daily: money(rhythm.futureShare) })
        : t("Mai rămân {remaining} în plicul săptămânii, cam {daily} pe zi până duminică.", { remaining: money(rhythm.remaining), daily: money(rhythm.todayShare) });

  const todayRow = rhythm.days.find((row) => row.isToday);
  const todayStrip = todayRow ? dayStripFigure(todayRow, heroTracksWeek ? brief.spendable : todayRow.left, heroTracksWeek) : 0;

  return { overPlan, heroLabel, heroValue, heroHint, explainer, heroTracksWeek, rhythm, rhythmNote, brief, todayStrip };
}
