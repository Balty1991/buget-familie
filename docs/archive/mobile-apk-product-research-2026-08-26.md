# Cercetare mobilă, APK și produs — 26 august 2026

**Autor:** Manus AI  
**Stare:** document de lucru pentru extinderea mobilă și Android

## Concluzie executivă

Pentru **Buget Familie**, direcția potrivită este o aplicație web unică, păstrată pe GitHub Pages, împachetată separat pentru Android cu **Capacitor**. Aceasta este și direcția tehnică a repo-ului de referință `Balty1991/Lumin-Culler`: același build web este sincronizat într-un proiect Android, iar buildurile de test și de release sunt separate în GitHub Actions. Capacitor poate fi adăugat unei aplicații web existente care are `package.json`, un director separat de artefacte web și un `index.html`; apoi `cap sync` copiază bundle-ul în proiectul nativ. [1]

> Nu este necesară rescrierea în React Native pentru obiectivul actual. Capacitor permite păstrarea codului React, a localStorage-ului existent și a publicării GitHub Pages, adăugând acces controlat la capabilități Android ulterior.

## Ce se poate prelua din Lumin Culler

| Element | Ce face repo-ul de referință | Adaptare pentru Buget Familie |
|---|---|---|
| Wrapper Android | Folosește Capacitor v8 cu `capacitor.config.ts` și directorul `android/`. | Folosim aceeași structură, cu identificator Android propriu și `webDir` aliniat la buildul Vite. |
| APK de test | Are un workflow lansat manual care construiește `assembleDebug` și încarcă APK-ul ca artefact. | Adăugăm un workflow manual; utilizatorul poate descărca APK-ul instalabil din rularea GitHub Actions. |
| Release | Separă un AAB semnat, pornit manual sau prin tag, de publicarea PWA. | Păstrăm separarea: Pages rămâne publicare web, iar pachetul release va cere explicit un keystore stocat doar ca secret GitHub. |
| Porți de calitate | Verifică tipuri și teste înainte de pachet. | Păstrăm `pnpm check`, testele financiare și buildul web înainte de sincronizarea Android. |

Capacitor v8 acceptă Android API 24+ și gestionează proiectul Android prin Android Studio; documentația oficială descrie adăugarea platformei cu `npx cap add android`, sincronizarea bundle-ului și rularea pe dispozitiv sau emulator. [1] [2]

## Concluzii din produsele de buget familial

| Produs | Semnal util verificat | Decizie pentru Buget Familie |
|---|---|---|
| Goodbudget | Bugete de tip plic, planificare pentru cheltuieli mari, economii, datorii și bugete împărțite pe dispozitive. [3] | Consolidăm alocările ca „plicuri” cu limită, consum și rămas, legate de aceeași perioadă salarială. |
| Honeydue | Selectarea a ceea ce se partajează într-un cuplu și conversații atașate cheltuielilor. [4] | Prioritizăm vizibilitatea comun/personal și pregătim note la o mișcare înaintea unei funcții de chat. |
| Monarch | Vedere de gospodărie pentru conturi comune și separate, colaborare la tranzacții, obiective și rapoarte. [5] | Păstrăm sursa + membrul ca date obligatorii și adăugăm control pentru statutul mișcărilor și o recapitulare de familie. |

Funcția cea mai importantă de adăugat acum nu este un feed social sau conectarea bancară, ci **înregistrarea rapidă și verificabilă**: o cheltuială trebuie introdusă cu suma, sursa, membrul, categoria și opțional bonul în câteva atingeri. Aceasta susține direct planurile, statisticile și colaborarea deja existente.

## Principii mobile care devin criterii de acceptare

Android recomandă un contrast de cel puțin 4,5:1 pentru textul mic și zone tactile de cel puțin 48 × 48 dp; WCAG 2.2 stabilește un prag minim de 24 × 24 CSS px pentru țintele de pointer, cu distanțare atunci când ținta este mai mică. [6] [7]

| Criteriu | Aplicare concretă |
|---|---|
| O singură mână | Bara de navigație, acțiunea „Adaugă” și confirmarea formularului stau în jumătatea inferioară a ecranului pe mobil. |
| Viteză | Formular compact: sumă numerică, tip venit/cheltuială, sursă, membru și categorie; ultimele opțiuni sunt reutilizabile. |
| Prevenirea erorii | Afișăm efectul asupra sursei și planului înainte de salvare; păstrăm confirmări pentru ștergeri. |
| Accesibilitate | Butoane de minimum 48 px pentru gesturile esențiale, etichete asociate câmpurilor, focus vizibil și contrast verificabil în ambele teme. |
| Offline și confidențialitate | Operațiile rămân locale; sincronizarea GitHub este explicită, criptată și nu include automat fotografii mari ale bonurilor. |

## Backlog prioritar propus

| Prioritate | Extindere | Efect practic |
|---|---|---|
| P0 | „Adăugare rapidă” ca sheet mobil cu ultimele selecții și tastatură numerică | Reduce timpul necesar pentru înregistrarea zilnică. |
| P0 | Cheltuieli recurente și calendar de scadențe | Evită ratarea ratelor, facturilor și contribuțiilor înainte de salariu. |
| P1 | Statut „în așteptare / confirmată” și notă pentru fiecare mișcare | Permite colaborarea familială fără modificarea istoricului contabil. |
| P1 | Recapitulare săptămânală și „check-in” de familie | Transformă datele în discuții scurte bazate pe aceleași cifre. |
| P1 | APK de test din GitHub Actions | Oferă o instalare Android directă, fără a renunța la pagina publică. |
| P2 | AAB semnat pentru Play Store | Devine necesar doar când se dorește distribuție prin Google Play și există keystore-ul utilizatorului. |

## Referințe

[1]: https://capacitorjs.com/docs/getting-started "Capacitor — Installing Capacitor"
[2]: https://capacitorjs.com/docs/android "Capacitor — Android Documentation"
[3]: https://goodbudget.com/ "Goodbudget — Home budget app"
[4]: https://www.honeydue.com/ "Honeydue — Finance App for Couples"
[5]: https://www.monarch.com/for-couples "Monarch — Budgeting for Couples"
[6]: https://developer.android.com/guide/topics/ui/accessibility/apps "Android Developers — Make apps more accessible"
[7]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html "W3C — Understanding Target Size (Minimum)"
