# ZooPrep Bluebook Importer (Chrome MV3 extension)

Exports a student's official College Board MyPractice results — **all tests, all
attempts, both adaptive Module 2 paths** — and delivers them to ZooPrep, either by
auto-upload or as a JSON file.

## Why an extension (and not paste-a-link / PDF)
The results live behind `digitalpractice-api.collegeboard.org`, which requires
custom auth headers the MyPractice app injects from memory. They are not in
cookies, a URL, or the PDF score report. The only robust, user-friendly capture
is to run in the page's own JS context and reuse the token the app already holds.

## How it works
- `page-hook.js` (MAIN world) wraps `fetch`/`XHR` to capture the CB auth token,
  then replays `POST /scores` (lists every attempt) and `POST /questions`
  (full content + answers + rationale per attempt). The token never leaves the page.
- `content-bridge.js` (ISOLATED world) relays messages between the hook and the
  popup. Only the assembled data bundle + progress cross this boundary.
- `popup.js` shows status/progress and runs delivery.
- `background.js` performs the file download or the authenticated upload to
  `POST {ZooPrepURL}/api/v1/practice-tests/import`. For auto-upload it mints a
  fresh access token from the stored refresh token via `POST /api/v1/auth/refresh`
  before each upload, so it keeps working without re-pasting anything.
- `zooprep-connect.js` (runs on the ZooPrep origin) receives the API URL +
  refresh token from ZooPrep's "Connect extension" button via `window.postMessage`
  and stores them — this is the one-click setup.
- `options.js` stores the ZooPrep URL, token, and delivery mode in `chrome.storage.sync`.

## Connecting for auto-upload (one click)
On ZooPrep → Practice Tests, click **Connect extension**. The page hands the
extension your API URL and a refresh token; from then on, exporting from
MyPractice uploads straight to your account. No copy-paste, no extension ID.
The refresh token lives ~7 days; click Connect again if upload says it expired.
Manual fallback (paste URL + access token in the extension's Options) still works.

## Student flow
1. Install once.
2. Sign in at mypractice.collegeboard.org and open any **Score Details** page
   once (this lets the hook capture the session token).
3. Click the extension → **Export my results**.
4. The bundle uploads to ZooPrep (if connected) or downloads as
   `zooprep-bluebook.json` to import manually.

## Bundle format (`schemaVersion: 1`)
```jsonc
{
  "schemaVersion": 1,
  "source": "mypractice_api",
  "capturedAtIso": "…",
  "attemptCount": 22,
  "attempts": [
    {
      "rosterEntryId": "fp_…",
      "testId": "6WSA01",
      "displayTitle": "SAT Practice 7",
      "asmtFamilyCd": 1,
      "submittedAt": "…",
      "scoreObject": { /* full /scores object: totalScore, sectionScores, questionBankData{domainScores,external_ids} */ },
      "questions": [ /* /questions response: [{id:'reading',items:[…]},{id:'math',items:[…]}] */ ]
    }
  ]
}
```

## Develop / load
Chrome → Extensions → Developer mode → **Load unpacked** → select this folder.
For Web Store distribution, add `icons` (16/48/128) and a privacy disclosure
covering the token capture (local-only) and the data uploaded to ZooPrep.

## Notes / limits
- Older attempts (pre-2026 capture format) may lack `externalId`/`metadata` on
  questions; the backend importer handles those as best-effort (keyed by
  `questionId`) and flags them.
- Auth token auto-refreshes in the app; the hook always uses the freshest one.
