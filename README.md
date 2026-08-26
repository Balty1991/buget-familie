# Buget Familie

**Buget Familie** este o aplicație PWA pentru administrarea colaborativă a banilor unei familii. Interfața include registru de venituri și cheltuieli, planificare săptămânală, datorii, obiective de economisire, bonuri de cumpărături și un spațiu pentru explicații ghidate de date.

## Ce este implementat acum

| Domeniu | Disponibil în interfață |
|---|---|
| Panou financiar | Imagine curentă, venituri, cheltuieli, economii, trend zilnic și bugete pe categorii. |
| Mișcări | Registru cu venituri și cheltuieli; adăugare rapidă și păstrare locală în browser pentru varianta statică. |
| Planificare | Suma disponibilă pentru săptămână și repartizare pe categorii. |
| Datorii | Credite, rate de produse și împrumuturi între persoane într-o singură vedere. |
| Economii | Obiective, progres și alocări dedicate. |
| Bonuri | Flux UI pentru captură, verificare și categorii de produs. |
| Asistent | Interfață de întrebări și explicații; răspunsurile sunt etichetate ca orientare, nu consultanță financiară. |

> **Notă privind datele:** versiunea din repo este un front-end demonstrativ. Mișcările adăugate sunt păstrate doar în browserul curent; datele implicite sunt fictive. Nu introduce date financiare reale înainte de conectarea backendului securizat.

## Rulare locală

```bash
pnpm install
pnpm dev
```

Pentru verificare înainte de publicare:

```bash
pnpm check
pnpm build
```

## Publicare prin GitHub Pages

Repo-ul va include un workflow GitHub Actions pentru build și publicare. GitHub Pages publică front-end static și nu poate găzdui un backend, o bază de date sau o procesare AI privată. Pentru sincronizarea reală între membri, autentificare, bonuri și procesare AI, folosiți un backend securizat cu control de acces la nivel de rând (de exemplu, Supabase).

Datele financiare, bonurile și cheile secrete nu trebuie comise vreodată în repo sau incluse în artefactele Pages. GitHub avertizează că Pages este public și nu trebuie utilizat pentru tranzacții sensibile.[^pages]

## Arhitectură recomandată pentru versiunea sincronizată

| Strat | Rol |
|---|---|
| GitHub Pages | PWA React, build automat și cod public. |
| Autentificare | Identități separate pentru fiecare membru; invitații și reautentificare pentru acțiuni sensibile. |
| Bază de date | Tranzacții, categorii, bugete, datorii, economii și jurnal de activitate, protejate cu politici row-level security. |
| Stocare privată | Bonuri în bucket privat, accesibile doar cu URL-uri semnate, validate ca format și dimensiune. |
| Funcții de analiză | OCR și asistent AI în backend; fiecare recomandare include intervalul și tranzacțiile folosite. |

## Principii de protecție

Aplicația trebuie să aplice minimizarea datelor, accesul doar pentru membrii autorizați, o perioadă de retenție configurabilă, export și ștergere la cerere. Politicile de autorizare trebuie testate separat pentru operațiile de citire, adăugare, modificare și ștergere.[^gdpr] [^rls]

[^pages]: [GitHub Docs — GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
[^gdpr]: [European Commission — GDPR principles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)
[^rls]: [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
