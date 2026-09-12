import { AlertTriangle, RotateCcw } from "lucide-react";
import { applyAllocationConflictChoice, undoAllocationConflictChoice, activeAllocationConflicts } from "@/lib/family-crypto";
import type { AppData } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";

const money = (value: number) =>
  new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(value);

export function EnvelopeConflictBanner({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const open = activeAllocationConflicts(data);
  const recent = (data.allocationConflicts || []).filter((item) => item.resolvedChoice && item.previousAmount !== undefined).slice(0, 3);
  if (!open.length && !recent.length) return null;

  return (
    <section className="bf-envelope-conflicts" aria-live="polite" aria-labelledby="bf-conflict-title">
      {open.length > 0 && (
        <>
          <div className="bf-envelope-conflicts-heading">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <p className="bf-kicker">{t("CONFLICT DE PLIC")}</p>
              <h2 id="bf-conflict-title">{t("Două telefoane au schimbat aceeași sumă")}</h2>
              <p>{t("Alege ce păstrezi. Nu unificăm sumele în tăcere.")}</p>
            </div>
          </div>
          <ul className="bf-envelope-conflicts-list">
            {open.map((conflict) => (
              <li key={conflict.id}>
                <div>
                  <b>{conflict.label}</b>
                  <span className="bf-conflict-badge" aria-label={t("Conflict")}>{t("Conflict")}</span>
                  <small>
                    {t("Pe acest telefon")}: {money(conflict.localAmount)} · {t("Pe celălalt")}: {money(conflict.remoteAmount)}
                  </small>
                </div>
                <div className="bf-envelope-conflicts-actions">
                  <button type="button" className="bf-primary" onClick={() => onChange(applyAllocationConflictChoice(data, conflict.id, "local"))}>
                    {t("Păstrează local")} ({money(conflict.localAmount)})
                  </button>
                  <button type="button" className="bf-secondary" onClick={() => onChange(applyAllocationConflictChoice(data, conflict.id, "remote"))}>
                    {t("Păstrează remote")} ({money(conflict.remoteAmount)})
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {recent.map((conflict) => (
        <div key={`undo-${conflict.id}`} className="bf-envelope-conflict-undo">
          <span>
            {t("Rezolvat")}: {conflict.label} → {money(conflict.resolvedChoice === "remote" ? conflict.remoteAmount : conflict.localAmount)}
          </span>
          <button type="button" className="bf-link-button" onClick={() => onChange(undoAllocationConflictChoice(data, conflict.id))}>
            <RotateCcw size={14} /> {t("Anulează")}
          </button>
        </div>
      ))}
    </section>
  );
}

export function EnvelopeConflictBadge({ allocationId, data }: { allocationId: string; data: AppData }) {
  const hit = activeAllocationConflicts(data).find((item) => item.allocationId === allocationId);
  if (!hit) return null;
  return <span className="bf-conflict-badge" title={t("Conflict de sumă după sync")}>{t("Conflict")}</span>;
}
