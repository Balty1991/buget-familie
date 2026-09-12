import { cn } from "@/lib/utils";
import { isQuotaExceededError, freeHeavyLocalCache } from "@/lib/safe-storage";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function isQuotaError(error: Error | null): boolean {
  if (!error) return false;
  if (isQuotaExceededError(error)) return true;
  return /QuotaExceeded|exceeded the quota|setItem.*Storage/i.test(
    `${error.name} ${error.message} ${error.stack || ""}`,
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private clearHeavyAndReload = () => {
    try {
      freeHeavyLocalCache(window.localStorage);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const quota = isQuotaError(this.state.error);

      if (quota) {
        return (
          <div className="flex items-center justify-center min-h-screen p-6 bg-background">
            <div className="flex flex-col items-stretch w-full max-w-lg gap-4 p-6 rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
              <div className="flex items-center gap-3">
                <AlertTriangle size={28} className="text-destructive flex-shrink-0" />
                <h2 className="text-lg font-semibold leading-snug">
                  Spațiul de stocare al browserului este plin
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Aplicația nu a putut salva o preferință locală (de exemplu flag-ul de configurare).
                Datele financiare rămân în stocarea modernă (IndexedDB). Poți elibera cache-ul greu
                din localStorage și reîncărca, exporta un backup din Setări, sau șterge datele site-ului
                din setările browserului.
              </p>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>Apasă „Eliberează cache și reîncarcă” (păstrează IDB).</li>
                <li>Dacă tot apare: Setări → exportă backup, apoi șterge datele site-ului.</li>
                <li>Chrome/Safari: Setări site → Stocare → Șterge datele.</li>
              </ol>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <button
                  type="button"
                  onClick={this.clearHeavyAndReload}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
                    "bg-primary text-primary-foreground hover:opacity-90 cursor-pointer",
                  )}
                >
                  <Trash2 size={16} />
                  Eliberează cache și reîncarcă
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
                    "border border-border hover:bg-muted cursor-pointer",
                  )}
                >
                  <RotateCcw size={16} />
                  Reîncarcă pagina
                </button>
              </div>
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer">Detalii tehnice</summary>
                <pre className="mt-2 p-3 text-xs rounded bg-muted overflow-auto whitespace-break-spaces">
                  {this.state.error?.message || this.state.error?.name}
                </pre>
              </details>
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">A apărut o eroare neașteptată.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer",
              )}
            >
              <RotateCcw size={16} />
              Reîncarcă pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
