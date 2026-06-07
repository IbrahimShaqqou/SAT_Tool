/*
 * page-hook.js — runs in the MAIN world (same JS context as the MyPractice app).
 *
 * Why MAIN world: the College Board API requires custom auth headers
 * (x-cb-catapult-authorization-token / -authentication-token) that the app
 * injects from in-memory state. They are NOT in cookies or storage. By wrapping
 * window.fetch here we observe those headers on requests the app already makes,
 * capture them, and reuse them to replay the results endpoints for EVERY attempt
 * — so the student never has to click through each result page.
 *
 * This script talks to the isolated content script (content-bridge.js) only via
 * window.postMessage with a namespaced type. It never sees ZooPrep credentials.
 */
(function () {
  "use strict";

  const API = "https://digitalpractice-api.collegeboard.org/mspractice-testresults-prod";
  const NS = "ZOOPREP_IMPORTER";

  // Most recent captured catapult auth headers (refreshed on every app request).
  let capturedHeaders = null;

  function captureFromHeaders(headers) {
    try {
      const authz = headers.get("x-cb-catapult-authorization-token");
      const authn = headers.get("x-cb-catapult-authentication-token");
      if (authz && authn) {
        capturedHeaders = {
          "x-cb-catapult-authorization-token": authz,
          "x-cb-catapult-authentication-token": authn,
        };
      }
    } catch (_) {
      /* Headers may be a plain object in some call styles; handled below. */
    }
  }

  function captureFromInit(init) {
    if (!init || !init.headers) return;
    const h = init.headers;
    const get = (k) =>
      typeof h.get === "function" ? h.get(k) : h[k] || h[k.toLowerCase()];
    const authz = get("x-cb-catapult-authorization-token");
    const authn = get("x-cb-catapult-authentication-token");
    if (authz && authn) {
      capturedHeaders = {
        "x-cb-catapult-authorization-token": authz,
        "x-cb-catapult-authentication-token": authn,
      };
    }
  }

  // ---- Wrap fetch to sniff the auth headers the app sends. ----
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      if (init && init.headers) captureFromInit(init);
      else if (input && input.headers) captureFromHeaders(input.headers);
    } catch (_) {}
    return origFetch.apply(this, arguments);
  };

  // ---- Also wrap XHR setRequestHeader as a belt-and-suspenders fallback. ----
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  const xhrPending = new WeakMap();
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      const lower = String(name).toLowerCase();
      if (lower === "x-cb-catapult-authorization-token" ||
          lower === "x-cb-catapult-authentication-token") {
        const acc = xhrPending.get(this) || {};
        acc[lower] = value;
        xhrPending.set(this, acc);
        if (acc["x-cb-catapult-authorization-token"] &&
            acc["x-cb-catapult-authentication-token"]) {
          capturedHeaders = { ...acc };
        }
      }
    } catch (_) {}
    return origSetHeader.apply(this, arguments);
  };

  async function apiPost(path, body) {
    if (!capturedHeaders) {
      throw new Error(
        "No College Board auth token captured yet. Open your score details once, then try again."
      );
    }
    const res = await origFetch(`${API}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...capturedHeaders },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(`${path} failed: HTTP ${res.status}`);
    return res.json();
  }

  // ---- Collect everything: all attempts' scores + per-attempt questions. ----
  async function collectAll(progress) {
    const scores = await apiPost("scores", {});
    const attempts = (scores && scores.scoreObjects) || [];
    progress(`Found ${attempts.length} attempts. Fetching questions…`, 0, attempts.length);

    const out = [];
    for (let i = 0; i < attempts.length; i++) {
      const a = attempts[i];
      let questions = null;
      try {
        questions = await apiPost("questions", {
          rosterEntryId: a.rosterEntryId,
          asmtFamilyCd: a.asmtFamilyCd,
        });
      } catch (e) {
        questions = { error: String(e && e.message ? e.message : e) };
      }
      out.push({
        rosterEntryId: a.rosterEntryId,
        testId: a.testId,
        displayTitle: a.displayTitle,
        asmtFamilyCd: a.asmtFamilyCd,
        submittedAt: a.asmtSubmissionStartTime,
        scoreObject: a,
        questions,
      });
      progress(`Fetched ${i + 1}/${attempts.length}: ${a.displayTitle}`, i + 1, attempts.length);
    }
    return {
      schemaVersion: 1,
      source: "mypractice_api",
      capturedAtIso: new Date().toISOString(),
      attemptCount: out.length,
      attempts: out,
    };
  }

  // ---- Message protocol with the isolated content bridge. ----
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.ns !== NS || msg.dir !== "toPage") return;

    if (msg.type === "PING") {
      window.postMessage(
        { ns: NS, dir: "toBridge", type: "PONG", hasToken: !!capturedHeaders, reqId: msg.reqId },
        "*"
      );
      return;
    }

    if (msg.type === "COLLECT") {
      const progress = (text, done, total) =>
        window.postMessage(
          { ns: NS, dir: "toBridge", type: "PROGRESS", text, done, total, reqId: msg.reqId },
          "*"
        );
      try {
        const bundle = await collectAll(progress);
        window.postMessage(
          { ns: NS, dir: "toBridge", type: "RESULT", bundle, reqId: msg.reqId },
          "*"
        );
      } catch (e) {
        window.postMessage(
          { ns: NS, dir: "toBridge", type: "ERROR", error: String(e && e.message ? e.message : e), reqId: msg.reqId },
          "*"
        );
      }
    }
  });

  // Announce readiness so the bridge knows the hook is installed.
  window.postMessage({ ns: NS, dir: "toBridge", type: "HOOK_READY" }, "*");
})();
