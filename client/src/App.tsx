/** Atelierul Financiar — container de aplicație calm, editorial și orientat pe decizie. */
import { lazy, Suspense } from "react";
import { Route, Router as WouterRouter, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";

const NotFound = lazy(() => import("@/pages/NotFound"));

function MissingPage() {
  return (
    <Suspense fallback={<div className="bf-lazy-panel">Pagină lipsă…</div>}>
      <NotFound />
    </Suspense>
  );
}

function AppRouter() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
  return (
    <WouterRouter base={basePath}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/404"} component={MissingPage} />
        <Route component={MissingPage} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  );
}

export default App;
