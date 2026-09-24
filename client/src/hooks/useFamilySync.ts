/**
 * Sincronizare familie: conectare, push debounce, unire remote, jurnal, dispozitive.
 * Pozele bonurilor rămân pe telefon; pachetul trimis e fără imageData.
 * Sesiunea se reia singură la pornire din cheia păstrată în family-session (nu din parolă).
 */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createEmptyAppData, newId, normalizeAppData, type AppData } from "@/lib/finance-data";
import { checkFamilyPassword } from "@/lib/family-password";
import { touchSyncDevice, revokeSyncDevice, restoreSyncDevice, isThisDeviceRevoked, listSyncDevices, getOrCreateDeviceId } from "@/lib/sync-devices";
import { readSyncJournal, writeSyncJournal, type SyncJournalEntry } from "@/lib/app-storage";
import type { EncryptedEnvelope, FamilySecret } from "@/lib/family-crypto";
import { clearFamilySession, loadFamilySession, saveFamilySession } from "@/lib/family-session";
import { refreshRoomEntitlement, setActiveFamilyRoom } from "@/lib/billing";
import { createFamilyInvite, formatInvite, parseInvite, type FamilyInvite } from "@/lib/family-invite";
import { addSelfMember, chooseSelfMember, claimOwnMember, needsSelfChoice, selfMemberIdOf } from "@/lib/member-identity";
import { safeSetItem } from "@/lib/safe-storage";
import { notifyFamilyEnvelopeChanges } from "@/lib/local-notifications";
import { t } from "@/lib/i18n";
import { isOfflineOnly } from "@/lib/ui-prefs";
import type { SyncPanelProps } from "@/pages/home-kit";
import { askConfirm } from "@/lib/confirm-dialog";

const loadFamilySync = () => import("@/lib/realtime-sync");
const loadFamilyCrypto = () => import("@/lib/family-crypto");
const loadFamilyRecovery = () => import("@/lib/family-recovery");

/** Omul a închis singur sesiunea: nu o reluăm și nu-l certăm cu bannerul „sync oprit”. */
const CLOSED_KEY = "buget-familie:sync-closed";
const readClosed = () => { try { return window.localStorage.getItem(CLOSED_KEY) === "1"; } catch { return false; } };
const writeClosed = (closed: boolean) => {
  try {
    if (closed) safeSetItem(window.localStorage, CLOSED_KEY, "1");
    else window.localStorage.removeItem(CLOSED_KEY);
  } catch { /* stocare blocată: bannerul poate apărea, nimic mai grav */ }
};

/** Serializare fără poze — același format pentru localStorage și push familie. */
export const syncPortable = (value: AppData) =>
  JSON.stringify({
    ...value,
    receipts: value.receipts.map(({ imageData: _one, imageData2: _two, imageKeys: _keys, ...rest }) => rest),
  });

