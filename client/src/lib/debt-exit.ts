/**
 * Ieșirea din datorii, cu toate cifrele unei decizii: avalanșa față de bulgărele de zăpadă,
 * ce schimbă o sumă în plus pe lună (luni câștigate, dobândă economisită față de „doar rata”)
 * și calendarul plăților pe lunile următoare. Peste `payoffPlan`, care simulează luna cu lună.
 */
import type { Debt } from "./finance-data";
import { payoffPlan, recommendedStrategy, type PayoffPlan, type PayoffStrategy } from "./debt-plan";

export type DebtExit = {
  avalanche: PayoffPlan;
  snowball: PayoffPlan;
  /** Doar ratele, fără nimic în plus, în ordinea recomandată: reperul față de care se socotește câștigul. */
  minimum: PayoffPlan;
  recommended: PayoffStrategy;
  /** Ce alege omul (sau recomandarea). */
  chosen: PayoffPlan;
  monthsSaved: number | null;
  interestSaved: number;
  /** Diferența de dobândă dintre cele două strategii, cu aceeași sumă în plus. */
  strategyGap: number;
};

const cents = (value: number) => Math.round(value * 100) / 100;

export function debtExit(debts: ReadonlyArray<Debt>, extra: number, strategy?: PayoffStrategy): DebtExit | undefined {
  const open = debts.filter((debt) => debt.remaining > 0);
  if (!open.length) return undefined;
  const avalanche = payoffPlan(open, extra, "avalanche");
  const snowball = payoffPlan(open, extra, "snowball");
  const recommended = recommendedStrategy(open);
  const minimum = payoffPlan(open, 0, recommended);
  const chosen = (strategy || recommended) === "avalanche" ? avalanche : snowball;
  const monthsSaved = chosen.months !== null && minimum.months !== null ? Math.max(0, minimum.months - chosen.months) : null;
  return {
    avalanche,
    snowball,
    minimum,
    recommended,
    chosen,
    monthsSaved,
    interestSaved: minimum.months === null ? 0 : cents(Math.max(0, minimum.totalInterest - chosen.totalInterest)),
    strategyGap: cents(Math.abs(avalanche.totalInterest - snowball.totalInterest)),
  };
}
