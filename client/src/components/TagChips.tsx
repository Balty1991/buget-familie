/**
 * „Pentru”: eticheta cheltuielii (Serviciu, Casă, Copil, Mașină sau una nouă). O atingere o pune,
 * a doua o scoate. Opțională: fără ea, cheltuiala rămâne doar pe categorie.
 */
import { useState } from "react";
import { type AppData } from "@/lib/finance-data";
import { knownTags } from "@/lib/tags";
import { t } from "@/lib/i18n";

const chip = (on: boolean): React.CSSProperties => ({
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 999,
  border: `1px solid ${on ? "var(--cf-primary-strong, #185849)" : "var(--cf-line)"}`,
  background: on ? "var(--cf-primary-strong, #185849)" : "var(--cf-surface)",
  color: on ? "var(--cf-on-primary, #fff)" : "var(--cf-ink)",
  fontSize: 13,
  fontWeight: 600,
});

export function TagChips({ data, value, onChange }: { data: AppData; value?: string; onChange: (tag: string | undefined) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const tags = knownTags(data);
  const shown = value && !tags.includes(value) ? [value, ...tags] : tags;
  const add = () => {
    const tag = draft.trim().replace(/\s+/g, " ").slice(0, 24);
    if (tag) onChange(tag);
    setAdding(false);
    setDraft("");
  };
  return (
    <div className="bf-field" role="group" aria-label={t("Pentru (opțional)")} style={{ gridColumn: "1 / -1" }}>
      <span>{t("Pentru (opțional)")}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {shown.map((tag) => (
          <button key={tag} type="button" aria-pressed={value === tag} style={chip(value === tag)} onClick={() => onChange(value === tag ? undefined : tag)}>{t(tag)}</button>
        ))}
        {adding
          ? <input autoFocus value={draft} maxLength={24} onChange={(event) => setDraft(event.target.value)} onBlur={add} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder={t("ex. Sală, Bunica")} aria-label={t("Etichetă nouă")} style={{ ...chip(false), width: "9em" }} />
          : <button type="button" style={chip(false)} onClick={() => setAdding(true)}>{t("+ Alta")}</button>}
      </div>
    </div>
  );
}
