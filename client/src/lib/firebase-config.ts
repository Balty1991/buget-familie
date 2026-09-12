/**
 * Configurația publică Firebase a aplicației Buget Familie.
 * Aceste valori nu sunt secrete — Firebase le expune intenționat în orice aplicație web;
 * protecția reală a datelor vine din regulile Firestore (firestore.rules) și din
 * criptarea AES-GCM aplicată registrului înainte de a ajunge în bază de date.
 *
 * Cum se completează (o singură dată, de administratorul aplicației):
 * 1. console.firebase.google.com → Add project → activează Firestore Database.
 * 2. Project settings → Your apps → Web (</>) → Register app.
 * 3. Copiază obiectul `firebaseConfig` afișat de Firebase exact în locul valorilor de mai jos.
 *
 * App Check (reCAPTCHA Enterprise / Debug) — vezi README „App Check” și docs/app-check-enforce-prep.md:
 * - Pe web/prod: setează `VITE_RECAPTCHA_SITE_KEY` la build SAU completează
 *   `RECAPTCHA_SITE_KEY_PLACEHOLDER` mai jos cu site key-ul reCAPTCHA Enterprise din Firebase App Check
 *   (nu secretul classic — în client merge doar site key-ul public).
 * - Pe Capacitor debug: `VITE_APPCHECK_DEBUG=true` activează Debug provider (token de debug
 *   din Firebase Console → App Check → Manage debug tokens). NU activa Enforce pe Firestore
 *   până confirmi că build-ul publicat trimite token — altfel blochezi familiile existente.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCblae37WNgd9kpkSMPQxfFN9kRRU_5Djs",
  authDomain: "buget-familie-a6a0d.firebaseapp.com",
  projectId: "buget-familie-a6a0d",
  storageBucket: "buget-familie-a6a0d.firebasestorage.app",
  messagingSenderId: "119097201129",
  appId: "1:119097201129:web:d46d0e3889dd6e50b53b78",
};

/** Site key public reCAPTCHA Enterprise. VITE_RECAPTCHA_SITE_KEY la build overridează. */
const RECAPTCHA_SITE_KEY_PLACEHOLDER = "6Lc9zrctAAAAAAz27Nr8XWx9D3cRnBnHkChyyeCq";

const envSiteKey =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_RECAPTCHA_SITE_KEY
    ? String(import.meta.env.VITE_RECAPTCHA_SITE_KEY).trim()
    : "";

export const recaptchaSiteKey = envSiteKey || RECAPTCHA_SITE_KEY_PLACEHOLDER;

/** Debug App Check: VITE_APPCHECK_DEBUG=true sau Capacitor Android în DEV. */
export const appCheckDebug =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_APPCHECK_DEBUG === "true") ||
  (typeof import.meta !== "undefined" &&
    import.meta.env?.DEV === true &&
    typeof window !== "undefined" &&
    Boolean((window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === "android"));

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const isAppCheckConfigured = Boolean(recaptchaSiteKey);

if (typeof console !== "undefined" && isFirebaseConfigured && !recaptchaSiteKey && !appCheckDebug) {
  console.info(
    "[Buget Familie] App Check: recaptchaSiteKey e gol. Sync funcționează fără Enforce. " +
      "Pentru protecție anti-abuz: setează VITE_RECAPTCHA_SITE_KEY sau completează RECAPTCHA_SITE_KEY_PLACEHOLDER. " +
      "Nu activa Enforce în Firebase până confirmi tokenul pe build-ul publicat.",
  );
}
