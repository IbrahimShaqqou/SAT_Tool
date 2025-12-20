# Data Import Documentation

Documentation for the SAT question bank data import process.

## Overview

The question bank contains 3,271 SAT questions sourced from the College Board Question Bank API. The import process consists of three stages:

1. **Fetch** - Download raw question data from College Board API
2. **Normalize** - Transform raw data into a consistent format
3. **Import** - Load normalized data into PostgreSQL

## Data Files

All data files are stored in `backend/data/`:

| File | Size | Description |
|------|------|-------------|
| `math_core.json` | 27 MB | Raw math question data from API |
| `math_norm.json` | 13 MB | Normalized math questions (1,681) |
| `reading_core.json` | 6.4 MB | Raw reading question data from API |
| `reading_norm.json` | 1.7 MB | Normalized reading questions (1,590) |

## Data Format

### Normalized Question Format

```json
{
  "uId": "015305f9-b9f2-4e73-8654-dad0656ff31c",
  "prompt_html": "<p>Question text with <math>equations</math>...</p>",
  "answer_type": "SPR",
  "choices_html": [],
  "correct": {
    "answers": ["3"]
  },
  "rationale_html": "<p>Explanation text...</p>",
  "meta": {
    "skill_cd": "H.D.",
    "skill_desc": "Systems of two linear equations in two variables",
    "difficulty": "H",
    "primary_class_cd_desc": "Algebra",
    "score_band_range_cd": 6,
    "ibn": ""
  }
}
```

### Answer Types

**MCQ (Multiple Choice Question):**
```json
{
  "answer_type": "MCQ",
  "choices_html": [
    "<p>Choice A</p>",
    "<p>Choice B</p>",
    "<p>Choice C</p>",
    "<p>Choice D</p>"
  ],
  "correct": {
    "index": 2
  }
}
```
The index is 0-based.

**SPR (Student-Produced Response):**
```json
{
  "answer_type": "SPR",
  "choices_html": [],
  "correct": {
    "answers": ["3", "3.0", "6/2"]
  }
}
```
Multiple equivalent answers may be listed.

### Reading Questions (Additional Fields)

Reading questions include a stimulus (passage):
```json
{
  "stimulus_html": "<p>Passage text...</p>",
  "prompt_html": "<p>Question about the passage...</p>",
  "rationale_html": "<p>Explanation...</p>"
}
```

During import, the stimulus is prepended to the prompt_html.

## Scripts

### fetch_math.py

Fetches math questions from College Board API.

**Usage:**
```bash
cd backend
python scripts/fetch_math.py [--fresh] [--check]
```

**Options:**
- `--fresh` - Re-download all questions from API
- `--check` - Only run quality checks on existing data

**Output:**
- `data/math_core.json` - Raw API response (keyed by uId)
- `data/math_norm.json` - Normalized question array

**API Endpoint:**
```
POST https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-questions
Payload: {"asmtEventId": 99, "test": 2, "domain": "H,P,Q,S"}
```

**Quality Checks:**
- Blank prompts
- SPR questions without answers
- MCQ questions with invalid correct index

### fetch_reading.py

Fetches reading/writing questions from College Board API.

**Usage:**
```bash
cd backend
python scripts/fetch_reading.py [--fresh] [--raw]
```

**Options:**
- `--fresh` - Re-download all questions from API
- `--raw` - Only create core file, skip normalization

**Output:**
- `data/reading_core.json` - Raw API response (keyed by uId)
- `data/reading_norm.json` - Normalized question array

**API Endpoint:**
```
POST https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-questions
Payload: {"asmtEventId": 99, "test": 1, "domain": "INI,CAS,EOI,SEC"}
```

### import_questions.py

Imports normalized questions into PostgreSQL.

**Usage:**
```bash
cd backend
python scripts/import_questions.py [--math] [--reading] [--all] [--seed-only]
```

**Options:**
- `--math` - Import only math questions
- `--reading` - Import only reading questions
- `--all` - Import both (default if no flags)
- `--seed-only` - Only seed taxonomy domains, skip questions

**Process:**
1. Seeds domain taxonomy (8 domains)
2. Reads normalized JSON files
3. Creates skills dynamically as encountered
4. Imports questions with duplicate detection
5. Commits in batches of 100

## Import Service

The import logic is in `app/services/question_import.py`.

### Functions

**seed_taxonomy(db)**

