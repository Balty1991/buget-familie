/**
 * „Ce am învățat de la tine.”
 *
 * Asistentul reține de mult unde pui de obicei cumpărăturile de la un magazin, iar
 * regulile scrise fac același lucru pe față. Până acum nu se putea vedea nici una, nici
 * alta — deci fiecare propunere bună părea noroc, iar fiecare propunere proastă părea
 * încăpățânare. Aici sunt amândouă, cu butonul de uitare lângă fiecare.
 */
import { useState } from "react";
import { BrainCircuit, Copy, Trash2 } from "lucide-react";
import { forgetHabit, forgetPhrase, forgetRule, learnedRules, readGuideMemory, writeGuideMemory } from "@/lib/learned-rules";
import { clearMissed, loadMissed, missedAsText } from "@/lib/guide-missed";
import { formatDate, type AppData } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import "../learned-rules.css";

export function LearnedRulesPanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const [memory, setMemory] = useState(() => readGuideMemory());
  const [missed, setMissed] = useState(() => loadMissed());
  const [copied, setCopied] = useState(false);
  const rows = learnedRules(data, memory);
  const phrases = [...(memory.learned || [])].sort((left, right) => right.lastAt.localeCompare(left.lastAt));
  const uitaFraza = (shape: string) => {
    const next = forgetPhrase(memory, shape);
    writeGuideMemory(next);
    setMemory(next);
  };
  const copiaza = async () => {
    try {
      await navigator.clipboard.writeText(missedAsText(missed));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch { /* fără clipboard, lista rămâne de citit pe ecran */ }
  };
  const goleste = () => {
    clearMissed();
    setMissed([]);
  };
  const uita = (id: string, kind: "rule" | "habit") => {
    if (kind === "rule") {
      onChange(forgetRule(data, id));
      return;
    }
    const next = forgetHabit(memory, id);
    writeGuideMemory(next);
    setMemory(next);
  };

  return (
    <section className="bf-learned" aria-labelledby="bf-learned-title">
      <header>
        <p className="bf-kicker">{t("CE AM ÎNVĂȚAT DE LA TINE")}</p>
        <h2 id="bf-learned-title">{t("Regulile după care îți propun.")}</h2>
        <p>{t("Regulile scrise se sincronizează între telefoane. Obiceiurile se învață din alegerile tale și rămân pe telefonul ăsta. Nimic nu se salvează singur — toate sunt doar propuneri.")}</p>
      </header>

      {rows.length === 0 ? (
        <div className="bf-empty-state slim">
          <BrainCircuit size={23} />
          <h2>{t("Încă nu am învățat nimic")}</h2>
          <p>{t("După câteva cheltuieli trecute la fel, o să-ți propun singur plicul și sursa. Poți scrie și o regulă din ghid: „de fiecare dată când scriu Lidl, pune-l pe Alimente”.")}</p>
        </div>
      ) : (
        <ul className="bf-learned-list">
          {rows.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <div>
                <b>{item.match}</b>
                <small>
                  {[
                    item.allocationLabel ? t("plicul „{name}”", { name: item.allocationLabel }) : item.category,
                    item.sourceLabel,
                  ].filter(Boolean).join(" · ")}
                </small>
                <em>
                  {item.kind === "rule"
                    ? t("regulă scrisă de tine")
                    : t("ales de {count} ori, ultima dată {when}", { count: String(item.count || 0), when: formatDate(String(item.lastAt || "").slice(0, 10)) })}
                </em>
              </div>
              <button type="button" className="bf-learned-forget" onClick={() => uita(item.id, item.kind)} aria-label={t("Uită „{name}”", { name: item.match })}>
                <Trash2 size={16} /> {t("Uită")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <header className="bf-learned-sub">
        <p className="bf-kicker">{t("FRAZE ÎNVĂȚATE")}</p>
        <p>{t("Fraze pe care le-a citit întâi ghidul online, iar tu ai confirmat propunerea. Acum le înțeleg direct pe telefon, și fără internet.")}</p>
      </header>
      {phrases.length === 0 ? (
        <p className="bf-helper">{t("Încă nicio frază. Când confirmi o propunere venită online, o rețin aici.")}</p>
      ) : (
        <ul className="bf-learned-list">
          {phrases.map((item) => (
            <li key={item.shape}>
              <div>
                <b>„{item.shape.replace("#", "…")}”</b>
                <small>{[item.kind === "income" ? t("venit") : t("cheltuială"), item.title, item.category].filter(Boolean).join(" · ")}</small>
                <em>{t("folosită de {count} ori, ultima dată {when}", { count: String(item.count), when: formatDate(item.lastAt.slice(0, 10)) })}</em>
              </div>
              <button type="button" className="bf-learned-forget" onClick={() => uitaFraza(item.shape)} aria-label={t("Uită „{name}”", { name: item.shape })}>
                <Trash2 size={16} /> {t("Uită")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <header className="bf-learned-sub">
        <p className="bf-kicker">{t("CE NU AM ÎNȚELES SINGUR")}</p>
        <p>{t("Frazele pe care ghidul de pe telefon le-a trimis online. Lista rămâne doar pe telefonul ăsta; o poți copia dacă vrei să ne-o trimiți.")}</p>
      </header>
      {missed.length === 0 ? (
        <p className="bf-helper">{t("Nicio frază. Tot ce mi-ai scris am înțeles pe telefon.")}</p>
      ) : (
        <>
          <ul className="bf-learned-list">
            {[...missed].reverse().slice(0, 20).map((item) => (
              <li key={`${item.at}-${item.text}`}>
                <div>
                  <b>{item.text}</b>
                  <em>{formatDate(item.at.slice(0, 10))}</em>
                </div>
              </li>
            ))}
          </ul>
          {missed.length > 20 && <p className="bf-helper">{t("Și încă {count} mai vechi, în lista copiată.", { count: String(missed.length - 20) })}</p>}
          <div className="bf-learned-actions">
            <button type="button" className="bf-secondary" onClick={() => void copiaza()}><Copy size={16} /> {copied ? t("Copiat") : t("Copiază lista")}</button>
            <button type="button" className="bf-secondary" onClick={goleste}><Trash2 size={16} /> {t("Golește")}</button>
          </div>
        </>
      )}
    </section>
  );
}
