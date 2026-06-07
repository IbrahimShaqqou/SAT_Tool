# Privacy — ZooPrep Bluebook Importer

**What it accesses.** The extension runs only on `mypractice.collegeboard.org`. It
reads the College Board session token your own browser already sends, solely to
request your practice-test results (`/scores` and `/questions`) from College
Board's API on your behalf.

**Where data goes.**
- The College Board session token stays in the page; it is never stored by the
  extension and never sent to ZooPrep or any third party.
- Your assembled results bundle is either (a) downloaded to your computer as a
  file you choose to import, or (b) uploaded to the ZooPrep URL you configured,
  authenticated with the ZooPrep access token you pasted into Settings.
- The ZooPrep URL and token you enter are stored only in your browser
  (`chrome.storage.sync`) and used only to upload your results to your account.

**What we do not do.** No analytics, no tracking, no selling data, no sending
your College Board credentials anywhere. The extension has no remote code.

**Permissions.**
- `storage` — save your ZooPrep URL/token and delivery preference locally.
- `downloads` — save the results file when not auto-uploading.
- host access to the two College Board domains above — to read your results.

**Removing your data.** Uninstalling the extension clears its stored settings.
Results already imported into ZooPrep are managed in your ZooPrep account.
