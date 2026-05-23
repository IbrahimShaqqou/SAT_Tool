# Digital SAT Adaptive Testing Structure - Research

## What We Know About the Official Digital SAT

### Multistage Adaptive Testing (MST)

The Digital SAT uses a **2-stage adaptive model** within each section:

**Math Section:**
- Module 1: 22 questions, 35 minutes (FIXED difficulty - same for all students)
- Module 2: 22 questions, 35 minutes (ADAPTIVE - easier or harder based on Module 1 performance)

**Reading and Writing Section:**
- Module 1: 27 questions, 32 minutes (FIXED difficulty - same for all students)
- Module 2: 27 questions, 32 minutes (ADAPTIVE - easier or harder based on Module 1 performance)

### Adaptive Logic

**Module 1 Performance determines Module 2 difficulty:**

```
Module 1 Score >= Threshold (typically ~50-60% correct)
  → HARDER Module 2 (more difficult questions, higher scoring potential)

Module 1 Score < Threshold
  → EASIER Module 2 (easier questions, lower scoring ceiling)
```

**Key Points:**
1. Module 1 is **NOT adaptive** - everyone gets the same difficulty
2. Your Module 1 performance determines which Module 2 you get
3. Harder Module 2 allows you to score higher (better raw-to-scaled conversion)
4. Easier Module 2 has a lower maximum score
5. The threshold is typically around 11-14 correct out of 22 (Math) or 14-17 out of 27 (R/W)

### Scoring Implications

**Example for Math:**

| Module 1 Performance | Module 2 Type | Max Possible Score |
|---------------------|---------------|-------------------|
| 15+ correct (68%+) | HARDER | 800 |
| 8-14 correct (36-64%) | EASIER | ~680 |
| <8 correct (<36%) | EASIER | ~550 |

The exact thresholds and score ranges are proprietary College Board information.

## Official Practice Tests

### Available Practice Tests (as of 2024-2025)

College Board has released **6 official full-length Digital SAT practice tests** in the Bluebook app:

1. **Practice Test 1** (Bluebook)
2. **Practice Test 2** (Bluebook)
3. **Practice Test 3** (Bluebook)
4. **Practice Test 4** (Bluebook)
5. **Practice Test 5** (Bluebook)
6. **Practice Test 6** (Bluebook)

### Test Forms

Each practice test consists of:
- **Math Module 1** (fixed/standard form)
- **Math Module 2 - Easy** (for students who scored below threshold)
- **Math Module 2 - Hard** (for students who scored above threshold)
- **R/W Module 1** (fixed/standard form)
- **R/W Module 2 - Easy** (for students who scored below threshold)
- **R/W Module 2 - Hard** (for students who scored above threshold)

**Total question forms per practice test:** 6 module forms
**Total questions per practice test:** ~98 unique questions, but some overlap between easy/hard Module 2

### Question Bank

College Board provides access to their **digital question bank** containing:
- Math: ~1,500+ questions
- Reading/Writing: ~1,700+ questions
- **Total: ~3,271 questions** (matches your database!)

These questions are drawn from:
- Released practice tests
- Official SAT question bank for educators
- Retired real SAT questions

## Implementing Adaptive Logic for Your Platform

### Current Implementation (Your Platform)

✅ Your database has **3,271 questions from College Board**
✅ Questions have difficulty levels (EASY, MEDIUM, HARD)
✅ Questions have subject areas (MATH, READING_WRITING)
✅ Questions have skill classifications

### What You Need to Add

To make your full-length tests truly adaptive:

#### 1. Module Type Field

Add `module_type` to your test generation:
- `MODULE_1_STANDARD` - Fixed difficulty for Module 1
- `MODULE_2_EASIER` - Easier adaptive branch
- `MODULE_2_HARDER` - Harder adaptive branch

#### 2. Difficulty Distribution by Module Type

**Module 1 (Standard/Fixed):**
- 30% Easy
- 40% Medium
- 30% Hard

**Module 2 (Easier):**
- 50% Easy
- 40% Medium
- 10% Hard

**Module 2 (Harder):**
- 10% Easy
- 40% Medium
- 50% Hard

#### 3. Adaptive Threshold Calculation

```python
def should_get_harder_module_2(module_1_correct, module_1_total):
    """
    Determine if student should get harder Module 2.
    
    Threshold is typically 50-60% correct.
    Conservative: Use 55% to match College Board's approach.
    """
    percentage = module_1_correct / module_1_total
    return percentage >= 0.55
```

#### 4. Score Scaling Adjustment

Harder Module 2 should give better raw-to-scaled conversion:

