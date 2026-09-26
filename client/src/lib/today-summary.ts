import { envelopeDecisionStatus, inPlanPeriod, isoToday, planForecast, sourceBalance, type AppData } from "@/lib/finance-data";
import { dayStripFigure, stripLei, todayBrief, trackModeHero, weeklyEnvelopeDailyRhythm } from "@/lib/household-insights";
import { daysLabel, getLocale, t } from "@/lib/i18n";
import { hasNoMoneyYet, planCycle } from "@/lib/plan-cycle";

const exact = (value: number) => stripLei(value, getLocale());

/**
 * Cifra mare, textul de sub ea și banda de zile. Aceeași sursă pentru toate trei.
 * Banii rămân cu cenți: 65,22 nu devine 65, iar 2.049,50 nu devine 2.050.
 */
export function buildTodaySummary(data: AppData, asOf?: string) {
  const math = planCycle(data);
  const forecast = planForecast(data, asOf);
  const brief = todayBrief(data, asOf);
  const rhythm = weeklyEnvelopeDailyRhythm(data, asOf);
  const envelopes = data.settings.salaryPlan.allocations.map((item) => ({ item, ...envelopeDecisionStatus(data, item, asOf) }));
  const noMoneyYet = hasNoMoneyYet(data);
  const overPlan = math.remaining < 0 && !noMoneyYet;
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

  const heroLabel = noMoneyYet
    ? t("Pune banii de azi")
    : overPlan
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
  /** Azi s-a consumat partea zilei, dar plicul mai are bani pentru zilele care urmează. */
  const todayUsedUp = rhythm.hasWeekly && rhythm.todayLeft <= 0.009 && rhythm.remaining > 0.009 && rhythm.remainingDays > 1 && rhythm.futureShare > 0;
  const heroValue = noMoneyYet
    ? 0
    : overPlan
    ? Math.abs(math.remaining)
    : heroTracksWeek
      ? brief.spendable
      : brief.hasPayday
        ? brief.spendable
        : data.settings.salaryPlan.allocations.length
          ? envelopeTotalRemaining
          : trackHero.value;
  const untilName = (() => {
    const end = rhythm.days[rhythm.days.length - 1]?.day;
    if (!end) return t("duminică");
    return new Date(`${end}T12:00:00`).toLocaleDateString(getLocale(), { weekday: "long" });
  })();
  /**
   * Plicul săptămânii e gol, dar în Plan sunt bani nerepartizați: fără o frază, „0,00” lângă
   * „Nerepartizați 6.606” arăta ca o contradicție (auditul pe ecran).
   */
  const weekEmpty = heroTracksWeek && rhythm.remaining <= 0.009 && rhythm.todayLeft <= 0.009;
  const freeInPlan = Math.max(0, math.remaining);
  const planHelp = weekEmpty && freeInPlan > 0.009;
  const heroHint = noMoneyYet
    ? t("Scrie cât ai acum pe card și în numerar (Setări → Surse și sold inițial). Apoi îți spunem cât poți folosi pe zi.")
    : overPlan
    ? t("de acoperit prin limită, plicuri sau cheltuieli flexibile")
    : weekEmpty
      ? planHelp
        ? t("Plicul săptămânii s-a terminat până {until}. În Plan mai ai {free} nerepartizați: poți pune o parte în plic.", { until: untilName, free: exact(freeInPlan) })
        : t("Plicul săptămânii s-a terminat până {until}. Banii săptămânii următoare vin atunci.", { until: untilName })
    : heroTracksWeek
      ? todayUsedUp
        ? t("Azi ai folosit partea zilei. De mâine: {daily} lei/zi ({available} pe {days}).", { daily: exact(rhythm.futureShare), available: exact(rhythm.remaining), days: daysLabel(rhythm.remainingDays - 1) })
        : t("Azi poți {pace} lei. În plicul săptămânii mai sunt {available} pentru {days}.", { pace: exact(brief.spendable), available: exact(rhythm.remaining), days: daysLabel(rhythm.remainingDays) })
      : brief.hasPayday
        ? brief.reason
        : data.settings.salaryPlan.allocations.length
          ? t("{weekly} săptămânale · {monthly} lunare/fixe{benchmark}", { weekly: exact(Math.max(0, weeklyEnvelopesRemaining)), monthly: exact(Math.max(0, monthlyEnvelopesRemaining)), benchmark: math.plan.nextPayday ? t(" · cam {daily}/zi", { daily: exact(daily) }) : "" })
          : trackHero.kind === "income"
            ? t("Suma e în Mișcări. Pune plicuri în Plan ca să vezi cât mai rămâne pe categorii.")
            : trackHero.kind === "liquid"
              ? t("Soldul surselor, după mișcările de azi. Pune data venitului în Plan, sau, la venituri neregulate, câte zile să-ți ajungă banii, ca să vezi cât poți folosi pe zi.")
              : trackHero.kind === "spent"
                ? t("Nu e un sold. E suma ieșită azi, până pui un venit sau un plic.")
                : t("Adaugă plicuri pentru a urmări cât mai rămâne în fiecare perioadă");
  const explainer = overPlan
    ? t("Planul este depășit: suma arată cât trebuie acoperit, nu bani disponibili pentru cheltuieli.")
    : brief.hasPayday
      ? rhythm.hasWeekly
        ? t("Este limita de azi din plicurile săptămânii. Ce n-are plic stă liber, nu mărește cifra.")
        : t("Partea zilei: banii de la începutul zilei, după scadențe și rate, împărțiți pe zilele până la venit. Ce cheltui azi scade din ea; mâine restul se reîmparte. În plicuri mai sunt {envelopes}; în surse {sources}.", { daily: exact(daily), envelopes: exact(envelopeTotalRemaining), sources: exact(math.availableSources) })
      : data.settings.salaryPlan.allocations.length
        ? t("Este ce mai poți folosi din plicurile alocate. Reperul zilnic împarte suma pe cele {days} până la venit — nu e bani în plus, e ritmul ca să nu golești plicurile înainte.", { days: daysLabel(forecast.remainingDays) })
        : trackHero.kind === "liquid"
          ? t("Este soldul de pe card, cash sau bonuri, după ce ai înregistrat. Fără data venitului nu calculăm un ritm zilnic.")
          : t("Plicurile sunt sume puse deoparte pentru un scop, cum ar fi mâncare, transport sau facturi.");

  /** Partea de azi s-a dus, dar în plic mai sunt bani pentru zilele următoare (cumpărăturile săptămânii). */
  const noteDaily = todayUsedUp || rhythm.days.some((row) => row.isToday && row.over) ? rhythm.futureShare : heroTracksWeek ? brief.spendable : rhythm.todayShare;
  const rhythmNote = noMoneyYet
    ? t("După ce pui banii de azi, împărțim plicul săptămânii pe zile.")
    : !rhythm.hasWeekly
    ? t("Nu sunt plicuri cu ritm săptămânal de împărțit pe zile.")
    : rhythm.remaining <= 0 && rhythm.todayLeft <= 0
      ? t("Plicul săptămânii e gol până {until}.", { until: untilName })
      : rhythm.days.some((row) => row.isToday && row.over)
        ? t("Azi a trecut peste partea de {share}. Mai rămân {remaining}, cam {daily} pe zi până {until}.", { share: exact(rhythm.todayShare), remaining: exact(rhythm.remaining), daily: exact(noteDaily), until: untilName })
        : todayUsedUp
          ? t("Azi ai folosit partea zilei. Mai rămân {remaining}, cam {daily} pe zi de mâine până {until}.", { remaining: exact(rhythm.remaining), daily: exact(noteDaily), until: untilName })
          // Aceeași cifră ca eroul pentru azi; zilele următoare au partea lor, nu media.
          : rhythm.days.some((row) => row.isFuture)
            ? t("Mai rămân {remaining} în plicul săptămânii: {today} azi, apoi cam {daily} pe zi până {until}.", { remaining: exact(rhythm.remaining), today: exact(noteDaily), daily: exact(rhythm.futureShare), until: untilName })
            : t("Mai rămân {remaining} în plicul săptămânii, toți pentru azi.", { remaining: exact(rhythm.remaining) });

  const todayRow = rhythm.days.find((row) => row.isToday);
  const todayStrip = todayRow ? dayStripFigure(todayRow, heroTracksWeek ? brief.spendable : todayRow.left, heroTracksWeek) : 0;

  /**
   * Cât se poate cheltui azi, ca sumă de bani. Când planul e depășit, cifra mare de pe
   * Astăzi e deficitul („Peste limita planului”), nu bani de cheltuit — ghidul spunea
   * „Poți folosi azi 4.457” exact când lipseau 4.457.
   */
  const canSpendToday = noMoneyYet || overPlan || !brief.hasPayday || brief.expired ? 0 : Math.max(0, brief.spendable);
  return { overPlan, canSpendToday, heroLabel, heroValue, heroHint, explainer, heroTracksWeek, rhythm, rhythmNote, brief, todayStrip, planHelp };
}
