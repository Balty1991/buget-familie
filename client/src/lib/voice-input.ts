/**
 * Ascultarea unei fraze, o singură dată. Pe Android trece prin recunoașterea vocală a
 * telefonului (WebView-ul nu are SpeechRecognition); în browser, prin Web Speech API.
 * Fără niciuna, butonul de microfon nu apare.
 */
type VoiceBridge = { available?: () => boolean; listen?: (lang: string) => void };
type RecognitionResult = ArrayLike<{ transcript: string }> & { isFinal?: boolean };
type Recognition = { lang: string; interimResults: boolean; continuous?: boolean; maxAlternatives: number; start: () => void; stop: () => void; abort: () => void; onresult: ((event: { resultIndex?: number; results: ArrayLike<RecognitionResult> }) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null };

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

/** `silent`: s-a oprit fără să audă nimic (prea încet, prea departe, sau microfonul a pornit târziu). */
export type VoiceResult = { text: string } | { error: "cancelled" | "silent" | "unavailable" | "denied" | "failed" };

/** O frază; `cancel` oprește ascultarea în browser (pe Android, dialogul telefonului are butonul lui). */
/** `onPartial`: textul auzit până acum, ca omul să vadă că e ascultat (doar în browser). */
export function listenOnce(lang = "ro-RO", onPartial?: (text: string) => void): { result: Promise<VoiceResult>; cancel: () => void } {
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
  /*
   * Chrome pe Android dă rar rezultatul „final” la o frază scurtă și uneori se oprește fără el.
   * Ținem și textul parțial: la oprire (de la om sau de la browser) folosim ce s-a auzit.
   * Atingerea „oprește” cheamă stop(), nu abort(): abort() arunca tot ce se auzise.
   */
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let heard = "";
  let settled = false;
  let finish: (value: VoiceResult) => void = () => {};
  const result = new Promise<VoiceResult>((resolve) => {
    finish = (value: VoiceResult) => { if (!settled) { settled = true; resolve(value); onPartial?.(""); } };
    recognition.onresult = (event) => {
      const parts: string[] = [];
      let final = false;
      for (let i = 0; i < event.results.length; i += 1) {
        const item = event.results[i];
        parts.push(item?.[0]?.transcript || "");
        if (item?.isFinal) final = true;
      }
      heard = parts.join(" ").replace(/\s+/g, " ").trim();
      onPartial?.(heard);
      if (final && heard) { finish({ text: heard }); try { recognition.stop(); } catch { /* deja oprită */ } }
    };
    recognition.onerror = (event) => {
      if (heard) { finish({ text: heard }); return; }
      finish({ error: event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : event.error === "no-speech" ? "silent" : event.error === "aborted" ? "cancelled" : "failed" });
    };
    recognition.onend = () => finish(heard ? { text: heard } : { error: "silent" });
    try { recognition.start(); } catch { finish({ error: "failed" }); }
  });
  return {
    result,
    cancel: () => {
      try { recognition.stop(); } catch { /* deja oprită */ }
      // Dacă browserul nu mai trimite nimic după stop(), nu lăsăm butonul agățat.
      window.setTimeout(() => finish(heard ? { text: heard } : { error: "cancelled" }), 1500);
    },
  };
}