export function useFamilySync(
  data: AppData,
  setData: Dispatch<SetStateAction<AppData>>,
  /** Registrul s-a încărcat din stocare; până atunci reluarea ar uni camera cu un registru gol. */
  storageReady = true,
) {
  const [syncPassword, setSyncPassword] = useState("");
  const [syncPasswordReveal, setSyncPasswordReveal] = useState("");
  const [syncRecoveryReveal, setSyncRecoveryReveal] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncConnected, setSyncConnected] = useState(false);
  const [syncLastSync, setSyncLastSync] = useState("");
  /** Încercarea de reluare automată s-a terminat (reușită sau nu); până atunci nu arătăm „oprit”. */
  const [syncResumeSettled, setSyncResumeSettled] = useState(false);
  const [syncHasSession, setSyncHasSession] = useState(false);
  /** Codul invitației camerei curente; lipsește la camerele vechi, cu parolă. */
  const [syncInvite, setSyncInvite] = useState("");
  /** Invitație primită prin link, pusă deja în câmp ca omul doar să confirme. */
  const [syncInviteDraft, setSyncInviteDraft] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  const [syncJournal, setSyncJournal] = useState<SyncJournalEntry[]>(readSyncJournal);

  const syncDataRef = useRef(data);
  syncDataRef.current = data;
  const syncPasswordRef = useRef(syncPassword);
  syncPasswordRef.current = syncPassword;
  /** Cu ce se criptează: cheia PBKDF2 neexportabilă (sau parola, dacă stocarea cheii lipsește). */
  const syncSecretRef = useRef<FamilySecret>("");
  const syncResumeTriedRef = useRef(false);
  const syncRoomIdRef = useRef<string | undefined>(undefined);
  const syncUnsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const syncLastPortableRef = useRef("");
  const syncPushTimerRef = useRef<number | undefined>(undefined);

  const syncAppendJournal = (entry: Omit<SyncJournalEntry, "id">) =>
    setSyncJournal((current) => {
      const next = [{ ...entry, id: newId("sync-log") }, ...current].slice(0, 40);
      writeSyncJournal(next);
      return next;
    });

  const syncRetainLocalReceiptImages = (value: AppData): AppData => ({
    ...value,
    receipts: value.receipts.map((receipt) => {
      const local = syncDataRef.current.receipts.find((item) => item.id === receipt.id);
      return { ...receipt, imageData: local?.imageData, imageData2: local?.imageData2, imageKeys: local?.imageKeys };
    }),
  });

  const markRecoveryIssued = (value: AppData): AppData => ({
    ...value,
    settings: { ...value.settings, syncRecoveryIssuedAt: value.settings.syncRecoveryIssuedAt || new Date().toISOString() },
  });

  const issueRecoveryIfNeeded = async (current: AppData, password: string, force: boolean) => {
    if (!force && current.settings.syncRecoveryIssuedAt) return { data: current };
    const recovery = await loadFamilyRecovery();
    const code = recovery.generateRecoveryCode();
    const wrap = await recovery.wrapFamilyPassword(password, code);
    const lookupId = await recovery.deriveRecoveryLookupId(code);
    try {
      const syncApi = await loadFamilySync();
      await syncApi.pushRecoveryWrap(lookupId, wrap);
    } catch {
      return {
        data: current,
        warning: t("Codul de recuperare nu a putut fi salvat. Lipește regulile noi în Firebase Console (familyRecovery), apoi apasă din nou „Creează cod de recuperare”."),
      };
    }
    return { code, data: markRecoveryIssued(current) };
  };

  const recoverWithCode = async (code: string) => {
    if (isOfflineOnly()) {
      setSyncNotice(t("Modul „doar offline” este activ. Dezactivează-l din Setări ca să folosești Sync."));
      return;
    }
    setSyncBusy(true);
    try {
      const recovery = await loadFamilyRecovery();
      const lookupId = await recovery.deriveRecoveryLookupId(code);
      const syncApi = await loadFamilySync();
      const wrap = await syncApi.fetchRecoveryWrap(lookupId);
      if (!wrap) {
        setSyncNotice(t("Nu am găsit acest cod de recuperare. Verifică-l sau folosește un backup din Setări."));
        return;
      }
      const password = await recovery.unwrapFamilyPassword(wrap, code);
      if (parseInvite(password)) {
        // Camerele cu invitație păstrează codul invitației în spatele codului de recuperare.
        setSyncInviteDraft(password);
        setSyncNotice(t("Am găsit invitația familiei. Apasă „Intră în familie”."));
        return;
      }
      setSyncPassword(password);
      setSyncPasswordReveal(password);
      setSyncNotice(t("Am găsit parola. Noteaz-o, apoi conectează acest telefon."));
    } catch (error) {
      setSyncNotice(error instanceof Error ? error.message : t("Codul de recuperare e greșit sau pachetul nu poate fi decriptat."));
    } finally {
      setSyncBusy(false);
    }
  };

  const syncDisconnect = () => {
    setActiveFamilyRoom(undefined);
    syncUnsubscribeRef.current?.();
    syncUnsubscribeRef.current = undefined;
    syncRoomIdRef.current = undefined;
    syncSecretRef.current = "";
    window.clearTimeout(syncPushTimerRef.current);
    setSyncConnected(false);
    setSyncPassword("");
    setSyncInvite("");
    setSyncHasSession(false);
    writeClosed(true);
    void clearFamilySession();
    setSyncNotice(t("Sesiunea a fost închisă pe acest telefon."));
  };

  /** Camera veche, cu parolă, a fost golită după mutarea familiei pe invitație. */
  const syncStopMovedRoom = () => {
    setActiveFamilyRoom(undefined);
    syncUnsubscribeRef.current?.();
    syncUnsubscribeRef.current = undefined;
    syncRoomIdRef.current = undefined;
    syncSecretRef.current = "";
    window.clearTimeout(syncPushTimerRef.current);
    setSyncConnected(false);
    setSyncHasSession(false);
    void clearFamilySession();
    setSyncNotice(t("Familia s-a mutat într-o cameră nouă, cu invitație. Cere invitația de pe telefonul care a mutat-o și lipește-o la „Am primit o invitație”. Datele de pe acest telefon rămân și se unesc la intrare."));
  };

  const syncHandleRemoteEnvelope = async (envelope: EncryptedEnvelope) => {
    try {
      const crypto = await loadFamilyCrypto();
      const remoteData = normalizeAppData(await crypto.decryptFamilyData(envelope, syncSecretRef.current));
      if (remoteData.settings.syncRoomMovedAt) {
        syncStopMovedRoom();
        return;
      }
      const merged = syncRetainLocalReceiptImages(crypto.mergeFamilyData(syncDataRef.current, remoteData));
      const mergedPortable = syncPortable(merged);
      if (mergedPortable === syncPortable(syncDataRef.current)) {
        setSyncLastSync(new Date().toISOString());
        return;
      }
      const previous = syncDataRef.current;
      if (isThisDeviceRevoked(merged)) {
        setData(merged);
        syncDisconnect();
        setSyncNotice(t("Acest telefon a fost revocat din cameră. Pe un telefon rămas în familie, apasă Reactivare — sau schimbați parola familiei."));
        return;
      }
      syncLastPortableRef.current = mergedPortable;
      setData(merged);
      setSyncLastSync(new Date().toISOString());
      void notifyFamilyEnvelopeChanges(previous, merged).catch(() => undefined);
      syncAppendJournal({
        createdAt: new Date().toISOString(),
        status: "resolved",
        message: t("Actualizare primită de la un alt telefon conectat."),
        action: t("Datele au fost reunite automat prin ID și marcaj de actualizare."),
      });
    } catch (error) {
      syncAppendJournal({
        createdAt: new Date().toISOString(),
        status: "failed",
        message: error instanceof Error ? error.message : "Pachetul primit nu a putut fi decriptat.",
        action: t("Verifică să fie exact aceeași parolă pe toate telefoanele."),
      });
      setSyncNotice(error instanceof Error ? error.message : "Un pachet primit nu a putut fi decriptat.");
    }
  };

  /**
   * Intră în cameră: unește pachetul existent, își ia membrul propriu la prima intrare,
   * trimite și ascultă. `password` lipsește la reluarea automată (parola nu e păstrată).
   */
  const syncOpenRoom = async (roomId: string, secret: FamilySecret, options: { password?: string; invite?: string; mode: "create" | "join" | "resume" }) => {
    const crypto = await loadFamilyCrypto();
    const syncApi = await loadFamilySync();
    const remoteEnvelope = await syncApi.fetchFamilyEnvelope(roomId);
    let merged = syncDataRef.current;
    if (!remoteEnvelope && options.mode === "join") {
      // Nu facem camere noi din parolă sau dintr-o invitație greșită: ar fi o cameră goală, separată de familie.
      setSyncNotice(options.invite
        ? t("Nu am găsit camera din această invitație. Verifică să fi copiat tot codul sau cere o invitație nouă.")
        : t("Nu există nicio cameră cu această parolă. Camerele noi se fac cu „Creează camera”, iar partenerul intră cu invitația."));
      return false;
    }
    if (remoteEnvelope) {
      const remoteData = normalizeAppData(await crypto.decryptFamilyData(remoteEnvelope, secret));
      if (remoteData.settings.syncRoomMovedAt) {
        syncStopMovedRoom();
        return false;
      }
      const own = claimOwnMember(syncDataRef.current, remoteData, getOrCreateDeviceId());
      merged = syncRetainLocalReceiptImages(crypto.mergeFamilyData(own, remoteData));
    }
    if (isThisDeviceRevoked(merged)) {
      setData(merged);
      await clearFamilySession();
      setSyncHasSession(false);
      setSyncNotice(t("Acest telefon a fost revocat din cameră. Pe un telefon rămas în familie, apasă Reactivare — sau schimbați parola familiei."));
      return false;
    }
    merged = touchSyncDevice(merged);
    // Codul de recuperare încuie parola (camere vechi) sau codul invitației (camere noi).
    const recoverable = options.invite || options.password;
    const recovery = recoverable ? await issueRecoveryIfNeeded(merged, recoverable, options.mode === "create") : { data: merged };
    merged = recovery.data;
    syncLastPortableRef.current = syncPortable(merged);
    setData(merged);
    const envelope = await crypto.encryptFamilyData(merged, secret);
    await syncApi.pushFamilyEnvelope(roomId, envelope);
    syncRoomIdRef.current = roomId;
    syncSecretRef.current = secret;
    syncUnsubscribeRef.current?.();
    syncUnsubscribeRef.current = syncApi.subscribeFamilyRoom(
      roomId,
      (incoming) => void syncHandleRemoteEnvelope(incoming),
      (error) => setSyncNotice(error.message),
    );
    setSyncConnected(true);
    setActiveFamilyRoom(roomId);
    void refreshRoomEntitlement(roomId);
    setSyncInvite(options.invite || "");
    setSyncLastSync(new Date().toISOString());
    writeClosed(false);
    if ("code" in recovery && recovery.code) setSyncRecoveryReveal(recovery.code);
    setSyncNotice(
      ("warning" in recovery && recovery.warning)
        || ("code" in recovery && recovery.code
          ? t("Sesiunea e activă. Notează codul de recuperare pe hârtie — nu îl mai arătăm.")
          : t("Sesiunea familiei este activă. Actualizările apar automat pe toate telefoanele conectate, fără reîmprospătare manuală.")),
    );
    return true;
  };

  const syncConnect = async () => {
    if (isOfflineOnly()) {
      setSyncNotice(t("Modul „doar offline” este activ. Dezactivează-l din Setări ca să folosești Sync."));
      return;
    }
    const strength = checkFamilyPassword(syncPassword);
    if (!strength.ok) {
      setSyncNotice(`${strength.label}. ${strength.advice.join(" ")}`);
      return;
    }
    setSyncBusy(true);
    try {
      const crypto = await loadFamilyCrypto();
      const roomId = await crypto.deriveFamilyRoomId(syncPassword);
      const material = await crypto.importFamilyKeyMaterial(syncPassword);
      if (await syncOpenRoom(roomId, material, { password: syncPassword, mode: "join" })) {
        const saved = await saveFamilySession(roomId, material);
        setSyncHasSession(saved);
      }
    } catch (error) {
      setSyncNotice(error instanceof Error ? error.message : t("Familia nu a putut fi conectată."));
    } finally {
      setSyncBusy(false);
    }
  };

  /** Intră într-o cameră cu invitație (nouă sau existentă) și ține minte sesiunea. */
  const syncEnterInvite = async (invite: FamilyInvite, mode: "create" | "join") => {
    const crypto = await loadFamilyCrypto();
    const code = formatInvite(invite);
    const material = await crypto.importFamilyKeyMaterial(invite.key);
    if (!(await syncOpenRoom(invite.roomId, material, { invite: code, mode }))) return false;
    setSyncHasSession(await saveFamilySession(invite.roomId, material, code));
    return true;
  };

  const syncGuarded = async (work: () => Promise<unknown>, failure: string) => {
    if (isOfflineOnly()) {
      setSyncNotice(t("Modul „doar offline” este activ. Dezactivează-l din Setări ca să folosești Sync."));
      return;
    }
    setSyncBusy(true);
    try {
      await work();
    } catch (error) {
      setSyncNotice(error instanceof Error ? error.message : failure);
    } finally {
      setSyncBusy(false);
    }
  };

  const syncCreateRoom = () => syncGuarded(async () => {
    if (await syncEnterInvite(createFamilyInvite(), "create")) {
      setSyncNotice(t("Camera familiei e gata. Trimite invitația partenerului și notează codul de recuperare."));
    }
  }, t("Camera familiei nu a putut fi creată."));

  const syncJoinInvite = (raw: string) => syncGuarded(async () => {
    const invite = parseInvite(raw);
    if (!invite) {
      setSyncNotice(t("Codul nu arată ca o invitație. Lipește tot mesajul primit sau tot linkul."));
      return;
    }
    /**
     * Invitația poate veni de la oricine: un link, un mesaj sau altă aplicație de pe telefon.
     * La intrare, tot registrul de pe telefon pleacă în camera aceea; întrebăm limpede înainte.
     */
    const current = syncDataRef.current;
    const hasLocalData = current.transactions.length > 0 || current.debts.length > 0 || current.savings.length > 0 || current.settings.salaryPlan.allocations.length > 0 || current.settings.paymentSources.some((source) => source.openingBalance > 0);
    if (hasLocalData && !(await askConfirm(
      t("Tot ce e pe acest telefon (mișcări, plicuri, datorii) va fi trimis și văzut în camera din invitație. Intră doar dacă invitația e de la cineva din casa ta."),
      { title: t("Intri în această familie?"), confirmLabel: t("Da, intru") },
    ))) return;
    if (await syncEnterInvite(invite, "join")) setSyncInviteDraft("");
  }, t("Nu am putut intra în familie."));

  /**
   * Mută o familie dintr-o cameră cu parolă într-una cu invitație. Camera veche e
   * suprascrisă cu un pachet gol care spune doar „s-a mutat”, fără cheia nouă: cine
   * ghicește parola nu mai găsește nimic, iar celelalte telefoane se opresc și cer invitația.
   */
  const syncMoveToInvite = () => syncGuarded(async () => {
    const oldRoomId = syncRoomIdRef.current;
    const oldSecret = syncSecretRef.current;
    if (!syncConnected || !oldRoomId || !oldSecret || syncInvite) return;
    if (!(await syncEnterInvite(createFamilyInvite(), "create"))) return;
    const crypto = await loadFamilyCrypto();
    const syncApi = await loadFamilySync();
    const movedAt = new Date().toISOString();
    const stub = { ...createEmptyAppData(), settings: { ...createEmptyAppData().settings, members: [], paymentSources: [], syncRoomMovedAt: movedAt } };
    await syncApi.pushFamilyEnvelope(oldRoomId, await crypto.encryptFamilyData(stub, oldSecret));
    setSyncNotice(t("Familia s-a mutat în camera nouă, iar camera veche a fost golită. Trimite invitația celorlalte telefoane: ele se opresc până o primesc."));
  }, t("Mutarea nu a reușit. Camera veche a rămas neatinsă."));

  /** Invitație venită prin link: o punem în câmp și deschidem Sync, fără să intrăm singuri. */
  const offerInvite = (raw: string) => {
    if (!parseInvite(raw)) return;
    setSyncInviteDraft(raw);
    setSyncNotice(t("Ai primit o invitație în familie. Verifică și apasă „Intră în familie”."));
  };

  /** Reluare la pornire: Android închide des aplicația, iar parola nu e păstrată. */
  useEffect(() => {
    if (syncResumeTriedRef.current || !online || !storageReady) return;
    syncResumeTriedRef.current = true;
    if (isOfflineOnly() || readClosed()) {
      setSyncResumeSettled(true);
      return;
    }
    void (async () => {
      const session = await loadFamilySession();
      if (!session) {
        setSyncResumeSettled(true);
        return;
      }
      setSyncHasSession(true);
      setSyncBusy(true);
      try {
        await syncOpenRoom(session.roomId, session.material, { invite: session.invite, mode: "resume" });
      } catch (error) {
        setSyncNotice(error instanceof Error ? error.message : t("Sincronizarea nu a putut fi reluată."));
      } finally {
        setSyncBusy(false);
        setSyncResumeSettled(true);
      }
    })();
    // syncOpenRoom citește starea curentă prin ref-uri; reluarea rulează o singură dată.
  }, [online, storageReady]);

  useEffect(() => {
    if (!syncConnected || !syncRoomIdRef.current) return;
    if (!online) {
      setSyncNotice(t("Fără conexiune — modificările rămân pe telefon și se trimit la reconectare."));
      return;
    }
    const currentPortable = syncPortable(data);
    if (currentPortable === syncLastPortableRef.current) return;
    window.clearTimeout(syncPushTimerRef.current);
    syncPushTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const crypto = await loadFamilyCrypto();
          const syncApi = await loadFamilySync();
          const roomId = syncRoomIdRef.current!;
          // Fetch+merge înainte de push — evită race „push fără pull recent”.
          const remoteEnvelope = await syncApi.fetchFamilyEnvelope(roomId);
          let toPush = syncDataRef.current;
          if (remoteEnvelope) {
            const remoteData = normalizeAppData(await crypto.decryptFamilyData(remoteEnvelope, syncSecretRef.current));
            if (remoteData.settings.syncRoomMovedAt) {
              syncStopMovedRoom();
              return;
            }
            toPush = syncRetainLocalReceiptImages(crypto.mergeFamilyData(syncDataRef.current, remoteData));
            const mergedPortable = syncPortable(toPush);
            if (mergedPortable !== syncPortable(syncDataRef.current)) {
              syncLastPortableRef.current = mergedPortable;
              setData(toPush);
            }
          }
          const envelope = await crypto.encryptFamilyData(toPush, syncSecretRef.current);
          await syncApi.pushFamilyEnvelope(roomId, envelope);
          syncLastPortableRef.current = syncPortable(toPush);
          setSyncLastSync(new Date().toISOString());
          setSyncNotice(t("Sesiunea familiei este activă. Actualizările apar automat pe toate telefoanele conectate, fără reîmprospătare manuală."));
        } catch (error) {
          setSyncNotice(error instanceof Error ? error.message : t("Actualizarea nu a putut fi trimisă."));
        }
      })();
    }, 800);
    return () => window.clearTimeout(syncPushTimerRef.current);
  }, [data, syncConnected, online]);

  useEffect(() => () => syncUnsubscribeRef.current?.(), []);

  const thisDevice = (data.settings.syncDevices || []).find((device) => device.id === getOrCreateDeviceId());
  /** Telefonul a fost în cameră și nu a ieșit singur, dar acum nu primește nimic. */
  const syncStopped = online && syncResumeSettled && !syncConnected && !syncBusy && !isOfflineOnly()
    && !readClosed() && (syncHasSession || Boolean(thisDevice && !thisDevice.revokedAt));

  const syncPanelProps: SyncPanelProps = {
    connected: syncConnected,
    stopped: syncStopped,
    sessionRemembered: syncHasSession,
    invite: syncInvite,
    inviteDraft: syncInviteDraft,
    setInviteDraft: setSyncInviteDraft,
    onCreateRoom: () => void syncCreateRoom(),
    onJoinInvite: (raw: string) => void syncJoinInvite(raw),
    onMoveToInvite: () => void syncMoveToInvite(),
    members: data.settings.members,
    selfMemberId: selfMemberIdOf(data),
    needsSelfChoice: needsSelfChoice(data),
    onChooseSelf: (memberId: string) => setData((current) => chooseSelfMember(current, memberId)),
    onAddSelf: (name: string) => setData((current) => addSelfMember(current, name)),
    busy: syncBusy,
    online,
    password: syncPassword,
    setPassword: setSyncPassword,
    passwordRevealOnce: syncPasswordReveal || undefined,
    clearPasswordReveal: () => setSyncPasswordReveal(""),
    recoveryRevealOnce: syncRecoveryReveal || undefined,
    clearRecoveryReveal: () => setSyncRecoveryReveal(""),
    recoveryIssued: Boolean(data.settings.syncRecoveryIssuedAt),
    onRecoverPassword: (code: string) => void recoverWithCode(code),
    onIssueRecovery: () => {
      void (async () => {
        if (!syncConnected) {
          setSyncNotice(t("Conectează mai întâi acest telefon, apoi creează codul de recuperare."));
          return;
        }
        if (!syncPasswordRef.current) {
          setSyncNotice(t("Sesiunea s-a reluat fără parolă, care nu se păstrează pe telefon. Pentru un cod nou, închide sesiunea și conectează-te din nou cu parola."));
          return;
        }
        if (data.settings.syncRecoveryIssuedAt) {
          const confirmed = await askConfirm(
            t("Codul vechi rămâne valabil. Notează-l pe cel nou imediat — nu îl mai arătăm."),
          );
          if (!confirmed) return;
        }
        setSyncBusy(true);
        try {
          const result = await issueRecoveryIfNeeded(syncDataRef.current, syncPasswordRef.current, true);
          setData(result.data);
          if (result.code) {
            setSyncRecoveryReveal(result.code);
            setSyncNotice(t("Sesiunea e activă. Notează codul de recuperare pe hârtie — nu îl mai arătăm."));
          } else if (result.warning) {
            setSyncNotice(result.warning);
          }
        } finally {
          setSyncBusy(false);
        }
      })();
    },
    notice: syncNotice,
    lastSync: syncLastSync,
    journal: syncJournal,
    devices: listSyncDevices(data),
    thisDeviceId: getOrCreateDeviceId(),
    onConnect: () => void syncConnect(),
    onDisconnect: syncDisconnect,
    onClearJournal: () => {
      setSyncJournal([]);
      writeSyncJournal([]);
    },
    onRevokeDevice: async (deviceId: string) => {
      if (deviceId === getOrCreateDeviceId()) {
        const confirmed = await askConfirm(
          t("Ieși din cameră pe acest telefon. Ca să revii, un alt telefon trebuie să te reactiveze — sau schimbați parola familiei."),
        );
        if (!confirmed) return;
      }
      const next = revokeSyncDevice(data, deviceId);
      setData(next);
      if (deviceId === getOrCreateDeviceId()) {
        syncDisconnect();
        setSyncNotice(t("Ai revocat acest telefon. Sesiunea s-a închis."));
      } else {
        setSyncNotice(t("Dispozitivul a fost marcat ca revocat. Se propagă la următoarea sincronizare."));
      }
    },
    onRestoreDevice: (deviceId: string) => {
      const next = restoreSyncDevice(data, deviceId);
      setData(next);
      setSyncNotice(t("Dispozitivul poate intra din nou. Se propagă la următoarea sincronizare."));
    },
  };

  return {
    syncPanelProps,
    offerInvite,
    setSyncPassword,
    setSyncPasswordReveal,
    syncPortable,
  };
}
