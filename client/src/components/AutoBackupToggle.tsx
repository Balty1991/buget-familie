/**
 * În Setări: salvarea automată, cu buton „Pornește / Oprește” și starea scrisă clar.
 * O bifă singură lăsa omul să se întrebe dacă s-a salvat ceva; acum vede „Pornită · ultima salvare …”.
 */
import { useAutoBackupPrefs } from "@/components/AutoBackupCard";
import { writeAutoBackup } from "@/lib/auto-backup";
import { isNativeApp, LIVE_BACKUP_NAME } from "@/lib/app-storage";
import { formatDate } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";

const when = (iso: string) => new Date(iso).toLocaleString(getLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Row({ title, detail, status, on, disabled, onToggle }: { title: string; detail: string; status: string; on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <div className={`bf-auto-backup-row${on ? " is-on" : ""}`}>
      <div className="bf-auto-backup-copy">
        <b>{title}</b>
        <small>{detail}</small>
        <span className="bf-auto-backup-status"><i aria-hidden="true" />{status}</span>
      </div>
      <button type="button" className={on ? "bf-secondary" : "bf-primary"} disabled={disabled} aria-pressed={on} onClick={onToggle}>{on ? t("Oprește") : t("Pornește")}</button>
    </div>
  );
}

export function AutoBackupToggle() {
  const prefs = useAutoBackupPrefs();
  const native = isNativeApp();
  const live = Boolean(prefs.live);
  return (
    <div className="bf-auto-backup">
      <p className="bf-kicker">{t("SALVARE AUTOMATĂ")}</p>
      <Row
        title={t("La fiecare modificare")}
        detail={native ? t("Fișierul {file} din Documente/Buget Familie se rescrie singur la câteva secunde după fiecare schimbare. Îl imporți oricând din Backup.", { file: LIVE_BACKUP_NAME }) : t("Doar în aplicația de pe telefon: browserul nu poate scrie singur fișiere.")}
        status={live ? (prefs.liveError ? t("Pornită, dar ultima salvare n-a mers: {reason}", { reason: prefs.liveError }) : prefs.liveAt ? t("Pornită · ultima salvare {time}", { time: when(prefs.liveAt) }) : t("Pornită · se salvează la prima modificare")) : t("Oprită")}
        on={live}
        disabled={!native}
        onToggle={() => writeAutoBackup({ live: !live, asked: true, liveError: undefined })}
      />
      <Row
        title={t("O copie pe săptămână")}
        detail={native ? t("Se scrie singură în Descărcări, pe telefonul acesta.") : t("În browser vine ca reamintire pe Astăzi.")}
        status={prefs.enabled ? (prefs.lastAt ? t("Pornită · ultima copie {date}", { date: formatDate(prefs.lastAt.slice(0, 10), { day: "numeric", month: "long" }) }) : t("Pornită")) : t("Oprită")}
        on={prefs.enabled}
        onToggle={() => writeAutoBackup({ enabled: !prefs.enabled, asked: true })}
      />
    </div>
  );
}
