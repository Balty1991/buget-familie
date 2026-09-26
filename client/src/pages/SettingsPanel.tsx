/**
 * Ecranul Setări. Scos din home-secondary. Comportamentul e același.
 */
import "../monthly-needs.css";
import "../pocket.css";
import { lazy, Suspense, useEffect, useState, type ChangeEvent } from "react";
import { Check, ChevronRight, ClipboardPaste, Download, LockKeyhole, RotateCcw, Share2, Trash2, Upload, X } from "lucide-react";
import { deviceTimeZone, BASE_CURRENCY, activeCurrencies, createFamilyCode, currenciesMissingRate, expenseCategories, newId, normalizeAppData, parseRomanianAmount, sourceBalance, sourceBalanceInCurrency, supportedCurrencies, type AppData, type PaymentKind } from "@/lib/finance-data";
import { downloadBackup, parseBackup, type BackupIntent } from "@/lib/app-storage";
import { AutoBackupToggle } from "@/components/AutoBackupToggle";
import { MemberModeSetup } from "@/components/MemberModeSetup";
import { BACKUP_SAVE_FALLBACK, BACKUP_SAVE_HELPER } from "@/lib/backup-ui-copy";
import { disableLocalAlerts, enableLocalAlerts, getNotificationPermission, isNotificationsArmed, isNotificationsEnabled, sendTestAlert, type NotificationPref } from "@/lib/local-notifications";
import { isOfflineOnly, setOfflineOnly, setSimpleMode } from "@/lib/ui-prefs";
import { disableAppLock, hasAppLockPin, isAppLockEnabled, isValidPin, setAppLockPin } from "@/lib/app-lock";
import { Field, dateText, money, sourceKindName } from "@/pages/home-kit";
import { memberColor, memberColorName, nextMemberColor } from "@/lib/member-color";
import { getLocale, languages, t } from "@/lib/i18n";
import { canAddMember } from "@/lib/entitlements";
import { FamilieUpgrade } from "@/components/FamilieUpgrade";
import { useLanguage } from "@/hooks/use-language";
import { askConfirm, showNotice } from "@/lib/confirm-dialog";

const TrustCenter = lazy(() => import("@/components/TrustCenter").then((module) => ({ default: module.TrustCenter })));
const PremiumStudio = lazy(() => import("@/components/PremiumStudio").then((module) => ({ default: module.PremiumStudio })));

/**
 * Cursurile sunt introduse manual, cu data la care au fost puse. Aplicația nu întreabă
 * niciun serviciu extern și nu recalculează retroactiv mișcările deja salvate: fiecare
 * mișcare valutară păstrează cursul cu care a fost înregistrată.
 */
/**
 * Un rând de sursă, editabil complet. Soldul inițial se ține într-un câmp liber până
 * la ieșirea din el: dacă l-am fi trecut prin parser la fiecare tastă, virgula
 * zecimală ar fi dispărut imediat, iar ștergerea ultimei cifre ar fi resetat la zero —
 * exact motivul pentru care câmpul părea că nu se poate edita.
 */
