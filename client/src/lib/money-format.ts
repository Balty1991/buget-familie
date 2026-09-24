/**
 * O singură formă pentru sume în lei, peste tot în aplicație: zecimale doar când există bani mărunți
 * („6.606 RON”, „184,50 RON”). Înainte, fiecare componentă avea formatul ei și cele mai multe
 * rotunjeau la leu, așa că aceeași sumă apărea „6.606 RON” în Plan și „6.605,70 RON” în Mișcări.
 */
import { getLocale } from "@/lib/i18n";

const cache = new Map<string, Intl.NumberFormat>();
const formatter = (locale: string, cents: boolean) => {
  const key = `${locale}|${cents}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: "currency", currency: "RON", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
    cache.set(key, format);
  }
  return format;
};

export function lei(value: number): string {
  let amount = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  if (Object.is(amount, -0)) amount = 0;
  return formatter(getLocale(), !Number.isInteger(amount)).format(amount);
}
