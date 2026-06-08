/* popup.js — drives status, export, progress, and delivery (upload or download). */

const MYPRACTICE_HOST = "mypractice.collegeboard.org";

const els = {
  status: document.getElementById("status"),
  hint: document.getElementById("hint"),
  export: document.getElementById("export"),
  progress: document.getElementById("progress"),
  progressBar: document.getElementById("progressBar"),
  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
  result: document.getElementById("result"),
  openOptions: document.getElementById("openOptions"),
};

// Show an indeterminate (sweeping) bar with a label — for phases with no total.
function showIndeterminate(text) {
  els.progress.hidden = false;
  els.progressBar.classList.add("progress__bar--indeterminate");
  els.progressFill.style.width = "";
  els.progressText.textContent = text || "";
}
function clearIndeterminate() {
  els.progressBar.classList.remove("progress__bar--indeterminate");
}

function setStatus(kind, text) {
  els.status.className = `status status--${kind}`;
  els.status.textContent = text;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshStatus() {
  const tab = await activeTab();
  if (!tab || !tab.url || !tab.url.includes(MYPRACTICE_HOST)) {
    setStatus("blocked", "Not on MyPractice");
    els.hint.innerHTML =
      'Go to <strong>mypractice.collegeboard.org</strong> and sign in, then reopen this.';
    els.export.disabled = true;
    return;
  }
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "IMPORTER_STATUS" });
    if (resp && resp.hasToken) {
      setStatus("ready", "Ready to export");
      els.hint.textContent = "We found your session. Click export to collect all your tests.";
      els.export.disabled = false;
    } else {
      setStatus("blocked", "Open a score report first");
      els.hint.innerHTML =
        'Click into any <strong>Score Details</strong> page once so we can read your ' +
        'session token, then come back here.';
      els.export.disabled = true;
    }
  } catch (e) {
    setStatus("blocked", "Reload the MyPractice tab");
    els.hint.textContent =
      "The page needs a refresh so the importer can attach. Reload and try again.";
    els.export.disabled = true;
  }
}

function onProgress(p) {
  els.progress.hidden = false;
  clearIndeterminate();
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  els.progressFill.style.width = `${pct}%`;
  els.progressText.textContent = p.text || "";
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "IMPORTER_PROGRESS") onProgress(msg.payload);
});

function showResult(html, isError) {
  els.result.hidden = false;
  els.result.className = isError ? "result result--error" : "result";
  els.result.innerHTML = html;
}

async function getDeliveryConfig() {
  const cfg = await chrome.storage.sync.get({
    deliveryMode: "auto", // "auto" => upload if connected else download
    zooprepBaseUrl: "",
    zooprepToken: "",
    zooprepRefreshToken: "",
  });
  return cfg;
}

async function deliver(bundle) {
  const cfg = await getDeliveryConfig();
  const canUpload = !!(cfg.zooprepBaseUrl && (cfg.zooprepRefreshToken || cfg.zooprepToken));
  const wantUpload = cfg.deliveryMode === "upload" || (cfg.deliveryMode === "auto" && canUpload);

  if (wantUpload && canUpload) {
    setStatus("checking", "Uploading…");
    showIndeterminate(`Uploading ${bundle.attemptCount} attempts to ZooPrep…`);
    try {
      const res = await chrome.runtime.sendMessage({
        type: "IMPORTER_UPLOAD",
        baseUrl: cfg.zooprepBaseUrl,
        bundle,
      });
      clearIndeterminate();
      els.progress.hidden = true;
      if (res && res.ok) {
        setStatus("ready", "Uploaded");
        showResult(
          `Uploaded ${bundle.attemptCount} attempts to ZooPrep. ` +
            `${res.summary ? res.summary : ""}`
        );
        return;
      }
      throw new Error(res && res.error ? res.error : "upload failed");
    } catch (e) {
      clearIndeterminate();
      els.progress.hidden = true;
      // Fall back to download so the data is never lost.
      await downloadBundle(bundle);
      showResult(
        `Upload failed (${String(e.message || e)}). Saved a file instead — ` +
          `import it manually in ZooPrep.`,
        true
      );
      return;
    }
  }
  els.progress.hidden = true;
  await downloadBundle(bundle);
  showResult(
    `Saved <strong>zooprep-bluebook.json</strong> with ${bundle.attemptCount} attempts. ` +
      `Open ZooPrep → Import and drop the file in.`
  );
}

async function downloadBundle(bundle) {
  const res = await chrome.runtime.sendMessage({ type: "IMPORTER_DOWNLOAD", bundle });
  if (!res || !res.ok) throw new Error(res && res.error ? res.error : "download failed");
}

els.export.addEventListener("click", async () => {
  els.export.disabled = true;
  els.result.hidden = true;
  setStatus("checking", "Collecting…");
  const tab = await activeTab();
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "IMPORTER_COLLECT" });
    if (!resp || !resp.ok) throw new Error(resp && resp.error ? resp.error : "collection failed");
    setStatus("ready", "Collected");
    await deliver(resp.bundle);
  } catch (e) {
    setStatus("error", "Export failed");
    showResult(String(e.message || e), true);
  } finally {
    els.export.disabled = false;
  }
});

els.openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

refreshStatus();
