/** Ecran de blocare locală: se afișează la deschidere și după ce aplicația a stat ascunsă un timp. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Delete, LockKeyhole } from "lucide-react";
import { APP_LOCK_BACKGROUND_RELOCK_MS, hasAppLockPin, isAppLockEnabled, verifyAppLockPin } from "@/lib/app-lock";

const PIN_LENGTH = 4;
const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function AppLockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => isAppLockEnabled() && hasAppLockPin());
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt && Date.now() - hiddenAt >= APP_LOCK_BACKGROUND_RELOCK_MS && isAppLockEnabled() && hasAppLockPin()) {
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (pin.length < PIN_LENGTH) return;
    let active = true;
    setBusy(true);
    void verifyAppLockPin(pin).then((ok) => {
      if (!active) return;
      setBusy(false);
      if (ok) {
        setLocked(false);
        setPin("");
        setError("");
      } else {
        setPin("");
        setError("PIN greșit.");
      }
    });
    return () => {
      active = false;
    };
  }, [pin]);

  if (!locked) return <>{children}</>;

  const press = (key: string) => {
    if (busy) return;
    if (key === "⌫") return setPin((current) => current.slice(0, -1));
    if (pin.length >= PIN_LENGTH) return;
    setError("");
    setPin((current) => current + key);
  };

  return (
    <div className="bf-app-lock" role="dialog" aria-modal="true" aria-label="Aplicație blocată">
      <LockKeyhole size={26} aria-hidden="true" />
      <h1>Introdu PIN-ul</h1>
      <p className="bf-app-lock-hint">Registrul familiei rămâne blocat până la PIN-ul corect.</p>
      <div className="bf-app-lock-dots" aria-hidden="true">
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <span key={index} className={index < pin.length ? "filled" : ""} />
        ))}
      </div>
      {error && <p className="bf-app-lock-error" role="alert">{error}</p>}
      <div className="bf-app-lock-pad">
        {PAD_KEYS.map((key, index) =>
          key === "" ? (
            <span key={index} aria-hidden="true" />
          ) : key === "⌫" ? (
            <button key={index} type="button" aria-label="Șterge o cifră" onClick={() => press(key)}>
              <Delete size={18} />
            </button>
          ) : (
            <button key={index} type="button" disabled={busy} onClick={() => press(key)}>
              {key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
