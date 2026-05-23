# Adaptive SAT Testing - Implementation Plan

## Summary

Transform the current full-length test system to use **2-stage adaptive testing** matching the official Digital SAT Bluebook format.

## What Changes

### Current System (Non-Adaptive)
- All 4 modules generated at once
- Same difficulty distribution for all students
- Simple linear score conversion

### New System (Adaptive)
- Module 1 generated with fixed difficulty
- Module 2 difficulty determined by Module 1 performance
- Separate score curves for easier vs harder Module 2

## Database Changes

### Migration: Add Module Type Tracking

```sql
-- File: /backend/alembic/versions/20260523_adaptive_modules.py

ALTER TABLE test_modules 
ADD COLUMN module_type VARCHAR(50),
ADD COLUMN got_harder_module_2 BOOLEAN DEFAULT NULL;

-- module_type values:
-- 'MODULE_1_STANDARD' - Fixed difficulty Module 1
-- 'MODULE_2_EASIER' - Adaptive easier branch
-- 'MODULE_2_HARDER' - Adaptive harder branch

-- got_harder_module_2: NULL for Module 1, TRUE/FALSE for Module 2
```

## Code Changes

### 1. Update Test Generation Service

**File:** `/backend/app/services/test_generation_service.py`

#### Current Flow:
```
generate_full_length_sat()
  → Generate all 4 modules at once
  → Return complete test
```

#### New Flow:
```
generate_full_length_sat()
  → Generate Module 1 for Math (STANDARD)
  → Generate Module 1 for R/W (STANDARD)
  → Module 2 slots remain EMPTY
  → Return test with only Module 1s
  
submit_module(module_1_id)
  → Calculate performance
  → Determine: easier or harder Module 2?
  → Generate appropriate Module 2
  → Link to test session
```

#### Implementation:

