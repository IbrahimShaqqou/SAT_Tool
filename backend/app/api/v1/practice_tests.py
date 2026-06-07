"""
Practice Tests API - Official College Board practice test endpoints.

Endpoints:
- GET /practice-tests - List available practice tests
- POST /practice-tests/{test_number}/start - Start a new practice test session
- GET /practice-tests/sessions/{session_id} - Get session details
- POST /practice-tests/sessions/{session_id}/submit-module - Submit a completed module
- GET /practice-tests/sessions/{session_id}/results - Get scored results
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.practice_test import PracticeTest, PracticeTestModule
from app.models.test import TestSession
from app.models.enums import TestType, TestStatus
from app.models.user import User
from app.models.question import Question
from app.models.response import StudentResponse
from app.models.taxonomy import Domain, Skill
from app.services.sat_scoring import (
    should_get_harder_module_2,
    score_full_length_test
)
from app.services.mypractice_import import import_bundle
from app.api.deps import get_current_user

router = APIRouter(prefix="/practice-tests", tags=["practice-tests"])


# ===== Response Models =====

class PracticeTestListItem(BaseModel):
    """Practice test in list view."""
    id: UUID
    test_number: int
    test_name: str
    description: Optional[str]
    is_active: bool
    total_questions: int = 98
    estimated_time_minutes: int = 134

    class Config:
        from_attributes = True


class ModuleInfo(BaseModel):
    """Module configuration info."""
    id: UUID
    module_number: int
    module_type: str
    subject_area: str
    time_limit_minutes: int
    question_count: int

    class Config:
        from_attributes = True


class PracticeTestDetail(BaseModel):
    """Detailed practice test information."""
    id: UUID
    test_number: int
    test_name: str
    description: Optional[str]
    modules: List[ModuleInfo]

    class Config:
        from_attributes = True


class StartTestResponse(BaseModel):
    """Response when starting a practice test."""
    session_id: UUID
    test_id: UUID
    test_name: str
    current_module: int
    total_modules: int
    instructions: str


class ModuleQuestion(BaseModel):
    """
    A question in a module, shaped to match the question bank API response so
    the same shared frontend components (QuestionDisplay, AnswerChoices, etc.)
    can render it without per-page adaptation.
    """
    id: UUID
    question_id: UUID  # alias of id, kept for legacy frontend code
    question_number: int
    domain: str
    skill_name: str
    difficulty: str
    answer_type: str
    prompt_html: str
    choices_json: List[str]
    passage_html: Optional[str] = None
    subject_area: str


class ModuleDetail(BaseModel):
    """Module to display to student."""
    module_id: UUID
    module_number: int
    subject_area: str
    time_limit_minutes: int
    questions: List[ModuleQuestion]


class SubmitModuleRequest(BaseModel):
    """Request body for submitting a module."""
    responses: List[dict] = Field(..., description="List of {question_id: UUID, selected_answer: str}")
    time_spent_seconds: int


class SubmitModuleResponse(BaseModel):
    """Response after submitting a module."""
    module_submitted: int
    next_module: Optional[int]
    module_2_path: Optional[str]  # "easier" or "harder"
    is_complete: bool
    message: str


class SectionScore(BaseModel):
    """Section scoring breakdown."""
    score: int
    score_low: Optional[int] = None
    score_high: Optional[int] = None
    score_method: Optional[str] = None   # "official" | "estimate" | "model"
    correct: int
    total: int
    percentage: float
    module_1_correct: int
    module_1_total: int
    module_2_correct: int
    module_2_total: int
    module_2_path: str


class TestResults(BaseModel):
    """Complete test results."""
    session_id: UUID
    test_name: str
    completed_at: Optional[datetime] = None
    total_score: int
    total_score_low: Optional[int] = None
    total_score_high: Optional[int] = None
    score_method: Optional[str] = None   # "official" | "estimate" | "model"
    percentile: int
    math: SectionScore
    reading_writing: SectionScore


# ===== Endpoints =====

class ImportBundleRequest(BaseModel):
    """Captured MyPractice bundle from the ZooPrep Bluebook Importer extension."""
    schemaVersion: int = 1
    source: Optional[str] = None
    capturedAtIso: Optional[str] = None
    attemptCount: Optional[int] = None
    attempts: List[dict] = Field(default_factory=list)


class ImportResponse(BaseModel):
    ok: bool
    summary: str
    detail: dict


@router.post("/import", response_model=ImportResponse)
def import_mypractice_bundle(
    bundle: ImportBundleRequest,
    dry_run: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ingest a captured MyPractice bundle (from the browser extension): upsert
    questions, (re)seed practice-test modules with adaptive Module 2 variants,
    and record official scaled scores + per-domain theta as scoring anchors.

    Pass `?dry_run=true` to validate without writing.
    """
    if not bundle.attempts:
        raise HTTPException(status_code=400, detail="Bundle has no attempts.")

    try:
        result = import_bundle(
            db, bundle.model_dump(), dry_run=dry_run, student_id=current_user.id
        )
    except Exception as e:  # surface a clean error to the extension/UI
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {e}")

    if not dry_run:
        db.commit()

    q = result["questions"]
    seeded = [t for t in result["tests"] if t["modules_seeded"] > 0]
    usable = [t for t in result["tests"] if t["usable"]]
    results_created = sum(t.get("results_created", 0) for t in result["tests"])
    summary = (
        f"{results_created} result{'' if results_created == 1 else 's'} saved to your history; "
        f"{q['inserted']} questions added, {q['updated']} updated; "
        f"{len(seeded) if not dry_run else len(usable)} tests "
        f"{'ready' if not dry_run else 'ready'} of {len(result['tests'])} found."
    )
    return ImportResponse(ok=True, summary=summary, detail=result)


