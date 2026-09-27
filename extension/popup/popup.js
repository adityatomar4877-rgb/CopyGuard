document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("enabled-toggle");
  const toggleLabel = document.getElementById("toggle-label");
  const connEl = document.getElementById("conn");
  const copyState = document.getElementById("copy-state");
  const cutState = document.getElementById("cut-state");
  const pasteState = document.getElementById("paste-state");

  // Load saved state (default: enabled)
  chrome.storage.local.get("protection_enabled", (result) => {
    const enabled = result.protection_enabled !== false; // default true
    toggle.checked = enabled;
    updateUI(enabled);
  });

  // Toggle handler — save state + notify all tabs
  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.storage.local.set({ protection_enabled: enabled });
    updateUI(enabled);

    // Tell every open tab to enable/disable protection
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs
          .sendMessage(tab.id, { type: "toggle_protection", enabled })
          .catch(() => {});
      }
    });
  });

  function updateUI(enabled) {
    if (enabled) {
      toggleLabel.textContent = "Protection ON";
      toggleLabel.style.color = "#4ade80";
      copyState.textContent = "Blocked";
      copyState.className = "blocked";
      cutState.textContent = "Blocked";
      cutState.className = "blocked";
      pasteState.textContent = "Blocked";
      pasteState.className = "blocked";
    } else {
      toggleLabel.textContent = "Protection OFF";
      toggleLabel.style.color = "#f87171";
      copyState.textContent = "Allowed";
      copyState.className = "disabled";
      cutState.textContent = "Allowed";
      cutState.className = "disabled";
      pasteState.textContent = "Allowed";
      pasteState.className = "disabled";
    }
  }

  // Connection status
  chrome.runtime.sendMessage({ type: "get_status" }, (status) => {
    if (status && status.connected) {
      connEl.textContent = "🟢 Connected";
      connEl.className = "badge on";
    } else {
      connEl.textContent = "🔴 Disconnected";
      connEl.className = "badge off";
    }
  });
});
