/**
 * În Setări: „Telefonul acesta e al…” pornește ecranul unic pentru copil sau bunic.
 * Adultul alege un cod de ieșire de 4 cifre; fără el, telefonul nu mai arată bugetul familiei.
 */
import { useState } from "react";
import type { AppData } from "@/lib/finance-data";
import { genitiveName, rememberPreviousSelf, setMemberModePin, writeMemberMode } from "@/lib/member-mode";
import { t } from "@/lib/i18n";

export function MemberModeSetup({ data }: { data: AppData }) {
  const members = data.settings.members;
  const [memberId, setMemberId] = useState(members.find((item) => item.id !== data.settings.selfMemberId)?.id || members[0]?.id || "");
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (members.length < 2) return null;
  const name = members.find((item) => item.id === memberId)?.name || "";
  const start = async () => {
    if (!/^\d{4}$/.test(pin)) return setError(t("Alege un cod de 4 cifre pentru ieșire."));
    if (pin !== again) return setError(t("Codurile nu sunt la fel."));
    setBusy(true);
    try {
      await setMemberModePin(pin);
      rememberPreviousSelf(data.settings.selfMemberId);
      // Cheltuielile notate de pe telefonul acesta sunt ale persoanei.
      window.dispatchEvent(new CustomEvent("buget-familie:local-settings", { detail: { selfMemberId: memberId } }));
      writeMemberMode(memberId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Nu am putut porni modul."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="bf-member-mode-setup" aria-labelledby="bf-member-mode-setup-title">
      <p className="bf-kicker">{t("COPIL SAU BUNIC")}</p>
      <h2 id="bf-member-mode-setup-title">{t("Telefonul unui membru al familiei")}</h2>
      <p>{t("Un singur ecran, cu text mare: cât are azi persoana din plicurile ei (de exemplu „Bani de buzunar”) și un buton de notat. Nu se văd restul bugetului, sincronizarea sau copiile de siguranță. Ieșirea cere codul ales acum.")}</p>
      <label className="bf-field"><span>{t("Telefonul acesta e al")}</span>
        <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
          {members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <div className="bf-member-mode-pins">
        <label className="bf-field"><span>{t("Cod de ieșire (4 cifre)")}</span><input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} /></label>
        <label className="bf-field"><span>{t("Încă o dată")}</span><input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={again} onChange={(event) => { setAgain(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} /></label>
      </div>
      {error && <p className="bf-form-error" role="alert">{error}</p>}
      <button type="button" className="bf-secondary" disabled={busy} onClick={() => void start()}>{t("Pornește: Telefonul {name}", { name: genitiveName(name) })}</button>
    </section>
  );
}
