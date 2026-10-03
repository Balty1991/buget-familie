import { afterEach, describe, expect, it, vi } from "vitest";
import { listenOnce } from "./voice-input";

type Handler<T> = ((event: T) => void) | null;
class FakeRecognition {
  static last: FakeRecognition;
  lang = ""; interimResults = false; continuous = false; maxAlternatives = 1;
  onresult: Handler<{ results: unknown }> = null; onerror: Handler<{ error?: string }> = null; onend: (() => void) | null = null;
  stopped = false; aborted = false;
  constructor() { FakeRecognition.last = this; }
  start() {}
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
  say(text: string, isFinal: boolean) { const item = Object.assign([{ transcript: text }], { isFinal }); this.onresult?.({ results: [item] }); }
}

const install = () => { (globalThis as unknown as { window: unknown }).window = { webkitSpeechRecognition: FakeRecognition, setTimeout: globalThis.setTimeout.bind(globalThis) }; };
afterEach(() => { delete (globalThis as unknown as { window?: unknown }).window; vi.useRealTimers(); });

describe("ascultarea în browser (Chrome pe Android)", () => {
  it("se oprește fără rezultat final: folosește textul parțial", async () => {
    install();
    const partials: string[] = [];
    const session = listenOnce("ro-RO", (text) => partials.push(text));
    expect(FakeRecognition.last.interimResults).toBe(true);
    FakeRecognition.last.say("30 de lei", false);
    FakeRecognition.last.say("30 de lei taxi", false);
    FakeRecognition.last.onend?.();
    await expect(session.result).resolves.toEqual({ text: "30 de lei taxi" });
    expect(partials).toContain("30 de lei taxi");
  });

  it("atingerea „oprește” păstrează ce s-a auzit (stop, nu abort)", async () => {
    vi.useFakeTimers();
    install();
    const session = listenOnce();
    FakeRecognition.last.say("30 de lei taxi", false);
    session.cancel();
    expect(FakeRecognition.last.stopped).toBe(true);
    expect(FakeRecognition.last.aborted).toBe(false);
    vi.advanceTimersByTime(1600);
    await expect(session.result).resolves.toEqual({ text: "30 de lei taxi" });
  });

  it("rezultatul final închide imediat", async () => {
    install();
    const session = listenOnce();
    FakeRecognition.last.say("taxi 30 de lei", true);
    await expect(session.result).resolves.toEqual({ text: "taxi 30 de lei" });
  });

  it("fără nimic auzit spune „silent”, nu tace", async () => {
    install();
    const session = listenOnce();
    FakeRecognition.last.onerror?.({ error: "no-speech" });
    await expect(session.result).resolves.toEqual({ error: "silent" });
  });
});
