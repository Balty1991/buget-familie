/** În Setări: copia săptămânală pornită sau oprită, și când s-a făcut ultima. */
import { useAutoBackupPrefs } from "@/components/AutoBackupCard";
import { writeAutoBackup } from "@/lib/auto-backup";
import { isNativeApp } from "@/lib/app-storage";
import { formatDate } from "@/lib/finance-data";
import { t } from "@/lib/i18n";

export function AutoBackupToggle() {
  const prefs = useAutoBackupPrefs();
  return (
    <label className="bf-auto-backup-toggle">
      <input type="checkbox" checked={prefs.enabled} onChange={(event) => writeAutoBackup({ enabled: event.target.checked, asked: true })} />
      <span>
        <b>{t("Copie automată o dată pe săptămână")}</b>
        <small>{isNativeApp() ? t("Se scrie singură în Descărcări, pe telefonul acesta.") : t("În browser vine ca reamintire pe Astăzi.")}{prefs.lastAt ? ` ${t("Ultima: {date}.", { date: formatDate(prefs.lastAt.slice(0, 10), { day: "numeric", month: "long" }) })}` : ""}</small>
      </span>
    </label>
  );
}
