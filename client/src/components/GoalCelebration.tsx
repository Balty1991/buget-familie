/**
 * Obiectiv atins: confetti, cifra strânsă și un buton de trimis familiei. Fără mișcare dacă
 * telefonul cere „reduce motion”; se închide la atingere în afară sau cu Escape.
 */
import "../goal-celebration.css";
import { PartyPopper, Share2 } from "lucide-react";
import type { SavingsGoal } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

const COLORS = ["#1d7a5f", "#f2b33d", "#e0664f", "#2f6fd6", "#7b3f86"];

export function GoalCelebration({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const text = t("Am strâns {amount} pentru „{goal}”! 🎉", { amount: lei(goal.target), goal: goal.name });
  const share = async () => {
    try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard?.writeText(text); } catch { /* omul a renunțat */ }
    onClose();
  };
  return (
    <div className="bf-modal-backdrop bf-celebrate-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="bf-confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, index) => <i key={index} style={{ left: `${(index * 37) % 100}%`, background: COLORS[index % COLORS.length], animationDelay: `${(index % 9) * 0.12}s`, animationDuration: `${2.4 + (index % 5) * 0.3}s` }} />)}</div>
      <section ref={dialogRef} tabIndex={-1} className="bf-modal bf-celebrate" role="dialog" aria-modal="true" aria-labelledby="bf-celebrate-title">
        <PartyPopper size={34} aria-hidden="true" color="var(--cf-primary-strong)" />
        <p className="bf-kicker">{t("OBIECTIV ATINS")}</p>
        <h2 id="bf-celebrate-title">{goal.name}</h2>
        <b>{lei(goal.target)}</b>
        <p className="bf-helper">{t("Ați strâns tot ce v-ați propus. Felicitări, pas cu pas a mers!")}</p>
        <div className="bf-celebrate-actions" style={{ display: "grid", gap: 10, width: "100%", marginTop: 8 }}>
          <button type="button" className="bf-primary" onClick={onClose}>{t("Minunat")}</button>
          <button type="button" className="bf-secondary" onClick={() => void share()}><Share2 size={16} aria-hidden="true" /> {t("Spune familiei")}</button>
        </div>
      </section>
    </div>
  );
}
