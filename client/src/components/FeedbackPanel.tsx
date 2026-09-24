import { useState } from "react";
import { MessageSquareWarning, Send } from "lucide-react";
import { sendFeedback, technicalDetails, type FeedbackKind } from "@/lib/feedback";
import { t } from "@/lib/i18n";

/**
 * „Spune-ne ce nu merge” — pentru testarea închisă. Textul pleacă la echipă; detaliile tehnice
 * (versiune, ecran, telefon) doar dacă omul le lasă bifate. Nimic din registru.
 */
export function FeedbackPanel({ screen, synced }: { screen: string; synced: boolean }) {
  const [kind, setKind] = useState<FeedbackKind>("problem");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [withDetails, setWithDetails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const submit = async () => {
    if (message.trim().length < 3) {
      setStatus({ tone: "error", text: t("Scrie câteva cuvinte despre ce s-a întâmplat.") });
      return;
    }
    setBusy(true);
    const result = await sendFeedback({ kind, message: message.trim(), contact: contact.trim() || undefined, details: withDetails ? technicalDetails(screen, synced) : undefined });
    setBusy(false);
    if (result === "sent" || result === "queued") {
      setMessage("");
      setStatus({ tone: "ok", text: result === "sent" ? t("Mulțumim! Am primit mesajul.") : t("Nu e internet acum. Mesajul pleacă singur la următoarea deschidere a aplicației.") });
      return;
    }
    setStatus({ tone: "error", text: result.error || t("Mesajul nu a putut fi trimis.") });
  };

  const kinds: Array<[FeedbackKind, string]> = [["problem", t("Nu merge ceva")], ["idea", t("Am o idee")], ["other", t("Altceva")]];
  return (
    <section className="bf-feedback" aria-labelledby="bf-feedback-title">
      <p className="bf-kicker">{t("TESTARE")}</p>
      <h2 id="bf-feedback-title"><MessageSquareWarning size={18} aria-hidden="true" /> {t("Spune-ne ce nu merge")}</h2>
      <p className="bf-helper">{t("Scrie ce ai făcut și ce s-a întâmplat. Nu trimitem sume, nume sau alte date din registru.")}</p>
      <div className="bf-feedback-kinds" role="radiogroup" aria-label={t("Tipul mesajului")}>
        {kinds.map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={kind === value} className={kind === value ? "active" : ""} onClick={() => setKind(value)}>{label}</button>
        ))}
      </div>
      <label className="bf-field"><span>{t("Mesajul tău")}</span>
        <textarea value={message} onChange={(event) => { setMessage(event.target.value); setStatus(null); }} rows={4} maxLength={2000} placeholder={t("ex. Am notat 50 lei la benzină, iar pe Astăzi cifra nu s-a schimbat.")} />
      </label>
      <label className="bf-field"><span>{t("Cum te putem contacta (opțional)")}</span>
        <input value={contact} onChange={(event) => setContact(event.target.value)} maxLength={120} placeholder={t("e-mail sau telefon")} autoComplete="email" />
      </label>
      <label className="bf-feedback-details">
        <input type="checkbox" checked={withDetails} onChange={(event) => setWithDetails(event.target.checked)} />
        <span>{t("Adaugă detalii tehnice: versiunea aplicației, ecranul, tipul telefonului și tema. Ne ajută să găsim problema.")}</span>
      </label>
      <button type="button" className="bf-primary full" disabled={busy || !message.trim()} onClick={() => void submit()}><Send size={16} /> {busy ? t("Se trimite…") : t("Trimite")}</button>
      {status && <p className={status.tone === "ok" ? "bf-notice" : "bf-form-error"} role="status">{status.text}</p>}
    </section>
  );
}