class MyResultItem(BaseModel):
    """A student's completed practice-test result (taken in Bluebook or here)."""
    session_id: UUID
    test_name: str
    test_number: Optional[int] = None
    completed_at: Optional[datetime] = None
    total_score: Optional[int] = None
    source: str = "zooprep"          # "mypractice_import" | "zooprep"
    is_official: bool = False


@router.get("/my-results", response_model=List[MyResultItem])
def list_my_results(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The current student's completed full-length practice-test results, newest
    first — including official attempts imported from Bluebook.
    """
    sessions = (
        db.query(TestSession)
        .filter(
            TestSession.student_id == current_user.id,
            TestSession.test_type == TestType.OFFICIAL_PRACTICE,
            TestSession.status == TestStatus.COMPLETED,
            TestSession.scaled_score.isnot(None),
        )
        # Newest first; created_at as a stable tiebreaker for same-day attempts.
        .order_by(
            TestSession.completed_at.desc().nullslast(),
            TestSession.created_at.desc(),
        )
        .all()
    )
    out = []
    for s in sessions:
        state = s.session_state or {}
        source = state.get("source", "zooprep")
        out.append(MyResultItem(
            session_id=s.id,
            test_name=s.title or "Practice Test",
            test_number=state.get("test_number"),
            completed_at=s.completed_at,
            total_score=s.scaled_score,
            source=source,
            is_official=(source == "mypractice_import"),
        ))
    return out


@router.get("/", response_model=List[PracticeTestListItem])
def list_practice_tests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all available practice tests."""
    tests = db.query(PracticeTest).filter(PracticeTest.is_active == True).order_by(PracticeTest.test_number).all()

    return [
        PracticeTestListItem(
            id=test.id,
            test_number=test.test_number,
            test_name=test.test_name,
            description=test.description,
            is_active=test.is_active,
            total_questions=98,
            estimated_time_minutes=134
        )
        for test in tests
    ]


@router.get("/{test_number}", response_model=PracticeTestDetail)
def get_practice_test(
    test_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed information about a practice test."""
    test = db.query(PracticeTest).filter(PracticeTest.test_number == test_number).first()

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Practice test {test_number} not found"
        )

    # Get module info (just metadata, not questions)
    modules = db.query(PracticeTestModule).filter(
        PracticeTestModule.practice_test_id == test.id
    ).order_by(
        PracticeTestModule.subject_area,
        PracticeTestModule.module_number,
        PracticeTestModule.module_type
    ).all()

    module_info = [
        ModuleInfo(
            id=m.id,
            module_number=m.module_number,
            module_type=m.module_type,
            subject_area=m.subject_area,
            time_limit_minutes=m.time_limit_minutes,
            question_count=m.question_count
        )
        for m in modules
    ]

    return PracticeTestDetail(
        id=test.id,
        test_number=test.test_number,
        test_name=test.test_name,
        description=test.description,
        modules=module_info
    )


@router.post("/{test_number}/start", response_model=StartTestResponse)
def start_practice_test(
    test_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start a new practice test session.

    Creates a test session and returns the first module (Reading/Writing Module 1).
    """
    # Get practice test
    practice_test = db.query(PracticeTest).filter(
        PracticeTest.test_number == test_number
    ).first()

    if not practice_test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Practice test {test_number} not found"
        )

    if not practice_test.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Practice test {test_number} is not currently available"
        )

    # Create test session
    test_session = TestSession(
        student_id=current_user.id,
        test_type=TestType.OFFICIAL_PRACTICE,
        subject_area=None,  # Full test covers both
        title=practice_test.test_name,
        session_state={
            "practice_test_id": str(practice_test.id),
            "test_number": practice_test.test_number,
            "current_module": 1,
            "modules_completed": [],
            "module_2_paths": {}  # Will store which path student took for each section
        }
    )

    db.add(test_session)
    db.commit()
    db.refresh(test_session)

    return StartTestResponse(
        session_id=test_session.id,
        test_id=practice_test.id,
        test_name=practice_test.test_name,
        current_module=1,
        total_modules=4,
        instructions=(
            "This is a full-length SAT practice test with 4 modules:\n"
            "1. Reading and Writing Module 1 (27 questions, 32 minutes)\n"
            "2. Reading and Writing Module 2 (27 questions, 32 minutes) - Adaptive\n"
            "3. Math Module 1 (22 questions, 35 minutes)\n"
            "4. Math Module 2 (22 questions, 35 minutes) - Adaptive\n\n"
            "Module 2 difficulty will adapt based on your Module 1 performance.\n"
            "You will have a 5-minute break between sections."
        )
    )


