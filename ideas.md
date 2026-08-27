# Direcție de design — Buget Familie

## Trei abordări explorate

### 1. Caietul de Casă
**Very Brief Intro:** O interfață caldă, tactilă, inspirată de registrele de familie și etichetele de cămară. Face finanțele să pară administrabile, nu intimidante.
**Probability:** 0.06

### 2. Atelierul Financiar
**Very Brief Intro:** Un tablou de comandă luminos, editorial, construit ca un atelier de decizie: măsurători clare, suprafețe de hârtie, accente de cerneală și semnale cromatice utile.
**Probability:** 0.04

### 3. Constelația de Economii
**Very Brief Intro:** O experiență nocturnă, contemplativă, în care obiectivele și datoriile apar ca puncte conectate într-o hartă financiară.
**Probability:** 0.08

## Abordarea aleasă — Atelierul Financiar

### Design Movement
**Editorial utilitar contemporan**, cu influențe din papetărie premium și tablouri de control industriale. Interfața arată ca un instrument de lucru de familie, nu ca o bancă rece și nici ca un joc.

### Core Principles
1. **Claritate înainte de ornament:** sumele, direcția și următoarea acțiune rămân întotdeauna dominante.
2. **Context înainte de judecată:** cheltuielile sunt explicate prin intervale, categorii și tendințe, fără ton moralizator.
3. **Informație stratificată:** imaginea de ansamblu este calmă; detaliile apar numai la cerere.
4. **Colaborare vizibilă:** acțiunile membrilor familiei sunt semnalate discret, iar deciziile comune au un spațiu propriu.

### Color Philosophy
Fundalul are ton de **hârtie caldă**, pentru a reduce presiunea asociată cu banii. Verdele-pădure indică echilibru și progres, coralul semnalează plăți sau atenție, iar galbenul de miere este folosit doar pentru alocări și răspunsuri care cer revizuire. Contrastul este ferm, cu text aproape-negru, pentru citirea sigură a cifrelor.

### Layout Paradigm
Un **banc de lucru financiar**: bară laterală îngustă ca un sertar de unelte, zonă centrală amplă pentru imaginea lunii, iar în dreapta o bandă contextuală cu asistentul, alerte și pașii imediat următori. Pe mobil, panoul contextual devine un sertar inferior.

### Signature Elements
1. **Benzi de măsură** pentru bugete și obiective, cu marcaje săptămânale.
2. **Etichete perforate** pentru categorii, conturi și tipuri de plată.
3. **Urme de creion** discrete, sub formă de linii și evidențieri organice, pentru insight-uri și starea financiară.

### Interaction Philosophy
Interacțiunile de rutină sunt directe și rapide: adăugarea unei cheltuieli începe dintr-un singur buton permanent. Orice schimbare importantă oferă confirmare clară și posibilitatea de anulare. Analizele se deschid ca foi suplimentare, nu ca pagini care rup contextul.

### Animation
Panourile, etichetele și cardurile folosesc tranziții de maximum 240 ms cu curbă `cubic-bezier(0.23, 1, 0.32, 1)`. Barele bugetelor cresc o singură dată la intrare, iar actualizările de sumă apar printr-un mic „slide” vertical, nu prin animații ostentative. Se respectă `prefers-reduced-motion`.

### Typography System
**IBM Plex Serif** este rezervată titlurilor de orientare și sumelor de focalizare, pentru o voce matură și controlată. **IBM Plex Sans** susține navigația, formularele, filtrele și cifrele tabulare, cu o ierarhie compactă: 10–11 px etichete, 13–16 px conținut, 24–32 px titluri de secțiune și 42–52 px pentru cifra esențială.

### Brand Essence
**Buget Familie este atelierul comun în care o familie vede, alocă și decide mai bine fiecare leu.** Personalitate: calmă, atentă, competentă.

### Brand Voice
Vocea este concretă, prietenoasă și lipsită de moralizare; CTAs folosesc verbe precise, iar insight-urile explică de ce. Exemple: „Alocă salariul înainte să se risipească.” și „Ai păstrat 320 lei pentru săptămâna a patra.”

### Wordmark & Logo
Marca este un **monogram geometric B/F** alcătuit din două forme de registru care se îmbină într-un acoperiș discret, sugerând buget și familie fără simboluri de bancă. Wordmark-ul combină numele în Manrope Semibold cu o subliniere scurtă, verde-pădure.

### Signature Brand Color
**Verde registru — `#143C36`**: un verde-pădure profund, propriu, asociat cu controlul calm și progresul.

## Style Decisions

