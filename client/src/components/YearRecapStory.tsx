/**
 * „Anul vostru”: retrospectiva anului ca o poveste, ecran cu ecran. Ecranele merg singure
 * (ținut apăsat = pauză), atingerea pe dreapta sau glisarea merge mai departe, pe stânga înapoi;
 * cifrele „numără” când apar. Ultimul ecran face imaginea de trimis.
 */
import "../year-recap.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Share2, X } from "lucide-react";
import { categoryColor } from "@/lib/category-color";
import { formatDate, isoToday, type AppData } from "@/lib/finance-data";
import { useCountUp } from "@/hooks/useCountUp";
import { yearStoryExtras, type PersonaId } from "@/lib/year-story";
import { getLocale, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { shareMonthCard } from "@/lib/month-share-card";
import { askReviewAfterMilestone } from "@/lib/review-prompt";
import { renderYearCard, yearCardHeadline } from "@/lib/year-recap-card";
import type { YearRecap } from "@/lib/year-recap";

type Slide = { id: string; tone: string; kicker: string; value: string; title: string; note?: string; extra?: React.ReactNode; /** Cifra care „numără” (în locul textului `value`). */ count?: { to: number; format: (value: number) => string } };

/** Cât stă un ecran până trece singur la următorul. */
const SLIDE_MS = 6500;
const PERSONAS: Record<PersonaId, () => { name: string; note: string }> = {
  savers: () => ({ name: t("Economisitorii"), note: t("Ați păstrat o parte serioasă din ce a intrat. Puține familii reușesc asta un an întreg.") }),
  "debt-fighters": () => ({ name: t("Luptătorii"), note: t("Ați dat datoriilor o bucată mare din an. Fiecare rată plătită e libertate câștigată.") }),
  steady: () => ({ name: t("Constanții"), note: t("Ați notat zi de zi, săptămâni la rând. Așa se vede cu adevărat unde merg banii.") }),
  minimalists: () => ({ name: t("Minimaliștii"), note: t("Multe zile fără niciun leu cheltuit. Liniștea asta se adună.") }),
  loyal: () => ({ name: t("Fidelii"), note: t("Aveți locurile voastre și vă întoarceți la ele. Acolo merită urmărite prețurile.") }),
  explorers: () => ({ name: t("Exploratorii"), note: t("Un an în care ați învățat cum se mișcă banii familiei. Anul viitor porniți cu avans.") }),
};
const weekdayName = (index: number) => new Intl.DateTimeFormat(getLocale(), { weekday: "long" }).format(new Date(Date.UTC(2026, 2, 2 + index, 12)));

function SlideValue({ slide }: { slide: Slide }) {
  const shown = useCountUp(slide.count?.to ?? 0, 900, 0);
  const text = slide.count ? slide.count.format(Math.round(shown)) : slide.value;
  const finalText = slide.count ? slide.count.format(slide.count.to) : slide.value;
  // Sumele lungi („12.400 lei”) nu încap la mărimea unui an: le micșorăm după lungime.
  const style = finalText.length > 7 ? { fontSize: finalText.length > 11 ? "clamp(36px, 11vw, 64px)" : "clamp(44px, 14vw, 84px)" } : undefined;
  return <b className="bf-year-value" style={style}>{text}</b>;
}

/** Lunile anului ca bare: cheltuieli, cu venitul ca linie subțire; cea mai bună lună e luminată. */
function MonthBars({ recap }: { recap: YearRecap }) {
  const top = Math.max(1, ...recap.monthly.map((row) => Math.max(row.spent, row.income)));
  return <div role="img" aria-label={t("Cheltuielile pe fiecare lună a anului")} style={{ display: "grid", gridTemplateColumns: `repeat(${recap.monthly.length}, minmax(0, 1fr))`, alignItems: "end", gap: 5, height: 170, marginTop: 16 }}>
    {recap.monthly.map((row, n) => <span key={row.month} style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 4, height: "100%" }}>
      {row.income > 0 && <i aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: `${18 + (row.income / top) * 140}px`, height: 2, background: "rgba(255,255,255,.7)" }} />}
      <i aria-hidden="true" style={{ display: "block", height: `${Math.max(4, (row.spent / top) * 140)}px`, borderRadius: 6, background: row.month === recap.bestMonth?.month ? "#fff" : "rgba(255,255,255,.42)", transformOrigin: "bottom", animation: `bf-year-in .5s ${n * 0.05}s ease both` }} />
      <small style={{ height: 14, fontSize: 10, lineHeight: "14px", textAlign: "center", opacity: 0.8 }}>{formatDate(`${row.month}-01`, { month: "narrow" })}</small>
    </span>)}
  </div>;
}

