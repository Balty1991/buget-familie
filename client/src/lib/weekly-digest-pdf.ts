/** Digest săptămânal PDF — generat local din check-in, fără rețea. */
import type { AppData } from "@/lib/finance-data";
import { formatDate } from "@/lib/finance-data";
import { checkInRebalance, formatWeeklyCheckInShare, weeklyCheckIn, weeklyDigestHeadline } from "@/lib/household-insights";
import { getLocale, t } from "./i18n";

const plain = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const money = (value: number) =>
  `${new Intl.NumberFormat(getLocale(), { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)} RON`;

export type WeeklyDigestPdfSnapshot = {
  familyName: string;
  createdAt: string;
  start: string;
  end: string;
  headline: string;
  detail: string;
  tone: string;
  income: number;
  expense: number;
  cashflow: number;
  transactionCount: number;
  nextStep: string;
  envelopes: Array<{ label: string; planned: number; spent: number; state: string }>;
  members: Array<{ name: string; expense: number }>;
  shareText: string;
};

export const weeklyDigestPdfSnapshot = (data: AppData, asOf?: string): WeeklyDigestPdfSnapshot => {
  const check = weeklyCheckIn(data, asOf);
  const digest = weeklyDigestHeadline(data, asOf);
  const rebalance = checkInRebalance(data);
  return {
    familyName: check.familyName,
    createdAt: new Date().toISOString(),
    start: check.start,
    end: check.end,
    headline: digest.title,
    detail: digest.detail,
    tone: digest.tone,
    income: check.income,
    expense: check.expense,
    cashflow: check.cashflow,
    transactionCount: check.transactionCount,
    nextStep: check.nextStep,
    envelopes: check.envelopes.map((item) => ({
      label: item.label,
      planned: item.planned,
      spent: item.spent,
      state: item.state,
    })),
    members: check.members.filter((item) => item.expense > 0).map((item) => ({ name: item.name, expense: item.expense })),
    shareText: formatWeeklyCheckInShare(check, rebalance),
  };
};

export const downloadWeeklyDigestPdf = async (data: AppData, asOf?: string) => {
  const { jsPDF } = await import("jspdf");
  const report = weeklyDigestPdfSnapshot(data, asOf);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const width = 210;
  const margin = 16;
  let y = 16;
  const write = (
    value: string,
    x: number,
    next = 5,
    options?: { size?: number; color?: [number, number, number]; style?: "normal" | "bold" },
  ) => {
    const color = options?.color || [38, 54, 68];
    doc.setFont("helvetica", options?.style || "normal");
    doc.setFontSize(options?.size || 9);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(plain(value), width - margin * 2 - (x - margin));
    doc.text(lines, x, y);
    y += next + Math.max(0, lines.length - 1) * ((options?.size || 9) * 0.35);
  };
  const divider = () => {
    doc.setDrawColor(213, 225, 222);
    doc.line(margin, y, width - margin, y);
    y += 5;
  };
  const ensurePage = (need = 24) => {
    if (y + need < 274) return;
    doc.addPage();
    y = 16;
  };

  doc.setFillColor(18, 70, 61);
  doc.roundedRect(margin, y, width - margin * 2, 38, 4, 4, "F");
  y += 10;
  write(t("DIGEST LOCAL"), margin + 8, 6, { size: 8, color: [223, 244, 232], style: "bold" });
  write(t("Digestul săptămânii"), margin + 8, 8, { size: 18, color: [255, 255, 255], style: "bold" });
  write(
    `${report.familyName} · ${formatDate(report.start, { day: "2-digit", month: "short" })} – ${formatDate(report.end, { day: "2-digit", month: "short" })}`,
    margin + 8,
    5,
    { size: 9, color: [223, 244, 232] },
  );
  y += 10;

  write(report.headline, margin, 6, { size: 12, style: "bold", color: [24, 77, 66] });
  write(report.detail, margin, 7, { size: 9, color: [88, 109, 101] });
  divider();

  const metric = (label: string, value: string, x: number, tone: [number, number, number]) => {
    doc.setFillColor(245, 249, 247);
    doc.roundedRect(x, y, 54, 23, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(91, 111, 103);
    doc.text(plain(label), x + 5, y + 7);
    doc.setFontSize(11);
    doc.setTextColor(tone[0], tone[1], tone[2]);
    doc.text(plain(value), x + 5, y + 16);
  };
  metric(t("Venituri").toUpperCase(), money(report.income), margin, [24, 77, 66]);
  metric(t("Cheltuieli").toUpperCase(), money(report.expense), margin + 58, [142, 62, 51]);
  metric(
    t("Diferență").toUpperCase(),
    `${report.cashflow >= 0 ? "+" : "-"}${money(Math.abs(report.cashflow))}`,
    margin + 116,
    report.cashflow < 0 ? [142, 62, 51] : [24, 77, 66],
  );
  y += 30;
  write(t("Următorul pas: {step}", { step: report.nextStep }), margin, 7, { size: 9, color: [24, 77, 66] });

  if (report.members.length > 1) {
    ensurePage();
    write(t("Perspectiva bilanțului"), margin, 6, { size: 8, color: [88, 109, 101], style: "bold" });
    divider();
    report.members.forEach((member) => {
      ensurePage(10);
      write(member.name, margin, 5, { size: 10, style: "bold" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(24, 77, 66);
      doc.text(money(member.expense), width - margin, y - 5, { align: "right" });
    });
  }

  if (report.envelopes.length) {
    ensurePage();
    write(t("Plicuri (planificat → cheltuit)"), margin, 6, { size: 8, color: [88, 109, 101], style: "bold" });
    divider();
    report.envelopes.forEach((item) => {
      ensurePage(12);
      const mark = item.state === "over" ? t("peste") : item.state === "watch" ? t("atenție") : t("ok");
      write(`${item.label} · ${mark}`, margin, 5, { size: 10, style: "bold" });
      write(`${money(item.planned)} → ${money(item.spent)}`, margin, 5, { size: 8, color: [101, 122, 112] });
      divider();
    });
  }

  const pages = doc.getNumberOfPages();
  for (let index = 1; index <= pages; index += 1) {
    doc.setPage(index);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(101, 122, 112);
    doc.text(
      plain(`${t("Generat local")} · ${new Date(report.createdAt).toLocaleString(getLocale())} · Buget Familie · ${index}/${pages}`),
      margin,
      287,
    );
  }
  doc.save(`digest-saptamanal-${report.start}-${report.end}.pdf`);
};
