# Database Schema Documentation

Complete documentation for the SAT Tutoring Platform PostgreSQL database.

## Connection

```bash
psql postgresql://sat_user:sat_password@localhost:5433/sat_tutor
```

## Overview

The database consists of 13 tables organized into four functional areas:

| Area | Tables |
|------|--------|
| Question Bank | questions, domains, subdomains, skills, question_versions, question_relations |
| User Management | users |
| Student Progress | student_responses, student_skills |
| Test System | test_sessions, test_questions, assignments, assignment_questions |

## Current Data

| Table | Row Count | Description |
|-------|-----------|-------------|
| questions | 3,271 | SAT questions |
| domains | 8 | Content domains |
| skills | 29 | Granular skills |
| subdomains | 0 | Not currently populated |
| users | 0 | User accounts |
| student_responses | 0 | Answer records |
| student_skills | 0 | Mastery tracking |
| test_sessions | 0 | Test instances |
| test_questions | 0 | Questions in tests |
| assignments | 0 | Tutor assignments |
| assignment_questions | 0 | Questions in assignments |
| question_versions | 0 | Version history |
| question_relations | 0 | Related questions |

## Enum Types

### userrole
- `STUDENT`
- `TUTOR`
- `ADMIN`

### answertype
- `MCQ` - Multiple Choice Question
- `SPR` - Student-Produced Response

### difficultylevel
- `EASY`
- `MEDIUM`
- `HARD`

### subjectarea
- `MATH`
- `READING_WRITING`

### testtype
- `PRACTICE`
- `ASSIGNED`
- `DIAGNOSTIC`
- `FULL_LENGTH`

### teststatus
- `NOT_STARTED`
- `IN_PROGRESS`
- `PAUSED`
- `COMPLETED`
- `ABANDONED`

### assignmentstatus
- `PENDING`
- `IN_PROGRESS`
- `COMPLETED`
- `OVERDUE`

---

## Table Reference

### questions

The main table containing all SAT questions.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| external_id | VARCHAR(100) | NO | College Board question ID (unique) |
| ibn | VARCHAR(50) | YES | Item bank number |
| subject_area | subjectarea | NO | MATH or READING_WRITING |
| domain_id | INTEGER | YES | Foreign key to domains |
| subdomain_id | INTEGER | YES | Foreign key to subdomains |
| skill_id | INTEGER | YES | Foreign key to skills |
| answer_type | answertype | NO | MCQ or SPR |
| difficulty | difficultylevel | YES | EASY, MEDIUM, or HARD |
| score_band_range | VARCHAR(20) | YES | Score band (1-8) |
| prompt_html | TEXT | NO | Question HTML (includes SVG, MathML) |
| choices_json | JSONB | YES | MCQ answer choices as HTML array |
| correct_answer_json | JSONB | NO | Correct answer in JSON format |
| explanation_html | TEXT | YES | Full explanation with worked solution |
| irt_difficulty_b | FLOAT | YES | IRT difficulty parameter (TODO) |
| irt_discrimination_a | FLOAT | YES | IRT discrimination parameter (TODO) |
| irt_guessing_c | FLOAT | YES | IRT guessing parameter (default 0.25) |
| is_active | BOOLEAN | NO | Soft delete flag |
| is_verified | BOOLEAN | NO | Manual verification flag |
| raw_import_json | JSONB | YES | Original import data |
| import_batch_id | VARCHAR(50) | YES | Import batch identifier |
| imported_at | TIMESTAMP | YES | Import timestamp |
| version | INTEGER | NO | Version counter |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |
| deleted_at | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:**
- `ix_questions_external_id` (unique)
- `ix_questions_domain_difficulty`
- `ix_questions_skill_difficulty`
- `ix_questions_subject_active`
- `ix_questions_type_difficulty`

**Answer Formats:**

MCQ (Multiple Choice):
```json
{
  "index": 2
}
```
The index is 0-based, referring to the position in choices_json.

SPR (Student-Produced Response):
```json
{
  "answers": ["3", "3.0", "6/2"]
}
```
Multiple equivalent answers may be accepted.

**Content Types in prompt_html:**
- Plain HTML text
- MathML equations (wrapped in `<math>` tags)
- SVG graphics (coordinate planes, graphs, geometric figures)
- HTML tables (data tables)
- Passages (for reading comprehension)

---

### domains

Top-level SAT content categories.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | INTEGER | NO | Primary key (auto-increment) |
| code | VARCHAR(10) | NO | Domain code (unique) |
| name | VARCHAR(100) | NO | Display name |
| subject_area | subjectarea | NO | MATH or READING_WRITING |
| description | TEXT | YES | Optional description |
| display_order | INTEGER | NO | UI ordering |
| is_active | BOOLEAN | NO | Active flag |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Current Data:**

