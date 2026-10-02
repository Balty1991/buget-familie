/**
 * Provocarea lunii pe Astăzi: propunerea în primele 10 zile, apoi progresul, cu o bară în
 * culoarea categoriei și unde ajunge luna la ritmul de acum. Refuzul ascunde cardul până luna viitoare.
 */
import { useMemo, useState } from "react";
import { Target, X } from "lucide-react";
import type { AppData } from "@/lib/finance-data";
import { challengeProgress, readChallenge, saveChallenge, suggestChallenge, type MonthChallenge } from "@/lib/month-challenge";
import { categoryTone } from "@/lib/category-color";
import { CategoryGlyph } from "@/components/CategoryGlyph";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

const storage = () => (typeof window !== "undefined" ? window.localStorage : undefined);

export function MonthChallengeCard({ data, today }: { data: AppData; today: string }) {
  const month = today.slice(0, 7);
  const [stored, setStored] = useState<MonthChallenge | "skip" | undefined>(() => { const s = storage(); return s ? readChallenge(s, month) : "skip"; });
  const suggestion = useMemo(() => (stored === undefined && Number(today.slice(8, 10)) <= 10 ? suggestChallenge(data.transactions, today) : undefined), [data.transactions, stored, today]);
  const active = stored && stored !== "skip" ? stored : undefined;
  const progress = useMemo(() => (active ? challengeProgress(data.transactions, active, today) : undefined), [active, data.transactions, today]);
  const choose = (value: MonthChallenge | "skip") => { const s = storage(); if (s) saveChallenge(s, month, value); setStored(value); };

  if (active && progress) {
    const left = Math.max(0, active.target - progress.spent);
    const line = progress.state === "over"
      ? t("Ținta e depășită cu {amount}. Luna viitoare încercăm din nou.", { amount: lei(progress.spent - active.target) })
      : progress.early
        ? t("Mai sunt {left} până la țintă.", { left: lei(left) })
        : progress.state === "watch"
        ? t("La ritmul de acum, termini luna la ~{amount}. Mai sunt {left} până la țintă.", { amount: lei(progress.projected), left: lei(left) })
        : t("La ritmul de acum, termini luna la ~{amount}. Bine ținut.", { amount: lei(progress.projected) });
    return (
      <section className={`bf-challenge is-${progress.state}`} style={categoryTone(active.category)} aria-label={t("Provocarea lunii")}>
        <span className="bf-challenge-icon" aria-hidden="true"><CategoryGlyph category={active.category} size={18} /></span>
        <div>
          <span className="bf-challenge-kicker">{t("PROVOCAREA LUNII")}</span>
          <b>{t("{category} sub {target}", { category: t(active.category), target: lei(active.target) })}</b>
          <i className="bf-challenge-bar" aria-hidden="true"><em style={{ width: `${Math.min(100, Math.round(progress.share * 100))}%` }} /></i>
          <small>{t("{spent} din {target}", { spent: lei(progress.spent), target: lei(active.target) })} · {line}</small>
        </div>
      </section>
    );
  }

  if (!suggestion) return null;
  return (
    <section className="bf-challenge is-offer" style={categoryTone(suggestion.category)} aria-label={t("Provocarea lunii")}>
      <span className="bf-challenge-icon" aria-hidden="true"><Target size={18} /></span>
      <div>
        <span className="bf-challenge-kicker">{t("PROVOCAREA LUNII")}</span>
        <b>{t("{category} sub {target} luna asta?", { category: t(suggestion.category), target: lei(suggestion.target) })}</b>
        <small>{t("Luna trecută: {last}. Cu 10% mai puțin rămân bani pentru altceva.", { last: lei(suggestion.last) })}</small>
        <div className="bf-challenge-actions">
          <button type="button" className="bf-primary" onClick={() => choose(suggestion)}>{t("Accept provocarea")}</button>
          <button type="button" className="bf-link-button" onClick={() => choose("skip")}>{t("Nu luna asta")}</button>
        </div>
      </div>
      <button type="button" className="bf-challenge-close" aria-label={t("Ascunde provocarea lunii")} onClick={() => choose("skip")}><X size={16} /></button>
    </section>
  );
}
