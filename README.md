# Buget Familie

**Buget Familie** este o aplicație PWA pentru administrarea banilor unei familii. Interfața este publicată prin GitHub Pages, iar sincronizarea protejată salvează doar un pachet financiar criptat într-un repo GitHub privat separat.

## Funcții implementate

| Domeniu | Funcție disponibilă |
|---|---|
| Panou financiar | Indicatori calculați din registrul real; o stare depășită este semnalată explicit, fără a fi mascată ca disponibil. |
| Mișcări | Adăugare, editare și ștergere de venituri și cheltuieli. Fiecare intrare are dată ISO, membru, sursă de plată și categorie. |
| Membri și surse | Membri configurabili, carduri nominale, cash, bonuri de masă, transferuri și categorii precum Taxi. |
| Plan până la salariu | Data următorului venit, limită totală, limită săptămânală calculată, zile rămase și alocări pe membri sau categorii. |
| Statistici | Venituri, cheltuieli și diferență pentru anul curent; evoluție lunară și categorii extrase din registru. |
| Datorii și economii | Adăugare, editare, ștergere și calcule de progres. |
| Bonuri | Bon manual cu magazin, valoare, categorie, produse și fotografie locală opțională; bonul creează automat cheltuiala asociată. |
| Asistent | Analiză locală explicabilă pentru cheltuieli, datorii, obiective, limite și alocări. |
| Aspect și control | Temă întunecată, resetare controlată și export/import de rezervă. |
| Sincronizare privată | Pachet AES-GCM criptat local, încărcat manual într-un repo GitHub privat. |

> Aplicația începe fără date demo. Datele sunt locale până când alegi explicit exportul sau sincronizarea.

## Modelul de calcul v6

Aplicația păstrează un singur registru drept sursă de adevăr. Soldul afișat pentru o sursă de plată este **soldul inițial plus venituri minus cheltuieli** atribuite acelei surse. Planul include numai cheltuielile cu dată din intervalul ales; alocările personale sau pe categorii sunt consumate din aceleași intrări, nu dintr-un total separat.

> Soldul inițial reprezintă punctul de pornire introdus de familie. În versiunea actuală nu este un extras bancar reconciliat pe o dată istorică; de aceea, utilizați-l ca bază de pornire la configurare și actualizați-l atent după importuri vechi.

## Sincronizare GitHub protejată

Aplicația publică este `Balty1991/buget-familie`. Repo-ul separat `Balty1991/buget-familie-date` este privat și stochează numai un pachet deja criptat în browser. Tokenul GitHub și parola de criptare nu sunt păstrate în local storage sau în repo-ul public.

| Pas | Acțiune |
|---|---|
| 1 | Creează un **fine-grained personal access token** limitat strict la repo-ul `buget-familie-date`. |
| 2 | Acordă numai permisiunea **Contents: Read and write**. |
| 3 | În aplicație, deschide pagina **Sincronizare** și introdu tokenul doar pentru sesiunea curentă. |
| 4 | Alege o parolă de familie de cel puțin 12 caractere; ea criptează datele prin AES-GCM înainte de upload. |
| 5 | Pe al doilea dispozitiv, introdu un token limitat și aceeași parolă, apoi apasă **Descarcă din repo**. |

Sincronizarea este intenționat manuală și confirmată înainte de suprascriere. În acest mod, familia alege când trimite sau recuperează datele și poate evita conflicte silențioase.

## Limite importante

| Cerință | Această versiune GitHub-only |
|---|---|
| CRUD financiar, planificare, temă și analize | Da, local în browser. |
| Copie între telefoane | Da, prin export/import sau pachet criptat în repo privat. |
| Sincronizare automată în timp real | Nu; este manuală cu protecție la suprascriere. |
| Fotografii ale bonurilor | Locale în browser; imaginile mari nu sunt recomandate. |
| Asistent LLM extern | Nu; GitHub Models a fost retras. Asistentul actual este local și explicabil. |

Datele financiare necriptate, bonurile și cheile nu trebuie comise în repo-ul public sau incluse în artefactele GitHub Pages. GitHub avertizează că Pages este public și nu trebuie utilizat pentru tranzacții sensibile.[^pages]

## Rulare locală

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm exec vitest run client/src/lib/finance-data.test.ts
```

Testele de regresie verifică parserul românesc pentru sume, migrarea defensivă a datelor vechi, calculul soldului derivat și consumul alocărilor din perioada de plan.

[^pages]: [GitHub Docs — GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
