/**
 * Hydrate LS↔IDB + persist debounce — extras din Home ca să rămână orchestrator.
 */
import { recordRemovals } from "@/lib/sync-removals";
import { stampPlanScalars } from "@/lib/plan-scalars";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { adjustDebtsForLedgerEdits, autoPostDueRecurring, adoptOutsideExpenses, createEmptyAppData, normalizeAppData, type AppData } from "@/lib/finance-data";
import {
  APP_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  localSnapshotText,
  readAppDataRecord,
  readLocalStorageSnapshot,
  resolveHydrateMerge,
  writeAppData,
  writeLocalStorageSnapshot,
} from "@/lib/app-storage";
import { t } from "@/lib/i18n";

export function readInitialAppData(): AppData {
  try {
    const raw = window.localStorage.getItem(APP_STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? adoptOutsideExpenses(normalizeAppData(JSON.parse(raw))) : createEmptyAppData();
  } catch {
    return createEmptyAppData();
  }
}

export function usePersistAppData(
  data: AppData,
  setData: Dispatch<SetStateAction<AppData>>,
) {
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const storageHydrated = useRef(false);
  const editedBeforeHydrate = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const applyData: typeof setData = (value) => {
    if (!storageHydrated.current) editedBeforeHydrate.current = true;
    // Ce dispare din plan sau din setări lasă piatră de mormânt, ca sincronizarea să nu-l readucă.
    setData((previous) => { const next = typeof value === "function" ? value(previous) : value; return stampPlanScalars(previous, recordRemovals(previous, adjustDebtsForLedgerEdits(previous, next))); });
  };

  useEffect(() => {
    let active = true;
    const localAtStart = readLocalStorageSnapshot();
    void readAppDataRecord()
      .then((indexed) => {
        if (!active) return;
        setData((current) => {
          const local = readLocalStorageSnapshot();
          const picked = resolveHydrateMerge({
            local: local.data ? local : localAtStart,
            indexed,
            memory: current,
            editedBeforeHydrate: editedBeforeHydrate.current,
          });
          // O copie stricată nu blochează pornirea: încercăm cealaltă copie, apoi ce e în memorie.
          for (const candidate of [picked, indexed.data, local.data]) {
            if (!candidate) continue;
            try { return adoptOutsideExpenses(normalizeAppData(candidate)); } catch { /* următoarea copie */ }
          }
          return current;
        });
      })
      .catch(() => setStorageNotice(t("Stocarea modernă nu este disponibilă; folosim fallback-ul local al browserului.")))
      .finally(() => {
        storageHydrated.current = true;
        setStorageReady(true);
      });
    return () => {
      active = false;
    };
  }, [setData]);

  useEffect(() => {
    if (!storageHydrated.current) return;
    const serialized = localSnapshotText(data);
    const savedAt = new Date().toISOString();
    const lsWrite = writeLocalStorageSnapshot(serialized, savedAt);
    if (lsWrite.quotaExceeded || !lsWrite.wroteFull) {
      setStorageNotice(
        t("Spațiul local este aproape plin. Fotografiile bonurilor rămân în stocarea dedicată; exportă un backup dacă problema continuă."),
      );
    }
    const timer = window.setTimeout(() => {
      void writeAppData(data, savedAt).then(() => channelRef.current?.postMessage(savedAt)).catch(() =>
        setStorageNotice(t("Datele sunt păstrate în fallback-ul browserului; stocarea modernă nu a confirmat salvarea.")),
      );
    }, 280);
    return () => window.clearTimeout(timer);
  }, [data]);

  /**
   * Aplicația deschisă în două file (web): fiecare scria starea ei întreagă și o cheltuială
   * notată în cealaltă filă se pierdea. Acum fila anunță salvarea, iar celelalte unesc registrul.
   */
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("buget-familie:data");
    channelRef.current = channel;
    channel.onmessage = () => {
      void (async () => {
        const record = await readAppDataRecord().catch(() => null);
        if (!record?.data) return;
        const { mergeFamilyData } = await import("@/lib/family-crypto");
        const other = normalizeAppData(record.data);
        setData((current) => {
          const merged = mergeFamilyData(current, other);
          const images = new Map([...other.receipts, ...current.receipts].map((item) => [item.id, item]));
          const withImages = { ...merged, receipts: merged.receipts.map((item) => { const source = images.get(item.id); return source ? { ...item, imageData: source.imageData, imageData2: source.imageData2, imageKeys: source.imageKeys } : item; }) };
          return localSnapshotText(withImages) === localSnapshotText(current) ? current : withImages;
        });
      })();
    };
    return () => { channel.close(); channelRef.current = null; };
  }, [setData]);

  useEffect(() => {
    if (!storageReady) return;
    setData((current) => autoPostDueRecurring(current));
  }, [storageReady, setData]);

  return {
    storageNotice,
    setStorageNotice,
    storageReady,
    applyData,
    storageHydrated,
  };
}
