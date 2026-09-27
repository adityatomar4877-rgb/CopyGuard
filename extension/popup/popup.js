document.addEventListener("DOMContentLoaded", () => {
  const nameSection = document.getElementById("name-section");
  const mainSection = document.getElementById("main-section");
  const nameInput = document.getElementById("name-input");
  const saveNameBtn = document.getElementById("save-name-btn");
  const userNameEl = document.getElementById("user-name");
  const toggle = document.getElementById("enabled-toggle");
  const toggleLabel = document.getElementById("toggle-label");
  const connEl = document.getElementById("conn");
  const copyState = document.getElementById("copy-state");
  const cutState = document.getElementById("cut-state");
  const pasteState = document.getElementById("paste-state");

  // Check if name is saved
  chrome.storage.local.get(["user_name", "protection_enabled"], (result) => {
    console.log("[CopyGuard Popup] stored name:", result.user_name, "protection:", result.protection_enabled);
    if (!result.user_name) {
      // First time — show name input, no way to skip
      nameSection.style.display = "block";
      mainSection.style.display = "none";
      nameInput.focus();
    } else {
      // Name exists — show main UI (name is permanent, no edit button)
      showMain(result.user_name, result.protection_enabled !== false);
    }
  });

  // Save name (only happens once)
  saveNameBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.style.borderColor = "#f87171";
      nameInput.focus();
      return;
    }
    chrome.storage.local.set({ user_name: name }, () => {
      showMain(name, true);
      chrome.runtime.sendMessage({ type: "name_set", name });
    });
  });

  // Enter key saves name
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveNameBtn.click();
  });

  function showMain(name, protectionOn) {
    nameSection.style.display = "none";
    mainSection.style.display = "block";
    userNameEl.textContent = name;
    toggle.checked = protectionOn;
    updateUI(protectionOn);
  }

  // Toggle handler
  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.storage.local.set({ protection_enabled: enabled });
    updateUI(enabled);
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("chrome-extension://")) continue;
        chrome.tabs.sendMessage(tab.id, { type: "toggle_protection", enabled }).catch(() => {});
      }
    });
    chrome.runtime.sendMessage({ type: "toggle", enabled });
  });

  function updateUI(enabled) {
    if (enabled) {
      toggleLabel.textContent = "Protection ON";
      toggleLabel.style.color = "#4ade80";
      copyState.textContent = "Blocked"; copyState.className = "blocked";
      cutState.textContent = "Blocked"; cutState.className = "blocked";
      pasteState.textContent = "Blocked"; pasteState.className = "blocked";
    } else {
      toggleLabel.textContent = "Protection OFF";
      toggleLabel.style.color = "#f87171";
      copyState.textContent = "Allowed"; copyState.className = "disabled";
      cutState.textContent = "Allowed"; cutState.className = "disabled";
      pasteState.textContent = "Allowed"; pasteState.className = "disabled";
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