function SourceRow({ data, source, settings, change }: { data: AppData; source: AppData["settings"]["paymentSources"][number]; settings: AppData["settings"]; change: (patch: Partial<AppData["settings"]>) => void }) {
  const [name, setName] = useState(source.name);
  const [balance, setBalance] = useState(String(source.openingBalance));
  useEffect(() => { setName(source.name); }, [source.name]);
  useEffect(() => { setBalance(String(source.openingBalance)); }, [source.openingBalance]);
  const own = sourceBalanceInCurrency(data, source.id);
  const patchSource = (patch: Partial<typeof source>) => change({ paymentSources: settings.paymentSources.map((item) => item.id === source.id ? { ...item, ...patch, ...("openingBalance" in patch ? { updatedAt: new Date().toISOString() } : {}) } : item) });
  const used = data.transactions.filter((item) => item.sourceId === source.id).length;
  const remove = async () => {
    if (settings.paymentSources.length <= 1) { void showNotice(t("Păstrează cel puțin o sursă de plată.")); return; }
    const question = used
      ? t("Ștergi sursa „{name}”? Cele {count} mișcări înregistrate pe ea rămân în registru, dar nu vor mai avea o sursă.", { name: source.name, count: used })
      : t("Ștergi sursa „{name}”?", { name: source.name });
    if (!await askConfirm(question)) return;
    change({
      paymentSources: settings.paymentSources.filter((item) => item.id !== source.id),
      salaryPlan: { ...settings.salaryPlan, sourceIds: settings.salaryPlan.sourceIds.filter((id) => id !== source.id), allocations: settings.salaryPlan.allocations.map((item) => item.sourceId === source.id ? { ...item, sourceId: undefined } : item) },
    });
  };
  return <div className="bf-source-edit rich">
    <label className="bf-source-name"><small>{t("Denumire")}</small><input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => { const clean = name.trim(); if (clean && clean !== source.name) patchSource({ name: clean }); else setName(source.name); }} /></label>
    <label><small>{t("Sold inițial")} ({source.currency || t("lei")})</small><input inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} onBlur={() => { const next = Math.max(0, parseRomanianAmount(balance)); if (next !== source.openingBalance) patchSource({ openingBalance: next }); else setBalance(String(source.openingBalance)); }} /></label>
    <label><small>{t("Valută")}</small><select value={source.currency || BASE_CURRENCY} onChange={(event) => patchSource({ currency: event.target.value === BASE_CURRENCY ? undefined : event.target.value })}>{supportedCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
    <label><small>{t("Aparține de")}</small><select value={source.memberId || ""} onChange={(event) => patchSource({ memberId: event.target.value || undefined })}><option value="">{t("Familie / comun")}</option>{settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
    <div className="bf-source-edit-foot">
      <span><b>{money(sourceBalance(data, source.id))}</b><small>{sourceKindName[source.kind]}{own ? <> · {own.amount.toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {own.currency}{own.exact ? null : <em className="bf-fx-approx">{t("aproximativ")}</em>}</> : null} · {t("{count} mișcări", { count: used })}</small></span>
      <button type="button" aria-label={t("Șterge sursa {name}", { name: source.name })} onClick={remove}><Trash2 size={15} /></button>
    </div>
  </div>;
}

/** Selectorul de limbă. Schimbarea are efect imediat, fără reîncărcarea aplicației. */
function LanguageSection() {
  const [lang, setLang] = useLanguage();
  return <section><p className="bf-kicker">{t("LIMBĂ")}</p><h2>{t("Limba aplicației")}</h2><p>{t("Se schimbă doar afișarea. Datele, categoriile și notele rămân exact cum le-ai scris.")}</p><div className="bf-language-switch" role="group" aria-label={t("Limba aplicației")}>{languages.map((item) => <button key={item.id} type="button" aria-pressed={lang === item.id} className={lang === item.id ? "active" : ""} onClick={() => setLang(item.id)}>{item.label}</button>)}</div></section>;
}

function ExchangeRatesSection({ data, settings, change }: { data: AppData; settings: AppData["settings"]; change: (patch: Partial<AppData["settings"]>) => void }) {
  const used = activeCurrencies(data);
  const missing = currenciesMissingRate(data);
  const [code, setCode] = useState(missing[0] || supportedCurrencies.find((item) => item !== BASE_CURRENCY) || "EUR");
  const [rate, setRate] = useState("");
  if (!used.length && !settings.exchangeRates.length) return null;
  const save = () => {
    const value = parseRomanianAmount(rate);
    if (!value || value <= 0) return;
    const next = [...settings.exchangeRates.filter((item) => item.currency !== code), { currency: code, rate: value, updatedAt: new Date().toISOString() }];
    change({ exchangeRates: next });
    setRate("");
  };
  return <section><p className="bf-kicker">{t("CURSURI VALUTARE")}</p><h2>{t("Cât face un leu")}</h2><p>{t("Se folosesc doar la înregistrarea unei mișcări noi și la soldul inițial al unei surse valutare. Mișcările deja salvate păstrează cursul cu care au fost introduse.")}</p>
    {missing.length > 0 && <p className="bf-form-error" role="alert">{t("Lipsește cursul pentru {codes}. Până îl adaugi, soldul inițial al acestor surse este socotit zero, ca să nu apară o cifră inventată.", { codes: missing.join(", ") })}</p>}
    {settings.exchangeRates.map((item) => <div className="bf-source-edit" key={item.currency}><span><b>1 {item.currency}</b><small>{t("pus pe {date}", { date: dateText(String(item.updatedAt).slice(0, 10), true) })}{used.includes(item.currency) ? "" : t(" · nefolosit de nicio sursă")}</small></span><label><small>Lei</small><input inputMode="decimal" value={String(item.rate)} onChange={(event) => change({ exchangeRates: settings.exchangeRates.map((entry) => entry.currency === item.currency ? { ...entry, rate: Math.max(0, parseRomanianAmount(event.target.value)), updatedAt: new Date().toISOString() } : entry) })} /></label><button aria-label={`Șterge cursul pentru ${item.currency}`} onClick={() => change({ exchangeRates: settings.exchangeRates.filter((entry) => entry.currency !== item.currency) })}><X size={14} /></button></div>)}
    <div className="bf-source-builder"><select value={code} onChange={(event) => setCode(event.target.value)} aria-label="Valuta">{supportedCurrencies.filter((item) => item !== BASE_CURRENCY).map((item) => <option key={item} value={item}>{item}</option>)}</select><input value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" placeholder="ex. 4,97" aria-label={t("Lei per unitate")} /><button onClick={save}>{t("Salvează cursul")}</button></div>
  </section>;
}

function LocalAlertsSettings({ data }: { data: AppData }) {
  const [pref, setPref] = useState<NotificationPref>("unknown");
  const [enabled, setEnabled] = useState(() => isNotificationsEnabled());
  const [armed, setArmed] = useState(() => isNotificationsArmed());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const refresh = () => {
      void getNotificationPermission().then((status) => {
        setPref(status);
        setEnabled(isNotificationsEnabled());
        setArmed(isNotificationsArmed());
      });
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("buget-familie:notify-permission", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("buget-familie:notify-permission", refresh);
    };
  }, []);

  const active = pref === "granted" || (armed && enabled && pref !== "denied" && pref !== "unsupported");

  const turnOn = () => {
    setBusy(true);
    setNotice("");
    let finished = false;
    const apply = (status: NotificationPref) => {
      if (finished) return;
      finished = true;
      setPref(status === "unsupported" ? status : status === "denied" ? "denied" : (status === "granted" ? "granted" : "unknown"));
      setEnabled(isNotificationsEnabled() && status !== "denied");
      setArmed(isNotificationsArmed());
      if (status === "granted") setNotice(t("Alertele sunt active pe acest dispozitiv. Urmează și o notificare de confirmare."));
      else if (status === "denied") setNotice(t("Permisiunea a fost refuzată. O poți reactiva din setările telefonului."));
      else if (status === "unsupported") setNotice(t("Notificările nu sunt disponibile în acest browser."));
      else setNotice(t("Am înregistrat Permite pe acest telefon. Dacă nu vezi o notificare, apasă „Trimite o notificare de test”."));
      setBusy(false);
    };
    const watchdog = window.setTimeout(() => apply("unknown"), 5000);
    void enableLocalAlerts(data)
      .then((status) => {
        window.clearTimeout(watchdog);
        apply(status);
      })
      .catch(() => {
        window.clearTimeout(watchdog);
        apply("unknown");
      });
  };

  const turnOff = async () => {
    disableLocalAlerts();
    setEnabled(false);
    setArmed(false);
    setNotice(t("Alertele au fost oprite pe acest dispozitiv."));
  };

  const ping = () => {
    void sendTestAlert().then(() => setNotice(t("Am trimis o notificare de test pe acest telefon.")));
  };

  return (
    <section className={"bf-settings-notifications" + (active ? " is-on" : "")} aria-labelledby="bf-alerts-title">
      <p className="bf-kicker">{t("ALERTE LOCALE")}</p>
      <h2 id="bf-alerts-title">{t("Reamintiri pe telefon")}</h2>
      <p>{t("Rămân pe dispozitiv; nu se trimit pe server. Nu te anunț când tu însuți adaugi o cheltuială — o vezi deja pe ecran.")}</p>
      <ul className="bf-alert-kinds">
        <li>{t("Scadențe în următoarele 3 zile")}</li>
        <li>{t("Plic aproape de limită sau epuizat")}</li>
        <li>{t("Venitul de mâine sau de azi")}</li>
        <li>{t("Check-in de seară, dacă ziua e goală")}</li>
        <li>{t("Cheltuială adăugată de alt membru, când telefoanele sunt sincronizate")}</li>
      </ul>
      {active ? (
        <div className="bf-notification-actions">
          <button type="button" className="bf-secondary" onClick={turnOff}>{t("Oprește alertele")}</button>
          <button type="button" className="bf-ghost" onClick={ping}>{t("Trimite o notificare de test")}</button>
        </div>
      ) : (
        <div className="bf-notification-actions">
          <button type="button" className="bf-primary" disabled={busy} onClick={turnOn}>{busy ? t("Se cere permisiunea…") : t("Activează alertele")}</button>
        </div>
      )}
      <p className="bf-helper">{active ? t("Active pe acest telefon.") : t("Oprite pe acest telefon.")}</p>
      {notice && <p className="bf-notice" role="status">{notice}</p>}
    </section>
  );
}

function AppLockSettings() {
  const [enabled, setEnabled] = useState(() => isAppLockEnabled() && hasAppLockPin());
  const [mode, setMode] = useState<"idle" | "create" | "confirm">("idle");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState("");

  const startCreate = () => { setMode("create"); setPin(""); setFirstPin(""); setNotice(""); };
  const cancel = () => { setMode("idle"); setPin(""); setFirstPin(""); };

  const submitFirst = () => {
    if (!isValidPin(pin)) return setNotice(t("PIN-ul trebuie să aibă exact 4 cifre."));
    setFirstPin(pin);
    setPin("");
    setMode("confirm");
    setNotice("");
  };

  const submitConfirm = () => {
    if (pin !== firstPin) {
      setNotice(t("PIN-urile nu coincid. Încearcă din nou."));
      setPin("");
      setFirstPin("");
      setMode("create");
      return;
    }
    void setAppLockPin(pin).then(() => {
      setEnabled(true);
      setMode("idle");
      setPin("");
      setFirstPin("");
      setNotice(t("Blocarea cu PIN este activă pe acest telefon."));
    });
  };

  const turnOff = async () => {
    if (!await askConfirm(t("Dezactivezi blocarea cu PIN pe acest telefon?"))) return;
    disableAppLock();
    setEnabled(false);
    setNotice(t("Blocarea a fost dezactivată."));
  };

  return (
    <section className="bf-settings-lock">
      <p className="bf-kicker">{t("SECURITATE")}</p>
      <h2>{t("Blocare cu PIN")}</h2>
      <p>{t("Un PIN de 4 cifre, doar pe acest telefon. Nu se salvează în clar, nu intră în backup și nu se sincronizează cu celelalte telefoane.")}</p>
      {mode === "idle" && (
        enabled ? (
          <div className="bf-notification-actions">
            <button type="button" onClick={startCreate}>{t("Schimbă PIN-ul")}</button>
            <button type="button" onClick={turnOff}>{t("Dezactivează")}</button>
          </div>
        ) : (
          <button type="button" className="bf-primary" onClick={startCreate}><LockKeyhole size={16} /> {t("Activează blocarea")}</button>
        )
      )}
      {(mode === "create" || mode === "confirm") && (
        <div className="bf-app-lock-setup">
          <Field label={mode === "create" ? "PIN nou (4 cifre)" : t("Confirmă PIN-ul")}>
            <input inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" autoFocus />
          </Field>
          <div className="bf-notification-actions">
            <button type="button" onClick={cancel}>{t("Anulează")}</button>
            <button type="button" className="bf-primary" disabled={pin.length !== 4} onClick={mode === "create" ? submitFirst : submitConfirm}>{mode === "create" ? t("Continuă") : t("Confirmă")}</button>
          </div>
        </div>
      )}
      {notice && <p className="bf-notice" role="status">{notice}</p>}
    </section>
  );
}

function MerchantRulesSection({ data, onChange }: { data: AppData; onChange: (value: AppData) => void }) {
  const rules = data.settings.merchantRules || [];
  const [match, setMatch] = useState("");
  const [category, setCategory] = useState("Alimente");
  const [allocationId, setAllocationId] = useState("");
  const categories = [...expenseCategories, ...data.settings.customCategories];
  const add = () => {
    const needle = match.trim();
    if (needle.length < 2) return;
    const rule = {
      id: newId("merchant-rule"),
      match: needle.slice(0, 80),
      category: category || undefined,
      allocationId: allocationId || undefined,
      updatedAt: new Date().toISOString(),
    };
    onChange({
      ...data,
      settings: {
        ...data.settings,
        merchantRules: [rule, ...rules.filter((item) => item.match.toLocaleLowerCase("ro-RO") !== needle.toLocaleLowerCase("ro-RO"))].slice(0, 80),
      },
    });
    setMatch("");
    setAllocationId("");
  };
  const remove = (id: string) => onChange({
    ...data,
    settings: { ...data.settings, merchantRules: rules.filter((item) => item.id !== id) },
  });
  return (
    <section id="bf-merchant-rules" className="bf-merchant-rules">
      <p className="bf-kicker">{t("REGULI COMERCIANT")}</p>
      <h2>{t("Dacă titlul conține…")}</h2>
      <p>{t("Propune categorie sau plic la import, OCR și asistent. Nu salvează nimic fără confirmarea ta.")}</p>
      <div className="bf-merchant-rule-form">
        <Field label={t("Text în titlu")}><input value={match} onChange={(event) => setMatch(event.target.value)} placeholder={t("ex. Glovo, ENEL, Starbucks")} /></Field>
        <Field label={t("Categorie propusă")}><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></Field>
        <Field label={t("Plic propus (opțional)")}><select value={allocationId} onChange={(event) => setAllocationId(event.target.value)}><option value="">{t("Fără plic preferat")}</option>{data.settings.salaryPlan.allocations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        <button type="button" className="bf-primary" onClick={add}>{t("Adaugă regula")}</button>
      </div>
      <ul className="bf-merchant-rule-list">
        {rules.map((rule) => {
          const envelope = data.settings.salaryPlan.allocations.find((item) => item.id === rule.allocationId);
          return (
            <li key={rule.id}>
              <div>
                <b>„{rule.match}”</b>
                <small>{rule.category ? t(rule.category) : t("fără categorie")}{envelope ? ` → ${envelope.label}` : ""}</small>
              </div>
              <button type="button" aria-label={t("Șterge regula {match}", { match: rule.match })} onClick={() => remove(rule.id)}><X size={14} /></button>
            </li>
          );
        })}
      </ul>
      {!rules.length && <small className="bf-helper">{t("Nicio regulă încă. Exemplu: „detergent” → Casă & facturi.")}</small>}
    </section>
  );
}

export function SettingsPanel({ data, onChange, onReset }: { data: AppData; onChange: (value: AppData) => void; onReset: () => void }) {
  const [backupPreview, setBackupPreview] = useState<{ data: AppData; exportedAt: string; fileName: string } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false); const [pasted, setPasted] = useState("");
  const importBackup = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; void file.text().then((raw) => { acceptBackupText(raw, file.name); }).catch(() => void showNotice(t("Nu am putut citi fișierul ales. Încearcă „Lipește text”."))); event.target.value = ""; };
  /**
   * Un singur drum pentru ambele butoane; diferă doar intenția și, la final, ce-i spunem
   * omului. „Salvat” trebuie să spună unde, altfel butonul pare că n-a făcut nimic.
   */
  const exportBackup = (intent: BackupIntent) => downloadBackup(data, intent).then((result) => {
    if (result.how === "shared") void showNotice(result.fallback ? t(BACKUP_SAVE_FALLBACK) : t("Backupul a fost trimis către aplicația aleasă."));
    else if (result.how === "saved") void showNotice(t("Backupul a fost scris în {path}. Îl găsești cu aplicația Fișiere.", { path: result.path }));
    else if (result.how === "downloaded") void showNotice(t("Backupul a fost salvat în descărcări."));
    else if (result.how === "failed") void showNotice(t("Nu am putut salva fișierul: {reason}", { reason: result.reason || t("motiv necunoscut") }));
  });
  const acceptBackupText = (raw: string, fileName: string) => { try { const backup = parseBackup(raw); setBackupPreview({ data: normalizeAppData(backup.data), exportedAt: backup.exportedAt, fileName }); setPasteOpen(false); setPasted(""); return true; } catch (reason) { void showNotice(reason instanceof Error ? reason.message : t("Backup-ul nu a putut fi importat.")); return false; } };
  const confirmBackupImport = () => { if (!backupPreview) return; onChange(backupPreview.data); setBackupPreview(null); };
  const [member, setMember] = useState(""); const [source, setSource] = useState(""); const [kind, setKind] = useState<PaymentKind>("card"); const [owner, setOwner] = useState(data.settings.members[0]?.id || ""); const [category, setCategory] = useState("");
  const settings = data.settings; const change = (patch: Partial<typeof settings>) => onChange({ ...data, settings: { ...settings, ...patch } });
  const [currency, setCurrency] = useState(BASE_CURRENCY);
  const addMember = () => { if (!member.trim()) return; if (settings.members.some((item) => item.name.toLowerCase() === member.trim().toLowerCase())) return; if (!canAddMember(settings.members.length)) { window.dispatchEvent(new Event("buget-familie:open-familie")); return; } change({ members: [...settings.members, { id: newId("member"), name: member.trim() }] }); setMember(""); };
  const addSource = () => { if (!source.trim()) return; change({ paymentSources: [...settings.paymentSources, { id: newId("source"), name: source.trim(), kind, memberId: kind === "transfer" ? undefined : owner, openingBalance: 0, currency: currency === BASE_CURRENCY ? undefined : currency }] }); setSource(""); setCurrency(BASE_CURRENCY); };
  const [simpleMode, setSimpleModeState] = useState(() => { try { return window.localStorage.getItem("buget-familie:simple-mode") === "1"; } catch { return false; } });
  const [offlineOnly, setOfflineOnlyState] = useState(() => isOfflineOnly());
  useEffect(() => {
    const onPrefs = (event: Event) => {
      const detail = (event as CustomEvent<{ simpleMode?: boolean; offlineOnly?: boolean }>).detail;
      if (typeof detail?.simpleMode === "boolean") setSimpleModeState(detail.simpleMode);
      if (typeof detail?.offlineOnly === "boolean") setOfflineOnlyState(detail.offlineOnly);
    };
    window.addEventListener("buget-familie:ui-prefs", onPrefs);
    return () => window.removeEventListener("buget-familie:ui-prefs", onPrefs);
  }, []);
  const toggleSimple = () => {
    const next = !simpleMode;
    setSimpleMode(next);
    setSimpleModeState(next);
  };
  const toggleOfflineOnly = async () => {
    const next = !offlineOnly;
    if (next && !await askConfirm(t("Oprești sincronizarea cloud pe acest telefon? Firebase nu se mai încarcă până reactivezi. Datele rămân locale."))) return;
    setOfflineOnly(next);
    setOfflineOnlyState(next);
  };
  return <div className="bf-settings"><LanguageSection /><section className="bf-guide-glossary compact" aria-labelledby="bf-settings-glossary"><p className="bf-kicker">{t("PE SCURT")}</p><h2 id="bf-settings-glossary">{t("Plic ≠ cont · Reper ≠ sold")}</h2><p>{t("Plicul e o limită pe categorie, nu un cont. Reperul e ritmul zilei din plan, nu soldul din bancă.")}</p><button type="button" className="bf-usage-jump" onClick={() => window.dispatchEvent(new Event("buget-familie:open-usage-tutorial"))}>{t("Deschide tutorialul de folosire")} <ChevronRight size={16} /></button></section><section className={"bf-simple-mode-card" + (simpleMode ? " is-on" : "")} aria-labelledby="bf-simple-mode-title"><p className="bf-kicker">{t("MOD SIMPLU")}</p><h2 id="bf-simple-mode-title">{t("Doar jurnal și esențialul")}</h2><p>{t("Astăzi arată un număr + captură; dock-ul rămâne Astăzi / Mișcări / Plan / Obligații; Mai mult păstrează Setări, Sync, De verificat, Scadențe, Backup și Ghid.")}</p><button type="button" className={simpleMode ? "bf-primary" : "bf-secondary"} onClick={toggleSimple}>{simpleMode ? t("Mod simplu activ — arată tot") : t("Activează modul simplu")}</button></section><MemberModeSetup data={data} /><section className="bf-offline-only-card" aria-labelledby="bf-offline-only-title"><p className="bf-kicker">{t("DOAR OFFLINE")}</p><h2 id="bf-offline-only-title">{t("Fără Firebase pe acest telefon")}</h2><p>{t("Registrul rămâne local. Sync cloud nu se încarcă deloc până reactivezi.")}</p><button type="button" className={offlineOnly ? "bf-primary" : "bf-secondary"} onClick={toggleOfflineOnly}>{offlineOnly ? t("Doar offline activ — reactivează sync") : t("Activează doar offline")}</button></section><section><p className="bf-kicker">{t("FAMILIE")}</p><Field label={t("Numele familiei")}><input value={settings.familyName} onChange={(event) => change({ familyName: event.target.value })} /></Field><Field label={t("Numele tău")}><input value={settings.memberName} onChange={(event) => change({ memberName: event.target.value })} /></Field><div className="bf-family-timezone"><p className="bf-helper">{t("Ziua familiei („azi”, tranșa săptămânii) se socotește după fusul {zone}, pe toate telefoanele.", { zone: settings.familyTimeZone || deviceTimeZone() || "—" })}</p>{deviceTimeZone() && deviceTimeZone() !== settings.familyTimeZone && <button type="button" className="bf-link-button" onClick={() => change({ familyTimeZone: deviceTimeZone(), familyTimeZoneSetAt: new Date().toISOString() })}>{t("Folosește fusul acestui telefon ({zone})", { zone: deviceTimeZone() || "" })}</button>}</div><Field label={t("Cod local de familie")} hint={t("Nu leagă telefoanele. E doar un semn în backup-ul exportat, ca să recunoști fișierul. Conectarea se face din Sync, cu invitația familiei.")}><input value={settings.familyCode} onChange={(event) => change({ familyCode: event.target.value.toUpperCase() })} /><button className="bf-link-button" onClick={() => change({ familyCode: createFamilyCode() })}><RotateCcw size={14} /> {t("Cod nou")}</button></Field></section><section><p className="bf-kicker">{t("MEMBRI")}</p>{settings.members.filter((item) => item.kind !== "child").length < 2 && <FamilieUpgrade reason="member" />}<div className="bf-member-rows">{settings.members.map((item) => { const color = memberColor(settings.members, item.id); return <div className="bf-member-row" key={item.id}><button type="button" className="bf-member-color" style={{ background: color }} aria-label={t("Culoarea lui {name}: {color}. Atinge pentru alta.", { name: item.name, color: t(memberColorName(color)) })} onClick={() => change({ members: settings.members.map((memberItem) => memberItem.id === item.id ? { ...memberItem, color: nextMemberColor(color), updatedAt: new Date().toISOString() } : memberItem) })} /><b>{item.name}</b><label><input type="checkbox" checked={item.kind === "child"} onChange={(event) => change({ members: settings.members.map((memberItem) => memberItem.id === item.id ? { ...memberItem, kind: event.target.checked ? "child" as const : undefined, updatedAt: new Date().toISOString() } : memberItem) })} /> {t("Copil")}</label>{settings.members.length > 1 && <button aria-label={`Șterge membrul ${item.name}`} onClick={() => change({ members: settings.members.filter((memberItem) => memberItem.id !== item.id) })}><X size={14} /></button>}</div>; })}</div><small className="bf-helper">{t("Un membru marcat drept copil primește un ecran simplu de buzunar. Dă-i un plic pe numele lui, din Plan.")}</small><div className="bf-mini-form"><input value={member} onChange={(event) => setMember(event.target.value)} placeholder={t("ex. Soția")} /><button onClick={addMember}>{t("Adaugă")}</button></div></section><section><p className="bf-kicker">{t("SURSE ȘI SOLD INITIAL")}</p>{settings.paymentSources.map((item) => <SourceRow key={item.id} data={data} source={item} settings={settings} change={change} />)}<div className="bf-source-builder"><input value={source} onChange={(event) => setSource(event.target.value)} placeholder={t("ex. Card soție")} aria-label={t("Numele sursei")} /><select value={kind} onChange={(event) => setKind(event.target.value as PaymentKind)} aria-label={t("Tipul sursei")}>{Object.entries(sourceKindName).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select value={owner} disabled={kind === "transfer"} onChange={(event) => setOwner(event.target.value)} aria-label={t("Al cui este")}>{settings.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Valuta sursei">{supportedCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}</select><button onClick={addSource}>{t("Adaugă")}</button></div></section><ExchangeRatesSection data={data} settings={settings} change={change} /><section><p className="bf-kicker">{t("CATEGORII PROPRII")}</p><div className="bf-chip-list">{settings.customCategories.map((item) => <span key={item}>{item}<button onClick={() => change({ customCategories: settings.customCategories.filter((categoryItem) => categoryItem !== item) })}><X size={14} /></button></span>)}</div><div className="bf-mini-form"><input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="ex. Taxi" /><button onClick={() => { if (category.trim() && !settings.customCategories.includes(category.trim())) { change({ customCategories: [...settings.customCategories, category.trim()] }); setCategory(""); } }}>{t("Adaugă")}</button></div></section><MerchantRulesSection data={data} onChange={onChange} /><LocalAlertsSettings data={data} /><AppLockSettings /><section><p className="bf-kicker">{t("BACKUP ȘI RECUPERARE")}</p><h2>{t("Protejează registrul local")}</h2><p>{t("Backup-ul este un fișier local JSON. Nu este trimis automat în rețea și poate fi importat pe un alt dispozitiv.")}</p><p className="bf-helper">{t(BACKUP_SAVE_HELPER)}</p><div className="bf-backup-actions"><button onClick={() => void exportBackup("save")}><Download size={16} /> {t("Salvează pe telefon")}</button><button type="button" onClick={() => void exportBackup("share")}><Share2 size={16} /> {t("Trimite o copie")}</button><AutoBackupToggle /><label className="bf-file-button"><Upload size={16} /> {t("Alege backup")}<input type="file" accept=".json,application/json,text/plain,application/octet-stream" onChange={importBackup} /></label><button type="button" onClick={() => setPasteOpen((value) => !value)}><ClipboardPaste size={16} /> {t("Lipește text")}</button></div>{pasteOpen && <div className="bf-backup-paste"><label htmlFor="backup-paste">{t("Dacă selectorul de fișiere nu se deschide, deschide backupul cu orice aplicație de fișiere, copiază tot textul și lipește-l aici.")}</label><textarea id="backup-paste" value={pasted} onChange={(event) => setPasted(event.target.value)} rows={5} placeholder={`{"kind":"buget-familie-backup",…`} /><div className="bf-backup-paste-actions"><button type="button" onClick={() => { setPasteOpen(false); setPasted(""); }}>{t("Anulează")}</button><button type="button" className="bf-primary" disabled={!pasted.trim()} onClick={() => acceptBackupText(pasted.trim(), t("text lipit"))}>{t("Citește textul")}</button></div></div>}{backupPreview && <div className="bf-backup-preview" role="alert" aria-live="polite"><div><p className="bf-kicker">{t("PREVIZUALIZARE ÎNAINTE DE IMPORT")}</p><h3>{backupPreview.fileName}</h3><p>{t("Exportat la {when}.", { when: new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(backupPreview.exportedAt)) })}</p><div className="bf-backup-preview-stats"><span><b>{backupPreview.data.transactions.length}</b><small>{t("mișcări")}</small></span><span><b>{backupPreview.data.receipts.length}</b><small>{t("bonuri")}</small></span><span><b>{backupPreview.data.settings.members.length}</b><small>{t("membri")}</small></span></div></div><p className="bf-backup-warning">{t("Importul va înlocui datele locale actuale. Nimic nu se schimbă până nu confirmi.")}</p><div className="bf-backup-preview-actions"><button type="button" onClick={() => setBackupPreview(null)}>{t("Anulează")}</button><button type="button" className="bf-primary" onClick={confirmBackupImport}><Check size={16} /> {t("Confirmă importul")}</button></div></div>}</section><Suspense fallback={null}><TrustCenter /></Suspense><Suspense fallback={null}><PremiumStudio /></Suspense><section className="bf-danger"><p className="bf-kicker">{t("RESETARE")}</p><h2>{t("Începe curat pe acest dispozitiv")}</h2><p>{t("Șterge numai datele locale. O copie sincronizată sau exportată nu este afectată.")}</p><button onClick={onReset}><Trash2 size={16} /> {t("Resetează datele locale")}</button></section></div>;
}
