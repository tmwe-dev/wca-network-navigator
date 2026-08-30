/**
 * navBridge — ponte fra i tool dell'agente Command e il router React.
 *
 * AuthenticatedLayout registra la funzione `navigate` di react-router qui;
 * i tool (non-React) possono così portare l'utente su una pagina senza
 * ricaricare l'app. Fallback: window.location.assign.
 */
type NavigateFn = (path: string) => void;

let navigateFn: NavigateFn | null = null;

export function registerNavigator(fn: NavigateFn): () => void {
  navigateFn = fn;
  return () => {
    if (navigateFn === fn) navigateFn = null;
  };
}

export function navigateToPath(path: string): void {
  if (navigateFn) {
    navigateFn(path);
    return;
  }
  if (typeof window !== "undefined") window.location.assign(path);
}
