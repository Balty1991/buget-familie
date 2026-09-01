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
 * `recaptchaSiteKey` este opțional și activează Firebase App Check (protecție anti-abuz
 * a cotei gratuite Firestore, comună tuturor familiilor). Se completează după:
 * 1. console.firebase.google.com → proiectul tău → Build → App Check.
 * 2. Alege aplicația web înregistrată → Provider: reCAPTCHA v3 → urmează linkul spre
 *    Google Cloud reCAPTCHA Enterprise / admin.recaptcha.net pentru a genera o cheie de site.
 * 3. Copiază cheia de site (site key) mai jos și activează „Enforce" pentru Firestore
 *    din tab-ul App Check, după ce ai confirmat că aplicația publicată trimite tokenul.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCblae37WNgd9kpkSMPQxfFN9kRRU_5Djs",
  authDomain: "buget-familie-a6a0d.firebaseapp.com",
  projectId: "buget-familie-a6a0d",
  storageBucket: "buget-familie-a6a0d.firebasestorage.app",
  messagingSenderId: "119097201129",
  appId: "1:119097201129:web:d46d0e3889dd6e50b53b78",
};

export const recaptchaSiteKey = "";

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const isAppCheckConfigured = Boolean(recaptchaSiteKey);
