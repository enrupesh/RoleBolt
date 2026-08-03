/**
 * Syncs Rolebolt web app auth token into extension storage.
 * Runs only on rolebolt.tech / localhost dev.
 */
(function () {
  const TOKEN_KEY = "rb_auth_token";

  function syncToken() {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      chrome.runtime.sendMessage({
        type: "SYNC_TOKEN",
        token,
        apiBase: location.origin,
      });
    } catch { /* ignore */ }
  }

  syncToken();

  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY) syncToken();
  });

  // Poll briefly after login redirect (same-tab navigation)
  let attempts = 0;
  const interval = setInterval(() => {
    syncToken();
    if (++attempts > 20) clearInterval(interval);
  }, 500);

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type === "ROLEBOLT_EXTENSION_REQUEST_TOKEN") {
      window.postMessage({
        type: "ROLEBOLT_EXTENSION_TOKEN",
        token: localStorage.getItem(TOKEN_KEY) || "",
        apiBase: location.origin,
      }, "*");
    }
  });
})();
