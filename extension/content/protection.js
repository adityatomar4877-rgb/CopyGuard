/**
 * CopyGuard content script — minimal.
 * Blocks copy + paste, reports attempts to service worker.
 * Respects the enable/disable toggle from the popup.
 */

(function () {
  "use strict";

  let protectionEnabled = true;

  // Load saved state on startup
  chrome.storage.local.get("protection_enabled", (result) => {
    protectionEnabled = result.protection_enabled !== false; // default true
    console.log("[CopyGuard] Protection", protectionEnabled ? "ON" : "OFF", "on", window.location.href);
  });

  // Listen for toggle messages from popup
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "toggle_protection") {
      protectionEnabled = msg.enabled;
      console.log("[CopyGuard] Protection", protectionEnabled ? "enabled" : "disabled");
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
      console.log("[CopyGuard] Blocked copy");
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
      console.log("[CopyGuard] Blocked cut");
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
      console.log("[CopyGuard] Blocked paste");
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
        console.log("[CopyGuard] Blocked Ctrl+C");
      } else if (key === "v") {
        e.preventDefault();
        e.stopPropagation();
        report("PASTE_ATTEMPT");
        console.log("[CopyGuard] Blocked Ctrl+V");
      } else if (key === "x") {
        e.preventDefault();
        e.stopPropagation();
        report("CUT_ATTEMPT");
        console.log("[CopyGuard] Blocked Ctrl+X");
      }
    },
    true
  );

  console.log("[CopyGuard] Content script loaded on", window.location.href);
})();
