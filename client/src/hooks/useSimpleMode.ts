/**
 * Mod simplu — preferință locală; se actualizează live via event ui-prefs.
 */
import { useEffect, useState } from "react";
import { isSimpleMode, setSimpleMode } from "@/lib/ui-prefs";

export function useSimpleMode() {
  const [simpleMode, setSimpleModeState] = useState(() => isSimpleMode());
  useEffect(() => {
    const onPrefs = (event: Event) => {
      const detail = (event as CustomEvent<{ simpleMode?: boolean }>).detail;
      if (typeof detail?.simpleMode === "boolean") setSimpleModeState(detail.simpleMode);
      else setSimpleModeState(isSimpleMode());
    };
    window.addEventListener("buget-familie:ui-prefs", onPrefs);
    return () => window.removeEventListener("buget-familie:ui-prefs", onPrefs);
  }, []);
  return {
    simpleMode,
    setSimpleMode: (enabled: boolean) => {
      setSimpleMode(enabled);
      setSimpleModeState(enabled);
    },
  };
}
