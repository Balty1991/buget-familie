/**
 * Rândul de la finalul a tot ce se trimite pe WhatsApp (bilanț, raport, imaginea lunii, obiectiv atins).
 * Fiecare mesaj trimis e o recomandare: spune limpede ce e aplicația (nu una de plăți) și unde se găsește.
 */
import { PUBLIC_SITE_URL } from "./family-invite";
import { t } from "./i18n";

export const SHARE_LINK = `${PUBLIC_SITE_URL}despre.html`;

export function withShareSignature(text: string): string {
  if (text.includes(SHARE_LINK)) return text;
  return `${text}\n\n— ${t("Notat în Buget Familie, caietul de buget al casei. Nu e aplicație de plăți și nu cere date bancare.")}\n${SHARE_LINK}`;
}