| Code | Name | Subject | Questions |
|------|------|---------|-----------|
| H | Heart of Algebra | MATH | 561 |
| P | Problem Solving and Data Analysis | MATH | 477 |
| Q | Passport to Advanced Math | MATH | 374 |
| S | Additional Topics in Math | MATH | 269 |
| INI | Information and Ideas | READING_WRITING | 821 |
| CAS | Craft and Structure | READING_WRITING | 412 |
| SEC | Standard English Conventions | READING_WRITING | 357 |
| EOI | Expression of Ideas | READING_WRITING | 0 |

---

### subdomains

Second-level content classification (not currently populated).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | INTEGER | NO | Primary key (auto-increment) |
| domain_id | INTEGER | NO | Foreign key to domains |
| code | VARCHAR(20) | NO | Subdomain code |
| name | VARCHAR(150) | NO | Display name |
| description | TEXT | YES | Optional description |
| display_order | INTEGER | NO | UI ordering |
| is_active | BOOLEAN | NO | Active flag |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Unique Constraint:** (domain_id, code)

---

### skills

Granular skill categories for mastery tracking.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | INTEGER | NO | Primary key (auto-increment) |
| subdomain_id | INTEGER | YES | Foreign key to subdomains |
| domain_id | INTEGER | YES | Foreign key to domains |
| code | VARCHAR(30) | NO | Skill code (unique) |
| name | VARCHAR(200) | NO | Display name |
| description | TEXT | YES | Optional description |
| primary_class_desc | VARCHAR(200) | YES | Primary class description |
| display_order | INTEGER | NO | UI ordering |
| is_active | BOOLEAN | NO | Active flag |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Current Math Skills:**

| Code | Name | Questions |
|------|------|-----------|
| H.A. | Linear equations in one variable | 104 |
| H.B. | Linear functions | 151 |
| H.C. | Linear equations in two variables | 124 |
| H.D. | Systems of two linear equations in two variables | 112 |
| H.E. | Linear inequalities in one or two variables | 70 |
| P.A. | Equivalent expressions | 102 |
| P.B. | Nonlinear equations in one variable and systems of equations in two variables | 148 |
| P.C. | Nonlinear functions | 227 |
| Q.A. | Ratios, rates, proportional relationships, and units | 84 |
| Q.B. | Percentages | 76 |
| Q.C. | One-variable data: Distributions and measures of center and spread | 73 |
| Q.D. | Two-variable data: Models and scatterplots | 63 |
| Q.E. | Probability and conditional probability | 43 |
| Q.F. | Inference from sample statistics and margin of error | 24 |
| Q.G. | Evaluating statistical claims: Observational studies and experiments | 11 |
| S.A. | Area and volume | 86 |
| S.B. | Lines, angles, and triangles | 79 |
| S.C. | Right triangles and trigonometry | 54 |
| S.D. | Circles | 50 |

**Current Reading/Writing Skills:**

| Code | Name | Questions |
|------|------|-----------|
| CID | Central Ideas and Details | 116 |
| INF | Inferences | 117 |
| COE | Command of Evidence | 245 |
| SYN | Rhetorical Synthesis | 182 |
| TRA | Transitions | 161 |
| WIC | Words in Context | 226 |
| TSP | Text Structure and Purpose | 130 |
| CTC | Cross-Text Connections | 56 |
| BOU | Boundaries | 180 |
| FSS | Form, Structure, and Sense | 177 |

---

### users

User accounts for students, tutors, and administrators.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| email | VARCHAR(255) | NO | Login email (unique) |
| password_hash | VARCHAR(255) | NO | Bcrypt password hash |
| role | userrole | NO | STUDENT, TUTOR, or ADMIN |
| is_active | BOOLEAN | NO | Account active flag |
| is_verified | BOOLEAN | NO | Email verified flag |
| first_name | VARCHAR(100) | NO | First name |
| last_name | VARCHAR(100) | NO | Last name |
| last_login_at | TIMESTAMP | YES | Last login timestamp |
| profile_data | JSONB | NO | Flexible profile data |
| tutor_id | UUID | YES | Foreign key to users (for students) |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |
| deleted_at | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:**
- `ix_users_email` (unique)
- `ix_users_role`
- `ix_users_role_active`
- `ix_users_tutor_active`

---

### student_responses

