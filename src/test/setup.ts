import "@testing-library/jest-dom";

// Polyfill File.prototype.text for jsdom (used by parsers)
if (typeof File !== "undefined" && !File.prototype.text) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (File.prototype as any).text = function () {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
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
