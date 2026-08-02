/**
 * composeProgress — bus di progresso per la generazione batch delle bozze email.
 * Solo presentazione: consente alla UI di mostrare avanzamento reale invece di 0%.
 */
type Listener = (done: number, total: number) => void;

const listeners = new Set<Listener>();

export function onComposeProgress(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitComposeProgress(done: number, total: number): void {
  for (const fn of listeners) {
    try {
      fn(done, total);
    } catch {
      /* un listener rotto non deve interrompere la generazione */
    }
  }
}
