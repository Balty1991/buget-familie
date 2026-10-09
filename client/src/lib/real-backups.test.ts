import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it, vi } from "vitest";
import { addIsoDays, normalizeAppData } from "./finance-data";
import { atNoon, checkInvariants } from "./__fixtures__/invariants";

/**
 * Verificarea dinaintea unei versiuni, pe backup-uri reale ținute în afara depozitului:
 * `REAL_BACKUPS=/cale/spre/folder pnpm vitest run real-backups`. Fără variabilă, nu rulează nimic.
 * Fiecare backup trece prin aceleași reguli ca luna simulată, în fiecare zi a planului lui.
 */
const folder = process.env.REAL_BACKUPS || "";
const files = folder && existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith(".json")).sort() : [];

afterEach(() => { vi.useRealTimers(); });

describe.skipIf(!files.length)("backup-uri reale", () => {
  for (const file of files) {
    it(file, () => {
      const raw = JSON.parse(readFileSync(join(folder, file), "utf8"));
      const data = normalizeAppData(raw.data ?? raw);
      const plan = data.settings.salaryPlan;
      const start = plan.periodStart || addIsoDays(new Date().toISOString().slice(0, 10), -3);
      const end = plan.nextPayday || addIsoDays(start, 14);
      for (let day = start; day < end; day = addIsoDays(day, 1)) {
        atNoon(day);
        checkInvariants(data, day);
      }
    });
  }
});
