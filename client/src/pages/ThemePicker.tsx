/** Alege tema. Scos din home-secondary. */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { automaticTheme, backgroundOptions, currentLocalMinutes, themeOptions, timeToMinutes, type BackgroundId, type ThemeId, type ThemeSchedule, type ThemeScheduleTimes } from "@/pages/home-kit";
import { t } from "@/lib/i18n";

export function ThemePicker({ theme, schedule, scheduleTimes, highContrast, background, onChange, onScheduleChange, onScheduleTimesChange, onContrastChange, onBackgroundChange, onClose }: { theme: ThemeId; schedule: ThemeSchedule; scheduleTimes: ThemeScheduleTimes; highContrast: boolean; background: BackgroundId; onChange: (theme: ThemeId) => void; onScheduleChange: (schedule: ThemeSchedule) => void; onScheduleTimesChange: (times: ThemeScheduleTimes) => void; onContrastChange: (active: boolean) => void; onBackgroundChange: (background: BackgroundId) => void; onClose: () => void }) {
  const [preview, setPreview] = useState<ThemeId>(theme);
  const [previewBackground, setPreviewBackground] = useState<BackgroundId>(background);
  const previewOption = themeOptions.find((option) => option.id === preview) || themeOptions[0];
  const scheduleIsValid = timeToMinutes(scheduleTimes.dayStart, -1) < timeToMinutes(scheduleTimes.eveningStart, -1) && timeToMinutes(scheduleTimes.eveningStart, -1) < timeToMinutes(scheduleTimes.nightStart, -1);
  const applyPreview = () => { onChange(preview); onBackgroundChange(previewBackground); onScheduleChange(schedule); onClose(); };
  const selectBackground = (id: BackgroundId) => {
    setPreviewBackground(id);
    onBackgroundChange(id);
  };
  const closeIfBackdrop = (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (event.target === event.currentTarget) onClose();
  };
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  return createPortal(
    <div className="bf-modal-backdrop bf-theme-backdrop" role="presentation" onPointerDown={closeIfBackdrop}>
      <section ref={dialogRef} tabIndex={-1} className="bf-modal bf-theme-picker" role="dialog" aria-modal="true" aria-label={t("Alege aspectul")} onPointerDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="bf-kicker">{t("ASPECTUL APLICAȚIEI")}</p>
            <h2>{t("Alege o atmosferă, nu doar o culoare.")}</h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide alegerea temei")} onClick={onClose}><X size={19} /></button>
        </header>
        <div className="bf-theme-picker-body">
        <p className="bf-theme-picker-intro">{t("Previzualizezi tema înainte de aplicare. Verdele rămâne progres, mierea înseamnă revizuire, iar coralul atrage atenția.")}</p>
        <section className={`bf-theme-preview ${preview} background-preview-${previewBackground}`} aria-label={`Previzualizare ${previewOption.name}`}>
          <div className="bf-theme-preview-top"><span>{previewOption.mood}</span><b>{previewOption.name}</b></div>
          <div className="bf-theme-preview-value"><small>{t("RĂMAS ÎN PLICURI")}</small><strong>1.480 lei</strong><i /></div>
          <div className="bf-theme-preview-stats"><span>{t("SURSE UTILIZABILE")} <b>4.830 lei</b></span><span>{t("PUS DEOPARTE")} <b>780 lei</b></span></div>
          <div className="bf-theme-preview-cta"><span>{t("Înregistrează")}</span></div>
          <div className="bf-theme-preview-nav"><i /><i /><i /><i /><i /></div>
        </section>
        <p className="bf-theme-preview-note">{t("Tema se aplică din butonul de jos. Textura suprafeței se schimbă imediat, la atingere.")}</p>
        <div className="bf-theme-grid">
          {themeOptions.map((option) => (
            <button key={option.id} type="button" className={`bf-theme-option ${option.id} ${preview === option.id ? "selected" : ""}`} aria-pressed={preview === option.id} onClick={() => setPreview(option.id)}>
              <span className="bf-theme-swatch" aria-hidden="true"><span /></span>
              <span><em>{option.mood}</em><b>{option.name}</b><small>{option.detail}</small></span>
              <i>{preview === option.id && <Check size={14} />}</i>
            </button>
          ))}
        </div>
        <section className="bf-background-preferences" aria-labelledby="bf-background-title">
          <div>
            <p className="bf-kicker">{t("FUNDAL")}</p>
            <h3 id="bf-background-title">{t("Alege textura suprafeței")}</h3>
            <p>{t("Atinge o dală — se aplică imediat, cu inel și bifă, fără să atingă cifrele.")}</p>
          </div>
          <div className="bf-background-grid" role="listbox" aria-label={t("Textura suprafeței")}>
            {backgroundOptions.map((option) => {
              const selected = previewBackground === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  className={selected ? "selected" : ""}
                  aria-pressed={selected}
                  aria-selected={selected}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    selectBackground(option.id);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectBackground(option.id);
                  }}
                >
                  <span className={`bf-background-swatch ${option.id}`} aria-hidden="true" />
                  <span className="bf-background-copy">
                    <b>{option.name}</b>
                    <small>{option.detail}</small>
                  </span>
                  {selected ? <i aria-hidden="true"><Check size={12} /></i> : null}
                </button>
              );
            })}
          </div>
        </section>
        <section className="bf-theme-preferences" aria-label={t("Preferințe temă")}>
          <button type="button" className={schedule === "auto" ? "active" : ""} role="switch" aria-checked={schedule === "auto"} onClick={() => onScheduleChange(schedule === "auto" ? "manual" : "auto")}>
            <span>
              <b>{t("Comută automat zi/noapte")}</b>
              <small>{schedule === "auto" ? `Activ acum: ${themeOptions.find((item) => item.id === automaticTheme(currentLocalMinutes(), scheduleTimes))?.name || "tema automată"}. Zi ${scheduleTimes.dayStart}–${scheduleTimes.eveningStart} · seară ${scheduleTimes.eveningStart}–${scheduleTimes.nightStart} · noapte ${scheduleTimes.nightStart}–${scheduleTimes.dayStart}.` : t("Folosește Alb ziua, Cyber Teal seara și Întunecat noaptea.")}</small>
            </span>
            <i aria-hidden="true" />
          </button>
          <div className="bf-theme-schedule-fields" aria-label="Intervale automate">
            <label><span>{t("Ziua începe")}</span><input type="time" value={scheduleTimes.dayStart} onChange={(event) => onScheduleTimesChange({ ...scheduleTimes, dayStart: event.target.value })} /></label>
            <label><span>{t("Seara începe")}</span><input type="time" value={scheduleTimes.eveningStart} onChange={(event) => onScheduleTimesChange({ ...scheduleTimes, eveningStart: event.target.value })} /></label>
            <label><span>{t("Noaptea începe")}</span><input type="time" value={scheduleTimes.nightStart} onChange={(event) => onScheduleTimesChange({ ...scheduleTimes, nightStart: event.target.value })} /></label>
          </div>
          {!scheduleIsValid && <small className="bf-theme-schedule-error">{t("Ordinea trebuie să fie zi → seară → noapte. Până la corectare se folosesc temporar valorile standard: 06:00, 17:00 și 21:00.")}</small>}
          <button type="button" className={highContrast ? "active" : ""} role="switch" aria-checked={highContrast} onClick={() => onContrastChange(!highContrast)}>
            <span>
              <b>{t("Contrast extra-ridicat")}</b>
              <small>{t("Contururi, texte secundare și stări active mai puternice, fără a schimba culorile banilor.")}</small>
            </span>
            <i aria-hidden="true" />
          </button>
        </section>
        </div>
        <div className="bf-theme-picker-footer">
        <button type="button" className="bf-primary bf-theme-apply" onClick={applyPreview}><Check size={17} /> {t("Aplică {name}", { name: previewOption.name })}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
