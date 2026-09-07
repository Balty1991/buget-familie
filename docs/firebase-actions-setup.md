# Deploy automat Firebase Functions prin GitHub Actions

Workflow-ul `.github/workflows/deploy-firebase-functions.yml` rulează la fiecare push pe `main` care modifică `functions/`, configurația Firebase sau workflow-ul însuși. Poate fi pornit și manual din GitHub Actions.

## Secrete necesare în GitHub

În repository-ul GitHub, la **Settings → Secrets and variables → Actions**, adaugă următoarele secrete:

| Secret | Conținut | Obligatoriu |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON-ul unei chei de service account Google Cloud pentru proiectul `buget-familie-a6a0d` | Da |
| `GEMINI_API_KEY` | Cheia Gemini care va fi sincronizată în Secret Manager | Recomandat pentru activarea Gemini |
| `GROQ_API_KEY` | Cheia Groq (gratuită) folosită ca rezervă când Gemini e ocupat | Opțional, dar recomandat |

Valoarea `FIREBASE_SERVICE_ACCOUNT` trebuie păstrată ca secret GitHub și nu trebuie introdusă în repository. Workflow-ul folosește autentificarea Google doar în timpul jobului, iar valoarea cheii nu este afișată în loguri.

## Permisiuni Google Cloud

Service account-ul folosit de workflow trebuie să poată publica Firebase Functions și să gestioneze secretul `GEMINI_API_KEY`. În funcție de politica proiectului, acordă-i permisiuni echivalente cu administrarea Cloud Functions, utilizarea service account-ului de runtime și administrarea versiunilor de secrete în Secret Manager.

Dacă organizația permite, este preferabilă autentificarea fără cheie persistentă prin Workload Identity Federation. Workflow-ul actual folosește `FIREBASE_SERVICE_ACCOUNT` pentru a fi ușor de configurat și pentru compatibilitate directă cu Firebase CLI; cheia trebuie rotită periodic.

## Ce face workflow-ul

Workflow-ul instalează dependențele Functions, rulează verificarea TypeScript, se autentifică în Google Cloud, creează sau actualizează secretul `GEMINI_API_KEY` dacă acesta există în GitHub Secrets, publică funcțiile Firebase și face o verificare POST a endpointului `aiGuide`.

Dacă `GEMINI_API_KEY` nu este definit în GitHub, workflow-ul nu suprascrie secretul existent în Firebase. Deploy-ul poate continua, dar funcția va funcționa cu secretul deja prezent în Secret Manager sau va eșua la runtime dacă acesta lipsește.

## Observație de securitate

Nu salva cheia Gemini în cod, în `.env` comis în Git sau în frontend. Frontend-ul trebuie să apeleze numai funcția `aiGuide`, iar cheia trebuie să rămână legată de funcția Firebase prin `defineSecret("GEMINI_API_KEY")`.