```python
def generate_full_length_sat(student_id: UUID) -> TestSession:
    """
    Generate adaptive full-length SAT.
    Only creates Module 1s - Module 2s generated after Module 1 submission.
    """
    test_session = TestSession(
        student_id=student_id,
        test_type=TestType.FULL_LENGTH,
        status=TestStatus.NOT_STARTED,
        title="Full-Length SAT Practice Test",
        # Note: total_questions unknown until Module 2s generated
        total_questions=None,
        time_limit_minutes=None
    )
    self.db.add(test_session)
    self.db.flush()
    
    # Generate Math Module 1 (STANDARD - fixed difficulty)
    math_m1_questions = self._select_module_questions(
        subject_area=SubjectArea.MATH,
        num_questions=22,
        difficulty_distribution={'EASY': 0.30, 'MEDIUM': 0.40, 'HARD': 0.30},
        exclude_ids=[]
    )
    
    math_m1 = TestModule(
        test_session_id=test_session.id,
        module_number=1,
        subject_area=SubjectArea.MATH,
        title="Math Module 1",
        total_questions=22,
        time_limit_minutes=35,
        module_type='MODULE_1_STANDARD',
        question_ids=[str(q.id) for q in math_m1_questions],
        status=TestStatus.NOT_STARTED
    )
    self.db.add(math_m1)
    
    # Placeholder for Math Module 2 (will be generated after Module 1)
    math_m2 = TestModule(
        test_session_id=test_session.id,
        module_number=2,
        subject_area=SubjectArea.MATH,
        title="Math Module 2",
        total_questions=22,
        time_limit_minutes=35,
        module_type=None,  # Will be set when generated
        question_ids=[],   # Empty until generated
        status=TestStatus.NOT_STARTED
    )
    self.db.add(math_m2)
    
    # Generate R/W Module 1 (STANDARD - fixed difficulty)
    rw_m1_questions = self._select_module_questions(
        subject_area=SubjectArea.READING_WRITING,
        num_questions=27,
        difficulty_distribution={'EASY': 0.30, 'MEDIUM': 0.40, 'HARD': 0.30},
        exclude_ids=[]
    )
    
    rw_m1 = TestModule(
        test_session_id=test_session.id,
        module_number=3,
        subject_area=SubjectArea.READING_WRITING,
        title="Reading/Writing Module 1",
        total_questions=27,
        time_limit_minutes=32,
        module_type='MODULE_1_STANDARD',
        question_ids=[str(q.id) for q in rw_m1_questions],
        status=TestStatus.NOT_STARTED
    )
    self.db.add(rw_m1)
    
    # Placeholder for R/W Module 2
    rw_m2 = TestModule(
        test_session_id=test_session.id,
        module_number=4,
        subject_area=SubjectArea.READING_WRITING,
        title="Reading/Writing Module 2",
        total_questions=27,
        time_limit_minutes=32,
        module_type=None,
        question_ids=[],
        status=TestStatus.NOT_STARTED
    )
    self.db.add(rw_m2)
    
    # Add break
    break_obj = ModuleBreak(
        test_session_id=test_session.id,
        after_module_number=2,
        before_module_number=3,
        break_duration_minutes=10
    )
    self.db.add(break_obj)
    
    self.db.commit()
    self.db.refresh(test_session)
    
    return test_session


def submit_module(self, module_id: UUID, time_expired: bool = False) -> TestModule:
    """
    Submit module. If this is Module 1, generate adaptive Module 2.
    """
    module = self.db.query(TestModule).filter(
        TestModule.id == module_id
    ).first()
    
    if not module:
        raise ValueError(f"Module {module_id} not found")
    
    # Mark module as completed
    module.status = TestStatus.COMPLETED
    module.completed_at = datetime.now(timezone.utc)
    module.time_expired = time_expired
    
    if module.started_at:
        module.time_spent_seconds = int(
            (module.completed_at - module.started_at).total_seconds()
        )
    
    # Calculate module score
    responses = self.db.query(StudentResponse).filter(
        StudentResponse.test_session_id == module.test_session_id,
        StudentResponse.question_id.in_([UUID(qid) for qid in module.question_ids])
    ).all()
    
    module.questions_answered = len(responses)
    module.questions_correct = sum(1 for r in responses if r.is_correct)
    
    if module.questions_answered > 0:
        module.score_percentage = (
            module.questions_correct / module.questions_answered
        ) * 100
    
    # If this is Module 1, generate adaptive Module 2
    if module.module_type == 'MODULE_1_STANDARD':
        self._generate_adaptive_module_2(module)
    
    self.db.commit()
    self.db.refresh(module)
    
    return module


def _generate_adaptive_module_2(self, module_1: TestModule):
    """
    Generate Module 2 based on Module 1 performance.
    """
    # Determine threshold: 55% correct → harder module
    threshold = 0.55
    got_harder = (module_1.questions_correct / module_1.total_questions) >= threshold
    
    # Find the Module 2 placeholder
    module_2 = self.db.query(TestModule).filter(
        TestModule.test_session_id == module_1.test_session_id,
        TestModule.subject_area == module_1.subject_area,
        TestModule.module_number == module_1.module_number + 1
    ).first()
    
    if not module_2:
        raise ValueError("Module 2 placeholder not found")
    
    # Set difficulty distribution based on performance
    if got_harder:
        difficulty_distribution = {
            'EASY': 0.10,
            'MEDIUM': 0.40,
            'HARD': 0.50
        }
        module_2.module_type = 'MODULE_2_HARDER'
    else:
        difficulty_distribution = {
            'EASY': 0.50,
            'MEDIUM': 0.40,
            'HARD': 0.10
        }
        module_2.module_type = 'MODULE_2_EASIER'
    
    # Get questions already used in Module 1
    used_question_ids = [UUID(qid) for qid in module_1.question_ids]
    
    # Select questions for Module 2
    num_questions = module_2.total_questions
    module_2_questions = self._select_module_questions(
        subject_area=module_2.subject_area,
        num_questions=num_questions,
        difficulty_distribution=difficulty_distribution,
        exclude_ids=used_question_ids
    )
    
    # Update Module 2
    module_2.question_ids = [str(q.id) for q in module_2_questions]
    module_2.got_harder_module_2 = got_harder
    
    self.db.commit()


def _select_module_questions(
    self,
    subject_area: SubjectArea,
    num_questions: int,
    difficulty_distribution: dict,
    exclude_ids: List[UUID]
) -> List[Question]:
    """
    Select questions with specified difficulty distribution.
    
    Args:
        subject_area: MATH or READING_WRITING
        num_questions: Total questions to select
        difficulty_distribution: Dict like {'EASY': 0.30, 'MEDIUM': 0.40, 'HARD': 0.30}
        exclude_ids: Questions to avoid
    """
    easy_count = int(num_questions * difficulty_distribution.get('EASY', 0.30))
    medium_count = int(num_questions * difficulty_distribution.get('MEDIUM', 0.40))
    hard_count = num_questions - easy_count - medium_count
    
    selected_questions = []
    
    for difficulty, target_count in [
        (DifficultyLevel.EASY, easy_count),
        (DifficultyLevel.MEDIUM, medium_count),
        (DifficultyLevel.HARD, hard_count)
    ]:
        questions = self.db.query(Question).filter(
            Question.is_active == True,
            Question.subject_area == subject_area,
            Question.difficulty == difficulty,
            ~Question.id.in_(exclude_ids + [q.id for q in selected_questions])
        ).order_by(func.random()).limit(target_count).all()
        
        selected_questions.extend(questions)
        
        # Fill shortfall from other difficulties if needed
        if len(questions) < target_count:
            shortfall = target_count - len(questions)
            backup = self.db.query(Question).filter(
                Question.is_active == True,
                Question.subject_area == subject_area,
                ~Question.id.in_(exclude_ids + [q.id for q in selected_questions])
            ).order_by(func.random()).limit(shortfall).all()
            selected_questions.extend(backup)
    
    random.shuffle(selected_questions)
    return selected_questions[:num_questions]
```

### 2. Update Score Calculation

