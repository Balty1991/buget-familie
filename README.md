# Buget Familie

**Buget Familie** este o aplicație PWA pentru administrarea banilor unei familii, publicată exclusiv prin GitHub Pages. Interfața include registru de venituri și cheltuieli, planificare săptămânală, datorii, obiective de economisire, setări de familie și transfer local controlat între dispozitive.

## Ce este implementat acum

| Domeniu | Disponibil în interfață |
|---|---|
| Panou financiar | Imagine curentă calculată exclusiv din datele reale adăugate de utilizator. |
| Mișcări | Registru cu venituri și cheltuieli; adăugare, modificare și ștergere locală. |
| Planificare | Suma disponibilă pentru săptămână și repartizare pe categorii. |
| Datorii | Credite, rate și împrumuturi; adăugare, modificare și ștergere. |
| Economii | Obiective, progres și alocări; adăugare, modificare și ștergere. |
| Setări | Numele familiei, numele membrului, codul de familie, temă întunecată și resetare controlată. |
| Transfer între dispozitive | Export JSON și import verificat prin codul familiei; transferul este manual, la alegerea utilizatorului. |
| Bonuri și asistent | Interfețe locale de orientare; fotografiile și recomandările AI reale necesită stocare și procesare privată. |

> **Notă privind datele:** aplicația începe fără date demo. Datele introduse se păstrează numai în browserul curent. Pentru al doilea dispozitiv, exportă pachetul din **Setări**, transmite fișierul printr-un canal de încredere și importă-l folosind codul familiei. Codul verifică pachetul; nu îl criptează.

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

Repo-ul include un workflow GitHub Actions pentru build și publicare. GitHub Pages publică front-end static și nu poate găzdui un backend, o bază de date sau o procesare AI privată. Din acest motiv, versiunea curentă folosește transfer manual export/import, nu sincronizare automată în timp real.

Datele financiare, bonurile și cheile secrete nu trebuie comise vreodată în repo sau incluse în artefactele Pages. GitHub avertizează că Pages este public și nu trebuie utilizat pentru tranzacții sensibile.[^pages]

## Limită importantă pentru sincronizare

| Strat | Rol |
|---|---|
| Cerință | Posibil doar cu GitHub Pages | Necesită un serviciu privat |
|---|---|---|
| Date locale, CRUD, temă și export | Da | Nu |
| Mutare controlată a pachetului între telefoane | Da, prin fișier și cod | Nu |
| Sincronizare automată simultană | Nu | Da, cu autentificare și bază de date |
| Fotografii private ale bonurilor | Nu | Da, cu stocare privată |
| Asistent AI pe date reale | Nu | Da, cu procesare server-side |

## Principii de protecție

Aplicația trebuie să aplice minimizarea datelor, accesul doar pentru membrii autorizați, o perioadă de retenție configurabilă, export și ștergere la cerere. Politicile de autorizare trebuie testate separat pentru operațiile de citire, adăugare, modificare și ștergere.[^gdpr] [^rls]

[^pages]: [GitHub Docs — GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
[^gdpr]: [European Commission — GDPR principles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)
[^rls]: [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
