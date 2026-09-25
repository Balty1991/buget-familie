/**
 * Ecranele se încarcă la cerere. Pe web, fără internet, o bucată care nu e încă în cache
 * nu se poate descărca, iar React arunca „A apărut o eroare neașteptată” pe tot ecranul
 * (ghidul apăsat offline). Acum: o a doua încercare, apoi un mesaj mic, cu „Reîncearcă”.
 */
import type { ComponentType } from "react";
import { t } from "./i18n";

function OfflinePiece() {
  return (
    <div className="bf-lazy-panel bf-lazy-offline" role="status">
      <p>{t("Partea asta a aplicației nu s-a putut încărca. Verifică internetul și reîncearcă.")}</p>
      <button type="button" className="bf-secondary" onClick={() => window.location.reload()}>{t("Reîncearcă")}</button>
    </div>
  );
}

export function safeImport<T extends ComponentType<any>>(loader: () => Promise<{ default: T }>): () => Promise<{ default: T }> {
  const fallback = { default: OfflinePiece as unknown as T };
  return () => loader().catch(() => new Promise<{ default: T }>((resolve) => {
    window.setTimeout(() => {
      loader().then(resolve).catch(() => resolve(fallback));
    }, 1500);
  }));
}
