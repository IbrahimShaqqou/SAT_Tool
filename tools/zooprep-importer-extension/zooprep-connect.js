/*
 * zooprep-connect.js — runs on the ZooPrep web app origin.
 *
 * Lets the ZooPrep "Connect extension" button hand the importer everything it
 * needs for auto-upload — the API base URL and a refresh token — via a simple
 * window.postMessage handshake. No copy-paste, no extension ID required.
 *
 * The extension stores the refresh token (not the short-lived access token) and
 * mints fresh access tokens itself before each upload, so auto-upload keeps
 * working for the life of the refresh token (~7 days).
 */
(function () {
  "use strict";
  const NS = "ZOOPREP_CONNECT";

  window.addEventListener("message", (event) => {
    // Only trust messages from the page itself.
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.ns !== NS) return;

    if (msg.type === "PING") {
      // Let the page know the extension is installed.
      window.postMessage({ ns: NS, type: "PONG", installed: true }, event.origin);
      return;
    }

    if (msg.type === "CONNECT") {
      const { baseUrl, refreshToken } = msg;
      if (!baseUrl || !refreshToken) {
        window.postMessage({ ns: NS, type: "CONNECTED", ok: false, error: "missing fields" }, event.origin);
        return;
      }
      chrome.storage.sync.set(
        {
          deliveryMode: "auto",
          zooprepBaseUrl: String(baseUrl).replace(/\/+$/, ""),
          zooprepRefreshToken: refreshToken,
          // Clear any stale pasted access token from the old flow.
          zooprepToken: "",
        },
        () => {
          window.postMessage({ ns: NS, type: "CONNECTED", ok: true }, event.origin);
        }
      );
    }
  });

  // Announce availability so a page that loads after us can detect the extension.
  window.postMessage({ ns: NS, type: "READY", installed: true }, window.location.origin);
})();
