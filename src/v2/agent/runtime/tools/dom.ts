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

/* ─── wait_for ─── */

export const waitForTool: AgentTool = {
  name: "wait_for",
  description: "Wait until an element matching a CSS selector appears in the DOM.",
  parameters: {
    selector: { type: "string", description: "CSS selector to wait for", required: true },
    timeout: { type: "string", description: "Max wait in ms (default 5000)", required: false },
  },
  requiresApproval: false,
  execute: async (args) => {
    const selector = String(args.selector ?? "");
    const timeoutMs = Number(args.timeout ?? 5000);
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (document.querySelector(selector)) {
        return { success: true, data: { found: selector, elapsed: Date.now() - start } };
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return { success: false, error: `Timeout: "${selector}" non trovato entro ${timeoutMs}ms` };
  },
};

/* ─── scroll_to ─── */

export const scrollToTool: AgentTool = {
  name: "scroll_to",
  description: "Scroll an element into view.",
  parameters: {
    selector: { type: "string", description: "CSS selector of element to scroll to", required: true },
  },
  requiresApproval: false,
  execute: async (args) => {
    const selector = String(args.selector ?? "");
    try {
      const el = document.querySelector(selector);
      if (!el) return { success: false, error: `Elemento non trovato: ${selector}` };
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      await new Promise((r) => setTimeout(r, 400));
      return { success: true, data: { scrolledTo: selector } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

/* ─── select_option ─── */

export const selectOptionTool: AgentTool = {
  name: "select_option",
  description: "Select an option from a <select> element or shadcn combobox by value.",
  parameters: {
    selector: { type: "string", description: "CSS selector of <select> or combobox trigger", required: true },
    value: { type: "string", description: "Value or label to select", required: true },
  },
  requiresApproval: false,
  execute: async (args) => {
    const selector = String(args.selector ?? "");
    const value = String(args.value ?? "");
    try {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return { success: false, error: `Elemento non trovato: ${selector}` };

      // Native <select>
      if (el.tagName === "SELECT") {
        const selectEl = el as HTMLSelectElement;
        const option = Array.from(selectEl.options).find(
          (o) => o.value === value || o.textContent?.trim() === value,
        );
        if (!option) return { success: false, error: `Opzione "${value}" non trovata` };
        selectEl.value = option.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        return { success: true, data: { selected: option.value, label: option.textContent } };
      }

      // Shadcn combobox/select: click trigger, wait for popover, click option
      el.click();
      await new Promise((r) => setTimeout(r, 300));
      const options = document.querySelectorAll("[role='option'], [data-value]");
      const match = Array.from(options).find(
        (o) => (o as HTMLElement).dataset.value === value || (o.textContent ?? "").trim() === value,
      ) as HTMLElement | undefined;
      if (!match) return { success: false, error: `Opzione "${value}" non trovata nel popover` };
      match.click();
      await new Promise((r) => setTimeout(r, 200));
      return { success: true, data: { selected: value } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

/* ─── upload_file ─── */

export const uploadFileTool: AgentTool = {
  name: "upload_file",
  description: "Simulate a file upload on an <input type='file'> element.",
  parameters: {
    selector: { type: "string", description: "CSS selector of file input", required: true },
    content: { type: "string", description: "Base64-encoded file content", required: true },
    filename: { type: "string", description: "File name (e.g. 'doc.pdf')", required: true },
    mime: { type: "string", description: "MIME type (e.g. 'application/pdf')", required: true },
  },
  requiresApproval: true,
  execute: async (args) => {
    const selector = String(args.selector ?? "");
    const content = String(args.content ?? "");
    const filename = String(args.filename ?? "file.txt");
    const mime = String(args.mime ?? "application/octet-stream");
    try {
      const el = document.querySelector(selector) as HTMLInputElement | null;
      if (!el || el.type !== "file") return { success: false, error: `Input file non trovato: ${selector}` };

      const byteString = atob(content);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const file = new File([ab], filename, { type: mime });

      const dt = new DataTransfer();
      dt.items.add(file);
      el.files = dt.files;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return { success: true, data: { uploaded: filename, size: file.size, mime } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

/* ─── submit_form ─── */

export const submitFormTool: AgentTool = {
  name: "submit_form",
  description: "Submit a form. ALWAYS requires user approval first.",
  parameters: {
    selector: { type: "string", description: "CSS selector of the form or submit button", required: true },
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

      if (el.tagName === "FORM") {
        (el as HTMLFormElement).requestSubmit();
      } else {
        // Assume it's a submit button
        el.click();
      }
      await new Promise((r) => setTimeout(r, 500));
      return { success: true, data: { submitted: selector } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

/* ─── take_snapshot ─── */

export const takeSnapshotTool: AgentTool = {
  name: "take_snapshot",
  description: "Take a screenshot of the current page and list interactive elements.",
  parameters: {},
  requiresApproval: false,
  execute: async () => {
    try {
      let screenshot: string | null = null;
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(document.body, {
          scale: 0.5,
          logging: false,
          useCORS: true,
          width: Math.min(document.body.scrollWidth, 1280),
          height: Math.min(document.body.scrollHeight, 800),
        });
        screenshot = canvas.toDataURL("image/jpeg", 0.6);
      } catch {
        // html2canvas may fail in some environments
      }

      const interactiveEls = Array.from(
        document.querySelectorAll("button, [role='button'], a[href], input, textarea, select"),
      )
        .slice(0, 30)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 60),
          selector: buildSelector(el),
        }));

      return {
        success: true,
        data: {
          url: window.location.pathname,
          title: document.title,
          screenshot,
          interactive_elements: interactiveEls,
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

/* ─── read_table ─── */

export const readTableTool: AgentTool = {
  name: "read_table",
  description: "Extract rows from a <table> or grid element (max 50 rows).",
  parameters: {
    selector: { type: "string", description: "CSS selector of the table or grid container", required: true },
  },
  requiresApproval: false,
  execute: async (args) => {
    const selector = String(args.selector ?? "");
    try {
      const el = document.querySelector(selector);
      if (!el) return { success: false, error: `Elemento non trovato: ${selector}` };

      // Try <table> first
      const table = el.tagName === "TABLE" ? el : el.querySelector("table");
      if (table) {
        const headers = Array.from(table.querySelectorAll("thead th, thead td")).map(
          (th) => (th.textContent ?? "").trim(),
        );
        const rows = Array.from(table.querySelectorAll("tbody tr"))
          .slice(0, 50)
          .map((tr) =>
            Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent ?? "").trim().slice(0, 200)),
          );
        return { success: true, data: { headers, rows, rowCount: rows.length } };
      }

      // Fallback: div-based grid — extract rows by direct children
      const children = Array.from(el.children).slice(0, 50);
      const rows = children.map((child) => ({
        text: (child.textContent ?? "").trim().slice(0, 300),
        selector: buildSelector(child),
      }));
      return { success: true, data: { type: "grid", rows, rowCount: rows.length } };
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
