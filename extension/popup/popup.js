import { DEFAULT_API_BASE } from "../lib/config.js";

const $ = (id) => document.getElementById(id);

function setStatus(msg, ok) {
  const el = $("status");
  el.textContent = msg || "";
  el.className = "status " + (ok ? "ok" : msg ? "err" : "");
}

function showScore(analysis) {
  $("resultSection").classList.remove("hidden");
  const score = analysis.matchScore || 0;
  const ringCls = score >= 75 ? "" : score >= 55 ? " mid" : " low";
  $("scoreBlock").innerHTML = `
    <div class="score-ring${ringCls}">${score}%</div>
    <div><strong style="font-size:12px">${escapeHtml(analysis.matchLabel || "Match")}</strong></div>`;
  $("resultSummary").textContent = analysis.summary || "";
  $("strengthList").innerHTML = (analysis.strengths || [])
    .slice(0, 3)
    .map(s => `<li>${escapeHtml(s)}</li>`)
    .join("");
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function getAuth() {
  return chrome.runtime.sendMessage({ type: "GET_AUTH" });
}

async function getActiveTabJob() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { tab, job: null };
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "GET_JOB_SNAPSHOT" });
    return { tab, job: resp?.job || null };
  } catch {
    return { tab, job: null };
  }
}

function fillJobFields(job, tab) {
  $("title").value = job?.title || tab?.title || "";
  $("company").value = job?.company || "";
  $("location").value = job?.location || "";
}

function payloadFromForm(tab, job) {
  return {
    url: job?.url || tab?.url || "",
    title: $("title").value.trim(),
    companyName: $("company").value.trim(),
    location: $("location").value.trim(),
    workMode: job?.workMode || "",
    salaryText: job?.salaryText || "",
    pageText: job?.description || "",
  };
}

async function init() {
  const auth = await getAuth();
  const conn = $("connStatus");
  const connected = !!(auth?.connected && auth?.token);

  if (connected) {
    conn.textContent = "Connected ✓";
    conn.className = "connected";
    $("connectSection").classList.add("hidden");
    $("jobSection").classList.remove("hidden");
  } else {
    conn.textContent = "Not connected";
    conn.className = "disconnected";
    $("connectSection").classList.remove("hidden");
    $("jobSection").classList.add("hidden");
    $("apiBase").value = auth?.apiBase || DEFAULT_API_BASE;
  }

  const { tab, job } = await getActiveTabJob();
  if (connected) fillJobFields(job, tab);

  $("connectBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_TAB", path: "/seeker/extension" });
  });

  $("saveTokenBtn").addEventListener("click", async () => {
    const token = $("token").value.trim();
    const apiBase = ($("apiBase").value.trim() || DEFAULT_API_BASE);
    if (!token) return setStatus("Paste your auth token.", false);
    await chrome.runtime.sendMessage({ type: "SYNC_TOKEN", token, apiBase });
    setStatus("Token saved!", true);
    setTimeout(() => location.reload(), 600);
  });

  $("analyzeBtn").addEventListener("click", async () => {
    $("analyzeBtn").disabled = true;
    setStatus("Analyzing…", true);
    try {
      const { tab, job } = await getActiveTabJob();
      const resp = await chrome.runtime.sendMessage({
        type: "ANALYZE_JOB",
        payload: payloadFromForm(tab, job),
      });
      if (!resp?.ok) throw new Error(resp?.error || "Analysis failed");
      showScore(resp.analysis);
      setStatus("Analysis complete", true);
    } catch (e) {
      setStatus(e.message || "Analysis failed", false);
    } finally {
      $("analyzeBtn").disabled = false;
    }
  });

  $("saveBtn").addEventListener("click", async () => {
    $("saveBtn").disabled = true;
    setStatus("Saving…", true);
    try {
      const { tab, job } = await getActiveTabJob();
      const resp = await chrome.runtime.sendMessage({
        type: "SAVE_JOB",
        payload: payloadFromForm(tab, job),
      });
      if (!resp?.ok) throw new Error(resp?.error || "Save failed");
      if (resp.workspace?.analysis) showScore(resp.workspace.analysis);
      setStatus("Saved to Job Workspace!", true);
    } catch (e) {
      setStatus(e.message || "Save failed", false);
    } finally {
      $("saveBtn").disabled = false;
    }
  });

  $("panelBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "OPEN_PANEL" }).catch(() => {
      setStatus("Open a regular job page first.", false);
    });
    window.close();
  });

  $("workspaceBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_TAB", path: "/seeker/workspace" });
  });

  $("disconnectBtn").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "CLEAR_AUTH" });
    location.reload();
  });
}

init();
