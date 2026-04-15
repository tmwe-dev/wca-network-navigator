/**
 * DOM tools — client-side browser actions for the agent loop.
 * Same-origin execution, no chrome.debugger needed.
 */
import type { AgentTool, AgentToolResult } from "./index";

const FORBIDDEN_SELECTORS = [
  /logout/i,
  /delete.*account/i,
  /drop.*table/i,
  /signout/i,
  /sign-out/i,
];

function isSelectorForbidden(selector: string): boolean {
  return FORBIDDEN_SELECTORS.some((r) => r.test(selector));
}

/**
 * React-compatible input value setter.
 */
function setReactInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    "value",
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    (el as HTMLInputElement).value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/* ─── navigate ─── */

export const navigateTool: AgentTool = {
  name: "navigate",
  description: "Navigate to a route within the app (e.g. /v2/crm, /v2/command).",
  parameters: {
    path: { type: "string", description: "Route path starting with /", required: true },
  },
  requiresApproval: false,
  execute: async (args) => {
    const path = String(args.path ?? "/");
    try {
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
      await new Promise((r) => setTimeout(r, 500));
      return { success: true, data: { navigatedTo: path, title: document.title } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

/* ─── read_page ─── */

export const readPageTool: AgentTool = {
  name: "read_page",
  description: "Read the current page structure: buttons, inputs, links, and main text content.",
  parameters: {},
  requiresApproval: false,
  execute: async () => {
    try {
      const buttons = Array.from(document.querySelectorAll("button, [role='button'], a[href]"))
        .slice(0, 30)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 80),
          selector: buildSelector(el),
          href: (el as HTMLAnchorElement).href || undefined,
        }));

      const inputs = Array.from(document.querySelectorAll("input, textarea, select"))
        .slice(0, 20)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: (el as HTMLInputElement).type ?? "",
          placeholder: (el as HTMLInputElement).placeholder ?? "",
          name: (el as HTMLInputElement).name ?? "",
          value: (el as HTMLInputElement).value?.slice(0, 100) ?? "",
          selector: buildSelector(el),
        }));

      const mainText = (document.querySelector("main") ?? document.body).textContent?.slice(0, 2000) ?? "";

      return {
        success: true,
        data: { url: window.location.pathname, title: document.title, buttons, inputs, mainText },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

/* ─── click ─── */

export const clickTool: AgentTool = {
  name: "click",
  description: "Click an element on the page by CSS selector.",
  parameters: {
    selector: { type: "string", description: "CSS selector of element to click", required: true },
  },
  requiresApproval: true,
  execute: async (args) => {
    const selector = String(args.selector ?? "");
    if (isSelectorForbidden(selector)) {
      return { success: false, error: "Selector bloccato da safety filter" };
    }
    try {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return { success: false, error: `Elemento non trovato: ${selector}` };
      el.click();
      await new Promise((r) => setTimeout(r, 300));
      return { success: true, data: { clicked: selector } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

/* ─── type_text ─── */

export const typeTextTool: AgentTool = {
  name: "type_text",
  description: "Type text into an input or textarea by CSS selector.",
  parameters: {
    selector: { type: "string", description: "CSS selector of input/textarea", required: true },
    text: { type: "string", description: "Text to type", required: true },
  },
  requiresApproval: false,
  execute: async (args) => {
    const selector = String(args.selector ?? "");
    const text = String(args.text ?? "");
    try {
      const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el) return { success: false, error: `Elemento non trovato: ${selector}` };
      el.focus();
      setReactInputValue(el, text);
      return { success: true, data: { typed: text.slice(0, 100), selector } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

/* ─── read_dom ─── */

export const readDomTool: AgentTool = {
  name: "read_dom",
  description: "Read the outerHTML of a DOM element (max 2000 chars).",
  parameters: {
    selector: { type: "string", description: "CSS selector", required: true },
  },
  requiresApproval: false,
  execute: async (args) => {
    const selector = String(args.selector ?? "");
    try {
      const el = document.querySelector(selector);
      if (!el) return { success: false, error: `Elemento non trovato: ${selector}` };
      return { success: true, data: { html: el.outerHTML.slice(0, 2000), selector } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

/* ─── Utility ─── */

function buildSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).slice(0, 2).join(".");
  const text = (el.textContent ?? "").trim().slice(0, 30);
  if (cls) return `${tag}.${cls}`;
  if (text) return `${tag}:has-text("${text}")`;
  return tag;
}
