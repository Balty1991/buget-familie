# Deploy automat Firebase Functions prin GitHub Actions

Workflow-ul `.github/workflows/deploy-firebase-functions.yml` rulează la fiecare push pe `main` care modifică `functions/`, configurația Firebase sau workflow-ul însuși. Poate fi pornit și manual din GitHub Actions.

## Autentificare: fără cheie (Workload Identity Federation)

Din 27.09.2026 workflow-urile de publicare nu mai folosesc nicio cheie JSON. Google are încredere direct în GitHub Actions, doar pentru repo-ul `Balty1991/buget-familie` și doar de pe `main` (lista de încredere `github`, legătura `buget-familie`). Contul folosit: `firebase-adminsdk-fbsvc@buget-familie-a6a0d.iam.gserviceaccount.com`. Pașii de configurare sunt în `docs/GHID-APPCHECK-WIF.md`.

La **Settings → Secrets and variables → Actions**, tabul **Variables**:

| Variabilă | Valoare |
|---|---|
| `GCP_WIF_PROVIDER` | `projects/119097201129/locations/global/workloadIdentityPools/github/providers/buget-familie` |
| `GCP_SERVICE_ACCOUNT` | `firebase-adminsdk-fbsvc@buget-familie-a6a0d.iam.gserviceaccount.com` |

Dacă repo-ul se redenumește sau se mută la alt proprietar, condiția din legătura `buget-familie` trebuie actualizată, altfel publicarea e refuzată.

## Secrete în GitHub

Tabul **Secrets**:

| Secret | Conținut | Obligatoriu |
|---|---|---|
| `GEMINI_API_KEY` | Cheia Gemini care va fi sincronizată în Secret Manager | Recomandat pentru activarea Gemini |
| `GROQ_API_KEY` | Cheia Groq (gratuită) folosită ca rezervă când Gemini e ocupat | Opțional, dar recomandat |

## Permisiuni Google Cloud

Service account-ul folosit de workflow trebuie să poată publica Firebase Functions și să gestioneze secretul `GEMINI_API_KEY`. În funcție de politica proiectului, acordă-i permisiuni echivalente cu administrarea Cloud Functions, utilizarea service account-ului de runtime și administrarea versiunilor de secrete în Secret Manager.

Nu crea chei JSON pentru acest cont: publicarea merge fără ele.

## Ce face workflow-ul

Workflow-ul instalează dependențele Functions, rulează verificarea TypeScript, se autentifică în Google Cloud, creează sau actualizează secretul `GEMINI_API_KEY` dacă acesta există în GitHub Secrets, publică funcțiile Firebase și face o verificare POST a endpointului `aiGuide`.

Dacă `GEMINI_API_KEY` nu este definit în GitHub, workflow-ul nu suprascrie secretul existent în Firebase. Deploy-ul poate continua, dar funcția va funcționa cu secretul deja prezent în Secret Manager sau va eșua la runtime dacă acesta lipsește.

## Observație de securitate

Nu salva cheia Gemini în cod, în `.env` comis în Git sau în frontend. Frontend-ul trebuie să apeleze numai funcția `aiGuide`, iar cheia trebuie să rămână legată de funcția Firebase prin `defineSecret("GEMINI_API_KEY")`.
