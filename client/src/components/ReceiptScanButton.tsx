import "../receipt-scan.css";
import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import type { AppData } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { askConfirm } from "@/lib/confirm-dialog";
import { canScanReceipt } from "@/lib/entitlements";
import { isOfflineOnly } from "@/lib/ui-prefs";
import { compressReceiptPhoto, receiptCategories, receiptScanConsented, rememberReceiptScanConsent, requestReceiptScan, scanToPrefill, type ScanPrefill } from "@/lib/receipt-scan";

/**
 * „Scanează bonul”: poza → articolele pe categorii, în formular. Poza pleacă la
 * Google Gemini doar ca să fie citită; nu o păstrăm nici pe telefon, nici pe server.
 */
export function ReceiptScanButton({ data, memberId, onResult }: { data: AppData; memberId?: string; onResult: (prefill: ScanPrefill) => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!canScanReceipt() || isOfflineOnly()) return null;

  const pick = async (which: "camera" | "gallery") => {
    if (busy) return;
    if (!receiptScanConsented()) {
      const ok = await askConfirm(t("Ca să citească bonul, poza pleacă la Google Gemini, care scoate din ea produsele și sumele. Poza nu se păstrează: nici pe telefon, nici pe serverul nostru. Restul bugetului rămâne pe telefon."), { title: t("Scanarea bonului"), confirmLabel: t("Am înțeles, scanez") });
      if (!ok) return;
      rememberReceiptScanConsent();
    }
    setError("");
    (which === "camera" ? cameraRef : galleryRef).current?.click();
  };

  const read = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const image = await compressReceiptPhoto(file);
      const receipt = await requestReceiptScan(image, receiptCategories(data));
      onResult(scanToPrefill(receipt, data, memberId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Nu am putut citi bonul acum. Mai încearcă o dată."));
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  return <section className="bf-scan-receipt" aria-busy={busy}>
    {busy ? <p className="bf-scan-receipt-busy" role="status"><Loader2 size={18} className="bf-spin" aria-hidden="true" /> {t("Citesc bonul… durează câteva secunde.")}</p> : <div className="bf-scan-receipt-actions">
      <button type="button" className="bf-scan-receipt-main" onClick={() => void pick("camera")}><Camera size={18} aria-hidden="true" /><span><b>{t("Scanează bonul")}</b><small>{t("Toate produsele, pe categorii")}</small></span></button>
      <button type="button" className="bf-scan-receipt-gallery" aria-label={t("Alege poza bonului din galerie")} onClick={() => void pick("gallery")}><ImagePlus size={18} aria-hidden="true" /></button>
    </div>}
    {error && <p className="bf-form-error" role="alert">{error}</p>}
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => void read(event.target.files?.[0])} />
    <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(event) => void read(event.target.files?.[0])} />
  </section>;
}
