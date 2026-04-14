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

// ── Partner-Connect module globals (loaded via importScripts) ──
// These are IIFE/object-literal modules assigned to `const` at global scope.

interface CacheEntry {
  data: unknown;
  expiresAt: number;
  hits: number;
  set(key: string, value: unknown, ttl?: number): void;
  get(key: string): unknown;
  [key: string]: unknown;
}

interface CacheModule {
  get(key: string): unknown;
  set(key: string, value: unknown, ttl?: number): void;
  remove(key: string): void;
  clear(): void;
  getStats(): { hits: number; misses: number; size: number };
  [key: string]: unknown;
}

interface StealthModule {
  randomDelay(min?: number, max?: number): Promise<void>;
  humanType(el: Element, text: string, options?: object): Promise<void>;
  pages: number;
  startTime: number;
  [key: string]: unknown;
}

interface RateLimiterModule {
  canProceed(action?: string): boolean;
  record(action?: string): void;
  [key: string]: unknown;
}

interface AgentModule {
  readAll(selector: string, options?: object): { ok: boolean; action?: string; selector?: string; count?: number; data?: { text: string }[]; error?: string };
  waitForElement(selector: string, timeoutMs?: number): Promise<Element | null>;
  click(target: string | Element): Promise<{ ok: boolean; error?: string }>;
  type(selector: string, text: string): Promise<{ ok: boolean; error?: string }>;
  scrollTo(selector: string): Promise<{ ok: boolean; error?: string }>;
  navigate(url: string): Promise<{ ok: boolean; error?: string }>;
  screenshot(): Promise<{ ok: boolean; data?: string; error?: string }>;
  [key: string]: unknown;
}

interface BrainModule {
  think(prompt: string, context?: object): Promise<{ result: string; model?: string; [key: string]: unknown }>;
  learnedAt: number;
  object: unknown;
  proxyUrl: string;
  model: string;
  content: string;
  result: unknown;
  [key: string]: unknown;
}

interface HydraClientModule {
  addKbEntry(entry: { type: string; title: string; content: string; tags: string[]; carrier?: string; confidence: number; source: string; [key: string]: unknown }): Promise<unknown>;
  addCarrierRule(rule: { title: string; content: string; carrier_code: string; rule_type: string; tags: string[]; priority?: number; [key: string]: unknown }): Promise<unknown>;
  [key: string]: unknown;
}

interface TaskRunnerModule {
  run(tasks: unknown[], options?: object): Promise<unknown>;
  [key: string]: unknown;
}

interface FileManagerModule {
  upload(data: unknown, filename?: string): Promise<{ ok: boolean; url?: string; error?: string }>;
  download(url: string): Promise<{ ok: boolean; data?: unknown; error?: string }>;
  [key: string]: unknown;
}

interface ConnectorsModule {
  [key: string]: unknown;
}

interface PipelineModule {
  [key: string]: unknown;
}

interface ElevenLabsModule {
  voices: unknown[];
  models: unknown[];
  [key: string]: unknown;
}

interface CryptoUtilsModule {
  encrypt(data: string, key: string): Promise<string>;
  decrypt(data: string, key: string): Promise<string>;
  _encSupaKey: string;
  [key: string]: unknown;
}

// Declare these as global `var` so they merge with script-scope const/var declarations
declare var Cache: CacheModule;
declare var Agent: AgentModule;
declare var Brain: BrainModule;
declare var HydraClient: HydraClientModule;
declare var TaskRunner: TaskRunnerModule;
declare var FileManager: FileManagerModule;
declare var Connectors: ConnectorsModule;
declare var Pipeline: PipelineModule;
declare var Stealth: StealthModule;
declare var RateLimiter: RateLimiterModule;
declare var CryptoUtils: CryptoUtilsModule;
declare var ElevenLabs: ElevenLabsModule;
declare var Library: { [key: string]: unknown };

// ── Node augmentation for shadowRoot access ─────────────────────
// TreeWalker and querySelectorAll return Node/Element; extensions
// access .shadowRoot which exists on Element but not Node.
// We augment Node so TS doesn't complain when iterating tree walkers.
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
