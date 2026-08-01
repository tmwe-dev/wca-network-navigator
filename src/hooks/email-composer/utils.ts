/**
 * Pure utility functions for EmailComposer
 */

export const escapeHtml = (str: string) =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const isValidUrl = (url: string) => {
  try { return ["http:", "https:"].includes(new URL(url).protocol); }
  catch { return false; }
};

export const VARIABLES = ["{{company_name}}", "{{contact_name}}", "{{city}}", "{{country}}"];
