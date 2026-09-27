/**
 * CopyGuard content script — minimal.
 * Blocks copy + paste, reports attempts to service worker.
 * Respects the enable/disable toggle from the popup.
 */

(function () {
  "use strict";

  let protectionEnabled = true;

  // Read saved state synchronously BEFORE attaching listeners.
  // This prevents a brief window where blocking is active even
  // when the user has toggled it off.
  try {
    chrome.storage.local.get("protection_enabled", (result) => {
      protectionEnabled = result.protection_enabled !== false;
      console.log("[CopyGuard] Initial state:", protectionEnabled ? "ON" : "OFF");
    });
  } catch (e) {}

  // Listen for live toggle from popup (fires immediately when user flips switch)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "toggle_protection") {
      protectionEnabled = msg.enabled;
      console.log("[CopyGuard] Toggle received:", msg.enabled ? "ON" : "OFF");
      sendResponse({ ok: true });
    }
    return true;
  });

  function report(event) {
    try {
      chrome.runtime.sendMessage({ type: "security_event", event: event });
    } catch (e) {
      console.warn("[CopyGuard] Could not send event:", e);
    }
  }

  // Block copy
  document.addEventListener(
    "copy",
    function (e) {
      if (!protectionEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      report("COPY_ATTEMPT");
    },
    true
  );

  // Block cut
  document.addEventListener(
    "cut",
    function (e) {
      if (!protectionEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      report("CUT_ATTEMPT");
    },
    true
  );

  // Block paste
  document.addEventListener(
    "paste",
    function (e) {
      if (!protectionEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      report("PASTE_ATTEMPT");
    },
    true
  );

  // Block Ctrl+C, Ctrl+V, Ctrl+X (and Cmd on Mac)
  document.addEventListener(
    "keydown",
    function (e) {
      if (!protectionEnabled) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "c") {
        e.preventDefault();
        e.stopPropagation();
        report("COPY_ATTEMPT");
      } else if (key === "v") {
        e.preventDefault();
        e.stopPropagation();
        report("PASTE_ATTEMPT");
      } else if (key === "x") {
        e.preventDefault();
        e.stopPropagation();
        report("CUT_ATTEMPT");
      }
    },
    true
  );

  console.log("[CopyGuard] Content script loaded on", window.location.href);
})();
