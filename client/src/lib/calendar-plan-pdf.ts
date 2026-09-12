/** Ledger Flow — PDF local pentru tranșele calendaristice; datele nu părăsesc browserul. */
import type { CalendarBudget } from "@/lib/calendar-budget";
import { formatDate } from "@/lib/finance-data";
import { getLocale, t } from "./i18n";

const plain = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const money = (value: number) => `${new Intl.NumberFormat(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} RON`;

export type CyclePdfExtras = {
  weekSpent?: Record<number, number>;
  envelopes?: Array<{ label: string; budget: number; spent: number; remaining: number }>;
};

export const calendarPlanPdfSnapshot = (plan: CalendarBudget, familyName: string, extras: CyclePdfExtras = {}) => ({
  familyName: familyName.trim() || "Buget Familie",
  createdAt: new Date().toISOString(),
  ...plan,
  weekSpent: extras.weekSpent || {},
  envelopes: extras.envelopes || [],
});

export const downloadCalendarPlanPdf = async (plan: CalendarBudget, familyName: string, extras: CyclePdfExtras = {}) => {
  const { jsPDF } = await import("jspdf");
  const report = calendarPlanPdfSnapshot(plan, familyName, extras);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const width = 210;
  const margin = 16;
  let y = 16;
  const write = (value: string, x: number, next = 5, options?: { size?: number; color?: [number, number, number]; style?: "normal" | "bold" }) => {
    const color = options?.color || [38, 54, 68];
    doc.setFont("helvetica", options?.style || "normal");
    doc.setFontSize(options?.size || 9);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(plain(value), x, y);
    y += next;
  };
  const divider = () => {
    doc.setDrawColor(213, 225, 222);
    doc.line(margin, y, width - margin, y);
    y += 5;
  };
  const ensurePage = (need = 20) => {
    if (y + need < 274) return;
    doc.addPage();
    y = 16;
  };

  doc.setFillColor(18, 70, 61);
  doc.roundedRect(margin, y, width - margin * 2, 35, 4, 4, "F");
  y += 10;
  write("BUGET FAMILIE", margin + 8, 6, { size: 8, color: [223, 244, 232], style: "bold" });
  write(t("Plan calendaristic de venit"), margin + 8, 8, { size: 18, color: [255, 255, 255], style: "bold" });
  write(
    `${report.familyName} · ${formatDate(report.start, { day: "2-digit", month: "long", year: "numeric" })} – ${formatDate(report.end, { day: "2-digit", month: "long", year: "numeric" })}`,
    margin + 8,
    5,
    { size: 9, color: [223, 244, 232] },
  );
  y += 10;

  const metric = (label: string, value: string, x: number) => {
    doc.setFillColor(245, 249, 247);
    doc.roundedRect(x, y, 54, 23, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(91, 111, 103);
    doc.text(plain(label), x + 5, y + 7);
    doc.setFontSize(11);
    doc.setTextColor(24, 77, 66);
    doc.text(plain(value), x + 5, y + 16);
  };
  metric(t("SUMA DE PERIOADĂ"), money(report.total), margin);
  metric(t("DURATA"), `${report.days} ${t("zile")} · ${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(report.exactWeeks)} ${t("săpt.")}`, margin + 58);
  metric(t("RITM SĂPTĂMÂNAL"), money(report.weeklyAmount), margin + 116);
  y += 32;

  write(t("TRANȘE CALENDARISTICE"), margin, 6, { size: 8, color: [88, 109, 101], style: "bold" });
  divider();
  report.weeks.forEach((week) => {
    ensurePage(18);
    const spent = report.weekSpent[week.index] || 0;
    const left = Math.max(0, week.amount - spent);
    write(`S${week.index} · ${formatDate(week.start, { day: "2-digit", month: "short" })} – ${formatDate(week.end, { day: "2-digit", month: "short" })}`, margin, 5, { size: 10, style: "bold" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(24, 77, 66);
    doc.text(money(week.amount), width - margin, y - 5, { align: "right" });
    write(
      `${week.days} ${week.days === 1 ? t("zi") : t("zile")}${week.days < 7 ? ` · ${t("tranșă parțială")}` : ""}`,
      margin,
      4,
      { size: 8, color: [101, 122, 112] },
    );
    if (spent > 0 || Object.keys(report.weekSpent).length) {
      write(`${t("Cheltuit")} ${money(spent)} · ${t("rămași")} ${money(left)}`, margin, 5, { size: 8, color: spent > week.amount ? [142, 62, 51] : [101, 122, 112] });
    }
    divider();
  });

  if (report.envelopes.length) {
    ensurePage(24);
    write(t("PLICURI ÎN CICLU"), margin, 6, { size: 8, color: [88, 109, 101], style: "bold" });
    divider();
    report.envelopes.forEach((item) => {
      ensurePage(14);
      write(item.label, margin, 5, { size: 10, style: "bold" });
      write(`${t("plan")} ${money(item.budget)} · ${t("Cheltuit").toLowerCase()} ${money(item.spent)} · ${t("rămași")} ${money(item.remaining)}`, margin, 5, { size: 8, color: [101, 122, 112] });
      divider();
    });
  }

  const pages = doc.getNumberOfPages();
  for (let index = 1; index <= pages; index += 1) {
    doc.setPage(index);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(101, 122, 112);
    doc.text(plain(`${t("Generat local")} ${new Date(report.createdAt).toLocaleString(getLocale())} · Buget Familie · ${index}/${pages}`), margin, 287);
  }
  doc.save(`plan-calendaristic-${report.start}-${report.end}.pdf`);
};
