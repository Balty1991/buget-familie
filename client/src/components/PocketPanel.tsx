/**
 * Buzunarul copilului: un singur număr mare, în cuvinte simple.
 *
 * Nu arată planul salarial, plicurile familiei sau soldurile surselor — un copil are
 * nevoie să știe cât mai are și cât poate cheltui azi, nu cum e construit bugetul.
 */
import "../pocket.css";
import { useState } from "react";
import { CalendarDays, PiggyBank, Wallet } from "lucide-react";
import { type AppData } from "@/lib/finance-data";
import { childMembers, childPocket } from "@/lib/allowance";
import { dateText, fmtExact, money } from "@/pages/home-kit";
import { t } from "@/lib/i18n";

export function PocketPanel({ data }: { data: AppData }) {
  const children = childMembers(data);
  const [memberId, setMemberId] = useState(children[0]?.id || "");
  const pocket = childPocket(data, memberId || children[0]?.id || "");

  if (!children.length) {
    return (
      <div className="bf-empty-state slim">
        <PiggyBank size={23} />
        <h2>Niciun copil marcat</h2>
        <p>{t("În Setări → Membri poți marca un membru drept copil. Dă-i apoi un plic pe numele lui, în Plan, iar aici va vedea cât mai are din banii de buzunar.")}</p>
      </div>
    );
  }

  if (!pocket) {
    return (
      <div className="bf-empty-state slim">
        <Wallet size={23} />
        <h2>{t("Încă nu are un plic")}</h2>
        <p>
          Creează în Plan un plic pe numele lui {children.find((item) => item.id === memberId)?.name || children[0].name} și
          pune-i suma de buzunar. Cheltuielile lui vor scădea din acel plic.
        </p>
      </div>
    );
  }

  const tone = pocket.remaining < 0 ? "over" : pocket.usage >= 0.8 ? "watch" : "good";

  return (
    <div className="bf-pocket-workspace">
      {children.length > 1 && (
        <div className="bf-pocket-switch" role="group" aria-label="Al cui buzunar">
          {children.map((item) => (
            <button key={item.id} className={item.id === pocket.member.id ? "active" : ""} onClick={() => setMemberId(item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      )}

      <section className={`bf-pocket-hero ${tone}`} aria-labelledby="pocket-title">
        <p className="bf-kicker">BANII LUI {pocket.member.name.toLocaleUpperCase("ro-RO")}</p>
        <h2 id="pocket-title">{fmtExact.format(Math.max(0, pocket.remaining))}</h2>
        <p className="bf-pocket-line">
          {pocket.remaining < 0
            ? `Ai cheltuit cu ${fmtExact.format(Math.abs(pocket.remaining))} mai mult decât aveai.`
            : pocket.daysLeft > 0
              ? `Poți cheltui ${fmtExact.format(pocket.perDay)} pe zi până se reumple.`
              : "Se reumple azi."}
        </p>
        <div className="bf-pocket-bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, Math.round(pocket.usage * 100))}%` }} />
        </div>
        <p className="bf-pocket-meta">
          <CalendarDays size={13} /> Ai primit {money(pocket.budget)} · ai cheltuit {money(pocket.spent)} · se reumple pe {dateText(pocket.refillsOn)}
        </p>
      </section>

      <section className="bf-pocket-history" aria-labelledby="pocket-history-title">
        <div className="bf-section-heading">
          <div>
            <p className="bf-kicker">{t("PE CE AI DAT")}</p>
            <h2 id="pocket-history-title">{t("Ultimele cumpărături")}</h2>
          </div>
          <Wallet size={19} />
        </div>
        {pocket.recent.length ? (
          <ul className="bf-pocket-list">
            {pocket.recent.map((item) => (
              <li key={item.id}>
                <div>
                  <b>{item.title}</b>
                  <small>{dateText(item.date)} · {item.category}</small>
                </div>
                <strong>{fmtExact.format(item.amount)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="bf-pocket-empty">{t("Încă nu ai cheltuit nimic în perioada asta.")}</p>
        )}
      </section>
    </div>
  );
}
