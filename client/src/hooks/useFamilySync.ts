/**
 * Sincronizare familie: conectare, push debounce, unire remote, jurnal, dispozitive.
 * Pozele bonurilor rămân pe telefon; pachetul trimis e fără imageData.
 */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { newId, normalizeAppData, type AppData } from "@/lib/finance-data";
import { checkFamilyPassword } from "@/lib/family-password";
import { touchSyncDevice, revokeSyncDevice, isThisDeviceRevoked, listActiveSyncDevices, getOrCreateDeviceId } from "@/lib/sync-devices";
import { readSyncJournal, writeSyncJournal, type SyncJournalEntry } from "@/lib/app-storage";
import type { EncryptedEnvelope } from "@/lib/family-crypto";
import { notifyFamilyEnvelopeChanges } from "@/lib/local-notifications";
import { t } from "@/lib/i18n";
import type { SyncPanelProps } from "@/pages/home-kit";

const loadFamilySync = () => import("@/lib/realtime-sync");
const loadFamilyCrypto = () => import("@/lib/family-crypto");

/** Serializare fără poze — același format pentru localStorage și push familie. */
export const syncPortable = (value: AppData) =>
  JSON.stringify({
    ...value,
    receipts: value.receipts.map(({ imageData: _one, imageData2: _two, imageKeys: _keys, ...rest }) => rest),
  });

export function useFamilySync(
  data: AppData,
  setData: Dispatch<SetStateAction<AppData>>,
) {
  const [syncPassword, setSyncPassword] = useState("");
  const [syncPasswordReveal, setSyncPasswordReveal] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncConnected, setSyncConnected] = useState(false);
  const [syncLastSync, setSyncLastSync] = useState("");
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

  const syncDisconnect = () => {
    syncUnsubscribeRef.current?.();
    syncUnsubscribeRef.current = undefined;
    syncRoomIdRef.current = undefined;
    window.clearTimeout(syncPushTimerRef.current);
    setSyncConnected(false);
    setSyncPassword("");
    setSyncNotice(t("Sesiunea a fost închisă pe acest telefon."));
  };

  const syncHandleRemoteEnvelope = async (envelope: EncryptedEnvelope) => {
    try {
      const crypto = await loadFamilyCrypto();
      const remoteData = normalizeAppData(await crypto.decryptFamilyData(envelope, syncPasswordRef.current));
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
        setSyncNotice(t("Acest telefon a fost revocat din cameră. Schimbă parola pe celelalte telefoane dacă e nevoie."));
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

  const syncConnect = async () => {
    const strength = checkFamilyPassword(syncPassword);
    if (!strength.ok) {
      setSyncNotice(`${strength.label}. ${strength.advice.join(" ")}`);
      return;
    }
    setSyncBusy(true);
    try {
      const crypto = await loadFamilyCrypto();
      const roomId = await crypto.deriveFamilyRoomId(syncPassword);
      const syncApi = await loadFamilySync();
      const remoteEnvelope = await syncApi.fetchFamilyEnvelope(roomId);
      let merged = syncDataRef.current;
      if (remoteEnvelope) {
        const remoteData = normalizeAppData(await crypto.decryptFamilyData(remoteEnvelope, syncPassword));
        merged = syncRetainLocalReceiptImages(crypto.mergeFamilyData(syncDataRef.current, remoteData));
      }
      merged = touchSyncDevice(merged);
      const mergedPortable = syncPortable(merged);
      syncLastPortableRef.current = mergedPortable;
      setData(merged);
      const envelope = await crypto.encryptFamilyData(merged, syncPassword);
      await syncApi.pushFamilyEnvelope(roomId, envelope);
      syncRoomIdRef.current = roomId;
      syncUnsubscribeRef.current = syncApi.subscribeFamilyRoom(
        roomId,
        (incoming) => void syncHandleRemoteEnvelope(incoming),
        (error) => setSyncNotice(error.message),
      );
      setSyncConnected(true);
      setSyncLastSync(new Date().toISOString());
      setSyncNotice(
        t("Sesiunea familiei este activă. Actualizările apar automat pe toate telefoanele conectate, fără reîmprospătare manuală."),
      );
    } catch (error) {
      setSyncNotice(error instanceof Error ? error.message : t("Familia nu a putut fi conectată."));
    } finally {
      setSyncBusy(false);
    }
  };

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
          const { encryptFamilyData } = await loadFamilyCrypto();
          const envelope = await encryptFamilyData(data, syncPasswordRef.current);
          const { pushFamilyEnvelope } = await loadFamilySync();
          await pushFamilyEnvelope(syncRoomIdRef.current!, envelope);
          syncLastPortableRef.current = currentPortable;
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

  const syncPanelProps: SyncPanelProps = {
    connected: syncConnected,
    busy: syncBusy,
    online,
    password: syncPassword,
    setPassword: setSyncPassword,
    passwordRevealOnce: syncPasswordReveal || undefined,
    clearPasswordReveal: () => setSyncPasswordReveal(""),
    notice: syncNotice,
    lastSync: syncLastSync,
    journal: syncJournal,
    devices: listActiveSyncDevices(data),
    thisDeviceId: getOrCreateDeviceId(),
    onConnect: () => void syncConnect(),
    onDisconnect: syncDisconnect,
    onClearJournal: () => {
      setSyncJournal([]);
      writeSyncJournal([]);
    },
    onRevokeDevice: (deviceId: string) => {
      const next = revokeSyncDevice(data, deviceId);
      setData(next);
      if (deviceId === getOrCreateDeviceId()) {
        syncDisconnect();
        setSyncNotice(t("Ai revocat acest telefon. Sesiunea s-a închis."));
      } else {
        setSyncNotice(t("Dispozitivul a fost marcat ca revocat. Se propagă la următoarea sincronizare."));
      }
    },
  };

  return {
    syncPanelProps,
    setSyncPassword,
    setSyncPasswordReveal,
    syncPortable,
  };
}
