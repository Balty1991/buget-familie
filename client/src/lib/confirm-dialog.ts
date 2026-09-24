/**
 * Întrebări și mesaje în dialogul aplicației, nu în fereastra nativă `window.confirm`,
 * care arăta altfel decât restul aplicației (testare cu utilizatori, problema medie #11).
 * `ConfirmHost` le afișează; fără el (teste, înainte de montare) folosim fereastra nativă.
 */

export type ConfirmRequest = {
  id: number;
  message: string;
  title?: string;
  confirmLabel?: string;
  /** Acțiunea șterge sau oprește ceva: butonul de confirmare e roșu, „Anulează” rămâne principal. */
  danger?: boolean;
  /** Doar un mesaj, cu un singur buton „Am înțeles”. */
  notice?: boolean;
  resolve: (value: boolean) => void;
};

type Listener = (request: ConfirmRequest) => void;
let listener: Listener | undefined;
let counter = 0;

export function subscribeConfirm(next: Listener) {
  listener = next;
  return () => {
    if (listener === next) listener = undefined;
  };
}

const fallback = (message: string, notice: boolean) => {
  if (typeof window === "undefined") return true;
  if (notice) {
    window.alert?.(message);
    return true;
  }
  return typeof window.confirm === "function" ? window.confirm(message) : true;
};

export function askConfirm(message: string, options: { title?: string; confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  if (!listener) return Promise.resolve(fallback(message, false));
  const active = listener;
  // Ștergerile și opririle au butonul de confirmare roșu, fără să-l ceară fiecare ecran.
  const danger = options.danger ?? /^(Ștergi|Oprești|Dezactivezi|Anulezi|Ieși|Delete|Stop|Turn off|Undo|Leave|Remove)/i.test(message.trim());
  return new Promise((resolve) => active({ id: ++counter, message, ...options, danger, resolve }));
}

export function showNotice(message: string, title?: string): Promise<void> {
  if (!listener) {
    fallback(message, true);
    return Promise.resolve();
  }
  const active = listener;
  return new Promise((resolve) => active({ id: ++counter, message, title, notice: true, resolve: () => resolve() }));
}
