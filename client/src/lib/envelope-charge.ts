/**
 * Ce se întâmplă cu plicul când se notează o sumă, în lei.
 * Nu rotunjește depășirea la zero: „0 rămași” nu spune că ai ieșit peste.
 */
import { t } from "@/lib/i18n";

export type EnvelopeAfterPay = { left: number; over: number };

/** `remaining` poate fi deja negativ. `amount` e suma în lei, nu în valuta tastată. */
export function envelopeAfterPay(remaining: number, amount: number): EnvelopeAfterPay {
  const pay = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const left = Math.round((remaining - pay) * 100) / 100;
  return { left, over: left < -0.004 ? Math.round(-left * 100) / 100 : 0 };
}

/** Textul din listă: „40 lei în S2” sau „12 lei peste în S2”. */
export function envelopeOptionRemain(remaining: number, format: (value: number) => string, weekIndex?: number): string {
  if (remaining < -0.004) {
    const over = format(-remaining);
    return weekIndex != null
      ? t("{over} peste în S{index}", { over, index: weekIndex })
      : t("cu {over} peste", { over });
  }
  return weekIndex != null
    ? t("{amount} în S{index}", { amount: format(Math.max(0, remaining)), index: weekIndex })
    : t("{amount} rămași", { amount: format(Math.max(0, remaining)) });
}

/** Opțiunea „Din ce săptămână”, cu depășirea la vedere. */
export function weekOptionLabel(index: number, remaining: number, budget: number, format: (value: number) => string): string {
  if (remaining < -0.004) return t("S{index}: cu {over} peste din {budget}", { index, over: format(-remaining), budget: format(budget) });
  return t("S{index}: {remaining} rămași din {budget}{after}", { index, remaining: format(remaining), budget: format(budget), after: "" });
}

/**
 * Propoziția de sub plic. `weekIndex` e săptămâna aleasă, nu neapărat cea de azi.
 * `pay` 0 lasă doar starea de acum, fără „după plată”.
 */
export function envelopeChargePhrase(input: {
  weekIndex?: number;
  remaining: number;
  budget: number;
  pay: number;
  format: (value: number) => string;
}): { text: string; over: boolean } {
  const charge = envelopeAfterPay(input.remaining, input.pay);
  const after = input.pay > 0
    ? charge.over > 0
      ? t(" · după plată, cu {over} peste", { over: input.format(charge.over) })
      : t(" · după plată {left}", { left: input.format(charge.left) })
    : "";
  const over = charge.over > 0 || input.remaining < -0.004;
  if (input.remaining < -0.004) {
    const overNow = input.format(-input.remaining);
    const text = input.weekIndex != null
      ? t("S{index}: deja cu {over} peste{after}", { index: input.weekIndex, over: overNow, after })
      : t("Deja cu {over} peste{after}", { over: overNow, after });
    return { text, over };
  }
  const remaining = input.format(Math.max(0, input.remaining));
  const budget = input.format(input.budget);
  const text = input.weekIndex != null
    ? t("S{index}: {remaining} rămași din {budget}{after}", { index: input.weekIndex, remaining, budget, after })
    : t("{remaining} rămași din {budget}{after}", { remaining, budget, after });
  return { text, over };
}