@router.get("/sessions/{session_id}/module", response_model=ModuleDetail)
def get_current_module(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current module for a test session.

    Returns questions and configuration for the module student should complete next.
    """
    # Get session
    session = db.query(TestSession).filter(TestSession.id == session_id).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found"
        )

    if session.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this test session"
        )

    if session.status == TestStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test session is already completed"
        )

    # Get current module info from session state
    current_module = session.session_state.get("current_module", 1)
    practice_test_id = UUID(session.session_state["practice_test_id"])
    modules_completed = session.session_state.get("modules_completed", [])
    module_2_paths = session.session_state.get("module_2_paths", {})

    # Determine which module to show
    # Module sequence: RW M1 (1) → RW M2 (2) → Math M1 (3) → Math M2 (4)
    if current_module == 1:
        # Reading/Writing Module 1
        subject = "reading_writing"
        module_num = 1
        module_type = "module_1_standard"
    elif current_module == 2:
        # Reading/Writing Module 2 (adaptive)
        subject = "reading_writing"
        module_num = 2
        # Check Module 1 performance
        rw_m1_completed = [m for m in modules_completed if m.get("subject") == "reading_writing" and m.get("module_num") == 1]
        if not rw_m1_completed:
            raise HTTPException(status_code=400, detail="Must complete Reading/Writing Module 1 first")

        rw_m1 = rw_m1_completed[0]
        got_harder = should_get_harder_module_2(rw_m1["correct"], rw_m1["total"])
        module_type = "module_2_harder" if got_harder else "module_2_easier"
        module_2_paths["reading_writing"] = "harder" if got_harder else "easier"
    elif current_module == 3:
        # Math Module 1
        subject = "math"
        module_num = 1
        module_type = "module_1_standard"
    elif current_module == 4:
        # Math Module 2 (adaptive)
        subject = "math"
        module_num = 2
        # Check Module 1 performance
        math_m1_completed = [m for m in modules_completed if m.get("subject") == "math" and m.get("module_num") == 1]
        if not math_m1_completed:
            raise HTTPException(status_code=400, detail="Must complete Math Module 1 first")

        math_m1 = math_m1_completed[0]
        got_harder = should_get_harder_module_2(math_m1["correct"], math_m1["total"])
        module_type = "module_2_harder" if got_harder else "module_2_easier"
        module_2_paths["math"] = "harder" if got_harder else "easier"
    else:
        raise HTTPException(status_code=400, detail="Invalid module number")

    # Update session with path selection. Replace the whole dict so SQLAlchemy
    # detects the change to the JSONB column.
    new_state = dict(session.session_state or {})
    new_state["module_2_paths"] = module_2_paths
    session.session_state = new_state
    db.commit()

    # Get module from database
    module = db.query(PracticeTestModule).filter(
        PracticeTestModule.practice_test_id == practice_test_id,
        PracticeTestModule.module_number == module_num,
        PracticeTestModule.module_type == module_type,
        PracticeTestModule.subject_area == subject
    ).first()

    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module not found: {subject} Module {module_num} ({module_type})"
        )

    # Get questions in order
    question_uids = module.question_uids
    questions = db.query(Question).filter(Question.external_id.in_(question_uids)).all()

    # Create lookup dict by external_id (the College Board uId)
    question_map = {q.external_id: q for q in questions}

    # Order questions according to module
    ordered_questions = []
    for i, uid in enumerate(question_uids):
        q = question_map.get(uid)
        if not q:
            continue

        ordered_questions.append(ModuleQuestion(
            id=q.id,
            question_id=q.id,
            question_number=i + 1,
            domain=q.domain.name if q.domain else "",
            skill_name=q.skill.name if q.skill else "",
            difficulty=str(q.difficulty.value if hasattr(q.difficulty, "value") else q.difficulty),
            answer_type=str(q.answer_type.value if hasattr(q.answer_type, "value") else q.answer_type),
            prompt_html=q.prompt_html,
            choices_json=q.choices_json or [],
            passage_html=None,
            subject_area=subject,
        ))

    return ModuleDetail(
        module_id=module.id,
        module_number=current_module,
        subject_area=subject,
        time_limit_minutes=module.time_limit_minutes,
        questions=ordered_questions
    )


@router.post("/sessions/{session_id}/submit-module", response_model=SubmitModuleResponse)
def submit_module(
    session_id: UUID,
    submission: SubmitModuleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a completed module.

    Grades the module, updates session state, and determines next module.
    """
    # Get session
    session = db.query(TestSession).filter(TestSession.id == session_id).first()

    if not session:
        raise HTTPException(status_code=404, detail="Test session not found")

    if session.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if session.status == TestStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Test already completed")

    # Get current module info
    current_module = session.session_state.get("current_module", 1)
    modules_completed = session.session_state.get("modules_completed", [])

    # Grade responses
    correct_count = 0
    total_count = len(submission.responses)

    for response in submission.responses:
        question = db.query(Question).filter(Question.id == response["question_id"]).first()
        if not question:
            continue
        selected = response.get("selected_answer")
        if selected is None:
            continue
        correct_json = question.correct_answer_json or {}
        if "index" in correct_json:
            # MCQ: compare integer index
            try:
                if int(selected) == int(correct_json["index"]):
                    correct_count += 1
            except (TypeError, ValueError):
                pass
        elif "answers" in correct_json:
            # SPR (free response): student answer matches any accepted answer (case-insensitive)
            accepted = [str(a).strip().lower() for a in correct_json["answers"]]
            if str(selected).strip().lower() in accepted:
                correct_count += 1

    # Determine subject and module number
    if current_module == 1:
        subject, mod_num = "reading_writing", 1
    elif current_module == 2:
        subject, mod_num = "reading_writing", 2
    elif current_module == 3:
        subject, mod_num = "math", 1
    elif current_module == 4:
        subject, mod_num = "math", 2
    else:
        raise HTTPException(status_code=400, detail="Invalid module state")

    # Save module results
    modules_completed.append({
        "module_number": current_module,
        "subject": subject,
        "module_num": mod_num,
        "correct": correct_count,
        "total": total_count,
        "time_spent_seconds": submission.time_spent_seconds
    })

    # Update session
    is_complete = current_module == 4
    next_module = None if is_complete else current_module + 1

    # Replace the JSONB dict entirely so SQLAlchemy detects the change.
    # Mutating nested keys on a JSONB column does not flag the row as dirty.
    new_state = dict(session.session_state or {})
    new_state["current_module"] = next_module
    new_state["modules_completed"] = modules_completed
    session.session_state = new_state

    if is_complete:
        session.status = TestStatus.COMPLETED
        session.completed_at = datetime.utcnow()

    db.commit()

    # Determine message
    if is_complete:
        message = "Test completed! View your results."
    else:
        if next_module in [2, 4]:
            message = f"Module {current_module} submitted. Loading adaptive Module {next_module}..."
        else:
            message = f"Module {current_module} submitted. Take a 5-minute break before starting the next section."

    # Determine Module 2 path if applicable
    module_2_path = None
    if current_module in [1, 3]:  # Just completed Module 1
        got_harder = should_get_harder_module_2(correct_count, total_count)
        module_2_path = "harder" if got_harder else "easier"

    return SubmitModuleResponse(
        module_submitted=current_module,
        next_module=next_module,
        module_2_path=module_2_path,
        is_complete=is_complete,
        message=message
    )


def _get_session_for_viewer(session_id: UUID, viewer: User, db: Session) -> TestSession:
    """
    Fetch a test session the viewer may see: the owning student, or that
    student's tutor. Raises 404/403 otherwise.
    """
    session = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Test session not found")

    if session.student_id == viewer.id:
        return session

    # Tutor viewing one of their students' results.
    student = db.query(User).filter(User.id == session.student_id).first()
    if student is not None and student.tutor_id == viewer.id:
        return session

    raise HTTPException(status_code=403, detail="Not authorized")


@router.get("/sessions/{session_id}/results", response_model=TestResults)
def get_test_results(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get complete test results with SAT scoring.

    Returns scaled scores (200-800 per section, 400-1600 total) and breakdown.
    Viewable by the student or their tutor.
    """
    session = _get_session_for_viewer(session_id, current_user, db)

    if session.status != TestStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Test not completed yet")

    # Resolve the practice test. Prefer the stable test_number (the id can be
    # orphaned if the test was re-seeded with a fresh UUID); fall back to id.
    state = session.session_state or {}
    test_number = state.get("test_number")
    practice_test = None
    if test_number is not None:
        practice_test = db.query(PracticeTest).filter(
            PracticeTest.test_number == test_number
        ).first()
    if practice_test is None and state.get("practice_test_id"):
        try:
            practice_test = db.query(PracticeTest).filter(
                PracticeTest.id == UUID(state["practice_test_id"])
            ).first()
        except (ValueError, TypeError):
            practice_test = None

    # Extract module results
    modules = state.get("modules_completed", [])

    # Find each module
    rw_m1 = next((m for m in modules if m["subject"] == "reading_writing" and m["module_num"] == 1), None)
    rw_m2 = next((m for m in modules if m["subject"] == "reading_writing" and m["module_num"] == 2), None)
    math_m1 = next((m for m in modules if m["subject"] == "math" and m["module_num"] == 1), None)
    math_m2 = next((m for m in modules if m["subject"] == "math" and m["module_num"] == 2), None)

    if not all([rw_m1, rw_m2, math_m1, math_m2]):
        raise HTTPException(status_code=400, detail="Incomplete test data")

    # Calculate scores using SAT scoring algorithm
    results = score_full_length_test(
        math_module_1_correct=math_m1["correct"],
        math_module_1_total=math_m1["total"],
        math_module_2_correct=math_m2["correct"],
        math_module_2_total=math_m2["total"],
        rw_module_1_correct=rw_m1["correct"],
        rw_module_1_total=rw_m1["total"],
        rw_module_2_correct=rw_m2["correct"],
        rw_module_2_total=rw_m2["total"],
        test_number=(practice_test.test_number if practice_test else test_number),
    )

    return TestResults(
        session_id=session.id,
        test_name=(practice_test.test_name if practice_test else (session.title or "Practice Test")),
        completed_at=session.completed_at,
        total_score=results["total_score"],
        total_score_low=results.get("total_score_low"),
        total_score_high=results.get("total_score_high"),
        score_method=results.get("score_method"),
        percentile=results["percentile"],
        math=SectionScore(**results["math"]),
        reading_writing=SectionScore(**results["reading_writing"])
    )


# ===== Question-by-question review + skill breakdown =====

ANSWER_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"]


class ReviewQuestion(BaseModel):
    """One question in the review, with the student's answer and the correct one."""
    number: int
    subject_area: str
    domain: Optional[str] = None
    skill: Optional[str] = None
    skill_id: Optional[int] = None
    answer_type: str
    prompt_html: str
    choices: List[str] = Field(default_factory=list)
    correct_index: Optional[int] = None
    correct_answers: List[str] = Field(default_factory=list)
    your_answer: Optional[str] = None
    is_correct: bool
    explanation_html: Optional[str] = None


class SkillBreakdownItem(BaseModel):
    """Per-skill correct/total rollup for this test."""
    skill_id: Optional[int] = None
    skill: str
    domain: Optional[str] = None
    subject_area: str
    correct: int
    total: int
    accuracy: float


class ReviewResponse(BaseModel):
    questions: List[ReviewQuestion]
    skills: List[SkillBreakdownItem]


@router.get("/sessions/{session_id}/review", response_model=ReviewResponse)
def get_test_review(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Question-by-question review for a completed practice test + a per-skill
    rollup (correct/total) so we can surface the skills that need practice.
    Viewable by the student or their tutor.
    """
    _get_session_for_viewer(session_id, current_user, db)

    responses = (
        db.query(StudentResponse)
        .filter(StudentResponse.test_session_id == session_id)
        .order_by(StudentResponse.submitted_at)
        .all()
    )

    q_ids = [r.question_id for r in responses]
    questions = {
        q.id: q
        for q in db.query(Question).filter(Question.id.in_(q_ids)).all()
    } if q_ids else {}
    domains = {d.id: d for d in db.query(Domain).all()}
    skills = {s.id: s for s in db.query(Skill).all()}

    review = []
    # skill_id -> [correct, total, names]
    skill_roll: dict = {}
    for i, r in enumerate(responses, start=1):
        q = questions.get(r.question_id)
        if q is None:
            continue
        dom = domains.get(q.domain_id)
        sk = skills.get(q.skill_id)
        choices = q.choices_json or []
        ca = q.correct_answer_json or {}
        correct_index = ca.get("index")
        correct_answers = ca.get("answers", []) or []
        raw = (r.response_json or {}).get("raw")
        # Normalize the student's answer for display.
        if q.answer_type.value == "MCQ" and isinstance(raw, str) and raw in ANSWER_LETTERS:
            your_answer = raw
        else:
            your_answer = str(raw) if raw is not None else None

        subject = q.subject_area.value
        review.append(ReviewQuestion(
            number=i,
            subject_area=subject,
            domain=dom.name if dom else None,
            skill=sk.name if sk else None,
            skill_id=q.skill_id,
            answer_type=q.answer_type.value,
            prompt_html=q.prompt_html,
            choices=choices,
            correct_index=correct_index,
            correct_answers=correct_answers,
            your_answer=your_answer,
            is_correct=bool(r.is_correct),
        ))

        key = q.skill_id or f"_d{q.domain_id}"
        if key not in skill_roll:
            skill_roll[key] = {
                "skill_id": q.skill_id,
                "skill": sk.name if sk else (dom.name if dom else "Uncategorized"),
                "domain": dom.name if dom else None,
                "subject_area": subject,
                "correct": 0,
                "total": 0,
            }
        skill_roll[key]["correct"] += 1 if r.is_correct else 0
        skill_roll[key]["total"] += 1

    skill_items = [
        SkillBreakdownItem(
            **v,
            accuracy=round(100 * v["correct"] / v["total"], 1) if v["total"] else 0.0,
        )
        for v in skill_roll.values()
    ]
    # Weakest first (lowest accuracy, then most attempted) so "needs practice" leads.
    skill_items.sort(key=lambda s: (s.accuracy, -s.total))

    return ReviewResponse(questions=review, skills=skill_items)


# ===== Import-driven study plan =====

class StudyPlanResponse(BaseModel):
    """The coaching plan generated from an imported attempt."""
    session_id: UUID
    test_number: Optional[int] = None
    test_name: Optional[str] = None
    focus_skills: List[dict] = Field(default_factory=list)
    also_review: List[dict] = Field(default_factory=list)
    recommended_next_test: Optional[int] = None
    next_test_reason: Optional[str] = None
    deltas: Optional[dict] = None
    created_at: Optional[datetime] = None


@router.get("/sessions/{session_id}/plan", response_model=StudyPlanResponse)
def get_study_plan(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The import-driven study plan for a completed practice test. Viewable by the
    student or their tutor. 404 if no plan exists (e.g. an import predating this
    feature, or one with no per-question data).
    """
    session = _get_session_for_viewer(session_id, current_user, db)

    from app.models.study_plan import StudyPlan
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.test_session_id == session.id)
        .first()
    )
    if plan is None:
        raise HTTPException(
            status_code=404,
            detail="No study plan for this test yet. Re-import it to generate one.",
        )

    return StudyPlanResponse(
        session_id=session.id,
        test_number=plan.test_number,
        test_name=session.title,
        focus_skills=plan.focus_skills or [],
        also_review=plan.also_review or [],
        recommended_next_test=plan.recommended_next_test,
        next_test_reason=plan.next_test_reason,
        deltas=plan.deltas,
        created_at=plan.created_at,
    )
