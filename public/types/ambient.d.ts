/**
 * ambient.d.ts — Type declarations for public/ browser extension scripts
 * Provides type safety without changing runtime behavior.
 */

// ── Service Worker globals ──────────────────────────────────────
declare function importScripts(...urls: string[]): void;

// ── Window augmentations (WhatsApp/Partner-Connect extensions) ──
interface Window {
  /** WhatsApp helper object injected by content script */
  __waH: {
    qsDeep(selector: string): Element | null;
    qsaDeep(selector: string): Element[];
    qsWithin(root: Element | Document, selector: string): Element | null;
    qsaWithin(root: Element | Document, selector: string): Element[];
    filterVisible(elements: Element[]): Element[];
    modernClearAndType(el: Element, text: string): void;
    modernInsertText(el: Element, text: string): void;
    invalidateCache(): void;
    [key: string]: ((...args: unknown[]) => unknown) | unknown;
  } | undefined;
  loadTemplate: ((name: string) => Promise<void>) | undefined;
  pauseTask: (() => void) | undefined;
  resumeTask: (() => void) | undefined;
  retryTask: (() => void) | undefined;
  aiLearnCached: ((pageType: string) => Promise<unknown>) | undefined;
}

// ── Node augmentation for shadowRoot access ─────────────────────
interface Node {
  readonly shadowRoot: ShadowRoot | null;
}

// ── Element augmentation ────────────────────────────────────────
// Extensions use querySelector returning Element, then access
// HTMLElement properties. Augmenting avoids mass casting.
interface Element {
  click(): void;
  focus(options?: FocusOptions): void;
  submit(): void;
  readonly offsetParent: Element | null;
  disabled: boolean;
  checked: boolean;
  value: string;
  type: string;
  name: string;
  placeholder: string;
  content: string;
  src: string;
  alt: string;
  title: string;
  href: string;
  style: CSSStyleDeclaration;
  readonly dataset: DOMStringMap;
}

// ── EventTarget augmentation ────────────────────────────────────
interface EventTarget {
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  href?: string;
  dataset?: DOMStringMap;
  /** IndexedDB event targets */
  result?: unknown;
  transaction?: IDBTransaction | null;
}
