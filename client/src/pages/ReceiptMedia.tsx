/** Miniatura bonului. Scos din home-secondary. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ReceiptText, X } from "lucide-react";
import { type Receipt } from "@/lib/finance-data";
import { acquireReceiptObjectUrl, acquireReceiptPreviewUrl, releaseReceiptObjectUrl } from "@/lib/receipt-storage";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { t } from "@/lib/i18n";

export function ReceiptThumbnail({ receipt }: { receipt: Receipt }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | undefined>();
  const photoCount = receipt.imageKeys?.length || (receipt.imageData2 ? 2 : receipt.imageData ? 1 : 0);
  const hasPhoto = photoCount > 0;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver !== "function") { setVisible(true); return; }
    let leaveTimer: number | undefined;
    const observer = new IntersectionObserver((entries) => {
      const onScreen = entries.some((entry) => entry.isIntersecting);
      if (onScreen) {
        if (leaveTimer) window.clearTimeout(leaveTimer);
        setVisible(true);
        return;
      }
      leaveTimer = window.setTimeout(() => setVisible(false), 480);
    }, { rootMargin: "180px 0px" });
    observer.observe(node);
    return () => { observer.disconnect(); if (leaveTimer) window.clearTimeout(leaveTimer); };
  }, []);
  useEffect(() => {
    if (!visible) { setUrl(undefined); return; }
    if (receipt.imageData) { setUrl(receipt.imageData); return; }
    const key = receipt.imageKeys?.[0];
    if (!key) { setUrl(undefined); return; }
    let active = true;
    let cacheKey: string | undefined;
    void acquireReceiptPreviewUrl(key).then((next) => {
      if (!active) { if (next) releaseReceiptObjectUrl(next.cacheKey); return; }
      cacheKey = next?.cacheKey;
      setUrl(next?.url);
    }).catch(() => { if (active) setUrl(undefined); });
    return () => { active = false; releaseReceiptObjectUrl(cacheKey); setUrl(undefined); };
  }, [visible, receipt.imageData, receipt.imageKeys?.[0]]);
  return (
    <>
      <span ref={ref} className="bf-receipt-thumb">
        <button type="button" disabled={!hasPhoto} aria-label={hasPhoto ? `Deschide fotografia bonului ${receipt.vendor}` : undefined} onClick={() => { if (hasPhoto) setOpen(true); }}>
          {url ? <img src={url} alt="" width={54} height={54} sizes="54px" loading="lazy" decoding="async" fetchPriority="low" /> : <span className="bf-receipt-icon"><ReceiptText size={21} /></span>}
          {photoCount > 1 ? <i className="bf-receipt-count">{photoCount}</i> : null}
        </button>
      </span>
      {open ? <ReceiptPhotoViewer receipt={receipt} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function receiptPhotoSources(receipt: Receipt): Array<{ id: string; key?: string; dataUrl?: string }> {
  if (receipt.imageKeys?.length) return receipt.imageKeys.map((key) => ({ id: key, key }));
  return [receipt.imageData, receipt.imageData2].filter((image): image is string => Boolean(image)).map((dataUrl, index) => ({ id: `inline-${index}`, dataUrl }));
}

function ReceiptPhotoViewer({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const sources = receiptPhotoSources(receipt);
  const [index, setIndex] = useState(0);
  const [url, setUrl] = useState<string | undefined>();
  const current = sources[index];
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  useEffect(() => {
    if (!current) { setUrl(undefined); return; }
    if (current.dataUrl) { setUrl(current.dataUrl); return; }
    if (!current.key) { setUrl(undefined); return; }
    let active = true;
    let cacheKey: string | undefined;
    void acquireReceiptObjectUrl(current.key).then((next) => {
      if (!active) { if (next) releaseReceiptObjectUrl(current.key); return; }
      if (next) cacheKey = current.key;
      setUrl(next);
    }).catch(() => { if (active) setUrl(undefined); });
    return () => { active = false; releaseReceiptObjectUrl(cacheKey); setUrl(undefined); };
  }, [current?.id, current?.key, current?.dataUrl]);
  if (!current) return null;
  return createPortal(
    <div className="bf-modal-backdrop bf-receipt-photo-sheet" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} tabIndex={-1} className="bf-receipt-photo-card" role="dialog" aria-modal="true" aria-label={`Fotografie bon ${receipt.vendor}`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="bf-kicker">{t("BON LOCAL")}</p>
            <h2>{receipt.vendor}</h2>
          </div>
          <button className="bf-icon-button" aria-label={t("Închide fotografia")} onClick={onClose}><X size={19} /></button>
        </header>
        <div className="bf-receipt-photo-frame">
          {url ? <img src={url} alt={`Bon ${receipt.vendor}, partea ${index + 1}`} decoding="async" /> : <span>{t("Pregătim fotografia…")}</span>}
        </div>
        {sources.length > 1 ? (
          <div className="bf-receipt-photo-switch" role="tablist" aria-label={t("Părțile bonului")}>
            <button type="button" disabled={index === 0} aria-label={t("Partea anterioară")} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ChevronLeft size={17} /></button>
            {sources.map((source, photoIndex) => (
              <button key={source.id} type="button" role="tab" aria-selected={photoIndex === index} className={photoIndex === index ? "active" : ""} onClick={() => setIndex(photoIndex)}>Partea {photoIndex + 1}</button>
            ))}
            <button type="button" disabled={index === sources.length - 1} aria-label={t("Partea următoare")} onClick={() => setIndex((value) => Math.min(sources.length - 1, value + 1))}><ChevronRight size={17} /></button>
          </div>
        ) : null}
        <p>{t("Fotografia rămâne pe telefon. Nu este trimisă în sincronizarea familiei.")}</p>
      </section>
    </div>,
    document.body,
  );
}
