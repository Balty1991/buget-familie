/**
 * Bare, axe și etichete lei — fără stub-uri care par date.
 */
import { getLocale } from "@/lib/i18n";

/** 0 când nu e valoare. Altfel scara 0–100, cu un minim vizibil doar pentru valori reale. */
export function chartBarHeight(value: number, max: number, minFilled = 6): number {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(minFilled, Math.min(100, (value / max) * 100));
}

export function leiLabel(value: number, compact = false): string {
  const n = Number.isFinite(value) ? value : 0;
  if (compact && Math.abs(n) >= 1000) {
    const k = n / 1000;
    const shown = Math.abs(k) >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `${shown}k lei`;
  }
  return `${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 }).format(Math.round(n))} lei`;
}

export function leiAxisTicks(max: number): number[] {
  const top = Math.max(0, Number.isFinite(max) ? max : 0);
  if (top <= 0) return [0];
  return [top, top / 2, 0];
}

export function hasChartValues(values: number[]): boolean {
  return values.some((value) => Number.isFinite(value) && value > 0);
}
