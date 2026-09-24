# Identitate anonimă (Firebase Auth)

De la **1.1.95**, fiecare telefon primește de la Firebase Authentication un identificator
anonim aleator: fără cont, fără nume, fără e-mail. Omul nu vede nimic nou.

## La ce folosește

- **Etapa 2 a regulilor** (`firestore.auth.rules`): camerele familiei și codurile de recuperare
  se deschid doar din aplicație. Un script care lovește direct Firestore, fără identitate, e refuzat.
- **Limitele funcțiilor** (`aiGuide`, `appFeedback`) se numără pe telefon, nu pe IP. Pe rețelele
  mobile, mulți oameni ies pe același IP și își consumau unul altuia ghidul online. IP-ul păstrează
  un plafon larg (5×), ca să nu ajute conturile anonime create pe bandă.
- **Feedbackul** are câmpul `reporter`: mesajele aceluiași tester se leagă între ele, fără nume.

## Cum se comportă aplicația

- `ensureSignedIn()` (`client/src/lib/realtime-sync.ts`) intră anonim la prima folosire a
  Firebase; identitatea rămâne în IndexedDB și supraviețuiește redeschiderii.
- Dacă nu merge (furnizorul oprit, fără rețea la prima pornire), sincronizarea continuă ca
  înainte, fără identitate, iar aplicația reîncearcă peste un minut. Nicio cerere nu așteaptă
  mai mult de 6 secunde după identitate.
- În modul „doar offline” nu se face nimic.

## Pași

### 1. Furnizorul anonim — automat

Workflow-ul **Deploy Firebase Functions** are pasul „Enable anonymous sign-in”. Dacă apare
cu avertisment, pornește-l de mână: Firebase Console → **Authentication** → *Get started* (o
singură dată) → **Sign-in method** → **Anonymous** → *Enable*.

Verificare: Authentication → **Users** începe să arate utilizatori „Anonymous” după ce
testerii deschid Sync sau ghidul online.

### 2. Regulile de etapa 2 — de mână, mai târziu

Nu publica `firestore.auth.rules` până când **toți** testerii au 1.1.95 sau mai nouă.
Versiunile vechi nu au identitate: s-ar opri din sincronizat (apare bannerul „sync oprit”).

Când e momentul:

1. Play Console → Testare → verifică în statistici că nu mai e nimeni pe `versionCode` < 97.
2. Firebase Console → Authentication → Users: telefoanele active apar ca „Anonymous”.
3. Firestore Database → **Rules**: lipește conținutul din `firestore.auth.rules` → *Publish*.
   (Sau `firebase deploy --only firestore:rules --config firebase.e2e.json`, care arată spre
   același fișier.)
4. Dacă ceva nu merge: lipește înapoi `firestore.rules`; e aceeași regulă, fără identitate.

Ce garantează testele:

- `firestore-rules-shape.test.ts`: `firestore.auth.rules` e exact `firestore.rules` plus
  `signedIn() &&` pe fiecare acces al familiei, deci cele două fișiere nu se pot despărți.
- `pnpm test:sync` rulează pe emulatoarele Firestore și Auth, **cu regulile de etapa 2**:
  două familii, invitație, redeschidere, mutare de pe parolă, plus o cerere fără identitate
  care trebuie refuzată.

## Ștergere

Identitatea nu e legată de persoană. La cerere (e-mail din `delete-data.html`), șterge
utilizatorul din Authentication → Users și mesajele lui din colecția `appFeedback`
(câmpul `reporter`).
