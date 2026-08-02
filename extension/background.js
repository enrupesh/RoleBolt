import { DEFAULT_API_BASE, STORAGE_KEYS, normalizeApiBase } from "./lib/config.js";

/** @returns {Promise<{ token: string; apiBase: string }>} */
async function getAuth() {
  const data = await chrome.storage.sync.get([STORAGE_KEYS.token, STORAGE_KEYS.apiBase]);
  return {
    token: data[STORAGE_KEYS.token] || "",
    apiBase: normalizeApiBase(data[STORAGE_KEYS.apiBase]),
  };
}

async function setAuth(token, apiBase) {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.token]: token,
    [STORAGE_KEYS.apiBase]: normalizeApiBase(apiBase),
  });
}

async function apiFetch(path, options = {}) {
  const { token, apiBase } = await getAuth();
  if (!token) throw new Error("Not connected. Sign in at Rolebolt and connect the extension.");

  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("json") ? await res.json().catch(() => ({})) : {};
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "GET_AUTH") {
        const auth = await getAuth();
        sendResponse({ ok: true, ...auth, connected: !!auth.token });
        return;
      }

      if (msg.type === "SYNC_TOKEN") {
        if (!msg.token) throw new Error("No token provided.");
        await setAuth(msg.token, msg.apiBase || DEFAULT_API_BASE);
        sendResponse({ ok: true });
        return;
      }

      if (msg.type === "CLEAR_AUTH") {
        await chrome.storage.sync.remove([STORAGE_KEYS.token]);
        sendResponse({ ok: true });
        return;
      }

      if (msg.type === "ANALYZE_JOB") {
        const data = await apiFetch("/recruit/seeker/workspace/extension-analyze", {
          method: "POST",
          body: JSON.stringify(msg.payload),
        });
        sendResponse({ ok: true, ...data });
        return;
      }

      if (msg.type === "SAVE_JOB") {
        const data = await apiFetch("/recruit/seeker/workspace/extension-save", {
          method: "POST",
          body: JSON.stringify(msg.payload),
        });
        sendResponse({ ok: true, ...data });
        return;
      }

      if (msg.type === "OPEN_TAB") {
        const { apiBase } = await getAuth();
        const base = normalizeApiBase(msg.apiBase || apiBase);
        chrome.tabs.create({ url: `${base}${msg.path || "/seeker/workspace"}` });
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      sendResponse({ ok: false, error: err.message || "Something went wrong" });
    }
  })();
  return true;
});

/** Allow Rolebolt web app to push auth token directly */
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      const origin = sender.origin || "";
      const allowed =
        origin.includes("rolebolt.tech") ||
        origin.includes("localhost:3000") ||
        origin.includes("127.0.0.1:3000");
      if (!allowed) throw new Error("Unauthorized origin");

      if (msg.type === "ROLEBOLT_CONNECT" && msg.token) {
        await setAuth(msg.token, msg.apiBase || origin.replace(/\/$/, "") || DEFAULT_API_BASE);
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "ROLEBOLT_PING") {
        const auth = await getAuth();
        sendResponse({ ok: true, connected: !!auth.token, version: chrome.runtime.getManifest().version });
        return;
      }
      sendResponse({ ok: false, error: "Unknown external message" });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true;
});
