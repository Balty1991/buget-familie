/**
 * P2-8 din auditul de performanță: Home dă vederilor zeci de funcții noi la fiecare randare,
 * așa că deschiderea unui modal sau dispariția barei „Anulează” randa din nou tot Astăzi.
 *
 * `stableView` învelește o vedere în `memo`, cu funcții stabile: fiecare funcție primită
 * devine un înveliș care cheamă mereu varianta cea mai nouă. Vederea se randează din nou doar
 * când se schimbă o valoare (date, mod simplu etc.), nu la fiecare randare a lui Home.
 * La schimbarea limbii sau a zilei, vederea se montează din nou, ca textele și „azi” să fie la zi.
 */
import { memo, useRef, type ComponentType } from "react";
import { getLocale } from "@/lib/i18n";
import { isoToday } from "@/lib/finance-data";

type AnyProps = Record<string, unknown>;

export function stableView<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  const Inner = memo(Component) as unknown as ComponentType<AnyProps>;
  function StableView(props: P) {
    const latest = useRef(props as AnyProps);
    latest.current = props as AnyProps;
    const wrappers = useRef(new Map<string, (...args: unknown[]) => unknown>());
    const passed: AnyProps = {};
    for (const [key, value] of Object.entries(props as AnyProps)) {
      if (typeof value !== "function") { passed[key] = value; continue; }
      let wrapper = wrappers.current.get(key);
      if (!wrapper) {
        wrapper = (...args: unknown[]) => (latest.current[key] as ((...inner: unknown[]) => unknown) | undefined)?.(...args);
        wrappers.current.set(key, wrapper);
      }
      passed[key] = wrapper;
    }
    return <Inner key={`${getLocale()}|${isoToday()}`} {...passed} />;
  }
  StableView.displayName = `Stable(${Component.displayName || Component.name || "View"})`;
  return StableView;
}
