/**
 * CopyGuard content script — minimal.
 * Blocks copy + paste, reports attempts to service worker.
 */

(function () {
  "use strict";

  function report(event) {
    try {
      chrome.runtime.sendMessage({ type: "security_event", event: event });
    } catch (e) {
      // Service worker might be asleep — message will wake it
      console.warn("[CopyGuard] Could not send event:", e);
    }
  }

  // Block copy
  document.addEventListener(
    "copy",
    function (e) {
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

  console.log("[CopyGuard] Protection active on", window.location.href);
})();