Records of student answers to questions.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| student_id | UUID | NO | Foreign key to users |
| question_id | UUID | NO | Foreign key to questions |
| test_session_id | UUID | YES | Foreign key to test_sessions |
| response_json | JSONB | NO | Student's answer |
| is_correct | BOOLEAN | NO | Correctness flag |
| time_spent_seconds | INTEGER | YES | Time spent on question |
| started_at | TIMESTAMP | YES | When student started question |
| submitted_at | TIMESTAMP | NO | When student submitted answer |
| confidence_level | INTEGER | YES | Student confidence (1-5) |
| flagged_for_review | BOOLEAN | NO | Flagged by student |
| student_notes | TEXT | YES | Student's notes |
| ability_estimate_before | FLOAT | YES | IRT ability before (TODO) |
| ability_estimate_after | FLOAT | YES | IRT ability after (TODO) |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Indexes:**
- `ix_responses_student_question`
- `ix_responses_student_correct`
- `ix_responses_session_order`
- `ix_responses_student_submitted`

---

### student_skills

Mastery level tracking per student-skill pair.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| student_id | UUID | NO | Foreign key to users |
| skill_id | INTEGER | NO | Foreign key to skills |
| mastery_level | FLOAT | NO | Mastery 0.0 to 1.0 |
| questions_attempted | INTEGER | NO | Total attempts |
| questions_correct | INTEGER | NO | Correct answers |
| last_practiced_at | TIMESTAMP | YES | Last practice time |
| ability_theta | FLOAT | YES | IRT ability estimate (TODO) |
| ability_se | FLOAT | YES | Standard error (TODO) |
| responses_for_estimate | INTEGER | NO | Responses used for IRT (TODO) |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Unique Constraint:** (student_id, skill_id)

---

### test_sessions

Practice and assigned test instances.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| student_id | UUID | NO | Foreign key to users |
| assignment_id | UUID | YES | Foreign key to assignments |
| test_type | testtype | NO | PRACTICE, ASSIGNED, DIAGNOSTIC, FULL_LENGTH |
| status | teststatus | NO | NOT_STARTED, IN_PROGRESS, PAUSED, COMPLETED, ABANDONED |
| subject_area | subjectarea | YES | MATH, READING_WRITING, or NULL for both |
| title | VARCHAR(200) | YES | Test title |
| total_questions | INTEGER | NO | Number of questions |
| question_config | JSONB | YES | Question selection configuration |
| time_limit_minutes | INTEGER | YES | Time limit |
| started_at | TIMESTAMP | YES | Test start time |
| completed_at | TIMESTAMP | YES | Test completion time |
| time_spent_seconds | INTEGER | YES | Total time spent |
| questions_answered | INTEGER | NO | Questions answered |
| questions_correct | INTEGER | NO | Correct answers |
| score_percentage | FLOAT | YES | Percentage score |
| scaled_score | INTEGER | YES | SAT scaled score |
| current_question_index | INTEGER | NO | Current position |
| session_state | JSONB | YES | Session state for resume |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Indexes:**
- `ix_test_sessions_student_status`
- `ix_test_sessions_student_type`

---

### test_questions

Questions assigned to a test session.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| test_session_id | UUID | NO | Foreign key to test_sessions |
| question_id | UUID | NO | Foreign key to questions |
| question_order | INTEGER | NO | Position in test |
| is_answered | BOOLEAN | NO | Answered flag |
| is_flagged | BOOLEAN | NO | Flagged for review |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Unique Constraints:**
- (test_session_id, question_order)
- (test_session_id, question_id)

---

### assignments

Tutor-created assignments for students.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| tutor_id | UUID | NO | Foreign key to users (tutor) |
| student_id | UUID | NO | Foreign key to users (student) |
| title | VARCHAR(200) | NO | Assignment title |
| instructions | TEXT | YES | Tutor instructions |
| status | assignmentstatus | NO | PENDING, IN_PROGRESS, COMPLETED, OVERDUE |
| due_date | TIMESTAMP | YES | Due date |
| assigned_at | TIMESTAMP | NO | Assignment date |
| started_at | TIMESTAMP | YES | Start time |
| completed_at | TIMESTAMP | YES | Completion time |
| question_count | INTEGER | YES | Number of questions |
| question_config | JSONB | YES | Question selection config |
| time_limit_minutes | INTEGER | YES | Time limit |
| target_score | INTEGER | YES | Target score |
| actual_score | INTEGER | YES | Achieved score |
| tutor_feedback | TEXT | YES | Tutor feedback |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Indexes:**
- `ix_assignments_student_status`
- `ix_assignments_tutor_status`
- `ix_assignments_due_date`

---

### assignment_questions

Questions in an assignment.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| assignment_id | UUID | NO | Foreign key to assignments |
| question_id | UUID | NO | Foreign key to questions |
| question_order | INTEGER | NO | Position in assignment |
| is_required | BOOLEAN | NO | Required flag |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Unique Constraints:**
- (assignment_id, question_order)
- (assignment_id, question_id)

