import { useEffect, useRef, useState, type RefObject } from "react";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Reține focusul tastaturii în interiorul unui dialog modal cât timp e montat, tratează Escape ca închidere
 * și întoarce focusul la controlul care l-a deschis când dialogul se demontează.
 *
 * Nu mută focusul pe primul buton: pe Android, .focus() e tratat ca :focus-visible
 * și primul card din First Run părea bifat fără să-l fi atins.
 */
/** Dialogurile deschise, ultimul deasupra: butonul Înapoi de pe Android îl închide pe cel de sus. */
const openDialogs: Array<{ current: () => void }> = [];
export function closeTopDialog(): boolean {
  const top = openDialogs[openDialogs.length - 1];
  if (!top) return false;
  top.current();
  return true;
}

export function useFocusTrap<T extends HTMLElement>(onClose: () => void): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    openDialogs.push(onCloseRef);
    return () => { const index = openDialogs.lastIndexOf(onCloseRef); if (index >= 0) openDialogs.splice(index, 1); };
  }, []);
  // Capturat în timpul primului render, înainte ca autoFocus-ul din dialog să fure focusul din pagină.
  const [previouslyFocused] = useState<HTMLElement | null>(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const focusableElements = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => element.offsetParent !== null);
    if (!container.contains(document.activeElement)) {
      container.focus({ preventScroll: true });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusableElements();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && previouslyFocused !== document.body && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [previouslyFocused]);

  return containerRef;
}
