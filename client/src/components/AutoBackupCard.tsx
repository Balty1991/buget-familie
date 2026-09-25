/**
 * Pe Astăzi: întrebarea o singură dată („pun o copie săptămânală?”) și, în browser sau când
 * scrierea automată n-a mers, reamintirea cu un buton. Pe telefon, copia merge singură.
 */
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { downloadBackup, isNativeApp, saveBackupSilently } from "@/lib/app-storage";
import { autoBackupDue, autoBackupName, autoBackupWorthAsking, readAutoBackup, writeAutoBackup, type AutoBackupPrefs } from "@/lib/auto-backup";
import type { AppData } from "@/lib/finance-data";
import { t } from "@/lib/i18n";

export function useAutoBackupPrefs() {
  const [prefs, setPrefs] = useState<AutoBackupPrefs>(() => readAutoBackup());
  useEffect(() => {
    const onChange = (event: Event) => setPrefs((event as CustomEvent<AutoBackupPrefs>).detail || readAutoBackup());
    window.addEventListener("buget-familie:auto-backup", onChange);
    return () => window.removeEventListener("buget-familie:auto-backup", onChange);
  }, []);
  return prefs;
}

/** Dacă se poate afișa ceva azi; aceeași regulă ca în card, ca Astăzi să știe dacă e gol. */
export const autoBackupCardVisible = (prefs: AutoBackupPrefs, data: AppData) =>
  autoBackupWorthAsking(prefs, data.transactions.length) || (autoBackupDue(prefs) && (!isNativeApp() || Boolean(prefs.lastError)));

let running = false;

export async function runAutoBackupIfDue(data: AppData) {
  const prefs = readAutoBackup();
  // Nu de două ori deodată: fiecare schimbare a datelor verifică, dar doar una scrie.
  if (running || !autoBackupDue(prefs) || !isNativeApp() || !data.transactions.length) return;
  running = true;
  try {
    const path = await saveBackupSilently(data, autoBackupName());
    writeAutoBackup({ lastAt: new Date().toISOString(), lastPath: path, lastError: undefined });
  } catch (error) {
    writeAutoBackup({ lastError: error instanceof Error ? error.message : "eroare" });
  } finally {
    running = false;
  }
}

export function AutoBackupCard({ data }: { data: AppData }) {
  const prefs = useAutoBackupPrefs();
  const [busy, setBusy] = useState(false);
  const native = isNativeApp();
  if (!autoBackupCardVisible(prefs, data)) return null;
  const saveNow = async () => {
    setBusy(true);
    const result = await downloadBackup(data, "save");
    setBusy(false);
    if (result.how === "saved" || result.how === "downloaded" || result.how === "shared") writeAutoBackup({ lastAt: new Date().toISOString(), lastPath: result.how === "saved" ? result.path : undefined, lastError: undefined });
  };
  if (autoBackupWorthAsking(prefs, data.transactions.length)) {
    return (
      <section className="bf-income-split bf-auto-backup" aria-labelledby="auto-backup-title">
        <header>
          <ShieldCheck size={19} aria-hidden="true" />
          <div>
            <p className="bf-kicker">{t("COPIE DE SIGURANȚĂ")}</p>
            <h3 id="auto-backup-title">{t("Păstrez o copie săptămânală?")}</h3>
            <p>{native
              ? t("O dată pe săptămână pun un fișier cu datele în Descărcări. Dacă se strică telefonul, îl încarci din Setări → „Alege backup”. Fișierul are sumele în clar: nu-l trimite nimănui.")
              : t("În browser nu pot salva singur: o dată pe săptămână îți amintesc să descarci copia. Dacă pierzi datele, o încarci din Setări → „Alege backup”.")}</p>
          </div>
        </header>
        <footer>
          <div>
            <button type="button" className="bf-secondary" onClick={() => writeAutoBackup({ asked: true, enabled: false })}>{t("Nu, mulțumesc")}</button>
            <button type="button" className="bf-primary" onClick={() => { writeAutoBackup({ asked: true, enabled: true }); if (native) void runAutoBackupIfDue(data); }}>{t("Da, săptămânal")}</button>
          </div>
        </footer>
      </section>
    );
  }
  return (
    <aside className="bf-income-split-done bf-auto-backup" role="status">
      <span>{prefs.lastError && native
        ? t("Copia automată n-a reușit săptămâna asta. Salveaz-o acum, cu o apăsare.")
        : t("E timpul pentru copia de siguranță a săptămânii.")}</span>
      <button type="button" className="bf-secondary" disabled={busy} onClick={() => void saveNow()}>{t("Salvează copia")}</button>
    </aside>
  );
}
