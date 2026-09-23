import { useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from "react";

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

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

/** zz.ll.aaaa pe ecran, yyyy-mm-dd în date. Nu depinde de limba telefonului. */
export function RoDateInput({ value = "", min, onChange, onBlur, placeholder, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? isoToRo(String(value || ""));
  const emit = (event: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>, iso: string) => {
    onChange?.({ ...event, target: { ...event.target, value: iso }, currentTarget: { ...event.currentTarget, value: iso } } as ChangeEvent<HTMLInputElement>);
  };
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      lang="ro"
      placeholder={placeholder || "zz.ll.aaaa"}
      value={shown}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        const iso = roToIso(next);
        if (!iso || (min && iso < String(min)) || iso === value) return;
        emit(event, iso);
      }}
      onBlur={(event) => {
        const iso = roToIso(draft ?? shown);
        if (iso && (!min || iso >= String(min)) && iso !== value) emit(event, iso);
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
