/** În Setări: „Telefonul acesta e al lui X” — pornește ecranul unic pentru copil sau bunic. */
import { useState } from "react";
import type { AppData } from "@/lib/finance-data";
import { askConfirm } from "@/lib/confirm-dialog";
import { writeMemberMode } from "@/lib/member-mode";
import { t } from "@/lib/i18n";

export function MemberModeSetup({ data }: { data: AppData }) {
  const members = data.settings.members;
  const [memberId, setMemberId] = useState(members.find((item) => item.id !== data.settings.selfMemberId)?.id || members[0]?.id || "");
  if (members.length < 2) return null;
  const start = async () => {
    const name = members.find((item) => item.id === memberId)?.name || "";
    if (!memberId || !await askConfirm(t("Pornești „Telefonul lui {name}”? Pe telefonul acesta se va vedea doar cât are {name} azi și butonul „Notează”. Ieșirea se face de jos, cu confirmare.", { name }), { confirmLabel: t("Pornește") })) return;
    // Cheltuielile notate de pe telefonul acesta sunt ale lui.
    window.dispatchEvent(new CustomEvent("buget-familie:local-settings", { detail: { selfMemberId: memberId } }));
    writeMemberMode(memberId);
  };
  return (
    <section className="bf-member-mode-setup" aria-labelledby="bf-member-mode-setup-title">
      <p className="bf-kicker">{t("COPIL SAU BUNIC")}</p>
      <h2 id="bf-member-mode-setup-title">{t("Telefonul unui membru al familiei")}</h2>
      <p>{t("Un singur ecran, cu text mare: cât are azi persoana aceea (din plicurile ei, dacă are, de exemplu „Bani de buzunar”) și „Notează”. Fără restul bugetului.")}</p>
      <label className="bf-field"><span>{t("Telefonul acesta e al lui")}</span>
        <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
          {members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <button type="button" className="bf-secondary" onClick={() => void start()}>{t("Pornește ecranul simplu")}</button>
    </section>
  );
}
