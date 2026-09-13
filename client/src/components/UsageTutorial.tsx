/**
 * Tutorial de folosire — Mai mult → Tutorial.
 * Pași, nu un articol: un gest pe ecran, apoi următorul.
 */
import { useState } from "react";
import {
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MessagesSquare,
  ReceiptText,
  Users,
  WalletCards,
} from "lucide-react";
import { USAGE_GLOSSARY, USAGE_LESSONS, type UsageAction } from "@/lib/usage-tutorial";
import { t } from "@/lib/i18n";
import type { MainView } from "@/pages/home-kit";

type Props = {
  onGo?: (view: MainView) => void;
  onOpenReview?: () => void;
  onOpenSync?: () => void;
};

const ICONS = {
  today: CalendarClock,
  capture: ReceiptText,
  envelopes: WalletCards,
  review: Inbox,
  family: Users,
  guide: MessagesSquare,
} as const;

export function UsageTutorial({ onGo, onOpenReview, onOpenSync }: Props) {
  const [step, setStep] = useState(0);
  const lesson = USAGE_LESSONS[step] || USAGE_LESSONS[0];
  const Icon = ICONS[lesson.id as keyof typeof ICONS] || BookOpen;
  const last = step >= USAGE_LESSONS.length - 1;
  const first = step <= 0;

  const run = (action: UsageAction) => {
    if (action === "today") onGo?.("today");
    else if (action === "plan") onGo?.("plan");
    else if (action === "journal") onGo?.("journal");
    else if (action === "review") onOpenReview?.();
    else if (action === "sync") onOpenSync?.();
    else if (action === "ghid") window.dispatchEvent(new Event("buget-familie:open-guide"));
  };

  return (
    <div className="bf-guide bf-usage-tutorial">
      <section className="bf-guide-hero">
        <BookOpen size={25} />
        <p className="bf-kicker">{t("TUTORIAL DE FOLOSIRE")}</p>
        <h2>{t("Cum ții casa, zi de zi.")}</h2>
        <p>{t("Șase gesturi. Unul pe ecran, apoi următorul. Îl găsești oricând în Mai mult → Tutorial.")}</p>
      </section>

      <nav className="bf-usage-toc" aria-label={t("Cuprins tutorial")}>
        {USAGE_LESSONS.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={index === step ? "is-on" : index < step ? "is-done" : ""}
            aria-current={index === step ? "step" : undefined}
            onClick={() => setStep(index)}
          >
            <span aria-hidden="true">{index + 1}</span>
            {t(item.nav)}
          </button>
        ))}
      </nav>

      <section className="bf-usage-step" aria-labelledby="bf-usage-step-title">
        <div className="bf-usage-step-visual" aria-hidden="true">
          <Icon size={26} />
          <b>0{step + 1}</b>
        </div>
        <p className="bf-kicker">{t(lesson.kicker)}</p>
        <h3 id="bf-usage-step-title">{t(lesson.title)}</h3>
        <p className="bf-usage-how">{t(lesson.how)}</p>
        {lesson.paragraphs.map((paragraph) => (
          <p key={paragraph}>{t(paragraph)}</p>
        ))}
        {lesson.action && (
          <button type="button" className="bf-usage-jump" onClick={() => run(lesson.action!.go)}>
            {t(lesson.action.label)} <ChevronRight size={16} />
          </button>
        )}
        <div
          className="bf-onboarding-progress"
          aria-label={t("Pasul {current} din {total}", { current: step + 1, total: USAGE_LESSONS.length })}
        >
          {USAGE_LESSONS.map((item, index) => (
            <span key={item.id} className={index === step ? "active" : index < step ? "done" : ""} />
          ))}
        </div>
        <div className="bf-usage-nav">
          <button type="button" className="bf-secondary" disabled={first} onClick={() => setStep((value) => Math.max(0, value - 1))}>
            <ChevronLeft size={16} /> {t("Înapoi")}
          </button>
          {!last ? (
            <button type="button" className="bf-primary" onClick={() => setStep((value) => Math.min(USAGE_LESSONS.length - 1, value + 1))}>
              {t("Continuă")} <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" className="bf-primary" onClick={() => onGo?.("today")}>
              {t("Gata, pe Astăzi")} <ChevronRight size={16} />
            </button>
          )}
        </div>
      </section>

      {last && (
        <>
          <section>
            <p className="bf-kicker">{t("ÎNAINTE DE ZIUA 1")}</p>
            <h3>{t("Un membru, o sursă, un plic")}</h3>
            <p>
              {t("În")} <b>{t("Setări familie")}</b>
              {t(", păstrează un singur membru pentru monitorizare personală sau adaugă mai mulți membri când aveți un buget comun. Configurează sursele și soldurile inițiale, apoi creează planul până la următorul venit.")}
            </p>
          </section>
          <section>
            <p className="bf-kicker">{t("PAROLA")}</p>
            <h3>{t("Parola de familie rămâne la voi")}</h3>
            <p>{t("Parola de sincronizare nu este salvată. Nu o pune în conversații, bonuri sau capturi de ecran. Dacă un telefon se pierde, schimbați parola pe telefoanele rămase — camera veche nu mai decriptează pachetul. Pozele bonurilor nu părăsesc telefonul. Politica, termenii și ștergerea datelor sunt în Setări → Încredere.")}</p>
          </section>
        </>
      )}

      <section className="bf-guide-glossary" aria-labelledby="bf-glossary-title">
        <p className="bf-kicker">{t("PE SCURT")}</p>
        <h3 id="bf-glossary-title">{t("Cuvinte scurte, fără confuzie")}</h3>
        <dl className="bf-glossary-list">
          {USAGE_GLOSSARY.map((item) => (
            <div key={item.term}>
              <dt>{t(item.term)}</dt>
              <dd>{t(item.meaning)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="bf-guide-hero-actions bf-usage-replay">
        <button type="button" className="bf-guide-replay" onClick={() => window.dispatchEvent(new Event("buget-familie:replay-onboarding"))}>
          <BookOpen size={16} /> {t("Reia turul „Calm financiar”")}
        </button>
        <button type="button" className="bf-guide-replay" onClick={() => window.dispatchEvent(new Event("buget-familie:replay-setup"))}>
          <WalletCards size={16} /> {t("Reia configurarea casei")}
        </button>
      </div>
    </div>
  );
}
