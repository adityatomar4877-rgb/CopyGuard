/**
 * CopyGuard content script — minimal.
 * Blocks copy + paste, reports attempts to service worker.
 * Respects the enable/disable toggle from the popup.
 * Shows a small badge on the page so users can verify it's active.
 */

(function () {
  "use strict";

  let protectionEnabled = true;

  // Read saved state
  try {
    chrome.storage.local.get("protection_enabled", (result) => {
      protectionEnabled = result.protection_enabled !== false;
      console.log("[CopyGuard] Initial state:", protectionEnabled ? "ON" : "OFF");
      showBadge();
    });
  } catch (e) {}

  // Listen for live toggle from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "toggle_protection") {
      protectionEnabled = msg.enabled;
      console.log("[CopyGuard] Toggle received:", msg.enabled ? "ON" : "OFF");
      showBadge();
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

  // Show a small badge in the corner so the user knows it's working
  function showBadge() {
    // Remove existing badge
    const existing = document.getElementById("copyguard-badge");
    if (existing) existing.remove();

    if (!protectionEnabled) return;

    // Wait for body to be available
    function addBadge() {
      if (!document.body) {
        setTimeout(addBadge, 100);
        return;
      }

      const badge = document.createElement("div");
      badge.id = "copyguard-badge";
      badge.textContent = "🛡️ CopyGuard Active";
      badge.style.cssText =
        "position:fixed !important;" +
        "bottom:10px !important;" +
        "right:10px !important;" +
        "background:#0f172a !important;" +
        "color:#4ade80 !important;" +
        "padding:6px 12px !important;" +
        "border-radius:8px !important;" +
        "font-size:12px !important;" +
        "font-family:system-ui,sans-serif !important;" +
        "z-index:2147483647 !important;" +
        "pointer-events:none !important;" +
        "opacity:0.9 !important;" +
        "transition:opacity 1s !important;" +
        "border:1px solid #334155 !important;";
      document.body.appendChild(badge);

      // Fade out after 4 seconds
      setTimeout(() => {
        if (badge.parentNode) {
          badge.style.opacity = "0";
          setTimeout(() => badge.remove(), 1000);
        }
      }, 4000);
    }

    addBadge();
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
  showBadge();
})();
