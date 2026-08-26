/** Atelierul Financiar — container de aplicație calm, editorial și orientat pe decizie. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router as WouterRouter, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";


function AppRouter() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
  return (
    <WouterRouter base={basePath}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <AppRouter />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
