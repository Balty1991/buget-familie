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
 */
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
