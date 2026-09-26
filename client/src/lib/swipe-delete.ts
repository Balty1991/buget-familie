import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Glisare spre stânga pe un rând, cu degetul: peste 96 px, rândul se șterge (cu „Anulează” în
 * bara de jos, ca la butonul de ștergere). Mouse-ul și derularea pe verticală nu declanșează nimic.
 */
export function swipeToDelete(onDelete: () => void) {
  let startX = 0;
  let startY = 0;
  let active = false;
  const reset = (element: HTMLElement) => {
    element.style.transition = "transform 160ms ease";
    element.style.transform = "";
    element.classList.remove("is-swiping", "is-swipe-armed");
  };
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType !== "touch") return;
      startX = event.clientX; startY = event.clientY; active = true;
      event.currentTarget.style.transition = "none";
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      if (!active) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { active = false; reset(event.currentTarget); return; }
      if (dx >= 0) return;
      event.currentTarget.classList.add("is-swiping");
      event.currentTarget.classList.toggle("is-swipe-armed", dx < -96);
      event.currentTarget.style.transform = `translateX(${Math.max(dx, -160)}px)`;
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      if (!active) return;
      active = false;
      const dx = event.clientX - startX;
      reset(event.currentTarget);
      if (dx < -96) {
        try { navigator.vibrate?.(12); } catch { /* fără vibrație */ }
        onDelete();
      }
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => { active = false; reset(event.currentTarget); },
  };
}
