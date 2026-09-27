document.addEventListener("DOMContentLoaded", () => {
  var nameSection = document.getElementById("name-section");
  var mainSection = document.getElementById("main-section");
  var nameInput = document.getElementById("name-input");
  var saveNameBtn = document.getElementById("save-name-btn");
  var userNameEl = document.getElementById("user-name");
  var toggle = document.getElementById("enabled-toggle");
  var toggleLabel = document.getElementById("toggle-label");
  var connEl = document.getElementById("conn");
  var copyState = document.getElementById("copy-state");
  var cutState = document.getElementById("cut-state");
  var pasteState = document.getElementById("paste-state");

  // Check if name is already saved
  chrome.storage.local.get(["user_name", "protection_enabled"], function (result) {
    console.log("[CopyGuard] Stored:", JSON.stringify(result));
    if (result.user_name) {
      // Name exists — show main UI, hide name input
      nameSection.style.display = "none";
      mainSection.style.display = "block";
      userNameEl.textContent = result.user_name;
      toggle.checked = result.protection_enabled !== false;
      updateUI(toggle.checked);
    }
    // If no name: name-section is already visible by default (from HTML)
  });

  // Save name
  saveNameBtn.addEventListener("click", function () {
    var name = nameInput.value.trim();
    if (!name) {
      nameInput.style.borderColor = "#f87171";
      nameInput.focus();
      return;
    }
    chrome.storage.local.set({ user_name: name, protection_enabled: true }, function () {
      nameSection.style.display = "none";
      mainSection.style.display = "block";
      userNameEl.textContent = name;
      toggle.checked = true;
      updateUI(true);
      chrome.runtime.sendMessage({ type: "name_set", name: name });
    });
  });

  // Enter key saves name
  nameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") saveNameBtn.click();
  });

  // Toggle handler
  toggle.addEventListener("change", function () {
    var enabled = toggle.checked;
    chrome.storage.local.set({ protection_enabled: enabled });
    updateUI(enabled);
    chrome.tabs.query({}, function (tabs) {
      for (var i = 0; i < tabs.length; i++) {
        var tab = tabs[i];
        if (!tab.url || tab.url.indexOf("chrome://") === 0 || tab.url.indexOf("edge://") === 0) continue;
        chrome.tabs.sendMessage(tab.id, { type: "toggle_protection", enabled: enabled }).catch(function(){});
      }
    });
    chrome.runtime.sendMessage({ type: "toggle", enabled: enabled });
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
  chrome.runtime.sendMessage({ type: "get_status" }, function (status) {
    if (status && status.connected) {
      connEl.textContent = "🟢 Connected";
      connEl.className = "badge on";
    } else {
      connEl.textContent = "🔴 Disconnected";
      connEl.className = "badge off";
    }
  });
});
