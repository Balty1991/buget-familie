# Restaurare urgentă Home.tsx

Pe `main`, fișierul `client/src/pages/Home.tsx` a fost înlocuit accidental cu un stub.

## Recuperare (1 minut)

```bash
git fetch origin
git checkout cb4390e123704ebed187b84777d1a9dfc2fa4b01 -- client/src/pages/Home.tsx
git commit -m "fix: restore Home.tsx from last good commit"
git push origin main
```

## Apoi, ca să apară scorul + alertele

1. Importuri (după WeeklySummaryPanel):

```ts
import { HealthScoreBadge } from "@/components/HealthScoreBadge";
import { scheduleFinancialReminders, requestNotificationPermission, setNotificationsEnabled } from "@/lib/local-notifications";
```

2. În `TodayView`, după `</span>` din `bf-today-situation-number`:

```tsx
<HealthScoreBadge data={data} />
```

3. După `autoPostDueRecurring`:

```ts
useEffect(() => { if (!storageReady) return; void scheduleFinancialReminders(data); }, [data, storageReady]);
```

4. În Setări → înainte de BACKUP: butoane Activează / Oprește alerte (folosesc `requestNotificationPermission` / `setNotificationsEnabled`).

## Ce e deja pe main (OK)

- Plan: progres repartizare + chip-uri rapide
- `local-notifications.ts`
- `@capacitor/local-notifications` în package.json
- Permisiuni Android pentru notificări
- HealthScoreBadge + CSS (componentă gata)
