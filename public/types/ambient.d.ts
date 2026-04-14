/**
 * ambient.d.ts — Type declarations for public/ browser extension scripts
 * Provides type safety without changing runtime behavior.
 */

// ── Service Worker globals ──────────────────────────────────────
declare function importScripts(...urls: string[]): void;

// ── Window augmentations (WhatsApp/Partner-Connect extensions) ──
interface WaHelpers {
  deepQueryAll(root: Document | Element, selector: string): Element[];
  deepQueryOne(root: Document | Element, selector: string): Element | null;
  click(el: Element): void;
  type(el: Element, text: string): void;
  scrollIntoView(el: Element): void;
  sleep(ms: number): Promise<void>;
  waitFor(selector: string, timeout?: number): Promise<Element | null>;
  [key: string]: unknown;
}

interface Window {
  __waH: WaHelpers | undefined;
  loadTemplate: ((name: string) => Promise<void>) | undefined;
  pauseTask: (() => void) | undefined;
  resumeTask: (() => void) | undefined;
  retryTask: (() => void) | undefined;
  aiLearnCached: ((pageType: string) => Promise<unknown>) | undefined;
}

// ── Node augmentation for shadowRoot access ─────────────────────
// TreeWalker returns Node; extensions access .shadowRoot which
// exists on Element but not Node in strict DOM typings.
interface Node {
  shadowRoot: ShadowRoot | null;
}

// ── EventTarget augmentation ────────────────────────────────────
// Extensions access .value, .checked etc. on event.target
interface EventTarget {
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  href?: string;
  dataset?: DOMStringMap;
}
