# UI modern pass — 2026-09-20

## De ce pass 1–2 aproape nu se vedeau

`main.tsx` importa `ui-modern-pass.css` **înainte** de foile deferred (~1 MB: `deferred-atelier.css` → clarity/atelier/…).  
`scheduleDeferredStyles` / `loadDeferredStyleSheets` din `client/src/lib/ram-hygiene.ts` le încărca **după** first paint și le **suprascria** pe ale noastre.

**Remediu (acest commit):** la finalul `loadDeferredStyleSheets`:

1. `await import("../ui-modern-pass.css");`
2. `await import("../ui-modern-pass-aggressive.css");` ← **ultimul** CSS din lanțul deferred

Pass-urile a1–c2 rămân utile ca bază; **vizibilitatea reală** vine din `ui-modern-pass-aggressive.css` încărcat ultima oară.

## Fișiere

- `client/src/ui-modern-pass.css` — stub `@import` a1…c2 (early + re-import deferred)
- `ui-modern-pass-a1…c2.css` — Pass 1–2 (prea slabe vs deferred; păstrate)
- **`client/src/ui-modern-pass-aggressive.css`** — bug fix + modernizare vizibilă
- `client/src/lib/ram-hygiene.ts` — import modern + aggressive **după** display-fixes-pass

## Aggressive pass — ce rezolvă (vizibil)

1. **P0 dock overlap** — `padding-bottom: calc(88px + safe-area + 24px)` pe main / Plan / Mișcări / Obligații / Analiză / utilities; filtrele („Acțiune”, „De la”) nu mai sunt sub dock
2. **Pătrat gri empty** — ascunde `::before` din empty/allocation; SVG `EnvelopeEmptyArt` / `.bf-envelope-empty-art` static, nu absolute pe cutie goală
3. **Tab-uri segment** (Istoric/Gospodărie/Asistent, Lună/Ciclu, pace) — activ = mint fill, **fără** bordură groasă deschisă
4. **Glow dock/card** — `--cf-glow: transparent`; umbră negru ~8–32%, zero violet/albastru pe dock
5. **Aer carduri** — pad ~22px; gap copy 12px; gap CTA 16px; LH ≥1.55
6. **CTA filled mint** — primary + plan simulator actions, pill, text închis
7. **H2 mobil sans** — Outfit / IBM Plex Sans, weight 600, ≤640px
8. **Dock activ** — pill mint 48px, nu blob uriaș
9. **Light Alb/Atelier** (`theme-ink` / `theme-white`) — aceleași reguli, umbră paper

## Cum verifici

1. Hard refresh Pages / Incognito (SW unregister dacă e nevoie). Așteaptă deferred (~6–10 s pe device, sau idle după reveal).
2. **Plan**: scroll până la filtre — „Acțiune” / „De la” **deasupra** dock-ului.
3. Plan empty plicuri: **fără** pătrat gri; art SVG sau doar text.
4. Tab-uri segment: activ mint plin, fără outline alb gros.
5. Dock: fără bară/glow albastru-violet sub Astăzi; activ mint.
6. Temă **Alb** + dark: carduri respiră; CTA plin.

### Hard refresh GitHub Pages
- Android Chrome: Incognito sau șterge date site → pull-to-refresh după rebuild (~1–2 min).
- iOS: Private / reload fără blockers.
- Desktop: Ctrl/Cmd+Shift+R; Application → Unregister SW.

## Neatinse
- `clarity-rebuild.css` — nerescris (override din urmă)
- `Home.tsx` — fără rewrite
- `BILLING_LIVE` / billing — `false`
- Soft `d1/d2` secondary surfaces — amânate; deferred-last e prioritatea

## Commits
- Pass 1–2 stub a/b/c (slabe vs deferred — documentat)
- `feat(ui): modernizare agresivă — override după deferred + dock/empty/tab-uri` (ram-hygiene last imports)
- `feat(ui): modernizare agresivă — CSS override vizibil + docs deferred-last`
