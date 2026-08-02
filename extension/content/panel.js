/**
 * Rolebolt floating Live AI panel — injected on job pages.
 */
(function () {
  const PANEL_ID = "rolebolt-copilot-root";
  const ICON_URL = chrome.runtime.getURL("icons/icon128.png");

  const PANEL_CSS = `
    :host { all: initial; }
    .rb-wrap { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size: 13px; color: #0f172a; }
    .rb-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483646;
      width: 52px; height: 52px; border-radius: 16px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      box-shadow: 0 8px 28px rgba(79,70,229,.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform .15s ease, box-shadow .15s ease;
    }
    .rb-fab:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(79,70,229,.5); }
    .rb-fab img { width: 28px; height: 28px; border-radius: 6px; }
    .rb-panel {
      position: fixed; bottom: 88px; right: 24px; z-index: 2147483646;
      width: 360px; max-width: calc(100vw - 32px); max-height: min(560px, calc(100vh - 120px));
      background: #fff; border-radius: 20px; overflow: hidden;
      box-shadow: 0 20px 60px rgba(15,23,42,.18), 0 0 0 1px rgba(15,23,42,.06);
      display: none; flex-direction: column;
    }
    .rb-panel.open { display: flex; }
    .rb-head {
      padding: 14px 16px; background: linear-gradient(135deg, #eef2ff, #f8fafc);
      border-bottom: 1px solid #e2e8f0; display: flex; align-items: flex-start; gap: 10px;
    }
    .rb-head img { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; }
    .rb-head h2 { margin: 0; font-size: 14px; font-weight: 800; line-height: 1.2; }
    .rb-head p { margin: 2px 0 0; font-size: 11px; color: #64748b; line-height: 1.3; }
    .rb-close {
      margin-left: auto; background: none; border: none; cursor: pointer;
      color: #94a3b8; font-size: 18px; line-height: 1; padding: 0 2px;
    }
    .rb-body { padding: 14px 16px; overflow-y: auto; flex: 1; }
    .rb-meta { font-size: 11px; color: #64748b; margin-bottom: 10px; }
    .rb-meta strong { color: #334155; display: block; font-size: 13px; margin-bottom: 2px; }
    .rb-score {
      display: flex; align-items: center; gap: 12px; padding: 12px;
      border-radius: 14px; margin-bottom: 12px; border: 1px solid #e2e8f0;
    }
    .rb-score-ring {
      width: 56px; height: 56px; border-radius: 50%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; font-weight: 900; font-size: 16px; flex-shrink: 0;
      border: 4px solid;
    }
    .rb-score.good .rb-score-ring { border-color: #10b981; color: #059669; background: #ecfdf5; }
    .rb-score.mid .rb-score-ring { border-color: #f59e0b; color: #d97706; background: #fffbeb; }
    .rb-score.low .rb-score-ring { border-color: #f43f5e; color: #e11d48; background: #fff1f2; }
    .rb-score-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .rb-summary { font-size: 12px; color: #475569; line-height: 1.45; }
    .rb-section { margin-top: 10px; }
    .rb-section h3 { margin: 0 0 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; }
    .rb-list { margin: 0; padding: 0; list-style: none; }
    .rb-list li { font-size: 12px; color: #334155; padding: 3px 0 3px 14px; position: relative; line-height: 1.35; }
    .rb-list li::before { content: "•"; position: absolute; left: 0; color: #6366f1; font-weight: 700; }
    .rb-list.missing li::before { color: #f43f5e; }
    .rb-actions { padding: 12px 16px 14px; border-top: 1px solid #f1f5f9; display: flex; flex-wrap: wrap; gap: 8px; }
    .rb-btn {
      flex: 1; min-width: calc(50% - 4px); border: none; border-radius: 10px; padding: 9px 10px;
      font-size: 11px; font-weight: 800; cursor: pointer; transition: opacity .15s;
    }
    .rb-btn:disabled { opacity: .55; cursor: not-allowed; }
    .rb-btn-primary { background: #4f46e5; color: #fff; }
    .rb-btn-secondary { background: #f1f5f9; color: #334155; }
    .rb-btn-ghost { background: #fff; color: #4f46e5; border: 1px solid #c7d2fe; }
    .rb-status { font-size: 11px; padding: 8px 10px; border-radius: 10px; margin-bottom: 10px; }
    .rb-status.info { background: #eef2ff; color: #4338ca; }
    .rb-status.err { background: #fff1f2; color: #be123c; }
    .rb-status.ok { background: #ecfdf5; color: #047857; }
    .rb-connect { text-align: center; padding: 8px 0; }
    .rb-connect p { font-size: 12px; color: #64748b; margin: 0 0 10px; line-height: 1.4; }
    .rb-spinner {
      width: 18px; height: 18px; border: 2px solid #c7d2fe; border-top-color: #4f46e5;
      border-radius: 50%; animation: rb-spin .7s linear infinite; margin: 8px auto;
    }
    @keyframes rb-spin { to { transform: rotate(360deg); } }
  `;

  function scoreClass(score) {
    if (score >= 75) return "good";
    if (score >= 55) return "mid";
    return "low";
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function listHtml(items, cls = "") {
    if (!items?.length) return `<p class="rb-meta">None identified</p>`;
    return `<ul class="rb-list ${cls}">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`;
  }

  class RoleboltPanel {
    constructor() {
      this.open = false;
      this.job = null;
      this.analysis = null;
      this.workspaceId = null;
      this.connected = false;
      this.busy = false;
      this.mount();
    }

    mount() {
      if (document.getElementById(PANEL_ID)) return;
      const host = document.createElement("div");
      host.id = PANEL_ID;
      document.documentElement.appendChild(host);
      this.shadow = host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = PANEL_CSS;
      this.shadow.appendChild(style);

      const wrap = document.createElement("div");
      wrap.className = "rb-wrap";
      wrap.innerHTML = `
        <button class="rb-fab" aria-label="Open Rolebolt Job Copilot" title="Rolebolt Job Copilot">
          <img src="${ICON_URL}" alt="" />
        </button>
        <div class="rb-panel" role="dialog" aria-label="Rolebolt Job Copilot">
          <div class="rb-head">
            <img src="${ICON_URL}" alt="" />
            <div>
              <h2>Rolebolt Copilot</h2>
              <p id="rb-subtitle">AI match insights for this job</p>
            </div>
            <button class="rb-close" aria-label="Close">×</button>
          </div>
          <div class="rb-body" id="rb-body"></div>
          <div class="rb-actions" id="rb-actions"></div>
        </div>
      `;
      this.shadow.appendChild(wrap);

      this.fab = wrap.querySelector(".rb-fab");
      this.panel = wrap.querySelector(".rb-panel");
      this.body = wrap.querySelector("#rb-body");
      this.actions = wrap.querySelector("#rb-actions");
      this.fab.style.display = "none";

      this.fab.addEventListener("click", () => this.toggle());
      wrap.querySelector(".rb-close").addEventListener("click", () => this.close());

      this.checkAuth();
    }

    async checkAuth() {
      const resp = await chrome.runtime.sendMessage({ type: "GET_AUTH" }).catch(() => null);
      this.connected = !!(resp?.connected && resp?.token);
    }

    setJob(job) {
      this.job = job;
      this.analysis = null;
      this.workspaceId = null;
      if (this.fab) this.fab.style.display = job ? "flex" : "none";
      if (this.open && !job) this.close();
      if (this.open) this.render();
    }

    toggle() {
      this.open = !this.open;
      this.panel.classList.toggle("open", this.open);
      if (this.open) this.render();
    }

    close() {
      this.open = false;
      this.panel.classList.remove("open");
    }

    setStatus(msg, type = "info") {
      this.body.innerHTML = `<div class="rb-status ${type}">${esc(msg)}</div>`;
      this.actions.innerHTML = "";
    }

    render() {
      if (!this.job) {
        this.setStatus("Browse a job posting to see AI match insights.", "info");
        return;
      }

      if (!this.connected) {
        this.body.innerHTML = `
          <div class="rb-connect">
            <div class="rb-meta"><strong>${esc(this.job.title || "Job detected")}</strong>${esc(this.job.company || "")}</div>
            <p>Connect your Rolebolt account to get instant match scores and save jobs to your workspace.</p>
          </div>`;
        this.actions.innerHTML = `
          <button class="rb-btn rb-btn-primary" data-action="connect">Connect Rolebolt</button>
          <button class="rb-btn rb-btn-secondary" data-action="save-local">Save page info only</button>`;
        this.bindActions();
        return;
      }

      if (this.busy) {
        this.body.innerHTML = `<div class="rb-meta"><strong>${esc(this.job.title)}</strong>${esc(this.job.company)}</div><div class="rb-spinner"></div><p style="text-align:center;color:#64748b;font-size:12px">Analyzing fit with AI…</p>`;
        this.actions.innerHTML = "";
        return;
      }

      if (!this.analysis) {
        this.body.innerHTML = `
          <div class="rb-meta"><strong>${esc(this.job.title)}</strong>${esc([this.job.company, this.job.location, this.job.workMode].filter(Boolean).join(" · "))}</div>
          <div class="rb-status info">Ready to analyze this role against your Rolebolt profile and resume.</div>`;
        this.actions.innerHTML = `
          <button class="rb-btn rb-btn-primary" data-action="analyze">Analyze match</button>
          <button class="rb-btn rb-btn-secondary" data-action="save">Save to workspace</button>`;
        this.bindActions();
        return;
      }

      const a = this.analysis;
      const cls = scoreClass(a.matchScore || 0);
      this.body.innerHTML = `
        <div class="rb-meta"><strong>${esc(this.job.title)}</strong>${esc([this.job.company, this.job.location].filter(Boolean).join(" · "))}</div>
        <div class="rb-score ${cls}">
          <div class="rb-score-ring">${a.matchScore || 0}%</div>
          <div>
            <div class="rb-score-label">${esc(a.matchLabel || "Match score")}</div>
            <p class="rb-summary">${esc(a.summary || "")}</p>
          </div>
        </div>
        <div class="rb-section"><h3>Strengths</h3>${listHtml(a.strengths)}</div>
        <div class="rb-section"><h3>Missing skills</h3>${listHtml(a.missingSkills, "missing")}</div>
        ${a.profileSuggestions?.length ? `<div class="rb-section"><h3>Suggestions</h3>${listHtml(a.profileSuggestions)}</div>` : ""}
        ${a.salaryInsight ? `<div class="rb-section"><h3>Salary insight</h3><p class="rb-summary">${esc(a.salaryInsight)}</p></div>` : ""}
        ${this.workspaceId ? `<div class="rb-status ok">Saved to your Job Workspace</div>` : ""}`;

      this.actions.innerHTML = `
        <button class="rb-btn rb-btn-primary" data-action="save">${this.workspaceId ? "Update workspace" : "Save to workspace"}</button>
        <button class="rb-btn rb-btn-ghost" data-action="resume">Tailor resume</button>
        <button class="rb-btn rb-btn-secondary" data-action="workspace">Open workspace</button>
        <button class="rb-btn rb-btn-secondary" data-action="reanalyze">Re-analyze</button>`;
      this.bindActions();
    }

    bindActions() {
      this.actions.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", () => this.handleAction(btn.getAttribute("data-action")));
      });
    }

    payload() {
      return {
        url: this.job.url,
        title: this.job.title,
        companyName: this.job.company,
        location: this.job.location || "",
        workMode: this.job.workMode || "",
        salaryText: this.job.salaryText || "",
        pageText: this.job.description || "",
      };
    }

    async handleAction(action) {
      if (action === "connect") {
        chrome.runtime.sendMessage({ type: "OPEN_TAB", path: "/seeker/extension" });
        return;
      }
      if (action === "analyze" || action === "reanalyze") {
        await this.runAnalyze();
        return;
      }
      if (action === "save" || action === "save-local") {
        await this.runSave(action === "save-local");
        return;
      }
      if (action === "resume") {
        const q = this.workspaceId ? `?workspaceId=${encodeURIComponent(this.workspaceId)}` : "";
        chrome.runtime.sendMessage({ type: "OPEN_TAB", path: `/seeker/resume${q}` });
        return;
      }
      if (action === "workspace") {
        const q = this.workspaceId ? `?id=${encodeURIComponent(this.workspaceId)}` : "";
        chrome.runtime.sendMessage({ type: "OPEN_TAB", path: `/seeker/workspace${q}` });
      }
    }

    async runAnalyze() {
      this.busy = true;
      this.render();
      const resp = await chrome.runtime.sendMessage({ type: "ANALYZE_JOB", payload: this.payload() }).catch(e => ({ ok: false, error: e.message }));
      this.busy = false;
      if (!resp?.ok) {
        this.setStatus(resp?.error || "Analysis failed. Check your connection.", "err");
        this.actions.innerHTML = `<button class="rb-btn rb-btn-secondary" data-action="analyze">Try again</button>`;
        this.bindActions();
        return;
      }
      this.analysis = resp.analysis;
      if (resp.existingWorkspaceId) this.workspaceId = resp.existingWorkspaceId;
      this.render();
    }

    async runSave(localOnly) {
      if (localOnly || !this.connected) {
        this.setStatus("Sign in to Rolebolt to save jobs to your workspace.", "info");
        return;
      }
      this.busy = true;
      this.render();
      const resp = await chrome.runtime.sendMessage({ type: "SAVE_JOB", payload: this.payload() }).catch(e => ({ ok: false, error: e.message }));
      this.busy = false;
      if (!resp?.ok) {
        this.setStatus(resp?.error || "Could not save job.", "err");
        this.actions.innerHTML = `<button class="rb-btn rb-btn-secondary" data-action="save">Try again</button>`;
        this.bindActions();
        return;
      }
      this.workspaceId = resp.workspace?.id;
      if (resp.workspace?.analysis) this.analysis = resp.workspace.analysis;
      this.render();
    }
  }

  window.RoleboltPanel = RoleboltPanel;
})();
