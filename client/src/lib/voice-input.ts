/**
 * Ascultarea unei fraze, o singură dată. Pe Android trece prin recunoașterea vocală a
 * telefonului (WebView-ul nu are SpeechRecognition); în browser, prin Web Speech API.
 * Fără niciuna, butonul de microfon nu apare.
 */
type VoiceBridge = { available?: () => boolean; listen?: (lang: string) => void };
type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; abort: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null };

const nativeVoice = (): VoiceBridge | undefined => {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { BugetFamilieVoice?: VoiceBridge }).BugetFamilieVoice;
};
const webRecognition = (): (new () => Recognition) | undefined => {
  if (typeof window === "undefined") return undefined;
  const scope = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition;
};

export function voiceAvailable(): boolean {
  try {
    const native = nativeVoice();
    if (native?.listen) return native.available ? native.available() : true;
    return Boolean(webRecognition());
  } catch {
    return false;
  }
}

export type VoiceResult = { text: string } | { error: "cancelled" | "unavailable" | "denied" | "failed" };

/** O frază; `cancel` oprește ascultarea în browser (pe Android, dialogul telefonului are butonul lui). */
export function listenOnce(lang = "ro-RO"): { result: Promise<VoiceResult>; cancel: () => void } {
  const native = nativeVoice();
  if (native?.listen) {
    let done = false;
    let onEvent: (event: Event) => void = () => {};
    const result = new Promise<VoiceResult>((resolve) => {
      // Nativul poate trimite rezultatul de mai multe ori (WebView-ul e oprit cât e deschis dialogul).
      onEvent = (event: Event) => {
        if (done) return;
        done = true;
        window.removeEventListener("buget-familie:voice", onEvent);
        const detail = (event as CustomEvent<{ text?: string; error?: string }>).detail || {};
        const text = (detail.text || "").trim();
        resolve(text ? { text } : { error: detail.error === "unavailable" ? "unavailable" : "cancelled" });
      };
      window.addEventListener("buget-familie:voice", onEvent);
      try { native.listen!(lang); } catch { onEvent(new CustomEvent("buget-familie:voice", { detail: { error: "unavailable" } })); }
    });
    return { result, cancel: () => { if (!done) onEvent(new CustomEvent("buget-familie:voice", { detail: { error: "cancelled" } })); } };
  }
  const Ctor = webRecognition();
  if (!Ctor) return { result: Promise.resolve({ error: "unavailable" }), cancel: () => {} };
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  const result = new Promise<VoiceResult>((resolve) => {
    let settled = false;
    const finish = (value: VoiceResult) => { if (!settled) { settled = true; resolve(value); } };
    recognition.onresult = (event) => finish({ text: (event.results[0]?.[0]?.transcript || "").trim() });
    recognition.onerror = (event) => finish({ error: event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : event.error === "aborted" || event.error === "no-speech" ? "cancelled" : "failed" });
    recognition.onend = () => finish({ error: "cancelled" });
    try { recognition.start(); } catch { finish({ error: "failed" }); }
  });
  return { result, cancel: () => { try { recognition.abort(); } catch { /* deja oprită */ } } };
}
