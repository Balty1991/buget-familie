/**
 * Ecranul Sync. Scos din home-secondary. Conectarea rămâne aceeași.
 * Starea live trăiește în Home, ca să reziste la schimbarea de tab.
 */
import { useEffect, useState } from "react";
import { Check, Cloud, Copy, KeyRound, RotateCcw, Send, ShieldAlert, Smartphone, UserRound, Users, X } from "lucide-react";
import { checkFamilyPassword } from "@/lib/family-password";
import { inviteMessage, parseInvite } from "@/lib/family-invite";
import { isNativeApp } from "@/lib/app-storage";
import { Field, type SyncPanelProps } from "@/pages/home-kit";
import { getLocale, t } from "@/lib/i18n";
import { canUseFamilySync } from "@/lib/entitlements";
import { FamilieUpgrade } from "@/components/FamilieUpgrade";

/**
 * Cât de greu e de ghicit parola de familie, spus pe loc.
 * Din ea se derivă identificatorul camerei de sincronizare, deci o parolă slabă
 * nu înseamnă doar „cineva citește”, ci „cineva poate suprascrie”.
 */
function PasswordMeter({ value }: { value: string }) {
  const verdict = checkFamilyPassword(value);
  return (
    <div className={`bf-password-meter s${verdict.score}`} role="status" aria-live="polite">
      <div className="bf-password-bars" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => <i key={index} className={index < verdict.score ? "on" : ""} />)}
      </div>
      <b>{verdict.label}</b>
      {verdict.advice.length > 0 && <small>{verdict.advice[0]}</small>}
    </div>
  );
}

/** Trimite invitația prin foaia de partajare a telefonului (WhatsApp, SMS…); fără ea, doar copiem. */
async function shareInvite(code: string): Promise<boolean> {
  const invite = parseInvite(code);
  if (!invite) return false;
  const text = inviteMessage(invite);
  try {
    if (isNativeApp()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: t("Invitație Buget Familie"), text });
      return true;
    }
    if (typeof navigator.share === "function") {
      await navigator.share({ title: t("Invitație Buget Familie"), text });
      return true;
    }
  } catch {
    // Anulat sau indisponibil: rămâne butonul de copiere.
  }
  return false;
}

/**
 * „Cine ești pe acest telefon?” — fiecare telefon notează pe membrul lui.
 * Alegerea rămâne pe telefon; numele membrilor se sincronizează.
 */
function SelfMemberPicker({ members, selfMemberId, needsChoice, onChoose, onAdd }: { members: SyncPanelProps["members"]; selfMemberId: string; needsChoice: boolean; onChoose: (id: string) => void; onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    onAdd(name);
    setName("");
    setAdding(false);
  };
  return (
    <section className={`bf-sync-self${needsChoice ? " is-needed" : ""}`} aria-labelledby="sync-self-title">
      <p className="bf-kicker">{t("PE ACEST TELEFON")}</p>
      <h3 id="sync-self-title"><UserRound size={16} aria-hidden="true" /> {t("Cine ești pe acest telefon?")}</h3>
      <p className="bf-helper">{needsChoice
        ? t("Alege-ți numele, ca tot ce notezi de aici să apară pe tine, nu pe celălalt telefon.")
        : t("Ce notezi de aici apare pe acest membru. Celălalt telefon își alege singur membrul lui.")}</p>
      <div className="bf-sync-self-options" role="radiogroup" aria-labelledby="sync-self-title">
        {members.map((member) => (
          <button key={member.id} type="button" role="radio" aria-checked={member.id === selfMemberId && !needsChoice} className={member.id === selfMemberId && !needsChoice ? "active" : ""} onClick={() => onChoose(member.id)}>
            {member.name}
          </button>
        ))}
        <button type="button" className={adding ? "active" : ""} onClick={() => setAdding((value) => !value)}>{t("Altcineva")}</button>
      </div>
      {adding && (
        <div className="bf-sync-self-add">
          <Field label={t("Numele tău")}>
            <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") add(); }} maxLength={40} placeholder="ex. Ioana" />
          </Field>
          <button type="button" className="bf-secondary" disabled={!name.trim()} onClick={add}>{t("Sunt eu")}</button>
        </div>
      )}
    </section>
  );
}