- Benzile de măsură devin forma implicită pentru progres, buget și intervale: includ marcaje săptămânale și praguri vizibile.
- Suprafețele principale se comportă ca fișe de lucru premium, cu muchii tratate, etichete perforate și note cu urmă de creion; cardurile neutre primesc un detaliu funcțional din acest sistem.
- Marca folosește explicit lectura **B/F** peste simbolul geometric de registru-acoperiș pentru a crește recunoașterea la dimensiuni mici.
- Ecranele fără date păstrează limbajul atelierului: fișe de lucru, rigle vizibile și o bandă contextuală de decizie rămân prezente de la prima deschidere.
- Banda contextuală din dreapta devine un ghid de pornire pentru un spațiu nou și folosește mierea pentru alocări/revizuire, iar coralul pentru atenție sau obligații.
- Marca principală folosește monograma B/F din benzi de registru, nu simbolul generic de portofel sau bancă.
- Etichetele de sumă diferențiază semantic planificarea, ieșirile de bani și atenția prin verde, miere și coral; culorile nu sunt folosite decorativ.
- Pe mobil, suma disponibilă și următoarea decizie familială domină înaintea pulsului și a registrului; butonul de înregistrare rămâne vizibil, dar nu concurează cu planul.
- Fiecare suprafață majoră are un artefact funcțional de atelier: prag de decizie, bandă cu riglă, fișă liniată sau etichetă perforată; nu folosim carduri financiare generice fără rol de lucru.
- Check-inul familiei este tratat ca o bandă de decizie, cu miere pentru revizuire/alocare și coral numai pentru atenție sau obligații.
- Marcajele de măsură apar numai când indică suma consumată, un prag, un interval sau progresul; nu rămân ca decorație independentă.
- Bara principală exprimă consumul planului ca procent și prag coral la 75%, iar pasul următor rămâne legat direct de această măsură.
- Semnul de aplicație combină traseul de progres cu o insignă geometrică B/F, păstrând atât lectura semantică, cât și recunoașterea de brand la dimensiuni mici.
- Monograma B/F este prima lectură a semnului; acoperișul și registrul servesc această geometrie, nu devin o pictogramă generică de casă sau bancă.
- Riglele sunt eliminate de pe cardurile secundare; rămân numai în suprafețele care afișează consumul planului, progresul sau un prag verificabil.
- Mierea rămâne exclusiv pentru alocare și revizuire, iar coralul semnalează exclusiv atenție, datorii ori depășiri.
- Pe mobil, fișele urmează ordinea funcțională: decizia curentă, planul măsurat, banda de decizie, pulsul și registrul; nicio suprafață majoră nu devine un card financiar generic.
- Semnele de măsură apar numai pentru un prag, interval, consum sau pas următor și folosesc aceeași gramatică de bandă calibrată.
- Fiecare modul răspunde concret la una dintre întrebările: ce s-a întâmplat, ce înseamnă sau ce decidem acum; etichetele generice sunt înlocuite cu formulări de gospodărie clare.
- Suprafețele secundare folosesc linii de registru, benzi etichetate sau muchii perforate în locul cardurilor neutre; riglele apar numai pentru progres, limite, praguri și intervale.
- Mierea este rezervată pentru alocare și revizuire, coralul pentru datorii, depășiri și atenție, iar verdele pentru disponibil și progres; culoarea nu este decorativă.
- Fișa „punct de decizie” și planul măsurat domină ecranul; pulsul, bilanțul și jurnalul sunt dovezi de lucru care explică ce s-a întâmplat și ce urmează.
- Pe mobil, prima vedere formulează o singură propoziție de decizie, o valoare dominantă și următoarea acțiune; titlurile editoriale rămân secundare față de această claritate.
- Și în lipsa datelor, ecranele păstrează fișe pregătite, linii de registru, etichete perforate și zone calibrate, nu carduri goale generice.
- Monograma este citită mai întâi ca B/F geometric de registru, fără interpretare de scut, mascotă sau insignă nostalgică; accentele de casă servesc doar geometria B/F.
- Elemente de atelier apar numai când explică un prag, o limită, o categorie sau o acțiune. Claritatea și spațiul liber au prioritate față de orice textură decorativă.
- IBM Plex Serif este rezervată sumei dominante, totalurilor majore și deciziei curente; toate controalele, filtrele și metadatele rămân în IBM Plex Sans compact.
- În tema întunecată, starea activă folosește o suprafață închisă cu text cu contrast ridicat și o subliniere semantică; nu folosim niciodată text alb peste fundal aproape alb.

## Redesign major mobil — structură aleasă

### Diferența obligatorie

Versiunea nouă nu păstrează traseul „Acasă · Jurnal · Plan · Obiective · Mai mult” și nu mută aceleași module între carduri. Ea este un **tablou de lucru pe cinci întrebări**: **Astăzi**, **Mișcări**, **Plan**, **Obligații** și **Analiză**. Utilitarele rare (temă, familie, sincronizare, ghid) devin o foaie de instrumente deschisă din antet, fără poziție în bara de jos.

### Layout Paradigm

Fiecare ecran începe cu o **bandă de situație** care răspunde într-un rând la întrebarea principală, urmată de o acțiune dominantă și de fișe de lucru desfășurate. Ecranul nu mai este o colecție de blocuri egalizate: prima decizie primește spațiu, iar următoarele detalii se comprimă într-o cronologie, un registru ori o măsurătoare.

| Ecran | Rol nou | Piesă dominantă |
|---|---|---|
| Astăzi | decizie zilnică și atenții | panou de marjă până la venit + listă de acțiuni |
| Mișcări | înregistrare și verificare | cronologie grupată pe zile, cu total zilnic |
| Plan | alocare și control înainte de consum | atelier de plicuri + rezervări până la venit |
| Obligații | datorii, rate, economii și scadențe | axă de obligații și istoric de plăți |
| Analiză | explicația schimbărilor | comparație lunară + grafice + PDF și asistent |

### Signature Elements 2.0

1. **Benzi de situație:** o singură propoziție și o valoare dominantă, nu un antet decorativ repetat.
2. **Cronologii de lucru:** mișcări, rate și modificări ale plicurilor apar ca trasee ordonate în timp, nu grile de instrumente.
3. **Măsurători cu prag:** barele explică o limită sau evoluție și afișează întotdeauna valoarea exactă, starea și acțiunea disponibilă.

### Interaction Philosophy 2.0

Înregistrarea unei mișcări rămâne la o atingere, dar contextul (membru, sursă și plic) se completează direct în flux. Comutările Familie/Membru se păstrează numai acolo unde schimbă rezultatul. Un utilizator nu trebuie să deschidă „Mai mult” pentru a vedea analiza, rata sau un plic; acestea sunt destinații de lucru de prim rang.
