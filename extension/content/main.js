/**
 * Main content script — detects jobs and mounts the Live AI panel.
 */
(function () {
  if (window.__roleboltContentLoaded) return;
  window.__roleboltContentLoaded = true;

  /** @type {import('../content/panel.js')} */
  let panel = null;
  let lastUrl = location.href;
  let debounceTimer = null;

  function initPanel() {
    if (!panel) panel = new window.RoleboltPanel();
    return panel;
  }

  function scan() {
    if (!window.RoleboltExtractors?.isLikelyJobPage?.()) {
      if (panel) panel.setJob(null);
      return;
    }
    const job = window.RoleboltExtractors.extractJob();
    if (!job?.title && !(job?.description?.length > 100)) {
      if (panel) panel.setJob(null);
      return;
    }
    initPanel().setJob(job);
  }

  function scheduleScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, 600);
  }

  // Initial scan
  scheduleScan();

  // SPA navigation (LinkedIn, Indeed, etc.)
  const pushState = history.pushState;
  history.pushState = function (...args) {
    pushState.apply(this, args);
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleScan();
    }
  };
  window.addEventListener("popstate", () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleScan();
    }
  });

  // DOM mutations for lazy-loaded job content (throttled)
  let mutationPending = false;
  const observer = new MutationObserver(() => {
    if (mutationPending) return;
    mutationPending = true;
    requestAnimationFrame(() => {
      mutationPending = false;
      scheduleScan();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Messages from popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "GET_JOB_SNAPSHOT") {
      const job = window.RoleboltExtractors?.extractJob?.() || null;
      sendResponse({ job });
      return true;
    }
    if (msg.type === "OPEN_PANEL") {
      const p = initPanel();
      scan();
      p.toggle();
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === "TRIGGER_ANALYZE") {
      const p = initPanel();
      scan();
      p.toggle();
      if (p.job) p.runAnalyze?.();
      sendResponse({ ok: true });
      return true;
    }
  });
})();