export function SyncPanel({ connected, busy, online, password, setPassword, notice, lastSync, journal, devices, thisDeviceId, onConnect, onDisconnect, onClearJournal, onRevokeDevice, onRestoreDevice, passwordRevealOnce, clearPasswordReveal, recoveryRevealOnce, clearRecoveryReveal, recoveryIssued, onRecoverPassword, onIssueRecovery, sessionRemembered, invite, inviteDraft, setInviteDraft, onCreateRoom, onJoinInvite, onMoveToInvite, members, selfMemberId, needsSelfChoice, onChooseSelf, onAddSelf }: SyncPanelProps) {
  const [showGenerated, setShowGenerated] = useState(Boolean(passwordRevealOnce));
  const [generatedOnce, setGeneratedOnce] = useState(passwordRevealOnce || "");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(Boolean(passwordRevealOnce));
  const [moveConfirm, setMoveConfirm] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryShown, setRecoveryShown] = useState(recoveryRevealOnce || "");
  const [showSessionPassword, setShowSessionPassword] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState("");
  useEffect(() => {
    if (!passwordRevealOnce) return;
    setPassword(passwordRevealOnce);
    setGeneratedOnce(passwordRevealOnce);
    setShowGenerated(true);
    setLegacyOpen(true);
    clearPasswordReveal?.();
  }, [passwordRevealOnce, setPassword, clearPasswordReveal]);
  useEffect(() => {
    if (!recoveryRevealOnce) return;
    setRecoveryShown(recoveryRevealOnce);
    clearRecoveryReveal?.();
  }, [recoveryRevealOnce, clearRecoveryReveal]);
  const latest = journal[0];
  const pendingMerge = connected && latest?.status === "detected";
  const failedMerge = connected && latest?.status === "failed";
  const stateLabel = busy
    ? t("Se conectează…")
    : !online
      ? (connected ? t("Offline — sesiune activă, fără rețea") : t("Fără conexiune"))
    : !connected
      ? t("Nu este conectat")
      : pendingMerge
        ? t("Conectat — unire în așteptare")
        : failedMerge
          ? t("Conectat — ultima unire a eșuat")
          : lastSync
            ? t("Conectat — sincronizat")
            : t("Conectat — așteptăm prima confirmare");
  const stateClass = busy ? "busy" : !online ? "offline" : !connected ? "idle" : pendingMerge || failedMerge ? "busy" : "connected";
  const stateDetail = !online
    ? t("Rețeaua lipsește. Registrul local rămâne intact; sync-ul se reia automat la reconectare.")
    : lastSync
    ? t("Ultima confirmare: {time}", { time: new Intl.DateTimeFormat(getLocale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(lastSync)) })
    : connected
      ? t("Așteptăm prima confirmare de la spațiul familiei.")
      : t("Conectează acest telefon pentru a vedea actualizările celorlalte dispozitive.");

  const copySecret = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSecret(value);
      window.setTimeout(() => setCopiedSecret((current) => current === value ? "" : current), 2500);
      return;
    } catch { /* fallback below */ }
    try {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand("copy");
      field.remove();
      if (!ok) throw new Error("copy");
      setCopiedSecret(value);
      window.setTimeout(() => setCopiedSecret((current) => current === value ? "" : current), 2500);
    } catch {
      window.alert(t("Nu am putut copia. Selectează codul și copiază-l tu."));
    }
  };

  return <div className="bf-sync">
    {!canUseFamilySync() ? <FamilieUpgrade reason="sync" /> : null}
    <div className="bf-sync-hero"><Users size={25} /><p className="bf-kicker">{t("FAMILIE CONECTATĂ")}</p><h2>{connected ? t("Sesiunea familiei este activă.") : t("Sincronizare criptată, în timp real, între telefoane.")}</h2><p>{t("Datele se criptează pe telefon; serverul vede doar un pachet pe care nu-l poate citi. Pozele bonurilor rămân pe telefon.")}</p></div>
    <aside className="bf-sync-local-only" role="note">
      <p className="bf-kicker">{t("CE SE SINCRONIZEAZĂ")}</p>
      <ul>
        <li>{t("Mișcări, plicuri, scadențe, datorii, economii")}</li>
        <li>{t("Membri, surse și planul până la salariu")}</li>
        <li>{t("Rezumatul cozii De verificat (titlu, sumă, dată — fără poze)")}</li>
      </ul>
      <p className="bf-kicker">{t("CE NU SE SINCRONIZEAZĂ")}</p>
      <p>{t("Rămân doar pe acest telefon — partenerul nu le vede automat:")}</p>
      <ul>
        <li>{t("Fotografiile bonurilor")}</li>
        <li>{t("Confirmarea din De verificat (doar pe telefonul care a creat propunerea)")}</li>
        <li>{t("Regulile de comerciant")}</li>
        <li>{t("Șabloanele rapide")}</li>
        <li>{t("Cache-ul de curs valutar (FX)")}</li>
      </ul>
      <p>{t("Pe sume de plic și pe aceeași mișcare editată pe două telefoane: alegi tu local/remote — nu unificăm tăcut banii. Pentru alte câmpuri (notițe, etichete), ultima scriere câștigă.")}</p>
    </aside>
    <div className={`bf-sync-state ${stateClass}`} role="status"><span aria-hidden="true">{connected && !busy && !pendingMerge && !failedMerge ? <Check size={15} /> : busy || pendingMerge ? <RotateCcw size={15} /> : <Cloud size={15} />}</span><div><b>{stateLabel}</b><small>{stateDetail}</small></div></div>

    <section className="bf-sync-session">
      <p className="bf-kicker">{connected ? t("CONECTAT") : t("CONECTEAZĂ FAMILIA")}</p>
      {connected ? <>
        <p><b>{t("Actualizare live, fără reîmprospătare manuală")}</b><br />{t("Cât aplicația rămâne deschisă pe orice telefon din familie, mișcările apar automat pe toate celelalte în câteva secunde.")}</p>
        {sessionRemembered && <p className="bf-helper">{invite ? t("Telefonul se reconectează singur când redeschizi aplicația.") : t("Telefonul se reconectează singur când redeschizi aplicația. Parola nu e păstrată, doar o cheie făcută din ea.")}</p>}
        {invite ? (
          <div className="bf-sync-invite">
            <p className="bf-kicker">{t("INVITĂ UN TELEFON")}</p>
            <p>{t("Trimite invitația partenerului. Pe telefonul lui: Sync → „Am primit o invitație” → lipește mesajul.")}</p>
            <div className="bf-sync-invite-actions">
              <button type="button" className="bf-primary" onClick={() => void shareInvite(invite).then((shared) => { if (!shared) void copySecret(inviteMessage(parseInvite(invite)!)); })}><Send size={16} /> {t("Trimite invitația")}</button>
              <button type="button" className="bf-secondary" onClick={() => void copySecret(inviteMessage(parseInvite(invite)!))}><Copy size={16} /> {copiedSecret === inviteMessage(parseInvite(invite)!) ? t("Copiat în clipboard") : t("Copiază invitația")}</button>
            </div>
            <p className="bf-helper">{t("Cine are invitația intră în familie. Trimite-o doar oamenilor din casă.")}</p>
          </div>
        ) : (
          <div className="bf-sync-move" role="note">
            <p className="bf-kicker">{t("CAMERĂ CU PAROLĂ")}</p>
            <p>{t("Familia folosește încă o cameră făcută din parolă. Două familii cu aceeași parolă ajung în aceeași cameră, iar o parolă ghicită deschide datele. Mută familia într-o cameră nouă, cu invitație.")}</p>
            {moveConfirm ? (
              <div className="bf-sync-invite-actions">
                <button type="button" className="bf-primary" disabled={busy || !online} onClick={() => { setMoveConfirm(false); onMoveToInvite(); }}>{t("Da, mută familia")}</button>
                <button type="button" className="bf-secondary" onClick={() => setMoveConfirm(false)}>{t("Anulează")}</button>
                <p className="bf-helper">{t("Celelalte telefoane se opresc până primesc invitația nouă. Datele lor nu se pierd: se unesc când intră.")}</p>
              </div>
            ) : (
              <button type="button" className="bf-secondary" disabled={busy || !online} onClick={() => setMoveConfirm(true)}>{t("Mută familia")}</button>
            )}
          </div>
        )}
        {recoveryShown && (
          <div className="bf-notice bf-sync-secret" role="status">
            <p><KeyRound size={14} /> {t("Notează acest cod o dată, pe hârtie, nu în telefon. Cu el poți scoate parola dacă o uiți.")}</p>
            <code className="bf-sync-password-once">{recoveryShown}</code>
            <button type="button" className="bf-secondary" onClick={() => void copySecret(recoveryShown)}>
              <Copy size={16} /> {copiedSecret === recoveryShown ? t("Copiat în clipboard") : t("Copiază codul")}
            </button>
          </div>
        )}
        <div className="bf-sync-recovery-actions">
          {!invite && <button type="button" className="bf-link-button" onClick={() => setShowSessionPassword((value) => !value)}>
            {showSessionPassword ? t("Ascunde parola acestei sesiuni") : t("Arată parola acestei sesiuni")}
          </button>}
          <button type="button" className="bf-link-button" onClick={onIssueRecovery} disabled={busy}>
            {recoveryIssued ? t("Cod nou de recuperare") : t("Creează cod de recuperare")}
          </button>
        </div>
        {showSessionPassword && !password && (
          <p className="bf-helper" role="status">{t("Sesiunea s-a reluat singură, iar parola nu e păstrată pe telefon. Dacă ai uitat-o, folosește codul de recuperare.")}</p>
        )}
        {showSessionPassword && password && (
          <div className="bf-notice bf-sync-secret" role="status">
            <p>{t("Parola acestei sesiuni (doar cât ești conectat):")}</p>
            <code className="bf-sync-password-once">{password}</code>
            <button type="button" className="bf-secondary" onClick={() => void copySecret(password)}>
              <Copy size={16} /> {copiedSecret === password ? t("Copiat în clipboard") : t("Copiază parola")}
            </button>
          </div>
        )}
        {recoveryIssued && !recoveryShown && (
          <p className="bf-helper">{t("Un cod de recuperare există deja. E cel notat la prima conectare. Poți emite altul — cel vechi rămâne valabil până schimbați parola.")}</p>
        )}
        <button className="bf-link-button" onClick={onDisconnect}>{t("Închide sesiunea acestui telefon")}</button>
      </> : <>
        <div className="bf-sync-backup-reminder" role="note">
          <ShieldAlert size={16} aria-hidden="true" />
          <p>{t("Înainte de reinstalare sau de schimbarea telefonului: exportă un backup din Setări și păstrează codul de recuperare.")}</p>
        </div>
        <div className="bf-sync-start">
          <p><b>{t("Primul telefon din familie")}</b><br />{t("Creează camera familiei, apoi trimite invitația celorlalte telefoane. Nu ai nevoie de cont sau de parolă.")}</p>
          <button className="bf-primary full" disabled={busy || !online} onClick={onCreateRoom}><Users size={17} /> {t("Creează camera")}</button>
        </div>
        <div className={`bf-sync-start${inviteDraft ? " is-offered" : ""}`}>
          <p><b>{t("Am primit o invitație")}</b><br />{t("Lipește mesajul sau linkul primit de la partener.")}</p>
          <Field label={t("Invitația")}>
            <textarea value={inviteDraft} onChange={(event) => setInviteDraft(event.target.value)} rows={3} placeholder={t("Lipește invitația aici")} autoComplete="off" spellCheck={false} />
          </Field>
          <button className="bf-primary full" disabled={busy || !online || !parseInvite(inviteDraft)} onClick={() => onJoinInvite(inviteDraft)}><Users size={17} /> {t("Intră în familie")}</button>
          {inviteDraft.trim() && !parseInvite(inviteDraft) && <p className="bf-form-error">{t("Codul nu arată ca o invitație. Lipește tot mesajul primit sau tot linkul.")}</p>}
        </div>
        <button type="button" className="bf-link-button" aria-expanded={legacyOpen} onClick={() => setLegacyOpen((value) => !value)}>{t("Am o parolă de familie")}</button>
        {legacyOpen && <>
        <p className="bf-helper">{t("Doar pentru camerele create înainte de invitații. Trebuie să fie identică, literă cu literă, cu cea de pe celelalte telefoane.")}</p>
        <Field label={t("Parola familiei")}>
          <input type={showGenerated ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setShowGenerated(false); }} placeholder={t("12+ caractere")} autoComplete="current-password" />
          {password.length > 0 && <PasswordMeter value={password} />}
        </Field>
        {showGenerated && generatedOnce && (
          <div className="bf-notice bf-sync-secret" role="status">
            <p><KeyRound size={14} /> {t("Parola găsită cu codul de recuperare. Noteaz-o în afara telefonului:")}</p>
            <code className="bf-sync-password-once">{generatedOnce}</code>
          </div>
        )}
        <p className="bf-helper">{t("Parola nu se salvează pe telefon și nu este trimisă niciodată necriptată. Telefonul ține minte doar o cheie făcută din ea, ca să se reconecteze singur.")}</p>
        <button className="bf-secondary full" disabled={busy || !online} onClick={onConnect}><KeyRound size={17} /> {t("Conectează cu parola")}</button>
        </>}
        <button type="button" className="bf-link-button" onClick={() => setForgotOpen((value) => !value)}>{t("Am un cod de recuperare")}</button>
        {forgotOpen && (
          <div className="bf-sync-forgot">
            <p className="bf-kicker">{t("RECUPERARE")}</p>
            <p className="bf-helper">{t("Introdu codul notat pe hârtie când s-a creat camera (sau la prima conectare, la camerele vechi). Arată așa: XXXX-XXXX-XXXX-XXXX.")}</p>
            <Field label={t("Cod de recuperare")}>
              <input value={recoveryInput} onChange={(event) => setRecoveryInput(event.target.value.toUpperCase())} placeholder={t("Codul notat")} autoComplete="off" spellCheck={false} />
            </Field>
            <button type="button" className="bf-secondary" disabled={busy || !online || recoveryInput.replace(/[^A-Z0-9]/gi, "").length < 16} onClick={() => onRecoverPassword(recoveryInput)}>
              {t("Recuperează accesul")}
            </button>
          </div>
        )}
      </>}
    </section>

    {connected && members.length > 0 && <SelfMemberPicker members={members} selfMemberId={selfMemberId} needsChoice={needsSelfChoice} onChoose={onChooseSelf} onAdd={onAddSelf} />}

    {(connected || devices.length > 0) && (
      <section className="bf-sync-devices" aria-labelledby="sync-devices-title">
        <div className="bf-sync-journal-heading">
          <div>
            <p className="bf-kicker">{t("DISPOZITIVE")}</p>
            <h3 id="sync-devices-title">{t("Telefoane în cameră")}</h3>
          </div>
        </div>
        <p className="bf-helper">{t("Revocarea scoate sesiunea de pe acel telefon. Dacă telefonul e pierdut și cineva știe parola, schimbați parola familiei — e singura încuietoare reală.")}</p>
        {devices.length ? (
          <ul className="bf-sync-device-list">
            {devices.map((device) => (
              <li key={device.id} className={device.revokedAt ? "is-revoked" : undefined}>
                <Smartphone size={16} aria-hidden="true" />
                <div>
                  <b>{device.label}{device.id === thisDeviceId ? ` · ${t("acest telefon")}` : ""}{device.revokedAt ? ` · ${t("revocat")}` : ""}</b>
                  <small>{t("Ultima dată văzut")}: {new Intl.DateTimeFormat(getLocale(), { dateStyle: "short", timeStyle: "short" }).format(new Date(device.lastSeenAt))}</small>
                </div>
                {device.revokedAt ? (
                  <button type="button" className="bf-link-button" onClick={() => onRestoreDevice(device.id)}>
                    {t("Reactivează")}
                  </button>
                ) : (
                  <button type="button" className="bf-link-button" onClick={() => onRevokeDevice(device.id)}>
                    {device.id === thisDeviceId ? t("Revocă acest telefon") : t("Revocă")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="bf-helper">{t("După conectare, telefoanele apar aici cu ultima dată văzută.")}</p>
        )}
      </section>
    )}

    {lastSync && <p className="bf-helper">Ultima actualizare: {new Intl.DateTimeFormat(getLocale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(lastSync))}</p>}
    {notice && <p className="bf-notice" role="status"><Check size={15} /> {notice}</p>}
    <section className="bf-sync-journal" aria-labelledby="sync-journal-title">
      <div className="bf-sync-journal-heading">
        <div>
          <p className="bf-kicker">{t("ISTORIC DE ACTUALIZĂRI")}</p>
          <h3 id="sync-journal-title">{t("Ce s-a întâmplat la sincronizare")}</h3>
        </div>
        {journal.length > 0 && <button className="bf-link-button" onClick={onClearJournal}>{t("Curăță istoricul")}</button>}
      </div>
      {journal.length ? (
        <div className="bf-sync-journal-list">
          {journal.map((entry) => (
            <article key={entry.id} className={`bf-sync-journal-entry ${entry.status}`}>
              <div className="bf-sync-journal-icon" aria-hidden="true">{entry.status === "resolved" ? <Check size={15} /> : entry.status === "failed" ? <X size={15} /> : <RotateCcw size={15} />}</div>
              <div>
                <strong>{entry.status === "resolved" ? t("Actualizare reunită") : entry.status === "failed" ? t("Actualizare eșuată") : t("Actualizare detectată")}</strong>
                <p>{entry.message}</p>
                <small>{new Intl.DateTimeFormat(getLocale(), { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))} · {entry.action}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="bf-helper">{t("Nu există actualizări înregistrate pe acest dispozitiv. Când un alt telefon trimite mișcări noi, aici vei vedea ce a fost reunit automat.")}</p>
      )}
    </section>
  </div>;
}
