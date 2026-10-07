import { useRef, useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import { t } from "@/lib/i18n";

function isoToRo(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

function roToIso(text: string): string | null {
  const match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const check = new Date(`${iso}T12:00:00`);
  if (check.getFullYear() !== year || check.getMonth() + 1 !== month || check.getDate() !== day) return null;
  return iso;
}

/**
 * Pe tastatura numerică punctul e greu de găsit: „10102026” devine „10.10.2026” pe măsură
 * ce scrii. Textul cu separatori scris de mână rămâne cum e.
 */
export function formatDateDraft(text: string) {
  if (!/^\d*$/.test(text)) return text;
  const digits = text.slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

/** Un câmp de dată rămas cu o dată care nu se poate citi: formularul nu salvează data veche pe tăcute. */
export const hasInvalidRoDate = () => typeof document !== "undefined" && Boolean(document.querySelector('[data-ro-date][aria-invalid="true"]'));

/** zz.ll.aaaa pe ecran, yyyy-mm-dd în date. Nu depinde de limba telefonului. */
export function RoDateInput({ value = "", min, onChange, onBlur, placeholder, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  /** Data scrisă nu se poate citi: o lăsăm pe ecran și spunem de ce, în loc s-o ștergem tăcut. */
  const [invalid, setInvalid] = useState(false);
  /** Calendarul telefonului: un câmp de dată ascuns, deschis din butonul de lângă text. */
  const pickerRef = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try { (picker as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { picker.click(); }
  };
  const shown = draft ?? isoToRo(String(value || ""));
  const emit = (event: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>, iso: string) => {
    onChange?.({ ...event, target: { ...event.target, value: iso }, currentTarget: { ...event.currentTarget, value: iso } } as ChangeEvent<HTMLInputElement>);
  };
  return (
    <>
    <span style={{ position: "relative", display: "block" }}>
    <input
      {...rest}
      style={{ ...(rest.style || {}), paddingRight: 52 }}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      lang="ro"
      placeholder={placeholder || "zz.ll.aaaa"}
      value={shown}
      aria-invalid={invalid || undefined}
      data-ro-date=""
      onChange={(event) => {
        const next = formatDateDraft(event.target.value);
        setDraft(next);
        setInvalid(false);
        const iso = roToIso(next);
        if (!iso || (min && iso < String(min)) || iso === value) return;
        emit(event, iso);
      }}
      onBlur={(event) => {
        const text = draft ?? shown;
        const iso = roToIso(text);
        const usable = Boolean(iso && (!min || iso >= String(min)));
        if (usable && iso !== value) emit(event, iso!);
        if (usable || !text.trim()) {
          setDraft(null);
          setInvalid(false);
        } else {
          setInvalid(true);
        }
        onBlur?.(event);
      }}
    />
    <button type="button" onClick={openPicker} aria-label={t("Alege data din calendar")} disabled={rest.disabled} style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, display: "grid", placeItems: "center", border: 0, borderRadius: 12, background: "transparent", color: "var(--cf-primary-strong, #1f5240)" }}>
      <CalendarDays size={20} aria-hidden="true" />
    </button>
    <input
      ref={pickerRef}
      type="date"
      tabIndex={-1}
      aria-hidden="true"
      value={/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : ""}
      min={min}
      onChange={(event) => { const iso = event.target.value; if (!iso || iso === value) return; setDraft(null); setInvalid(false); emit(event, iso); }}
      style={{ position: "absolute", right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none", border: 0, padding: 0 }}
    />
    </span>
    {invalid && <small className="bf-form-error" role="alert">{min && roToIso(draft ?? "") ? t("Data trebuie să fie după {date}.", { date: isoToRo(String(min)) }) : t("Data nu e bună. Scrie-o ca zz.ll.aaaa, de exemplu 10.10.2026.")}</small>}
    </>
  );
}
