# SAT Practice Test Mappings

This directory contains mappings between official College Board SAT Practice Tests and questions in our database.

## File Structure

Each mapping file is named: `practice_test_{test_number}_modules_{variant}.json`

Example: `practice_test_4_modules_1_2_easy.json`

## Mapping Format

```json
{
  "test_number": 4,
  "test_name": "SAT Practice 4",
  "date_extracted": "2026-05-22",
  "note": "Module 2 is the EASIER version (student answered all Module 1 questions wrong)",
  
  "rw_module_1": ["uId1", "uId2", ...],
  "rw_module_2_easier": ["uId3", "uId4", ...],
  "math_module_1": ["uId5", "uId6", ...],
  "math_module_2_easier": ["uId7", "uId8", ...],
  
  "matches": [
    {
      "questionNumber": 1,
      "section": "rw",
      "module": 1,
      "uId": "7a55e35d-d8ae-488b-9bcc-08cdf7b74f33",
      "similarity": 0.9367,
      "preview": "Although critics believed...",
      "manual": false
    },
    ...
  ]
}
```

## SAT Structure

The digital SAT has a 2-stage adaptive format:

### Reading and Writing
- **Module 1**: 27 questions (fixed difficulty)
- **Module 2**: 27 questions (adapts based on Module 1 performance)
  - Students scoring ~55%+ on Module 1 get **harder** Module 2
  - Students scoring below ~55% on Module 1 get **easier** Module 2

### Math
- **Module 1**: 22 questions (fixed difficulty)
- **Module 2**: 22 questions (adapts based on Module 1 performance)
  - Students scoring ~55%+ on Module 1 get **harder** Module 2
  - Students scoring below ~55% on Module 1 get **easier** Module 2

**Total**: 98 questions per test

## Extraction Process

1. **Manual Test Taking**: Student takes practice test on mypractice.collegeboard.org
2. **Web Scraping**: JavaScript console script extracts all questions from results page
3. **Fuzzy Matching**: Python script matches extracted text to database questions (60% similarity threshold)
4. **Manual Review**: Remaining unmatched questions manually identified
5. **Verification**: Spot-check matches to confirm accuracy

## Match Quality

### Practice Test 4 (Modules 1 & 2 Easy)
- **Total Questions**: 98
- **Automatically Matched**: 94 (96%)
- **Manually Matched**: 3 (3%)
- **Unmatched**: 1 (1%)
- **Overall Success**: 97/98 (99%)

### Module Breakdown
- **RW Module 1**: 27/27 questions (100%)
- **RW Module 2 (easier)**: 26/27 questions (96%)
- **Math Module 1**: 22/22 questions (100%)
- **Math Module 2 (easier)**: 22/22 questions (100%)

### Unmatched Questions
- **Q90** (Math Module 2): Question not found in current database
  - Likely a newer question added after database last updated
  - May need database refresh to capture this question

## Using the Mappings

### Get All Questions for a Practice Test

```python
import json

# Load mapping
with open('data/practice_test_mappings/practice_test_4_modules_1_2_easy.json') as f:
    mapping = json.load(f)

# Get all RW Module 1 question uIds
rw_m1_uids = mapping['rw_module_1']  # 27 questions

# Load questions from database
with open('data/reading_core.json') as f:
    db = json.load(f)

rw_m1_questions = [db[uid] for uid in rw_m1_uids]
```

### Display Questions in Order

```python
# Get questions in test order
for match in mapping['matches']:
    if match['section'] == 'rw' and match['module'] == 1:
        uid = match['uId']
        question = db[uid]
        print(f"Q{match['questionNumber']}: {question['content']['stimulus'][:100]}...")
```

### Filter by Difficulty

```python
# Get only hard questions from Math Module 1
math_m1_questions = [db[uid] for uid in mapping['math_module_1']]
hard_questions = [q for q in math_m1_questions if q['difficulty'] == 'hard']
```

## Future Work

### Complete Mappings Needed
- **Practice Test 4**: Module 2 (harder version) - need student to retake scoring well
- **Practice Tests 1, 2, 3, 5, 6**: All modules (both easy and hard variants)

### Automation Improvements
- Lower similarity threshold for initial matching
- Better HTML cleaning (remove data-ssml tags)
- OCR for image-based questions (graphs, charts)
- Automated verification by cross-checking answer keys

### Database Updates
- Refresh question bank to capture newest questions
- Add practice test metadata fields to questions
- Tag questions with "appears in Practice Test X Module Y"

## Scripts

- `match_practice_test.py`: Fuzzy text matching script
- `merge_manual_matches.py`: Adds manually identified matches
- `manual_matches.json`: Manual match overrides

## Notes

- Bluebook (native app) uses different question IDs than the API
- Network interception doesn't work (encrypted test packages)
- MyPractice web scraping is the most reliable extraction method
- Text matching works well (93%+ similarity for correct matches)
- Answer choices improve matching accuracy significantly
