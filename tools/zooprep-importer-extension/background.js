/* background.js — service worker: file download + ZooPrep upload.
 *
 * Auto-upload uses a stored refresh token (from the one-click Connect handshake)
 * to mint a fresh access token before each upload, so it keeps working for the
 * life of the refresh token without the student pasting anything. Falls back to
 * a directly-pasted access token (zooprepToken) for the manual flow. */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "IMPORTER_DOWNLOAD") {
    downloadBundle(msg.bundle)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (msg.type === "IMPORTER_UPLOAD") {
    uploadBundle(msg.baseUrl, msg.bundle)
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
});

async function downloadBundle(bundle) {
  const json = JSON.stringify(bundle, null, 2);
  // data: URL avoids needing a Blob URL (not available in MV3 service workers).
  const url = "data:application/json;charset=utf-8," + encodeURIComponent(json);
  await chrome.downloads.download({
    url,
    filename: "zooprep-bluebook.json",
    saveAs: true,
  });
}

function getConfig() {
  return chrome.storage.sync.get({
    zooprepBaseUrl: "",
    zooprepToken: "",
    zooprepRefreshToken: "",
  });
}

async function mintAccessToken(base, refreshToken) {
  let res;
  try {
    res = await fetch(`${base}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (e) {
    throw new Error(`Couldn't reach ZooPrep at ${base}. Is the URL right? (${e.message})`);
  }
  if (res.status === 401) {
    throw new Error(
      "Your ZooPrep connection expired. Open ZooPrep → Practice Tests and click Connect again."
    );
  }
  if (!res.ok) {
    throw new Error(`ZooPrep auth failed (HTTP ${res.status}) at ${base}/api/v1/auth/refresh`);
  }
  const data = await res.json();
  // Rotate the stored refresh token if the server issued a new one.
  if (data.refresh_token) {
    chrome.storage.sync.set({ zooprepRefreshToken: data.refresh_token });
  }
  return data.access_token;
}

async function uploadBundle(baseUrlArg, bundle) {
  const cfg = await getConfig();
  const base = (baseUrlArg || cfg.zooprepBaseUrl || "").replace(/\/+$/, "");
  if (!base) throw new Error("ZooPrep isn't connected yet.");

  // Prefer the durable refresh-token flow; fall back to a pasted access token.
  let accessToken = cfg.zooprepToken;
  if (cfg.zooprepRefreshToken) {
    accessToken = await mintAccessToken(base, cfg.zooprepRefreshToken);
  }
  if (!accessToken) {
    throw new Error("No ZooPrep credentials. Click Connect on the ZooPrep import page.");
  }

  const res = await fetch(`${base}/api/v1/practice-tests/import`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(bundle),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.detail) detail = j.detail;
    } catch (_) {}
    throw new Error(detail);
  }
  const data = await res.json().catch(() => ({}));
  return data && data.summary ? data.summary : "";
}
