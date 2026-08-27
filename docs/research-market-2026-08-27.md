# Cercetare comparativă de piață — 27 august 2026

## Surse consultate

| Produs | Observații relevante | Implicație pentru Buget Familie |
|---|---|---|
| [Honeydue](https://www.honeydue.com/) | Se poziționează pentru cupluri, cu vizibilitate selectivă, cheltuieli împărțite, activitate, solduri, facturi, bugete și dialog contextual pe tranzacții. | Separarea dintre date individuale și date comune, plus contextul unui membru la fiecare mișcare, sunt diferențiatori practici. Aplicația are deja membri și surse; următorul pas util este o vedere/filtru explicit personal vs. familie, nu chat demonstrativ. |
| [Goodbudget — What You Get](https://goodbudget.com/what-you-get/) | Prezintă bugetarea pe plicuri, partajarea bugetului, economisirea pentru cheltuieli mari și urmărirea rambursării datoriei. | Plicurile trebuie să rămână vizibile prin limită, consum, alertă și istoric. Datoriile merită un flux de actualizare explicită a soldului după rate, nu o estimare automată. |
| [Harvard FCU — AI budgeting and credit apps](https://harvardfcu.org/blog/ai-budgeting-credit-apps-what-consumers-need-to-know/) | Atrage atenția că instrumentele AI pot necesita date de cont și tranzacții, pot rata contextul veniturilor neregulate și nu trebuie urmate necritic. | Asistentul trebuie să arate datele și regulile din spatele fiecărei observații, să nu sugereze investiții și să nu trimită automat date familiale în afara dispozitivului. |
| [YNAB — Features](https://www.ynab.com/features) | Evidențiază obiective, gestionarea datoriilor, rapoarte, vederi personalizabile, widgeturi mobile și colaborare printr-un buget împărțit. | Direcția utilă este orientarea la următoarea decizie, ținte clare și vederi personalizabile; integrarea bancară și funcțiile online permanente nu sunt premise ale produsului GitHub-only. |

## Concluzii de produs

Produsele consacrate combină patru lucruri: un registru comun, limite explicite pe categorii, obligații urmărite și colaborare între persoane. Buget Familie are deja o bază compatibilă: registru local, plan prudent până la venit, plicuri cu sursă și membru, realocări, datorii, obiective, recurente și sincronizare opțională criptată.

Diferențierea potrivită pentru versiunea GitHub-only nu este imitarea conectării bancare sau a unui chat online. Este **controlul familial explicabil și privat**: fiecare sumă trebuie să arate cine a plătit, din ce sursă, ce plic a fost consumat, ce obligație a rămas și de ce apare o alertă. Funcțiile ce cer infrastructură permanentă, precum actualizare instantanee, agregare bancară sau un model extern care primește date financiare, rămân intenționat în afara versiunii actuale până există consimțământ și arhitectură server-side.

Pentru asistent, concluzia este la fel de importantă: recomandările automate trebuie să rămână **descrieri de risc și opțiuni de verificat**, nu instrucțiuni de investiție, promisiuni de rezultat sau decizii luate în locul familiei. Cea mai utilă versiune imediată este un asistent local care explică ritmul, plicurile, ratele și marja până la venit din datele deja introduse.

## Oportunități prioritare rezultate

| Prioritate | Funcție | Motiv |
|---|---|---|
| 1 | Filtru de perspectivă „Familie / membru” pentru bilanț, jurnal și plicuri | Răspunde nevoii de buget comun cu responsabilitate individuală, fără a duplica datele. |
| 2 | Flux explicit pentru plata ratei și actualizarea soldului datoriei | Face bilanțul mai fidel fără a presupune că orice cheltuială din categoria „Rate produse” reduce automat un credit. |
| 3 | Tablou de plicuri cu alerte, selecție și istoric filtrabil | Face metoda plicurilor acționabilă înainte ca o limită să fie depășită. |
| 4 | Tematică accesibilă Black–Blue și variante memorate | Îmbunătățește confortul vizual fără a schimba semantica financiară. |
| 5 | Asistent local pe bază de semnale și explicații | Oferă îndrumare verificabilă fără a expedia date financiare către un model extern. |

## Limită verificată

Nicio concluzie de piață nu justifică afișarea de recenzii, evaluări sau testimonialele ca și cum ar aparține utilizatorilor Buget Familie. Aplicația nu va inventa astfel de conținuturi.

## Principii obligatorii pentru teme

Conform [W3C WCAG 2.2 — Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum), textul obișnuit trebuie să atingă cel puțin 4,5:1 față de fundal, iar textul mare cel puțin 3:1. În temele noi, culorile nu vor fi singurul semnal: veniturile, cheltuielile și alertele păstrează icon, semn aritmetic, etichetă și text explicativ. Fundalul Black–Blue va folosi negru-albăstrui ca material principal și albastru doar ca accent controlat, nu ca fundal variabil sub text subțire.

## Actualizare: tipografie, navigație și dashboard mobil

Cercetarea pentru rafinarea interfeței confirmă că un dashboard mobil financiar trebuie să ofere întâi o vedere scanabilă asupra poziției curente și a deciziei următoare, apoi să dezvăluie detalii în context. Navigația globală, navigația contextuală și detalierea unei valori trebuie să se susțină reciproc, iar etichetele concise și filtrele mențin utilizatorul orientat.[^gooddata]

Pentru mobil, prioritățile sunt acțiuni repetate rămase vizibile, ținte tactile de minimum aproximativ 48 px, ierarhie bazată pe sold, mișcări recente și obligații apropiate, plus carduri verticale pentru date care nu necesită comparație de tabel. Interfața financiară trebuie să favorizeze certitudinea, feedbackul și lizibilitatea cifrelor în fața elementelor decorative.[^toptal] [^banking]

În implementare, aceasta înseamnă: font pentru cifre și controale orientat spre lizibilitate, titluri editoriale rezervate exclusiv punctelor de orientare, bara de navigație inferioară pentru cele cinci zone principale, filtre compacte pentru Jurnal și acțiuni distincte pentru editare versus ștergere. Culorile de stare rămân dublate de text, iconografie și etichete pentru a nu deveni singura sursă de semnificație.[^boia]

[^gooddata]: https://www.gooddata.ai/blog/six-principles-of-dashboard-information-architecture/
[^toptal]: https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui
[^banking]: https://lollypop.design/blog/2026/june/banking-app-ui-design/
[^boia]: https://www.boia.org/blog/4-common-accessibility-barriers-in-mobile-banking-apps
