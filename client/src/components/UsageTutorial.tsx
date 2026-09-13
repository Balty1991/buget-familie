/**
 * Tutorial de folosire — Mai mult → Ghid.
 * Reluabil, cu sărituri către ecrane, nu un overlay de prima deschidere.
 */
import { BookOpen, ChevronRight, WalletCards } from "lucide-react";
import { USAGE_GLOSSARY, USAGE_LESSONS, type UsageAction } from "@/lib/usage-tutorial";
import { t } from "@/lib/i18n";
import type { MainView } from "@/pages/home-kit";

type Props = {
  onGo?: (view: MainView) => void;
  onOpenReview?: () => void;
  onOpenSync?: () => void;
};

export function UsageTutorial({ onGo, onOpenReview, onOpenSync }: Props) {
  const jump = (id: string) => {
    document.getElementById(`bf-usage-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const run = (action: UsageAction) => {
    if (action === "today") onGo?.("today");
    else if (action === "plan") onGo?.("plan");
    else if (action === "journal") onGo?.("journal");
    else if (action === "review") onOpenReview?.();
    else if (action === "sync") onOpenSync?.();
  };

  return (
    <div className="bf-guide bf-usage-tutorial">
      <section className="bf-guide-hero">
        <BookOpen size={25} />
        <p className="bf-kicker">{t("TUTORIAL DE FOLOSIRE")}</p>
        <h2>{t("Cum ții casa, zi de zi.")}</h2>
        <p>{t("Șase gesturi. Restul e opțional. Poți relua pagina oricând din Mai mult → Ghid.")}</p>
        <div className="bf-guide-hero-actions">
          <button type="button" className="bf-guide-replay" onClick={() => window.dispatchEvent(new Event("buget-familie:replay-onboarding"))}>
            <BookOpen size={16} /> {t("Reia turul „Calm financiar”")}
          </button>
          <button type="button" className="bf-guide-replay" onClick={() => window.dispatchEvent(new Event("buget-familie:replay-setup"))}>
            <WalletCards size={16} /> {t("Reia configurarea casei")}
          </button>
        </div>
      </section>

      <nav className="bf-usage-toc" aria-label={t("Cuprins tutorial")}>
        {USAGE_LESSONS.map((lesson) => (
          <button type="button" key={lesson.id} onClick={() => jump(lesson.id)}>
            {t(lesson.title)}
          </button>
        ))}
      </nav>

      {USAGE_LESSONS.map((lesson) => (
        <section key={lesson.id} id={`bf-usage-${lesson.id}`}>
          <p className="bf-kicker">{t(lesson.kicker)}</p>
          <h3>{t(lesson.title)}</h3>
          {lesson.paragraphs.map((paragraph) => (
            <p key={paragraph}>{t(paragraph)}</p>
          ))}
          {lesson.action && (
            <button type="button" className="bf-usage-jump" onClick={() => run(lesson.action!.go)}>
              {t(lesson.action.label)} <ChevronRight size={16} />
            </button>
          )}
        </section>
      ))}

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
    </div>
  );
}
