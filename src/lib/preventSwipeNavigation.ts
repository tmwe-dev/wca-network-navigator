/**
 * Blocca le gesture di scroll che causano navigazione del browser
 * (swipe-back/forward su trackpad in Safari/Chrome macOS).
 *
 * Il CSS `overscroll-behavior` copre Chrome/Edge/Firefox; Safari lo ignora
 * per la gesture di history, quindi qui intercettiamo il wheel orizzontale
 * quando NON esiste un contenitore realmente scrollabile in orizzontale
 * sotto al cursore (o quando quel contenitore è già a fine corsa).
 *
 * UI-only: non tocca alcuna logica applicativa.
 */
function canScrollHorizontally(el: HTMLElement, deltaX: number): boolean {
  const style = getComputedStyle(el);
  const overflowX = style.overflowX;
  if (overflowX !== "auto" && overflowX !== "scroll") return false;
  if (el.scrollWidth <= el.clientWidth + 1) return false;
  if (deltaX < 0) return el.scrollLeft > 0;
  return el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

export function installPreventSwipeNavigation(): () => void {
  const onWheel = (e: WheelEvent) => {
    if (e.deltaX === 0) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;

    let node = e.target as HTMLElement | null;
    while (node && node !== document.body && node !== document.documentElement) {
      if (canScrollHorizontally(node, e.deltaX)) return;
      node = node.parentElement;
    }

    if (e.cancelable) e.preventDefault();
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  return () => window.removeEventListener("wheel", onWheel);
}
