/** Ecranul Analiză. Scos din home-secondary. */
import { lazy, Suspense, useState } from "react";
import { Bot, LayoutDashboard, Users } from "lucide-react";
import { type AppData } from "@/lib/finance-data";
import { type MainView } from "@/pages/home-kit";
import { t } from "@/lib/i18n";

const ReportsPanel = lazy(() => import("@/components/ReportsPanel").then((module) => ({ default: module.ReportsPanel })));
const AdvisorPanel = lazy(() => import("@/components/AdvisorPanel").then((module) => ({ default: module.AdvisorPanel })));
const HouseholdStudio = lazy(() => import("@/components/HouseholdStudio").then((module) => ({ default: module.HouseholdStudio })));

/** Atelierul Financiar 3.0 — Analiza este o destinație de lucru, cu rapoarte și asistent separat încărcate la cerere. */
export function InsightsView({ data, onChange, onGo }: { data: AppData; onChange: (next: AppData) => void; onGo?: (view: MainView) => void }) {
  const [panel, setPanel] = useState<"reports" | "household" | "assistant">("reports");
  return <div className="bf-page bf-insights-workspace"><header className="bf-insights-header"><div><p className="bf-kicker">{t("ANALIZĂ FINANCIARĂ")}</p><h1>{t("Înțelege")} <em>{t("schimbarea.")}</em></h1><p>{t("Compară lunile, închide ritualul gospodăriei și cere o explicație locală.")}</p></div><span><LayoutDashboard size={25} /></span></header><div className="bf-insights-switch bf-segment" role="tablist" aria-label={t("Tip analiză")}><button role="tab" aria-selected={panel === "reports"} className={panel === "reports" ? "active" : ""} onClick={() => setPanel("reports")}><LayoutDashboard size={16} /> {t("Istoric")}</button><button role="tab" aria-selected={panel === "household"} className={panel === "household" ? "active" : ""} onClick={() => setPanel("household")}><Users size={16} /> {t("Gospodărie")}</button><button role="tab" aria-selected={panel === "assistant"} className={panel === "assistant" ? "active" : ""} onClick={() => setPanel("assistant")}><Bot size={16} /> {t("Asistent")}</button></div>{panel === "reports" ? <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim analiza…")}</div>}><ReportsPanel data={data} onGo={onGo} /></Suspense> : panel === "household" ? <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim gospodăria…")}</div>}><HouseholdStudio data={data} onChange={onChange} /></Suspense> : <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim asistentul…")}</div>}><AdvisorPanel data={data} onChange={onChange} /></Suspense>}</div>;
}
