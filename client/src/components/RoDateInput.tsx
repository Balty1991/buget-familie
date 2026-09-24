import { useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from "react";
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
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
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

/** zz.ll.aaaa pe ecran, yyyy-mm-dd în date. Nu depinde de limba telefonului. */
export function RoDateInput({ value = "", min, onChange, onBlur, placeholder, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  /** Data scrisă nu se poate citi: o lăsăm pe ecran și spunem de ce, în loc s-o ștergem tăcut. */
  const [invalid, setInvalid] = useState(false);
  const shown = draft ?? isoToRo(String(value || ""));
  const emit = (event: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>, iso: string) => {
    onChange?.({ ...event, target: { ...event.target, value: iso }, currentTarget: { ...event.currentTarget, value: iso } } as ChangeEvent<HTMLInputElement>);
  };
  return (
    <>
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      lang="ro"
      placeholder={placeholder || "zz.ll.aaaa"}
      value={shown}
      aria-invalid={invalid || undefined}
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
    {invalid && <small className="bf-form-error" role="alert">{min && roToIso(draft ?? "") ? t("Data trebuie să fie după {date}.", { date: isoToRo(String(min)) }) : t("Data nu e bună. Scrie-o ca zz.ll.aaaa, de exemplu 10.10.2026.")}</small>}
    </>
  );
}
