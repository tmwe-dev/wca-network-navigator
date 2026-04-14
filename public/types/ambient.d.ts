/**
 * ambient.d.ts — Type declarations for public/ browser extension scripts
 * Provides type safety without changing runtime behavior.
 */

// ── Service Worker globals ──────────────────────────────────────
declare function importScripts(...urls: string[]): void;

// ── Partner-Connect module globals (loaded via importScripts) ───
// background.js uses importScripts() to load these modules.
// They're const-declared in their own files but accessed as globals
// in background.js. We declare them here for cross-file visibility.
// Using `var` to avoid TS2451 conflicts with existing `const` declarations.
declare var Agent: { [key: string]: unknown };
declare var Brain: { [key: string]: unknown };
declare var HydraClient: { [key: string]: unknown };
declare var TaskRunner: { [key: string]: unknown };
declare var FileManager: { [key: string]: unknown };
declare var Connectors: { [key: string]: unknown };
declare var Pipeline: { [key: string]: unknown };
declare var Stealth: { pages: number; startTime: number; [key: string]: unknown };
declare var RateLimiter: { [key: string]: unknown };
declare var CryptoUtils: { _encSupaKey: string; [key: string]: unknown };
declare var ElevenLabs: { voices: unknown[]; models: unknown[]; [key: string]: unknown };
declare var Library: { [key: string]: unknown };

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
// Extensions use querySelector which returns Element, then access
// HTMLElement-specific properties. Rather than casting everywhere,
// we augment Element with commonly-used properties.
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
