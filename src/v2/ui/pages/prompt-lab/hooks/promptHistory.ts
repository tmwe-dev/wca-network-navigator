/**
 * promptHistory.ts - Functions for managing prompt version history
 * Handles undo/redo, version tracking, and history management
 */

export interface PromptVersion {
  id: string;
  content: string;
  timestamp: Date;
  label: string;
  source: "initial" | "edited" | "improved" | "restored";
}

export interface PromptHistoryState {
  versions: PromptVersion[];
  currentIndex: number;
}

/** Creates a new history state. */
export function createHistoryState(): PromptHistoryState {
  return {
    versions: [],
    currentIndex: -1,
  };
}

/** Adds a version to the history. */
export function addVersion(
  state: PromptHistoryState,
  content: string,
  label: string,
  source: "initial" | "edited" | "improved" | "restored" = "edited"
): PromptHistoryState {
  const newVersion: PromptVersion = {
    id: `v_${Date.now()}`,
    content,
    timestamp: new Date(),
    label,
    source,
  };

  const newVersions = state.versions.slice(0, state.currentIndex + 1);
  newVersions.push(newVersion);

  return {
    versions: newVersions,
    currentIndex: newVersions.length - 1,
  };
}

/** Undoes to the previous version. */
export function undo(state: PromptHistoryState): PromptHistoryState {
  if (state.currentIndex <= 0) return state;

  return {
    ...state,
    currentIndex: state.currentIndex - 1,
  };
}

/** Redoes to the next version. */
export function redo(state: PromptHistoryState): PromptHistoryState {
  if (state.currentIndex >= state.versions.length - 1) return state;

  return {
    ...state,
    currentIndex: state.currentIndex + 1,
  };
}

/** Gets the current version content. */
export function getCurrentVersion(state: PromptHistoryState): string {
  if (state.currentIndex < 0 || state.currentIndex >= state.versions.length) {
    return "";
  }
  return state.versions[state.currentIndex].content;
}

/** Gets the version at a specific index. */
export function getVersionAt(
  state: PromptHistoryState,
  index: number
): PromptVersion | null {
  if (index < 0 || index >= state.versions.length) return null;
  return state.versions[index];
}

/** Checks if undo is possible. */
export function canUndo(state: PromptHistoryState): boolean {
  return state.currentIndex > 0;
}

/** Checks if redo is possible. */
export function canRedo(state: PromptHistoryState): boolean {
  return state.currentIndex < state.versions.length - 1;
}

/** Gets all versions for display. */
export function getVersionHistory(
  state: PromptHistoryState
): PromptVersion[] {
  return state.versions;
}

/** Clears all history. */
export function clearHistory(): PromptHistoryState {
  return createHistoryState();
}