```python
def calculate_test_score(self, test_session_id: UUID) -> Dict[str, Any]:
    """
    Calculate SAT score with adaptive adjustment.
    """
    test_session = self.db.query(TestSession).filter(
        TestSession.id == test_session_id
    ).first()
    
    modules = self.db.query(TestModule).filter(
        TestModule.test_session_id == test_session_id
    ).all()
    
    math_modules = [m for m in modules if m.subject_area == SubjectArea.MATH]
    rw_modules = [m for m in modules if m.subject_area == SubjectArea.READING_WRITING]
    
    # Check if student got harder Module 2
    math_got_harder = any(m.got_harder_module_2 for m in math_modules if m.got_harder_module_2 is not None)
    rw_got_harder = any(m.got_harder_module_2 for m in rw_modules if m.got_harder_module_2 is not None)
    
    math_score = self._calculate_section_score_adaptive(math_modules, math_got_harder)
    rw_score = self._calculate_section_score_adaptive(rw_modules, rw_got_harder)
    
    return {
        "math_score": math_score,
        "reading_writing_score": rw_score,
        "total_score": math_score + rw_score,
        "math_correct": sum(m.questions_correct for m in math_modules),
        "math_total": sum(m.total_questions for m in math_modules),
        "rw_correct": sum(m.questions_correct for m in rw_modules),
        "rw_total": sum(m.total_questions for m in rw_modules),
        "math_got_harder_module_2": math_got_harder,
        "rw_got_harder_module_2": rw_got_harder
    }


def _calculate_section_score_adaptive(
    self,
    modules: List[TestModule],
    got_harder_module_2: bool
) -> int:
    """
    Calculate scaled score with adaptive adjustment.
    """
    if not modules:
        return 200
    
    total_correct = sum(m.questions_correct for m in modules)
    total_questions = sum(m.total_questions for m in modules)
    
    if total_questions == 0:
        return 200
    
    percentage = total_correct / total_questions
    
    if got_harder_module_2:
        # Harder module: better scoring potential (200-800)
        if percentage < 0.5:
            score = 200 + (percentage * 2 * 350)  # 200-550
        else:
            score = 550 + ((percentage - 0.5) * 2 * 250)  # 550-800
    else:
        # Easier module: lower ceiling (200-680)
        if percentage < 0.5:
            score = 200 + (percentage * 2 * 250)  # 200-450
        else:
            score = 450 + ((percentage - 0.5) * 2 * 230)  # 450-680
    
    # Round to nearest 10
    score = round(score / 10) * 10
    
    return max(200, min(800, int(score)))
```

### 3. Update Frontend Results Display

**File:** `/frontend/src/pages/student/FullLengthResultsPage.jsx`

Add indicator showing which adaptive path was taken:

```jsx
{/* Adaptive Path Indicator */}
{results.math_got_harder_module_2 !== undefined && (
  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
    <h3 className="font-semibold text-gray-900 mb-2">
      Adaptive Test Path
    </h3>
    <div className="grid md:grid-cols-2 gap-4 text-sm">
      <div>
        <span className="font-medium">Math:</span>{' '}
        {results.math_got_harder_module_2 ? (
          <Badge variant="success">Harder Module 2</Badge>
        ) : (
          <Badge variant="warning">Easier Module 2</Badge>
        )}
      </div>
      <div>
        <span className="font-medium">Reading/Writing:</span>{' '}
        {results.rw_got_harder_module_2 ? (
          <Badge variant="success">Harder Module 2</Badge>
        ) : (
          <Badge variant="warning">Easier Module 2</Badge>
        )}
      </div>
    </div>
    <p className="text-xs text-gray-600 mt-2">
      The difficulty of Module 2 was determined by your Module 1 performance.
      Harder modules allow for higher scores.
    </p>
  </div>
)}
```

## Testing Plan

### 1. Test Module 1 → Easier Module 2
- Answer only 8/22 correct in Math Module 1 (36%)
- Verify Module 2 generates with 50% easy questions
- Check max score is capped around 680

### 2. Test Module 1 → Harder Module 2
- Answer 15/22 correct in Math Module 1 (68%)
- Verify Module 2 generates with 50% hard questions
- Check score can reach 800

### 3. Test Threshold Edge Cases
- Test exactly at threshold (12/22 = 55%)
- Verify consistent behavior

### 4. Test Both Sections
- Different performance in Math vs R/W
- Verify independent adaptive branching

## Migration Steps

1. **Create migration file:**
   ```bash
   cd backend
   alembic revision -m "add_adaptive_module_tracking"
   ```

2. **Add columns:**
   - `module_type VARCHAR(50)`
   - `got_harder_module_2 BOOLEAN`

3. **Run migration:**
   ```bash
   alembic upgrade head
   ```

4. **Update service layer** with new adaptive logic

5. **Update frontend** to show adaptive path

6. **Test thoroughly** before production

## Benefits

✅ **Realistic Practice**: Matches official Digital SAT exactly
✅ **Better Diagnostics**: See which difficulty level student can handle
✅ **Accurate Scoring**: Reflects real SAT scoring with adaptive adjustment
✅ **Student Motivation**: Earning "harder module" feels like achievement
✅ **Score Guarantee**: More accurate predictions for your tutoring guarantee

---

**Implementation Time:** ~4-6 hours
**Priority:** High (core feature for realistic SAT prep)
**Complexity:** Medium (well-defined logic, clear structure)
