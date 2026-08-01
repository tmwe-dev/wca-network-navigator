/**
 * Risoluzione runtime di un'icona lucide dal suo nome.
 *
 * Il modulo `lucide-react` esporta anche non-componenti (helper, tipi runtime):
 * qui la voce viene accettata solo dopo un controllo runtime reale, quindi un
 * nome sconosciuto o un export non-componente ricade sul fallback.
 */
import * as Icons from "lucide-react";

type IconModuleEntry = Record<string, unknown>;

function isLucideIcon(value: unknown): value is Icons.LucideIcon {
  // I componenti lucide sono forwardRef (oggetto con $$typeof) o funzioni.
  if (typeof value === "function") return true;
  return typeof value === "object" && value !== null && "$$typeof" in value && "render" in value;
}

/** Icona lucide corrispondente al nome, oppure `fallback` (default `Bot`). */
export function resolveLucideIcon(
  name: string | null | undefined,
  fallback: Icons.LucideIcon = Icons.Bot,
): Icons.LucideIcon {
  if (!name) return fallback;
  const entry = (Icons as IconModuleEntry)[name];
  return isLucideIcon(entry) ? entry : fallback;
}
