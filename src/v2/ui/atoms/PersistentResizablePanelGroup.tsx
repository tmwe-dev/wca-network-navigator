/**
 * PersistentResizablePanelGroup — Wrapper standard di sistema attorno a
 * `ResizablePanelGroup` che PERSISTE automaticamente le dimensioni dei
 * pannelli in `localStorage` tramite la prop `autoSaveId` di
 * `react-resizable-panels`.
 *
 * REGOLA DI SISTEMA (2026-05-02):
 *   Ogni layout split in cui l'utente può ridimensionare aree di lavoro
 *   DEVE memorizzare le proporzioni scelte e ripristinarle alla prossima
 *   apertura. Usare questo componente al posto di `ResizablePanelGroup`
 *   ogni volta che si offre la possibilità di trascinare una maniglia.
 *
 * Convenzione `storageId`:
 *   - Stringa stabile, kebab-case, scopata alla pagina:
 *       `<feature>:<panel-purpose>` es. `prompt-lab:main-vs-chat`,
 *       `prompt-lab:blocks-vs-editor`, `golden-layout:left-vs-main`.
 *   - NON cambiare `storageId` dopo il rilascio: rompe il ripristino per
 *     gli utenti esistenti.
 */
import * as React from "react";
import { ResizablePanelGroup } from "@/components/ui/resizable";

type Props = React.ComponentProps<typeof ResizablePanelGroup> & {
  /** Identificatore stabile per la persistenza in localStorage. */
  storageId: string;
};

const STORAGE_PREFIX = "ui:resizable:";

export function PersistentResizablePanelGroup({
  storageId,
  ...rest
}: Props): React.ReactElement {
  return <ResizablePanelGroup autoSaveId={`${STORAGE_PREFIX}${storageId}`} {...rest} />;
}

export default PersistentResizablePanelGroup;