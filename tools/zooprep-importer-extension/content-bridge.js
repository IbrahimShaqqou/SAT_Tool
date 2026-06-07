/*
 * content-bridge.js — runs in the ISOLATED world on mypractice.collegeboard.org.
 *
 * Bridges the MAIN-world page hook (which holds the captured CB token and does
 * the API replay) and the extension's popup/background (which handle delivery).
 *
 * - page  <-> bridge : window.postMessage, namespaced ZOOPREP_IMPORTER
 * - bridge <-> popup : chrome.runtime messaging
 *
 * The token never leaves the page context; only the assembled data bundle and
 * progress updates cross into the extension.
 */
(function () {
  "use strict";
  const NS = "ZOOPREP_IMPORTER";

  let hookReady = false;
  const pending = new Map(); // reqId -> {onProgress, resolve, reject}

  function newReqId() {
    return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }

  // ---- Receive from the page hook (MAIN world). ----
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.ns !== NS || msg.dir !== "toBridge") return;

    if (msg.type === "HOOK_READY") {
      hookReady = true;
      return;
    }

    const ctx = msg.reqId ? pending.get(msg.reqId) : null;

    if (msg.type === "PONG") {
      if (ctx) { ctx.resolve({ hasToken: msg.hasToken }); pending.delete(msg.reqId); }
      return;
    }
    if (msg.type === "PROGRESS") {
      if (ctx && ctx.onProgress) ctx.onProgress(msg);
      // Also forward live to any open popup.
      chrome.runtime.sendMessage({ type: "IMPORTER_PROGRESS", payload: msg }).catch(() => {});
      return;
    }
    if (msg.type === "RESULT") {
      if (ctx) { ctx.resolve({ bundle: msg.bundle }); pending.delete(msg.reqId); }
      return;
    }
    if (msg.type === "ERROR") {
      if (ctx) { ctx.reject(new Error(msg.error)); pending.delete(msg.reqId); }
      return;
    }
  });

  function callPage(type, onProgress) {
    return new Promise((resolve, reject) => {
      const reqId = newReqId();
      pending.set(reqId, { onProgress, resolve, reject });
      window.postMessage({ ns: NS, dir: "toPage", type, reqId }, "*");
      // Safety timeout for non-collect calls.
      if (type === "PING") {
        setTimeout(() => {
          if (pending.has(reqId)) { pending.delete(reqId); reject(new Error("hook not responding")); }
        }, 2000);
      }
    });
  }

  // ---- Receive from the popup. ----
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "IMPORTER_STATUS") {
      callPage("PING")
        .then((r) => sendResponse({ ok: true, hookReady, hasToken: r.hasToken }))
        .catch(() => sendResponse({ ok: true, hookReady, hasToken: false }));
      return true; // async
    }
    if (message.type === "IMPORTER_COLLECT") {
      callPage("COLLECT", (p) => {
        chrome.runtime.sendMessage({ type: "IMPORTER_PROGRESS", payload: p }).catch(() => {});
      })
        .then((r) => sendResponse({ ok: true, bundle: r.bundle }))
        .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
      return true; // async
    }
  });
})();
