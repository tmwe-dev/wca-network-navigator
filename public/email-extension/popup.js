/**
 * popup.js — Mini-launcher: opens the side panel
 */
document.getElementById("btn-open")?.addEventListener("click", async () => {
  try {
    // Try to open side panel programmatically
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
    window.close();
  } catch (err) {
    // Fallback: just close popup, side panel should auto-open on icon click
    window.close();
  }
});