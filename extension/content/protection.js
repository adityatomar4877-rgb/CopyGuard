/**
 * CopyGuard content script — minimal.
 * Blocks copy + paste when protection is ON.
 * When protection is OFF, still logs the action (as ALLOWED) but doesn't block.
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

  // Show badge
  function showBadge() {
    const existing = document.getElementById("copyguard-badge");
    if (existing) existing.remove();
    if (!protectionEnabled) return;

    function addBadge() {
      if (!document.body) { setTimeout(addBadge, 100); return; }
      const badge = document.createElement("div");
      badge.id = "copyguard-badge";
      badge.textContent = "🛡️ CopyGuard Active";
      badge.style.cssText =
        "position:fixed !important;bottom:10px !important;right:10px !important;" +
        "background:#0f172a !important;color:#4ade80 !important;padding:6px 12px !important;" +
        "border-radius:8px !important;font-size:12px !important;font-family:system-ui,sans-serif !important;" +
        "z-index:2147483647 !important;pointer-events:none !important;opacity:0.9 !important;" +
        "transition:opacity 1s !important;border:1px solid #334155 !important;";
      document.body.appendChild(badge);
      setTimeout(() => {
        if (badge.parentNode) { badge.style.opacity = "0"; setTimeout(() => badge.remove(), 1000); }
      }, 4000);
    }
    addBadge();
  }

  // Copy — block when ON, log when OFF
  document.addEventListener("copy", function (e) {
    if (protectionEnabled) {
      e.preventDefault(); e.stopPropagation();
      report("COPY_ATTEMPT");
    } else {
      report("COPY_ALLOWED");
    }
  }, true);

  // Cut — block when ON, log when OFF
  document.addEventListener("cut", function (e) {
    if (protectionEnabled) {
      e.preventDefault(); e.stopPropagation();
      report("CUT_ATTEMPT");
    } else {
      report("CUT_ALLOWED");
    }
  }, true);

  // Paste — block when ON, log when OFF
  document.addEventListener("paste", function (e) {
    if (protectionEnabled) {
      e.preventDefault(); e.stopPropagation();
      report("PASTE_ATTEMPT");
    } else {
      report("PASTE_ALLOWED");
    }
  }, true);

  // Ctrl+C, Ctrl+V, Ctrl+X
  document.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();

    if (protectionEnabled) {
      if (key === "c") { e.preventDefault(); e.stopPropagation(); report("COPY_ATTEMPT"); }
      else if (key === "v") { e.preventDefault(); e.stopPropagation(); report("PASTE_ATTEMPT"); }
      else if (key === "x") { e.preventDefault(); e.stopPropagation(); report("CUT_ATTEMPT"); }
    } else {
      if (key === "c") { report("COPY_ALLOWED"); }
      else if (key === "v") { report("PASTE_ALLOWED"); }
      else if (key === "x") { report("CUT_ALLOWED"); }
    }
  }, true);

  console.log("[CopyGuard] Content script loaded on", window.location.href);
  showBadge();
})();