Creates the 8 SAT domains:
- Math: H, P, Q, S
- Reading/Writing: INI, CAS, EOI, SEC

**import_normalized_questions(db, json_path, subject_area, batch_id)**

Main import function:
1. Loads JSON file
2. Pre-fetches existing domains and skills
3. For each question:
   - Skip if external_id exists (duplicate)
   - Map domain from skill code or primary class
   - Create skill if not exists
   - Map difficulty (E/M/H to EASY/MEDIUM/HARD)
   - Build Question record with all fields
   - Add to session
4. Commit in batches

**import_math_questions(db, json_path, batch_id)**

Wrapper for math import with default path.

**import_reading_questions(db, json_path, batch_id)**

Wrapper for reading import with default path.

### Domain Mapping

**Math:**
- Skill code starts with H -> Heart of Algebra
- Skill code starts with P -> Problem Solving and Data Analysis
- Skill code starts with Q -> Passport to Advanced Math
- Skill code starts with S -> Additional Topics in Math

**Reading/Writing:**
- primary_class_cd_desc contains "INFORMATION" or "IDEAS" -> INI
- primary_class_cd_desc contains "CRAFT" or "STRUCTURE" -> CAS
- primary_class_cd_desc contains "EXPRESSION" -> EOI
- primary_class_cd_desc contains "ENGLISH" or "CONVENTIONS" -> SEC

## Complete Refresh Process

To completely refresh the question bank from College Board:

```bash
cd backend

# 1. Fetch fresh data from API
python scripts/fetch_math.py --fresh
python scripts/fetch_reading.py --fresh

# 2. Clear existing data (optional)
psql postgresql://sat_user:sat_password@localhost:5433/sat_tutor \
  -c "TRUNCATE questions, skills CASCADE;"

# 3. Import to database
python scripts/import_questions.py --all
```

## Re-normalize Without Re-fetching

If you need to re-normalize existing core data (e.g., after script changes):

```python
import json

# For math
with open('data/math_core.json') as f:
    core = json.load(f)

# Apply normalize function to each record
norm = []
for uid, rec in core.items():
    rec['uId'] = uid
    norm.append(normalize(rec))

with open('data/math_norm.json', 'w') as f:
    json.dump(norm, f, indent=2)
```

## Data Statistics

### Current Import

| Metric | Math | Reading | Total |
|--------|------|---------|-------|
| Total Questions | 1,681 | 1,590 | 3,271 |
| With Explanations | 1,222 (73%) | 1,590 (100%) | 2,812 (86%) |
| With SVG Graphs | 192 | 54 | 246 |
| MCQ Type | 389 | 1,590 | 1,979 |
| SPR Type | 1,292 | 0 | 1,292 |

### Difficulty Distribution

| Difficulty | Math | Reading |
|------------|------|---------|
| Easy | 616 (37%) | 557 (35%) |
| Medium | 555 (33%) | 534 (34%) |
| Hard | 510 (30%) | 499 (31%) |

### Skills Created

| Domain | Skills | Questions |
|--------|--------|-----------|
| H (Algebra) | 5 | 561 |
| P (Problem Solving) | 3 | 477 |
| Q (Advanced Math) | 7 | 374 |
| S (Additional Topics) | 4 | 269 |
| INI (Information and Ideas) | 5 | 821 |
| CAS (Craft and Structure) | 3 | 412 |
| SEC (Standard English) | 2 | 357 |

## Troubleshooting

### Connection Errors

If fetch scripts fail with connection errors:
- Check internet connection
- The College Board API may rate limit requests
- Scripts include retry logic and delays

### Import Errors

Common import errors:
- **Duplicate key**: Question already exists (skipped)
- **Missing domain**: Skill code doesn't map to known domain
- **Invalid JSON**: Malformed choices or correct answer

### Verification Queries

```sql
-- Check import results
SELECT
    subject_area,
    COUNT(*) as total,
    COUNT(explanation_html) as with_explanation
FROM questions
GROUP BY subject_area;

-- Check for missing explanations
SELECT external_id, difficulty
FROM questions
WHERE explanation_html IS NULL
LIMIT 10;

-- Verify skill mapping
SELECT s.code, s.name, COUNT(q.id)
FROM skills s
LEFT JOIN questions q ON q.skill_id = s.id
GROUP BY s.code, s.name
ORDER BY COUNT(q.id) DESC;
```
