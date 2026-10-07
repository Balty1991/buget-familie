# Kit de lansare — Buget Familie

Ce e de făcut în afara codului, în ordinea în care aduce bani și oameni.

## 1. Pornirea plăților (Play Console)

Codul e gata (cumpărare, verificare pe server, anulări, Familia pentru partener). Pașii detaliați: `docs/BILLING_PLAY_PREP.md`. Pe scurt:

1. Play Console → Configurare → **Profil de plăți / comerciant** (dacă nu există).
2. Monetizare → Abonamente: `familie_lunar` (plan de bază `lunar`, 19,99 lei) și `familie_anual` (plan de bază `anual`, 149 lei), fiecare cu ofertă de probă de 30 de zile.
3. Utilizatori și permisiuni: contul de serviciu al funcțiilor, cu drept pe comenzi și abonamente.
4. Google Cloud: activează „Google Play Android Developer API”.
5. Spune-mi când ai terminat: pun `BILLING_LIVE = true`, publicăm pe testare internă și cumpărăm o dată cu un cont de test (fără bani reali).

## 2. Ieșirea în producție

Conturile personale noi au nevoie, de regulă, de **12 testeri activi timp de 14 zile** pe testarea închisă înainte de producție (vezi Play Console → Producție → cerințe). Testerii sunt și primele recenzii.

Mesaj de recrutare (WhatsApp / Facebook):

> Salut! Am făcut o aplicație de buget pentru familie, în română: îți spune cât poți cheltui azi ca să ajungi la salariu. Nu e aplicație de plăți, nu cere card sau parola băncii — notezi tu. Caut 20 de oameni care să o folosească 2 săptămâni și să-mi spună ce nu merge. E gratuită. Îmi dai adresa de Gmail și îți trimit linkul?

După 14 zile: rugăminte scurtă de recenzie, doar celor care o folosesc:

> Mulțumesc că ai testat! Dacă te ajută, o recenzie sinceră pe Google Play contează enorm pentru o aplicație mică. Orice problemă, scrie-mi direct și o repar.

## 3. Răspunsul la „țeapă” / „scam”

> Bună ziua! Înțeleg prudența. Buget Familie nu e o aplicație de plăți și nici de monitorizare: nu mută bani, nu se leagă de bancă, nu cere card sau parole și nu urmărește pe nimeni. E un caiet de buget: notați voi ce cheltuiți. Datele stau pe telefon. E publicată pe Google Play, care verifică dezvoltatorul. Dacă aveți o întrebare concretă, vă răspund aici.

Regulă: un singur răspuns calm, apoi „Ascunde”. Fără discuții în comentarii.

## 4. TikTok / Reels (30–45 s, filmat cu telefonul)

1. **„Cât poți cheltui azi?”** — Ecranul cu cifra mare. „Salariul vine pe 10. Azi am 84 de lei de mâncare. Atât. Dacă mâine nu cheltui nimic, poimâine am 112.” Text pe ecran: *O singură cifră pe zi, până la salariu.*
2. **„Unde s-au dus 5.000 de lei?”** — Graficul lunii, apoi bilanțul trimis pe WhatsApp soției. *Luna ta într-o imagine.*
3. **„Tichete de masă + SGR + cash”** — Un bon real plătit din două surse, notat în 10 secunde. *Făcută pentru România.*
4. **„Eu notez, ea notează”** — Două telefoane, cheltuiala apare pe al doilea în câteva secunde. *Un buget, două telefoane.*
5. **„RCA-ul nu mai e o surpriză”** — Plicul de plăți rare care se umple din fiecare salariu.

Final comun: „Buget Familie, gratuit pe Google Play. Nu e aplicație de plăți — e caietul vostru de buget.”

## 5. Grupuri de Facebook (mămici, economii, „bani și buget”)

Nu reclamă, ci poveste + întrebare (citește regulile grupului înainte):

> Noi ne certam la fiecare sfârșit de lună pe „unde s-au dus banii”. Am făcut pentru noi o aplicație simplă: îți spune cât poți cheltui azi până la salariu, iar eu și soția notăm fiecare de pe telefonul lui. De când o folosim, mâncarea nu mai trece de plic. Dacă vrea cineva s-o încerce (e gratuită, nu cere date bancare), las linkul în comentarii. Voi cum țineți bugetul?

## 6. Ce măsurăm (Play Console, gratuit)

- Statistici → Achiziție: instalări pe zi și de unde vin.
- Calitate → Evaluări: nota și ce scriu oamenii.
- După pornirea plăților: Monetizare → Abonamente (probe pornite, convertite, anulate).

Ținte realiste pentru prima lună în producție: 500 de instalări, 30% încă active după 7 zile, 5% din familiile cu două telefoane pornesc proba.
