chrome.runtime.sendMessage({ type: "get_status" }, (status) => {
  const el = document.getElementById("conn");
  if (status && status.connected) {
    el.textContent = "🟢 Connected";
    el.className = "badge on";
  } else {
    el.textContent = "🔴 Disconnected";
    el.className = "badge off";
  }
});
