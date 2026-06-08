# Chrome Web Store submission — ZooPrep Bluebook Importer

## Build the upload artifact

```bash
./build.sh --prod      # -> zooprep-importer-prod.zip  (this is what you upload)
```

The prod build uses `manifest.prod.json`: version `1.0.0`, host permissions pinned
to the College Board endpoints + `zooprep.com` + the production backend
(`sattool-production.up.railway.app`). It contains **no** `localhost`/`127.0.0.1`
hosts (those are dev-only and would draw review scrutiny).

> When the backend moves to a custom domain (e.g. `api.zooprep.com`), update the
> last host in `manifest.prod.json`, bump `version`, and re-submit.

## One-time setup
1. Register a Chrome Web Store developer account ($5 one-time fee):
   https://chrome.google.com/webstore/devconsole
2. Verify your publisher email/domain (verifying `zooprep.com` lets you publish
   as a recognized publisher, which students trust more).

## Store listing copy

**Name:** ZooPrep Bluebook Importer

**Summary (132 char max):**
Import your official College Board Bluebook SAT practice results into ZooPrep — real scores and a personalized study plan.

**Description:**
> ZooPrep Bluebook Importer brings your official Digital SAT practice-test
> results from College Board into your ZooPrep account.
>
> After you take a practice test in College Board's Bluebook app and view your
> score report on mypractice.collegeboard.org, this extension collects your
> results — your official scores and every question with your answers — and
> sends them to ZooPrep. There, you get your real section scores, a per-skill
> map of what to work on, a question-by-question review, and a study plan that
> tells you exactly what to learn and practice next.
>
> How to use it:
> 1. Connect the extension once from ZooPrep (Practice Tests → Connect extension).
> 2. Sign in at mypractice.collegeboard.org and open any score report.
> 3. Click the extension and "Export my results." Your results upload to ZooPrep
>    automatically (or download as a file you can import).
>
> This extension only works with your own College Board account and your own
> ZooPrep account. It does not collect anything else.

**Category:** Education
**Language:** English

## Permission justifications (required at submission)

Reviewers ask why each permission is needed. Paste these:

- **`storage`** — Stores the user's ZooPrep connection (site URL + a refresh
  token they explicitly grant via the "Connect extension" button) and their
  delivery preference, locally in the browser.
- **`downloads`** — Saves the results bundle as a JSON file when the user opts
  to import manually instead of auto-uploading.
- **Host `mypractice.collegeboard.org` / `digitalpractice-api.collegeboard.org`**
  — The user's results live here. The extension reads them from College Board's
  own results API, using the session the user is already signed into.
- **Host `zooprep.com` / `*.zooprep.com`** — Receives the one-click "Connect"
  handshake from the ZooPrep web app (passes the API URL + the user's ZooPrep
  refresh token to the extension).
- **Host `sattool-production.up.railway.app`** — The ZooPrep backend the results
  are uploaded to.

**Single purpose (required field):**
> Import a signed-in user's own College Board Bluebook practice-test results into
> their own ZooPrep account.

**Remote code:** No (all code is bundled; nothing is fetched/eval'd).

**Data usage disclosures (Privacy tab):**
- Data collected: the user's SAT practice-test results (scores + responses).
- Used only to: transfer those results to the user's ZooPrep account.
- Not sold, not used for advertising, not shared with third parties.
- The College Board session token is read in-page and never stored or transmitted
  by the extension. See PRIVACY.md.

**Privacy policy URL:** `https://zooprep.com/privacy` (live in the app — the
Privacy Policy page covers both the website and the importer extension). Required
because the listing handles user data.

## Listing assets to prepare
- **Icon:** 128×128 (already in `icons/icon128.png`).
- **Screenshots:** 1280×800 (or 640×400), at least one. Suggested: the popup
  mid-export, and the ZooPrep results/plan page showing imported scores.
- **Small promo tile (optional):** 440×280.

## Submit
1. Dev console → **New item** → upload `zooprep-importer-prod.zip`.
2. Fill Listing (copy above), Privacy (justifications above), Distribution
   (Public, or Unlisted if you want link-only access first — see below).
3. Submit for review. MV3 education extensions with a clear single purpose
   typically clear review in a few days.

## Recommended rollout for scale (seamless for students)
- Submit as **Unlisted** first: it's live and installable via direct link, but
  not search-discoverable. You control the link; less exposure while you validate.
- Put the install link behind the in-app **"Get the extension"** button (the
  import page already has one — repoint it from the local zip to the Web Store
  URL once published). One click from inside ZooPrep → Web Store → Add.
- After the connect flow is proven with real students, flip to **Public**.
