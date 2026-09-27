# Ghid: publicare fără cheie (WIF) și App Check

Proiect Firebase: `buget-familie-a6a0d` · Repo: `Balty1991/buget-familie`

---

## Partea 1 · Publicare fără cheie (Workload Identity Federation)

**Ce se schimbă:** GitHub nu mai folosește cheia JSON salvată în secrete. La fiecare publicare cere de la Google o permisiune valabilă câteva minute, doar pentru acest repo și doar de pe `main`.

**Stare (27.09.2026): făcut.** Federarea e configurată, ambele publicări au trecut fără cheie, iar cheia JSON și secretul `FIREBASE_SERVICE_ACCOUNT` au fost șterse. Workflow-urile folosesc doar federarea. Pașii de mai jos rămân pentru refacere (proiect nou, repo redenumit).

### Pasul 1 · Deschide Cloud Shell

1. Intră pe https://console.cloud.google.com și alege proiectul **buget-familie-a6a0d** (sus, lângă logo).
2. Apasă iconița **>_** („Activate Cloud Shell”), dreapta sus. Jos se deschide un terminal.

### Pasul 2 · Află contul de serviciu

Lipește în terminal:

```bash
gcloud iam service-accounts list --project=buget-familie-a6a0d
```

Contul folosit de GitHub e cel pentru care ai făcut cheia JSON (de obicei are „github” sau „deploy” în nume, sau e `firebase-adminsdk-…`). Dacă nu ești sigur, trimite-mi lista și îți spun eu care e.

### Pasul 3 · Creează federarea

Înlocuiește `CONTUL_TAU` cu emailul contului de la pasul 2, apoi lipește tot blocul:

```bash
PROJECT_ID=buget-familie-a6a0d
SA=CONTUL_TAU
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project=$PROJECT_ID

gcloud iam workload-identity-pools create github \
  --project=$PROJECT_ID --location=global --display-name="GitHub"

gcloud iam workload-identity-pools providers create-oidc buget-familie \
  --project=$PROJECT_ID --location=global --workload-identity-pool=github \
  --display-name="buget-familie" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='Balty1991/buget-familie' && assertion.ref=='refs/heads/main'"

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project=$PROJECT_ID --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/Balty1991/buget-familie"

echo "GCP_WIF_PROVIDER = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/buget-familie"
echo "GCP_SERVICE_ACCOUNT = $SA"
```

Ultimele două linii afișează cele două valori de care ai nevoie la pasul 4.

### Pasul 4 · Pune cele două valori în GitHub

1. GitHub → repo **buget-familie** → **Settings** → **Secrets and variables** → **Actions**.
2. Tabul **Variables** (nu Secrets) → **New repository variable**:
   - `GCP_WIF_PROVIDER` = linia `projects/…/providers/buget-familie`
   - `GCP_SERVICE_ACCOUNT` = emailul contului

### Pasul 5 · Verifică

1. GitHub → **Actions** → **Publică regulile Firestore** → **Run workflow** (pe `main`).
2. În jobul `deploy` trebuie să apară verde pasul **Authenticate to Google Cloud (Workload Identity Federation)**, iar publicarea să treacă.

### Pasul 6 · Șterge cheia veche (doar după ce pasul 5 a trecut)

1. Google Cloud → **IAM și administrare** → **Conturi de serviciu** → contul tău → tabul **Chei** → șterge cheia JSON.
2. GitHub → Settings → Secrets and variables → Actions → **Secrets** → șterge `FIREBASE_SERVICE_ACCOUNT`.

De acum nu mai există nicio cheie care să poată scăpa.

---

## Partea 2 · App Check

**Unde suntem:**
- Aplicația cere deja jetoane App Check prin **reCAPTCHA Enterprise** (cheia `6Lc9zrctAAAAAAz27Nr8XWx9D3cRnBnHKChyyeCq`).
- Ghidul AI verifică jetonul pe server. Fără jeton, primește un plafon mai mic.
- Pe Firestore, App Check **nu e impus** încă. Asta e corect până vedem cifrele.

**Regula de aur:** nu apăsa „Enforce” până nu vezi în cifre că aproape toate cererile (inclusiv de pe Android) sunt „verificate”. Altfel utilizatorii rămân fără sincronizare.

### Pasul 1 · Verifică cheia reCAPTCHA

1. Google Cloud → caută **reCAPTCHA** → **Keys** → cheia `6Lc9zrct…`.
2. La **Domains** trebuie să fie ambele:
   - `balty1991.github.io` (varianta web)
   - `localhost` (aplicația Android rulează intern pe `https://localhost`)

### Pasul 2 · Verifică aplicația în Firebase

1. https://console.firebase.google.com → proiectul → **App Check** → tabul **Apps**.
2. Aplicația web trebuie să fie înregistrată cu **reCAPTCHA Enterprise** și aceeași cheie. Dacă nu e, apasă pe ea → reCAPTCHA Enterprise → lipește cheia → Save.

### Pasul 3 · Urmărește cifrele o săptămână

1. App Check → tabul **APIs** → **Cloud Firestore** și **Cloud Functions**.
2. Uită-te la procentul de cereri **Verified** față de **Unverified: invalid** și **Unverified: outdated client**.
3. Lasă testerii să folosească aplicația ~7 zile, apoi trimite-mi o captură cu graficul.

### Pasul 4 · Decidem împreună

- **Peste ~98% verificate, inclusiv de pe Android:** apeși **Enforce** la Cloud Firestore. Eu pornesc și verificarea strictă la ghidul AI.
- **Android apare neverificat:** reCAPTCHA nu merge bine în aplicația de telefon. Atunci adaug **Play Integrity**, nativ, în aplicație. Pentru asta îmi trebuie:
  1. Firebase → Project settings → aplicația Android `…` → descarci `google-services.json` (îl pui în `android/app/`, nu e secret).
  2. Play Console → aplicația → **Test and release** → **App integrity** → **Link Cloud project** → alegi `buget-familie-a6a0d`.
  3. Firebase → App Check → aplicația Android → **Play Integrity** → pui amprenta SHA-256 a cheii de semnare din Play Console (**App integrity** → **App signing**).

  După ce aplicația cu Play Integrity ajunge la testeri, repetăm pasul 3 și abia apoi apeși Enforce.
