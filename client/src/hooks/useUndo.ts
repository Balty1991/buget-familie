/**
 * Anulare locală după ștergere: ține rândurile scoase câteva secunde,
 * ca o greșeală dintr-o atingere să se corecteze tot dintr-o atingere.
 */
import { useEffect, useRef, useState } from "react";
import { buildUndo, type UndoAction } from "@/lib/undo-delete";
import type { AppData } from "@/lib/finance-data";

export function useUndo(data: AppData, setData: (value: AppData | ((current: AppData) => AppData)) => void) {
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  const offerUndo = (action: UndoAction | undefined) => {
    window.clearTimeout(undoTimer.current);
    if (!action) return;
    setUndo(action);
    undoTimer.current = window.setTimeout(() => setUndo(null), 9000);
  };

  const runUndo = () => {
    window.clearTimeout(undoTimer.current);
    if (undo) setData((current) => undo.apply(current));
    setUndo(null);
  };

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const deleteWithUndo = (
    label: string,
    pick: (current: AppData) => { next: AppData; removed: Parameters<typeof buildUndo>[1] },
  ) => {
    const { next, removed } = pick(data);
    setData(next);
    offerUndo(buildUndo(label, removed));
  };

  return { undo, setUndo, runUndo, deleteWithUndo };
}
