/**
 * Intrarea în „Anul vostru”. Pe Astăzi apare din decembrie până la sfârșitul lui ianuarie și
 * se poate ascunde; în Gospodărie stă mereu, de îndată ce anul are destule zile notate.
 */
import { lazy, Suspense, useMemo, useState } from "react";
import { X } from "lucide-react";
import { isoToday, type AppData } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { safeSetItem } from "@/lib/safe-storage";
import { recapReady, recapYearFor, yearRecap } from "@/lib/year-recap";

const YearRecapStory = lazy(() => import("@/components/YearRecapStory").then((module) => ({ default: module.YearRecapStory })));

const hiddenKey = (year: number) => `buget-familie:year-recap-hidden-${year}`;

export function YearRecapEntry({ data, seasonal = false }: { data: AppData; seasonal?: boolean }) {
  const today = isoToday();
  const year = recapYearFor(today);
  const inSeason = today.slice(5, 7) === "12" || today.slice(5, 7) === "01";
  const [hidden, setHidden] = useState(() => { try { return seasonal && localStorage.getItem(hiddenKey(year)) === "1"; } catch { return false; } });
  const [open, setOpen] = useState(false);
  const recap = useMemo(() => (seasonal && (!inSeason || hidden) ? undefined : yearRecap(data.transactions, year, today)), [data.transactions, year, today, seasonal, inSeason, hidden]);
  if (!recap || !recapReady(recap)) return null;
  const hide = () => { try { safeSetItem(localStorage, hiddenKey(year), "1"); } catch { /* fără stocare */ } setHidden(true); };
  return <div className="bf-year-cta-wrap">
    <button type="button" className="bf-year-cta" onClick={() => setOpen(true)}>
      <span aria-hidden="true">{String(year).slice(2)}</span>
      <span><b>{t("Anul vostru {year}", { year })}</b><small>{t("{days} zile notate · unde s-au dus banii · cea mai bună lună", { days: recap.loggedDays })}</small></span>
    </button>
    {seasonal && <button type="button" className="bf-year-cta-close" aria-label={t("Ascunde anul vostru")} onClick={hide}><X size={16} /></button>}
    {open && <Suspense fallback={null}><YearRecapStory recap={recap} familyName={data.settings.familyName || t("Familia noastră")} onClose={() => setOpen(false)} /></Suspense>}
  </div>;
}
