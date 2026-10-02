/**
 * „Anul vostru”: retrospectiva anului ca o poveste, ecran cu ecran. Atingerea pe dreapta
 * merge mai departe, pe stânga înapoi; ultimul ecran face imaginea de trimis.
 */
import "../year-recap.css";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Share2, X } from "lucide-react";
import { categoryColor } from "@/lib/category-color";
import { formatDate } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { shareMonthCard } from "@/lib/month-share-card";
import { askReviewAfterMilestone } from "@/lib/review-prompt";
import { renderYearCard, yearCardHeadline } from "@/lib/year-recap-card";
import type { YearRecap } from "@/lib/year-recap";

type Slide = { id: string; tone: string; kicker: string; value: string; title: string; note?: string; extra?: React.ReactNode };

const monthName = (month: string) => { const text = formatDate(`${month}-01`, { month: "long" }); return text.charAt(0).toLocaleUpperCase() + text.slice(1); };

export function YearRecapStory({ recap, familyName, onClose }: { recap: YearRecap; familyName: string; onClose: () => void }) {
  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [
      { id: "intro", tone: "forest", kicker: t("ANUL VOSTRU"), value: String(recap.year), title: t("{family}, anul vostru în buget", { family: familyName }), note: t("{moves} mișcări notate. Hai să vedem ce spun.", { moves: recap.moves }) },
      { id: "days", tone: "teal", kicker: t("CONSECVENȚĂ"), value: String(recap.loggedDays), title: t("zile în care ați notat"), note: t("Cea mai lungă serie: {streak} zile la rând.", { streak: recap.longestStreak }) },
    ];
    const top = recap.categories[0];
    if (top) list.push({
      id: "categories", tone: "honey", kicker: t("UNDE S-AU DUS BANII"), value: `${Math.round(top.share * 100)}%`, title: t("au mers pe {category}", { category: t(top.name) }),
      extra: <ul className="bf-year-bars">{recap.categories.map((item) => <li key={item.name}><span>{t(item.name)}</span><b>{lei(item.amount)}</b><i><em style={{ width: `${Math.max(3, item.share * 100)}%`, background: categoryColor(item.name) }} /></i></li>)}</ul>,
    });
    if (recap.topPlace) list.push({ id: "place", tone: "plum", kicker: t("LOCUL VOSTRU"), value: recap.topPlace.name, title: t("{visits} vizite într-un an", { visits: recap.topPlace.visits }), note: t("Magazinul la care v-a dus drumul cel mai des.") });
    if (recap.bestMonth) list.push({
      id: "best", tone: "sky", kicker: t("CEA MAI BUNĂ LUNĂ"), value: monthName(recap.bestMonth.month),
      title: recap.bestMonth.keptShare !== undefined ? t("au rămas {share}% din ce a intrat", { share: Math.round(recap.bestMonth.keptShare * 100) }) : t("cele mai mici cheltuieli: {amount}", { amount: lei(recap.bestMonth.spent) }),
      note: t("Merită ținut minte ce a mers atunci."),
    });
    list.push({ id: "nospend", tone: "teal", kicker: t("ZILE FĂRĂ CHELTUIELI"), value: String(recap.noSpendDays), title: t("zile în care n-a ieșit niciun leu"), note: t("Fiecare a lăsat bani pentru altceva.") });
    const head = yearCardHeadline(recap, false);
    list.push({ id: "share", tone: "forest", kicker: head.kicker, value: head.value, title: head.note, note: t("Faceți din anul vostru o imagine de trimis familiei.") });
    return list;
  }, [recap, familyName]);

  const [index, setIndex] = useState(0);
  const [showAmounts, setShowAmounts] = useState(false);
  const [state, setState] = useState<"idle" | "working" | "shared" | "saved" | "error">("idle");
  const last = index === slides.length - 1;
  const go = (step: number) => setIndex((current) => Math.min(slides.length - 1, Math.max(0, current + step)));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const root = document.documentElement;
    root.classList.add("bf-year-story-open");
    return () => { window.removeEventListener("keydown", onKey); root.classList.remove("bf-year-story-open"); };
  }, [onClose, slides.length]);

  const send = async () => {
    setState("working");
    try {
      const blob = await renderYearCard(recap, familyName, showAmounts);
      const result = await shareMonthCard(blob, `buget-familie-${recap.year}.png`, t("Anul nostru în Buget Familie"), t("Trimite anul vostru"));
      setState(result === "cancelled" ? "idle" : result);
      if (result === "shared") window.setTimeout(() => void askReviewAfterMilestone(), 1200);
    } catch {
      setState("error");
    }
  };

  const slide = slides[index];
  return createPortal(
    <div className={`bf-year-story is-${slide.tone}`} role="dialog" aria-modal="true" aria-label={t("Anul vostru {year}", { year: recap.year })}>
      <div className="bf-year-progress" aria-hidden="true">{slides.map((item, n) => <i key={item.id} className={n < index ? "is-done" : n === index ? "is-now" : ""} />)}</div>
      <button type="button" className="bf-year-close" aria-label={t("Închide")} onClick={onClose}><X size={20} /></button>
      <button type="button" className="bf-year-tap is-back" aria-label={t("Înapoi")} disabled={index === 0} onClick={() => go(-1)} />
      {!last && <button type="button" className="bf-year-tap is-next" aria-label={t("Mai departe")} onClick={() => go(1)} />}
      <section key={slide.id} className="bf-year-slide" aria-live="polite">
        <p className="bf-year-kicker">{slide.kicker}</p>
        <b className="bf-year-value">{slide.value}</b>
        <h2>{slide.title}</h2>
        {slide.note && <p className="bf-year-note">{slide.note}</p>}
        {slide.extra}
        {last && <div className="bf-year-share">
          <label><input type="checkbox" checked={showAmounts} onChange={(event) => setShowAmounts(event.target.checked)} /><span><b>{t("Arată sumele în imagine")}</b><small>{showAmounts ? t("Se văd lei. Bun pentru familie, nu pentru povești publice.") : t("Doar procente și zile: nimeni nu vede cât câștigați.")}</small></span></label>
          <button type="button" className="bf-year-send" disabled={state === "working"} onClick={() => void send()}><Share2 size={18} aria-hidden="true" /> {state === "working" ? t("Pregătim…") : state === "shared" ? t("Trimis") : state === "saved" ? t("Salvată în descărcări") : t("Trimite imaginea anului")}</button>
          {state === "error" && <p role="alert">{t("Imaginea nu s-a putut face pe acest telefon.")}</p>}
        </div>}
      </section>
      <nav className="bf-year-nav">
        <button type="button" aria-label={t("Înapoi")} disabled={index === 0} onClick={() => go(-1)}><ChevronLeft size={20} /></button>
        <span>{index + 1} / {slides.length}</span>
        <button type="button" aria-label={t("Mai departe")} disabled={last} onClick={() => go(1)}><ChevronRight size={20} /></button>
      </nav>
    </div>,
    document.body,
  );
}
