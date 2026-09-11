import { Sparkles } from "lucide-react";
import { t } from "@/lib/i18n";

const included = [
  t("Plicuri până la următorul venit, pe membru și pe sursă (card, cash, bonuri)"),
  t("Sincronizare de familie criptată AES-GCM, fără cont"),
  t("Bilanțul săptămânii: planificat vs realizat pe plic, de trimis familiei"),
  t("Recapitulare lunară, vârstă a banilor, vânător de abonamente"),
  t("PDF de bilanț, CSV, OCR local pe bonuri, asistent explicabil"),
];

const later = [
  t("Abonament Play Billing — îl activăm separat, după listare"),
  t("Funcții de familie avansate plătite vor rămâne cele pe care le folosești deja; nu le blocăm acum"),
];

export function PremiumStudio() {
  return (
    <section className="bf-premium-catalog">
      <p className="bf-kicker">{t("VALOARE PREMIUM · DEJA INCLUSĂ")}</p>
      <h2>{t("Ce merită plătit, când va exista abonament")}</h2>
      <p>{t("Nu cerem bani acum. Tot ce construim pentru abonați este deblocat, ca să-l poți testa pe bune înainte de Play Billing.")}</p>
      <ul>{included.map((item) => <li key={item}><Sparkles size={14} /> {item}</li>)}</ul>
      <small className="bf-helper">{later[0]}. {later[1]}.</small>
    </section>
  );
}
