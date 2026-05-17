/**
 * CommandPageBackButton — alias del trigger globale `GlobalNavTrigger`.
 * Mantenuto solo per backward-compat con i call site della Command page;
 * il pulsante reale è ora montato una sola volta dal layout, quindi
 * questo componente non rende nulla per evitare duplicazioni.
 */
export function CommandPageBackButton(_props?: { currentPath?: string }): null {
  void _props;
  return null;
}
