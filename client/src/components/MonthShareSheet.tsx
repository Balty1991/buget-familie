/**
 * Foaia „Imaginea lunii”: previzualizare, comutatorul pentru sume și butonul de trimis.
 * Imaginea se desenează pe telefon; sumele apar doar dacă omul le pornește.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon, Share2, X } from "lucide-react";
import type { MonthlyFamilyReport } from "@/lib/household-insights";
import { renderMonthCard, shareMonthCard } from "@/lib/month-share-card";
import { askReviewAfterMilestone } from "@/lib/review-prompt";
import { t } from "@/lib/i18n";

export function MonthShareSheet({ report, onClose }: { report: MonthlyFamilyReport; onClose: () => void }) {
  const [showAmounts, setShowAmounts] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [state, setState] = useState<"idle" | "working" | "shared" | "saved" | "error">("idle");

  useEffect(() => {
    let alive = true;
    let made = "";
    renderMonthCard(report, showAmounts)
      .then((blob) => {
        if (!alive) return;
        made = URL.createObjectURL(blob);
        setPreview({ url: made, blob });
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [report, showAmounts]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    if (!preview) return;
    setState("working");
    try {
      const result = await shareMonthCard(preview.blob, `buget-familie-${report.month}.png`, t("Luna noastră în Buget Familie"));
      setState(result === "cancelled" ? "idle" : result);
      if (result === "shared") window.setTimeout(() => void askReviewAfterMilestone(), 1200);
    } catch {
      setState("error");
    }
  };

  // În body, nu în card: un părinte animat (transform) ar muta foaia fixă în afara ecranului.
  return createPortal(
    <div className="bf-modal-backdrop bf-month-share-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="bf-modal bf-month-share" role="dialog" aria-modal="true" aria-labelledby="bf-month-share-title">
        <header>
          <div>
            <p className="bf-kicker">{t("IMAGINEA LUNII")}</p>
            <h2 id="bf-month-share-title">{report.title}</h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}><X size={18} /></button>
        </header>
        <div className="bf-month-share-preview">
          {preview ? <img src={preview.url} alt={t("Imaginea lunii {month}, gata de trimis", { month: report.title })} /> : <span><ImageIcon size={28} aria-hidden="true" /> {t("Desenăm imaginea…")}</span>}
        </div>
        <label className="bf-month-share-toggle">
          <input type="checkbox" checked={showAmounts} onChange={(event) => setShowAmounts(event.target.checked)} />
          <span><b>{t("Arată sumele")}</b><small>{showAmounts ? t("Se văd lei. Bun pentru familie, nu pentru povești publice.") : t("Doar procente: nimeni nu vede cât câștigați.")}</small></span>
        </label>
        <button type="button" className="bf-primary bf-month-share-send" disabled={!preview || state === "working"} onClick={() => void send()}>
          <Share2 size={16} /> {state === "working" ? t("Pregătim…") : state === "shared" ? t("Trimis") : state === "saved" ? t("Salvată în descărcări") : t("Trimite imaginea")}
        </button>
        {state === "error" && <p className="bf-form-error">{t("Imaginea nu s-a putut face pe acest telefon. Trimite raportul ca text.")}</p>}
        <p className="bf-helper">{t("Imaginea se face pe telefon și pleacă doar unde alegi tu.")}</p>
      </section>
    </div>,
    document.body,
  );
}
