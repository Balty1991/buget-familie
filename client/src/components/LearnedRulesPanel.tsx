/**
 * „Ce am învățat de la tine.”
 *
 * Asistentul reține de mult unde pui de obicei cumpărăturile de la un magazin, iar
 * regulile scrise fac același lucru pe față. Până acum nu se putea vedea nici una, nici
 * alta — deci fiecare propunere bună părea noroc, iar fiecare propunere proastă părea
 * încăpățânare. Aici sunt amândouă, cu butonul de uitare lângă fiecare.
 */
import { useState } from "react";
import { BrainCircuit, Trash2 } from "lucide-react";
import { forgetHabit, forgetRule, learnedRules, readGuideMemory, writeGuideMemory } from "@/lib/learned-rules";
import { formatDate, type AppData } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import "../learned-rules.css";

export function LearnedRulesPanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const [memory, setMemory] = useState(() => readGuideMemory());
  const rows = learnedRules(data, memory);
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
          <p>{t("După câteva cheltuieli trecute la fel, o să-ți propun singur plicul și sursa. Poți scrie și o regulă din ghid: «de fiecare dată când scriu Lidl, pune-l pe Alimente».")}</p>
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
              <button type="button" onClick={() => uita(item.id, item.kind)} aria-label={t("Uită „{name}”", { name: item.match })}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
