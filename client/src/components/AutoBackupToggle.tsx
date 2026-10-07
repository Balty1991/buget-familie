/** În Setări: copia săptămânală pornită sau oprită, și când s-a făcut ultima. */
import { useAutoBackupPrefs } from "@/components/AutoBackupCard";
import { writeAutoBackup } from "@/lib/auto-backup";
import { isNativeApp, LIVE_BACKUP_NAME } from "@/lib/app-storage";
import { formatDate } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";

export function AutoBackupToggle() {
  const prefs = useAutoBackupPrefs();
  const native = isNativeApp();
  return (
    <>
    <label className="bf-auto-backup-toggle">
      <input type="checkbox" checked={Boolean(prefs.live)} disabled={!native} onChange={(event) => writeAutoBackup({ live: event.target.checked, asked: true, liveError: undefined })} />
      <span>
        <b>{t("Salvare automată la fiecare modificare")}</b>
        <small>{native
          ? t("Fișierul {file} din Documente/Buget Familie se rescrie singur la câteva secunde după fiecare schimbare. Îl imporți oricând din Backup.", { file: LIVE_BACKUP_NAME })
          : t("Doar în aplicația de pe telefon: browserul nu poate scrie singur fișiere.")}
          {prefs.live && prefs.liveAt ? ` ${t("Ultima salvare: {time}.", { time: new Date(prefs.liveAt).toLocaleString(getLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}` : ""}
          {prefs.live && prefs.liveError ? <em className="bf-form-error" style={{ display: "block" }}>{t("N-a mers ultima salvare: {reason}", { reason: prefs.liveError })}</em> : null}
        </small>
      </span>
    </label>
    <label className="bf-auto-backup-toggle">
      <input type="checkbox" checked={prefs.enabled} onChange={(event) => writeAutoBackup({ enabled: event.target.checked, asked: true })} />
      <span>
        <b>{t("Copie automată o dată pe săptămână")}</b>
        <small>{isNativeApp() ? t("Se scrie singură în Descărcări, pe telefonul acesta.") : t("În browser vine ca reamintire pe Astăzi.")}{prefs.lastAt ? ` ${t("Ultima: {date}.", { date: formatDate(prefs.lastAt.slice(0, 10), { day: "numeric", month: "long" }) })}` : ""}</small>
      </span>
    </label>
    </>
  );
}
