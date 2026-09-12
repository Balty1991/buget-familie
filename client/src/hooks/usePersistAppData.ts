/**
 * Hydrate LS↔IDB + persist debounce — extras din Home ca să rămână orchestrator.
 */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { autoPostDueRecurring, createEmptyAppData, normalizeAppData, type AppData } from "@/lib/finance-data";
import {
  APP_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  readAppDataRecord,
  readLocalStorageSnapshot,
  resolveHydrateMerge,
  writeAppData,
  writeLocalStorageSnapshot,
} from "@/lib/app-storage";
import { t } from "@/lib/i18n";
import { syncPortable } from "@/hooks/useFamilySync";

export function readInitialAppData(): AppData {
  try {
    const raw = window.localStorage.getItem(APP_STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? normalizeAppData(JSON.parse(raw)) : createEmptyAppData();
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

  const applyData: typeof setData = (value) => {
    if (!storageHydrated.current) editedBeforeHydrate.current = true;
    setData(value);
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
          return picked ? normalizeAppData(picked) : current;
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
    const serialized = syncPortable(data);
    const savedAt = new Date().toISOString();
    const lsWrite = writeLocalStorageSnapshot(serialized, savedAt);
    if (lsWrite.quotaExceeded || !lsWrite.wroteFull) {
      setStorageNotice(
        t("Spațiul local este aproape plin. Fotografiile bonurilor rămân în stocarea dedicată; exportă un backup dacă problema continuă."),
      );
    }
    const timer = window.setTimeout(() => {
      void writeAppData(data, savedAt).catch(() =>
        setStorageNotice(t("Datele sunt păstrate în fallback-ul browserului; stocarea modernă nu a confirmat salvarea.")),
      );
    }, 280);
    return () => window.clearTimeout(timer);
  }, [data]);

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
