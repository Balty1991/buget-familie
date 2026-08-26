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
**Fraunces** este folosită în titlurile de analiză și sumele de focalizare, pentru o voce umană și memorabilă. **Manrope** susține navigația, formularele și tabelele, cu cifre tabulare pentru sume. Ierarhia urmează o scară compactă: 12 px etichete, 14–16 px conținut, 24–32 px titluri de secțiune, 42–52 px pentru cifra esențială.

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
