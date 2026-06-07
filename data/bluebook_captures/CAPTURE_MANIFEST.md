# Bluebook MyPractice API Captures

**Captured:** 2026-06-05 from `mypractice.collegeboard.org` (logged-in session).
**Source endpoint:** `POST digitalpractice-api.collegeboard.org/mspractice-testresults-prod/questions`
Request body: `{"rosterEntryId":"fp_...","asmtFamilyCd":1}`. Response: 2 groups
(`reading` 54, `math` 44) = the 98 questions that attempt administered (Module 1 + one
Module 2 path). `displayNumber` resets to "1" at the module boundary (RW after 27, Math after 22).

Also captured: `pt7_scores.json` — the `/scores` response, which contains ALL 22 attempts across
all tests (official IRT scores, per-domain theta, and the full 145-id form list per test).

## Per-question fields (current format)
`externalId` (== our `questions.external_id`), `questionId`, `vaultId`, `section`, `displayNumber`,
`sequence`, `prompt`, `passage`, `answer{choices,correctChoice,response,correct,style,rationale}`,
`metadata{PRIMARY/SECONDARY/TERTIARY_CLASS_CD}`.

## Coverage

| Test | Files | M1 shared | easy-M2 | hard-M2 | Unique Qs | Status |
|------|-------|-----------|---------|---------|-----------|--------|
| PT4  | easier+harder | 53 | 45 | 45 | **143** | Full form, both paths |
| PT5  | easier+harder | 53 | 45 | 45 | **143** | Full form, both paths |
| PT6  | easier+harder | 53 | 45 | 45 | **143** | Full form, both paths |
| PT7  | easier+harder | 51 | 47 | 47 | **145** | Full form, both paths |
| PT10 | mixed (1 take) | — | — | — | 98 | Partial: RW easier + Math harder only |

(M1 shared >49 because the two adaptive paths overlap by a couple Module-1 / pretest items.)

## Files
- `pt{4,5,6,7}_easier_questions.json` — attempt routed to EASIER Module 2 (0 correct take)
- `pt{4,5,6,7}_harder_questions.json` — attempt routed to HARDER Module 2 (~all-correct take)
- `pt10_mixed_questions.json` — only attempt (RW easier, Math harder). **OLD FORMAT: no
  `externalId`, no `metadata` — items keyed by `questionId`/`vaultId` only; not in our bank.**
- `pt7_scores.json` — `/scores` for the whole account (all 22 attempts, official scores + theta)
- `pt7_questions{,_request}.json` — original PT7 harder capture + sample request body

## Attempt roster IDs used (rosterEntryId)
- PT4: easier `fp_9b505b54-afd0-4d32-917a-d5f71ee71478` (1 correct), harder `fp_f13b89ef-0676-4550-beee-6089c429af7f` (1080)
- PT5: easier `fp_d30c38a6-2f6d-43e3-8574-09f79b74def5` (0), harder `fp_46fe797a-a26a-41a4-be45-9161f0d2b3ca` (1080)
- PT6: easier `fp_27ff3b21-c481-40df-97ec-c966cfc5bb91` (0), harder `fp_46f31f48-427f-4ef4-8f7b-e93ff59d8b62` (1060)
- PT7: easier `fp_5bcd345b-0ad1-4f84-a027-7c83ddae0d2a` (0), harder `fp_663916da-30f5-4539-b86a-d8659fac584e` (1050)
- PT10: `fp_1072cf21-7380-44b5-8e66-2abd6d508691` (770, mixed)

## Notes
- `externalId` is the join key to `questions.external_id`. PT7 was new to the bank (0/145 present);
  the others should be cross-checked too — the API delivers full content regardless, so anything
  missing can be imported directly.
- Auth token (`x-cb-catapult-authorization-token`) auto-refreshes in the app session (~15-min exp);
  capturing via UI navigation always uses a fresh valid token. Direct cross-origin replay is blocked.
- PT10's old format means a separate import path (key by questionId, no domain tags) — or re-take
  PT10 in current Bluebook to get the modern externalId-tagged payload.
