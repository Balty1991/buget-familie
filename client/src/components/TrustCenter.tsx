import { ExternalLink, ShieldCheck } from "lucide-react";
import { APP_SUPPORT_EMAIL, APP_VERSION, publicLegalUrl } from "@/lib/app-version";

export function TrustCenter() {
  const privacy = publicLegalUrl("privacy.html");
  const terms = publicLegalUrl("terms.html");
  const deletion = publicLegalUrl("delete-data.html");
  return (
    <section className="bf-trust">
      <p className="bf-kicker">ÎNCREDERE ȘI CONFIDENȚIALITATE</p>
      <h2>Ce face aplicația cu datele tale</h2>
      <p>Buget Familie este un registru local. Nu avem conturi de utilizator, nu cerem login bancar și nu vindem date.</p>
      <ul>
        <li><b>Pe telefon:</b> mișcări, plicuri, datorii, economii, poze de bonuri, teme și alerte.</li>
        <li><b>Opțional, criptat:</b> un pachet AES-GCM într-o cameră Firebase derivată din parola familiei. Serverul nu vede lei, nume sau parole în clar.</li>
        <li><b>Nu sincronizăm:</b> fotografiile bonurilor, șabloanele rapide, filtrele, tema și istoricul de sincronizare al acestui dispozitiv.</li>
        <li><b>Fără cont de șters:</b> nu există cont Play/Google al aplicației. Resetarea din Setări golește doar acest telefon. O copie din cameră rămâne până schimbați parola de familie.</li>
      </ul>
      <p>Permisiuni Android: internet (sincronizare opțională), notificări locale, alarmă exactă pentru reamintiri, pornire după restart. Camera se folosește doar prin selectorul de sistem, pentru bonuri.</p>
      <div className="bf-trust-links">
        <a href={privacy} target="_blank" rel="noreferrer"><ShieldCheck size={15} /> Politică de confidențialitate <ExternalLink size={13} /></a>
        <a href={terms} target="_blank" rel="noreferrer">Termeni de utilizare <ExternalLink size={13} /></a>
        <a href={deletion} target="_blank" rel="noreferrer">Cum ștergi datele <ExternalLink size={13} /></a>
        <a href={`mailto:${APP_SUPPORT_EMAIL}`}>Suport · {APP_SUPPORT_EMAIL}</a>
      </div>
      <small className="bf-helper">Versiune {APP_VERSION} · pachet ro.balty1991.bugetfamilie. Asistentul este local, pe reguli, nu un model de limbaj.</small>
    </section>
  );
}
