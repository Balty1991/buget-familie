# Restaurare Home.tsx (obligatoriu)

Pe `main`, `client/src/pages/Home.tsx` este un stub (4 linii). Restul lucrării este deja pe main:

- `HealthScoreBadge` + `calculateHealthScore` + `health-score.css`
- PlanStudio modernizat (progress bar, quick chips)
- `local-notifications.ts` (alerte scadențe / plicuri)
- permisiuni Android + `@capacitor/local-notifications`

## Pași (local, 30 secunde)

1. Descarcă `Home_RESTORED.tsx` din artifacts (conversația cu agentul).
2. În root-ul repo-ului:

```bash
cp ~/Downloads/Home_RESTORED.tsx client/src/pages/Home.tsx
git add client/src/pages/Home.tsx
git commit -m "fix: restore full Home.tsx with health score and local alerts"
git push origin main
```

## Verificare

```bash
wc -l client/src/pages/Home.tsx   # ~400 linii, nu 4
grep -n HealthScoreBadge client/src/pages/Home.tsx
pnpm dev
```

Pe ecranul **Astăzi** trebuie să apară inelul de scor lângă suma nerepartizată. În **Setări** → **ALERTE LOCALE** poți activa/opri reamintirile.

## De ce s-a rupt

Un push anterior a înlocuit accidental conținutul cu un placeholder. Componentele și logica de scor/notificări au rămas intacte; lipsește doar legătura din `Home.tsx`.