const monthName = (month: string) => { const text = formatDate(`${month}-01`, { month: "long" }); return text.charAt(0).toLocaleUpperCase() + text.slice(1); };

export function YearRecapStory({ recap, familyName, onClose, data }: { recap: YearRecap; familyName: string; onClose: () => void; data?: AppData }) {
  const extras = useMemo(() => (data ? yearStoryExtras(data, recap, isoToday()) : undefined), [data, recap]);
  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [
      { id: "intro", tone: "forest", kicker: t("ANUL VOSTRU"), value: String(recap.year), title: t("{family}, anul vostru în buget", { family: familyName }), note: t("{moves} mișcări notate. Hai să vedem ce spun.", { moves: recap.moves }) },
      { id: "days", tone: "teal", kicker: t("CONSECVENȚĂ"), value: String(recap.loggedDays), count: { to: recap.loggedDays, format: String }, title: t("zile în care ați notat"), note: t("Cea mai lungă serie: {streak} zile la rând.", { streak: recap.longestStreak }) },
    ];
    if (recap.monthly.length >= 3) list.push({ id: "months", tone: "sky", kicker: t("ANUL, LUNĂ CU LUNĂ"), value: lei(recap.spent), count: { to: Math.round(recap.spent), format: lei }, title: t("cheltuiți în {count} luni", { count: recap.monthly.length }), note: recap.income > 0 ? t("Linia albă: ce a intrat. Bara luminată: cea mai bună lună.") : undefined, extra: <MonthBars recap={recap} /> });
    const top = recap.categories[0];
    if (top) list.push({
      id: "categories", tone: "honey", kicker: t("UNDE S-AU DUS BANII"), value: `${Math.round(top.share * 100)}%`, title: t("au mers pe {category}", { category: t(top.name) }),
      extra: <ul className="bf-year-bars">{recap.categories.map((item) => <li key={item.name}><span>{t(item.name)}</span><b>{lei(Math.round(item.amount))}</b><i><em style={{ width: `${Math.max(3, item.share * 100)}%`, background: categoryColor(item.name) }} /></i></li>)}</ul>,
    });
    if (recap.topPlace) list.push({ id: "place", tone: "plum", kicker: t("LOCUL VOSTRU"), value: recap.topPlace.name, title: t("{visits} vizite într-un an", { visits: recap.topPlace.visits }), note: t("Magazinul la care v-a dus drumul cel mai des.") });
    if (recap.bestMonth) list.push({
      id: "best", tone: "sky", kicker: t("CEA MAI BUNĂ LUNĂ"), value: monthName(recap.bestMonth.month),
      title: recap.bestMonth.keptShare !== undefined ? t("au rămas {share}% din ce a intrat", { share: Math.round(recap.bestMonth.keptShare * 100) }) : t("cele mai mici cheltuieli: {amount}", { amount: lei(recap.bestMonth.spent) }),
      note: t("Merită ținut minte ce a mers atunci."),
    });
    list.push({ id: "nospend", tone: "teal", kicker: t("ZILE FĂRĂ CHELTUIELI"), value: String(recap.noSpendDays), count: { to: recap.noSpendDays, format: String }, title: t("zile în care n-a ieșit niciun leu"), note: extras?.priciestWeekday !== undefined ? t("Fiecare a lăsat bani pentru altceva. Ziua cea mai scumpă a săptămânii: {day}.", { day: weekdayName(extras.priciestWeekday) }) : t("Fiecare a lăsat bani pentru altceva.") });
    if (extras?.biggest) list.push({ id: "biggest", tone: "honey", kicker: t("CEA MAI MARE CHELTUIALĂ"), value: lei(extras.biggest.amount), count: { to: Math.round(extras.biggest.amount), format: lei }, title: extras.biggest.title, note: formatDate(extras.biggest.date, { day: "numeric", month: "long" }) });
    if (extras && (extras.debtPaid > 0 || extras.goalsReached.length > 0)) list.push({
      id: "steps", tone: "forest", kicker: t("PAȘI MARI"),
      value: extras.debtPaid > 0 ? lei(extras.debtPaid) : String(extras.goalsReached.length),
      count: extras.debtPaid > 0 ? { to: extras.debtPaid, format: lei } : { to: extras.goalsReached.length, format: String },
      title: extras.debtPaid > 0 ? t("date pe datorii") : t("obiective atinse"),
      note: extras.goalsReached.length ? t("Obiective atinse: {names}.", { names: extras.goalsReached.slice(0, 3).join(", ") }) : extras.goalsSaved > 0 ? t("Și {amount} strânși pentru obiective.", { amount: lei(extras.goalsSaved) }) : undefined,
    });
    if (extras?.netChange !== undefined) list.push({ id: "worth", tone: extras.netChange > 0 ? "teal" : "plum", kicker: t("AVEREA FAMILIEI"), value: `${extras.netChange > 0 ? "+" : ""}${lei(extras.netChange)}`, count: { to: extras.netChange, format: (value) => `${value > 0 ? "+" : ""}${lei(value)}` }, title: t("în ultimele 12 luni"), note: extras.netChange > 0 ? t("Ce aveți minus ce datorați a crescut. Asta e direcția.") : t("A fost un an greu. Planul pe 12 luni vă ajută să întoarceți cifra.") });
    if (extras) { const persona = PERSONAS[extras.persona](); list.push({ id: "persona", tone: "plum", kicker: t("ANUL ĂSTA AȚI FOST"), value: persona.name, title: t("asta spun cifrele voastre"), note: persona.note }); }
    const head = yearCardHeadline(recap, false);
    list.push({ id: "share", tone: "forest", kicker: head.kicker, value: head.value, title: head.note, note: t("Faceți din anul vostru o imagine de trimis familiei.") });
    return list;
  }, [recap, familyName, extras]);

  const [index, setIndex] = useState(0);
  const [showAmounts, setShowAmounts] = useState(false);
  const [state, setState] = useState<"idle" | "working" | "shared" | "saved" | "error">("idle");
  const last = index === slides.length - 1;
  const go = (step: number) => { setIndex((current) => Math.min(slides.length - 1, Math.max(0, current + step))); setElapsed(0); };
  const [elapsed, setElapsed] = useState(0);
  const [held, setHeld] = useState(false);
  const swipe = useRef<{ x: number; y: number; swiped: boolean } | undefined>(undefined);
  const reduced = useMemo(() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return true; } }, []);
  // Ecranele merg singure, ca o poveste; ultimul (trimiterea) așteaptă.
  useEffect(() => {
    if (reduced || held || last) return;
    const began = Date.now() - elapsed;
    const timer = window.setInterval(() => {
      const spent = Date.now() - began;
      if (spent >= SLIDE_MS) { window.clearInterval(timer); go(1); } else setElapsed(spent);
    }, 120);
    return () => window.clearInterval(timer);
  }, [index, held, last, reduced]);

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
    <div className={`bf-year-story is-${slide.tone}`} role="dialog" aria-modal="true" aria-label={t("Anul vostru {year}", { year: recap.year })}
      onPointerDown={(event) => { swipe.current = { x: event.clientX, y: event.clientY, swiped: false }; if ((event.target as HTMLElement).classList.contains("bf-year-tap")) setHeld(true); }}
      onPointerUp={(event) => { setHeld(false); const start = swipe.current; if (!start) return; const dx = event.clientX - start.x; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(event.clientY - start.y)) { start.swiped = true; go(dx < 0 ? 1 : -1); } }}
      onPointerCancel={() => setHeld(false)}
      onClickCapture={(event) => { if (swipe.current?.swiped && (event.target as HTMLElement).classList.contains("bf-year-tap")) { event.stopPropagation(); swipe.current = undefined; } }}>
      <div className="bf-year-progress" aria-hidden="true">{slides.map((item, n) => <i key={item.id} className={n < index ? "is-done" : ""} style={{ overflow: "hidden" }}>{n === index && <b style={{ display: "block", height: "100%", width: reduced || last ? "100%" : `${Math.min(100, (elapsed / SLIDE_MS) * 100)}%`, background: "#fff", borderRadius: 4 }} />}</i>)}</div>
      <button type="button" className="bf-year-close" aria-label={t("Închide")} onClick={onClose}><X size={20} /></button>
      <button type="button" className="bf-year-tap is-back" aria-label={t("Înapoi")} disabled={index === 0} onClick={() => go(-1)} />
      {!last && <button type="button" className="bf-year-tap is-next" aria-label={t("Mai departe")} onClick={() => go(1)} />}
      <section key={slide.id} className="bf-year-slide" aria-live="polite">
        <p className="bf-year-kicker">{slide.kicker}</p>
        <SlideValue key={slide.id} slide={slide} />
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
