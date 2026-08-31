import { Sparkles } from "lucide-react";

const included = [
  "Plicuri până la următorul venit, pe membru și pe sursă (card, cash, bonuri)",
  "Sincronizare de familie criptată AES-GCM, fără cont",
  "Bilanțul săptămânii: planificat vs realizat pe plic, de trimis familiei",
  "Recapitulare lunară, vârstă a banilor, vânător de abonamente",
  "PDF de bilanț, CSV, OCR local pe bonuri, asistent explicabil",
];

const later = [
  "Abonament Play Billing — îl activăm separat, după listare",
  "Funcții de familie avansate plătite vor rămâne cele pe care le folosești deja; nu le blocăm acum",
];

export function PremiumStudio() {
  return (
    <section className="bf-premium-catalog">
      <p className="bf-kicker">VALOARE PREMIUM · DEJA INCLUSĂ</p>
      <h2>Ce merită plătit, când va exista abonament</h2>
      <p>Nu cerem bani acum. Tot ce construim pentru abonați este deblocat, ca să-l poți testa pe bune înainte de Play Billing.</p>
      <ul>{included.map((item) => <li key={item}><Sparkles size={14} /> {item}</li>)}</ul>
      <small className="bf-helper">{later[0]}. {later[1]}.</small>
    </section>
  );
}