---

### question_versions

Version history for question auditing.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| question_id | UUID | NO | Foreign key to questions |
| version_number | INTEGER | NO | Version counter |
| change_reason | VARCHAR(500) | YES | Reason for change |
| content_snapshot | JSONB | NO | Full question state |
| changed_by_id | UUID | YES | Foreign key to users |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Unique Constraint:** (question_id, version_number)

---

### question_relations

Relationships between questions.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| question_id | UUID | NO | Primary key, Foreign key to questions |
| related_question_id | UUID | NO | Primary key, Foreign key to questions |
| relation_type | VARCHAR(50) | NO | similar, prerequisite, follow_up |
| similarity_score | FLOAT | YES | Similarity 0.0 to 1.0 |
| created_at | TIMESTAMP | NO | Record creation time |
| updated_at | TIMESTAMP | NO | Last update time |

**Check Constraint:** question_id != related_question_id

---

## Entity Relationships

```
users
  |-- tutor_id --> users (self-reference for student-tutor)
  |-- student_responses
  |-- student_skills
  |-- test_sessions
  |-- assignments (as tutor)
  |-- assignments (as student)
  |-- question_versions (changed_by)

domains
  |-- subdomains
  |-- skills
  |-- questions

subdomains
  |-- skills
  |-- questions

skills
  |-- questions
  |-- student_skills

questions
  |-- question_versions
  |-- question_relations (both sides)
  |-- student_responses
  |-- test_questions
  |-- assignment_questions

test_sessions
  |-- test_questions
  |-- student_responses
  |-- assignments (optional)

assignments
  |-- assignment_questions
  |-- test_sessions
```

---

## Example Queries

### Basic Queries

```sql
-- Count questions by subject
SELECT subject_area, COUNT(*)
FROM questions
GROUP BY subject_area;

-- Count questions by difficulty
SELECT difficulty, COUNT(*)
FROM questions
GROUP BY difficulty
ORDER BY difficulty;

-- Count questions by domain
SELECT d.name, COUNT(q.id)
FROM domains d
LEFT JOIN questions q ON q.domain_id = d.id
GROUP BY d.name
ORDER BY COUNT(q.id) DESC;
```

### Finding Questions

```sql
-- Questions with SVG graphs
SELECT external_id, difficulty, LEFT(prompt_html, 100)
FROM questions
WHERE prompt_html LIKE '%<svg%'
LIMIT 10;

-- Questions by skill
SELECT q.external_id, q.difficulty, s.name as skill
FROM questions q
JOIN skills s ON q.skill_id = s.id
WHERE s.code = 'H.D.'
ORDER BY q.difficulty;

-- Questions with explanations
SELECT external_id, LEFT(explanation_html, 200)
FROM questions
WHERE explanation_html IS NOT NULL
LIMIT 5;

-- Random practice set
SELECT external_id, prompt_html, difficulty
FROM questions
WHERE subject_area = 'MATH'
  AND difficulty = 'MEDIUM'
ORDER BY RANDOM()
LIMIT 10;
```

### Full Question Data

```sql
-- Get complete question with explanation
SELECT
    q.external_id,
    q.subject_area,
    q.difficulty,
    q.answer_type,
    d.name as domain,
    s.name as skill,
    q.prompt_html,
    q.choices_json,
    q.correct_answer_json,
    q.explanation_html
FROM questions q
JOIN domains d ON q.domain_id = d.id
JOIN skills s ON q.skill_id = s.id
WHERE q.external_id = '00d5ab1d-b64c-4161-97b7-890e404262ac';
```

### Export Data

```sql
-- Export questions as JSON
COPY (
  SELECT row_to_json(t) FROM (
    SELECT external_id, prompt_html, explanation_html, difficulty
    FROM questions
    WHERE explanation_html IS NOT NULL
    LIMIT 5
  ) t
) TO STDOUT;

-- Export to CSV
COPY (
  SELECT external_id, subject_area, difficulty, answer_type
  FROM questions
) TO '/tmp/questions.csv' WITH CSV HEADER;
```

### Statistics

```sql
-- Difficulty distribution by subject
SELECT
    subject_area,
    difficulty,
    COUNT(*) as count,
    ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER (PARTITION BY subject_area) * 100, 1) as percentage
FROM questions
GROUP BY subject_area, difficulty
ORDER BY subject_area, difficulty;

-- Skill distribution
SELECT
    s.name as skill,
    s.code,
    COUNT(q.id) as questions,
    COUNT(q.explanation_html) as with_explanations
FROM skills s
LEFT JOIN questions q ON q.skill_id = s.id
GROUP BY s.name, s.code
ORDER BY questions DESC;
```
