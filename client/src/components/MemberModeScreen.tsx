/**
 * Ecranul unic pentru „telefonul lui X”: cifra lui de azi, un buton mare „Notează” și
 * ultimele lui mișcări. Ieșirea cere confirmare, ca un copil să nu ajungă din greșeală
 * la tot bugetul familiei.
 */
import "../monthly-needs.css";
import { Plus } from "lucide-react";
import { formatDate, type AppData } from "@/lib/finance-data";
import { askConfirm } from "@/lib/confirm-dialog";
import { memberToday, writeMemberMode } from "@/lib/member-mode";
import { daysLabel, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

export function MemberModeScreen({ data, memberId, onAdd }: { data: AppData; memberId: string; onAdd: () => void }) {
  const member = data.settings.members.find((item) => item.id === memberId);
  const figure = memberToday(data, memberId);
  const recent = data.transactions.filter((item) => item.memberId === memberId).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);
  const exit = async () => {
    if (!await askConfirm(t("Ieși din „Telefonul lui {name}”? Pe telefonul acesta se va vedea iar tot bugetul familiei.", { name: member?.name || "" }), { confirmLabel: t("Ieși") })) return;
    writeMemberMode("");
  };
  return (
    <section className="bf-member-mode" aria-labelledby="bf-member-mode-title">
      <p className="bf-kicker">{t("TELEFONUL LUI {name}", { name: (member?.name || "").toLocaleUpperCase("ro-RO") })}</p>
      <h1 id="bf-member-mode-title"><span>{t("Ai azi")}</span><strong>{lei(figure.today)}</strong></h1>
      <p className="bf-member-mode-note">
        {figure.own
          ? t("Din {labels}: mai sunt {left} în total.", { labels: figure.labels.join(", "), left: lei(figure.left || 0) })
          : t("Din banii familiei, pentru azi.")}
        {figure.days !== undefined && figure.days > 0 ? ` ${t("Banii noi vin peste {days}.", { days: daysLabel(figure.days) })}` : ""}
      </p>
      <button type="button" className="bf-primary bf-member-mode-add" onClick={onAdd}><Plus size={26} aria-hidden="true" /> {t("Notează o cheltuială")}</button>
      {recent.length > 0 && (
        <div className="bf-member-mode-recent">
          <h2>{t("Ultimele")}</h2>
          <ul>{recent.map((item) => <li key={item.id}><span>{item.title}<small>{formatDate(item.date, { day: "numeric", month: "long" })}</small></span><b>{item.kind === "expense" ? "−" : "+"}{lei(item.amount)}</b></li>)}</ul>
        </div>
      )}
      <button type="button" className="bf-member-mode-exit" onClick={() => void exit()}>{t("Ieși din modul acesta")}</button>
    </section>
  );
}
