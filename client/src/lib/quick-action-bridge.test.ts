import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeQuickAction, observeQuickActions } from "./quick-action-bridge";

type Listener = () => void;

function stubNative(queue: string[]) {
  const listeners: Record<string, Listener[]> = {};
  const add = (target: Record<string, Listener[]>) => (type: string, fn: Listener) => {
    target[type] = [...(target[type] || []), fn];
  };
  const remove = (target: Record<string, Listener[]>) => (type: string, fn: Listener) => {
    target[type] = (target[type] || []).filter((item) => item !== fn);
  };
  const documentStub = { visibilityState: "visible", addEventListener: add(listeners), removeEventListener: remove(listeners) };
  Object.assign(globalThis, {
    window: {
      BugetFamilieQuickAction: { consume: () => queue.shift() || "" },
      addEventListener: add(listeners),
      removeEventListener: remove(listeners),
    },
    document: documentStub,
  });
  return { fire: (type: string) => (listeners[type] || []).forEach((fn) => fn()), listeners };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "document");
});

describe("puntea către widget", () => {
  it("întoarce acțiunea cerută o singură dată", () => {
    stubNative(["expense"]);
    expect(consumeQuickAction()).toBe("expense");
    expect(consumeQuickAction()).toBeUndefined();
  });

  it("ignoră o acțiune necunoscută", () => {
    stubNative(["stergeTot"]);
    expect(consumeQuickAction()).toBeUndefined();
  });

  it("nu face nimic fără puntea nativă", () => {
    vi.useFakeTimers();
    Object.assign(globalThis, {
      window: { setTimeout: globalThis.setTimeout.bind(globalThis), addEventListener: () => undefined, removeEventListener: () => undefined },
      document: { addEventListener: () => undefined, removeEventListener: () => undefined, visibilityState: "visible" },
    });
    const handle = vi.fn();
    const stop = observeQuickActions(handle);
    vi.runAllTimers();
    stop();
    expect(handle).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("verifică la montare și la revenirea în prim-plan", () => {
    const native = stubNative(["expense"]);
    const handle = vi.fn();
    const stop = observeQuickActions(handle);
    expect(handle).toHaveBeenCalledWith("expense");

    // A doua apăsare pe widget readuce aplicația fără reîncărcarea paginii.
    (globalThis as unknown as { window: { BugetFamilieQuickAction: { consume: () => string } } }).window.BugetFamilieQuickAction.consume = () => "receipt";
    native.fire("visibilitychange");
    expect(handle).toHaveBeenLastCalledWith("receipt");
    stop();
  });

  it("desface ascultătorii la oprire", () => {
    const native = stubNative([]);
    const stop = observeQuickActions(() => undefined);
    stop();
    expect(native.listeners.visibilitychange).toEqual([]);
    expect(native.listeners.focus).toEqual([]);
  });
});
