import "@testing-library/jest-dom";

// Polyfill File.prototype.text for jsdom (used by parsers)
/* eslint-disable @typescript-eslint/no-explicit-any -- test file with mocks */
if (typeof File !== "undefined" && !File.prototype.text) {
  (File.prototype as any).text = function () {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this as any);
    });
  };
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
