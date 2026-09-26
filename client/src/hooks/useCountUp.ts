import { useEffect, useRef, useState } from "react";

/**
 * Cifra zilei „numără” până la valoarea nouă (480 ms) după o notare, ca omul să vadă că s-a
 * schimbat, nu doar să apară alt număr. Prima afișare nu se animă; cu „Reduce mișcarea” din
 * telefon, valoarea se schimbă direct.
 */
export function useCountUp(target: number, duration = 480): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    from.current = target;
    if (start === target) return;
    let reduced = false;
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { reduced = true; }
    if (reduced || typeof window.requestAnimationFrame !== "function") { setShown(target); return; }
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(start + (target - start) * eased);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => { window.cancelAnimationFrame(frame); setShown(target); };
  }, [target, duration]);
  return shown;
}
