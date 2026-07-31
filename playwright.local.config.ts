import base from "./playwright.config";
export default { ...base, use: { ...base.use, launchOptions: { executablePath: "/opt/ms-playwright/chromium-1194/chrome-linux/chrome" } } };