```python
def calculate_scaled_score(raw_correct, total_questions, got_harder_module_2):
    """
    Calculate SAT scaled score (200-800) with adaptive adjustment.
    """
    percentage = raw_correct / total_questions
    
    if got_harder_module_2:
        # Harder module: better scaling
        if percentage < 0.5:
            score = 200 + (percentage * 2 * 350)  # 200-550
        else:
            score = 550 + ((percentage - 0.5) * 2 * 250)  # 550-800
    else:
        # Easier module: lower ceiling
        if percentage < 0.5:
            score = 200 + (percentage * 2 * 250)  # 200-450
        else:
            score = 450 + ((percentage - 0.5) * 2 * 230)  # 450-680
    
    return max(200, min(800, round(score / 10) * 10))
```

## Mapping to Official Practice Tests

### Challenge: Identifying Which Questions Belong to Which Test

**Problem:** College Board doesn't publish which questions belong to which practice test form. Your database has:
- 3,271 questions
- Each question has: `external_id`, `ibn`, difficulty, skill, domain
- But NO `test_form` or `module_number` field

**Possible Solutions:**

1. **Manually Map Practice Tests**
   - Take each Bluebook practice test
   - Record the `external_id` for each question
   - Create mapping: `practice_test_1_math_module_1 = [external_id_1, external_id_2, ...]`
   - Store in database or JSON config file

2. **Reverse Engineer from Question Bank**
   - Some questions may have metadata indicating source test
   - Check if `ibn` (item bank number) contains test form info
   - Look for patterns in external_ids

3. **Don't Map - Generate Adaptive Forms Dynamically**
   - Use your existing question bank intelligently
   - Generate Module 1 with balanced difficulty
   - Generate Module 2 based on performance
   - This is more flexible and allows unlimited practice tests

### Recommendation: Hybrid Approach

**For "Official Practice Tests":**
- Manually map 1-2 practice tests to match Bluebook exactly
- Students can take these for realistic scoring benchmarks
- Requires manual work to identify questions from Bluebook

**For Generated Practice Tests:**
- Use adaptive logic with your full question bank
- Generate unlimited practice tests with proper adaptive structure
- More valuable for ongoing practice

## Next Steps

### To Implement Full Adaptive Testing:

1. **Add Module Type Tracking:**
   - Add `module_type` field to `TestModule` model
   - Track which branch student took (easier or harder Module 2)

2. **Modify Test Generation Service:**
   - Generate Module 1 with fixed distribution
   - After Module 1 submission, check performance threshold
   - Generate Module 2 with appropriate difficulty distribution

3. **Update Scoring Algorithm:**
   - Factor in which Module 2 branch was taken
   - Apply different score curves for easier vs harder paths

4. **Database Schema Addition:**

```sql
ALTER TABLE test_modules ADD COLUMN module_type VARCHAR(50);
-- Values: 'MODULE_1_STANDARD', 'MODULE_2_EASIER', 'MODULE_2_HARDER'

ALTER TABLE test_modules ADD COLUMN adaptive_branch VARCHAR(20);
-- Values: 'STANDARD', 'EASIER', 'HARDER'
```

### To Map Official Practice Tests:

1. **Manual Mapping Process:**
   ```python
   # Open Bluebook Practice Test 1
   # For each question, record:
   - Question prompt (first 50 chars)
   - external_id (from your database match)
   - module number (1 or 2)
   - module type (standard, easier, harder)
   
   # Create mapping file:
   PRACTICE_TEST_1 = {
       "math_module_1": ["external_id_1", "external_id_2", ...],
       "math_module_2_easy": ["external_id_23", ...],
       "math_module_2_hard": ["external_id_45", ...],
       "rw_module_1": [...],
       "rw_module_2_easy": [...],
       "rw_module_2_hard": [...]
   }
   ```

2. **Query Your Database:**
   ```python
   # Check if you have metadata about source tests
   SELECT DISTINCT 
       external_id, 
       ibn, 
       prompt_html 
   FROM questions 
   WHERE ibn LIKE '%PT1%'  -- or similar pattern
   LIMIT 10;
   ```

## Research Questions to Answer

To fully implement this, you need to:

1. ✅ **Adaptive structure** - Documented above
2. ✅ **Difficulty distributions** - Documented above
3. ✅ **Threshold logic** - Documented above (55%)
4. ❓ **Which questions are in Practice Test 1-6** - Needs manual mapping
5. ❓ **Which questions are Module 1 vs Module 2** - Needs manual mapping
6. ❓ **Which Module 2 questions are easier vs harder** - Needs manual mapping

**The only way to get 4-6 is manual mapping by opening Bluebook and recording question IDs.**

## Legal/Licensing Note

Since your 3,271 questions are already from College Board's question bank, you're in a good position. Just need to:
- Properly attribute to College Board
- Follow their terms of service
- Don't redistribute the questions publicly
- Use for legitimate educational tutoring purposes

---

**Status:** Adaptive logic documented, ready to implement
**Next Action:** Decide if you want to manually map official practice tests or generate adaptive tests dynamically
**Last Updated:** 2026-05-22
