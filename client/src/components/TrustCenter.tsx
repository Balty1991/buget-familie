import { ExternalLink, ShieldCheck } from "lucide-react";
import { APP_SUPPORT_EMAIL, APP_VERSION, publicLegalUrl } from "@/lib/app-version";
import { t } from "@/lib/i18n";

export function TrustCenter() {
  const privacy = publicLegalUrl("privacy.html");
  const terms = publicLegalUrl("terms.html");
  const deletion = publicLegalUrl("delete-data.html");
  return (
    <section className="bf-trust">
      <p className="bf-kicker">{t("ÎNCREDERE ȘI CONFIDENȚIALITATE")}</p>
      <h2>{t("Ce face aplicația cu datele tale")}</h2>
      <p>{t("Buget Familie este un registru local. Nu avem conturi de utilizator, nu cerem login bancar și nu vindem date.")}</p>
      <ul>
        <li><b>{t("Pe telefon:")}</b> {t("mișcări, plicuri, datorii, economii, poze de bonuri, teme și alerte.")}</li>
        <li><b>{t("Opțional, criptat:")}</b> {t("un pachet AES-GCM într-o cameră Firebase derivată din parola familiei. Serverul nu vede lei, nume sau parole în clar.")}</li>
        <li><b>{t("Nu sincronizăm:")}</b> {t("fotografiile bonurilor, șabloanele rapide, filtrele, tema și istoricul de sincronizare al acestui dispozitiv.")}</li>
        <li><b>{t("Fără cont de șters:")}</b> nu există cont Play/Google al aplicației. Resetarea din Setări golește doar acest telefon. O copie din cameră rămâne până schimbați parola de familie.</li>
      </ul>
      <p>{t("Permisiuni Android: internet (sincronizare opțională), notificări locale, alarmă exactă pentru reamintiri, pornire după restart. Camera se folosește doar prin selectorul de sistem, pentru bonuri.")}</p>
      <div className="bf-trust-links">
        <a href={privacy} target="_blank" rel="noreferrer"><ShieldCheck size={15} /> {t("Politică de confidențialitate")} <ExternalLink size={13} /></a>
        <a href={terms} target="_blank" rel="noreferrer">{t("Termeni de utilizare")} <ExternalLink size={13} /></a>
        <a href={deletion} target="_blank" rel="noreferrer">{t("Cum ștergi datele")} <ExternalLink size={13} /></a>
        <a href={`mailto:${APP_SUPPORT_EMAIL}`}>Suport · {APP_SUPPORT_EMAIL}</a>
      </div>
      <small className="bf-helper">Versiune {APP_VERSION} · pachet ro.balty1991.bugetfamilie. Asistentul este local, pe reguli, nu un model de limbaj.</small>
    </section>
  );
}
