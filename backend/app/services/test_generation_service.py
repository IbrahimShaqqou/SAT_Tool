"""
SAT Tutoring Platform - Test Generation Service

Generates full-length SAT practice tests in Bluebook format.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID
import random

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.models.test import TestSession
from app.models.test_module import TestModule, ModuleBreak, BLUEBOOK_SAT_FORMAT
from app.models.question import Question
from app.models.response import StudentResponse
from app.models.enums import TestType, TestStatus, SubjectArea, DifficultyLevel


class TestGenerationService:
    """Service for generating full-length SAT practice tests."""

    def __init__(self, db: Session):
        self.db = db

    def generate_full_length_sat(
        self,
        student_id: UUID,
        avoid_recent_days: int = 7
    ) -> TestSession:
        """
        Generate a full-length SAT practice test in Bluebook format.

        Creates a test with 4 modules:
        - Math Module 1: 22 questions, 35 minutes
        - Math Module 2: 22 questions, 35 minutes
        - Reading/Writing Module 1: 27 questions, 32 minutes
        - Reading/Writing Module 2: 27 questions, 32 minutes

        Total: 98 questions, 2 hours 14 minutes

        Args:
            student_id: Student taking the test
            avoid_recent_days: Avoid questions answered in last N days

        Returns:
            TestSession with modules created
        """
        # Create the test session
        test_session = TestSession(
            student_id=student_id,
            test_type=TestType.FULL_LENGTH,
            status=TestStatus.NOT_STARTED,
            title="Full-Length SAT Practice Test",
            total_questions=BLUEBOOK_SAT_FORMAT["total_questions"],
            time_limit_minutes=BLUEBOOK_SAT_FORMAT["total_time_minutes"]
        )
        self.db.add(test_session)
        self.db.flush()  # Get test_session.id

        # Get recently answered question IDs to avoid
        recently_answered_ids = self._get_recently_answered_questions(
            student_id, avoid_recent_days
        )

        # Generate Math modules (Module 1 and 2)
        math_questions_m1 = self._select_module_questions(
            subject_area=SubjectArea.MATH,
            num_questions=22,
            exclude_ids=recently_answered_ids
        )

        math_questions_m2 = self._select_module_questions(
            subject_area=SubjectArea.MATH,
            num_questions=22,
            exclude_ids=recently_answered_ids + [q.id for q in math_questions_m1]
        )

        # Generate Reading/Writing modules (Module 3 and 4)
        rw_questions_m1 = self._select_module_questions(
            subject_area=SubjectArea.READING_WRITING,
            num_questions=27,
            exclude_ids=recently_answered_ids
        )

        rw_questions_m2 = self._select_module_questions(
            subject_area=SubjectArea.READING_WRITING,
            num_questions=27,
            exclude_ids=recently_answered_ids + [q.id for q in rw_questions_m1]
        )

        # Create modules
        modules_config = [
            ("Math Module 1", SubjectArea.MATH, 22, 35, math_questions_m1),
            ("Math Module 2", SubjectArea.MATH, 22, 35, math_questions_m2),
            ("Reading/Writing Module 1", SubjectArea.READING_WRITING, 27, 32, rw_questions_m1),
            ("Reading/Writing Module 2", SubjectArea.READING_WRITING, 27, 32, rw_questions_m2),
        ]

        for idx, (title, subject, num_q, time_min, questions) in enumerate(modules_config, start=1):
            module = TestModule(
                test_session_id=test_session.id,
                module_number=idx,
                subject_area=subject,
                title=title,
                total_questions=num_q,
                time_limit_minutes=time_min,
                question_ids=[str(q.id) for q in questions],
                status=TestStatus.NOT_STARTED if idx == 1 else TestStatus.NOT_STARTED
            )
            self.db.add(module)

        # Add break between Math and Reading/Writing sections (after module 2)
        break_obj = ModuleBreak(
            test_session_id=test_session.id,
            after_module_number=2,
            before_module_number=3,
            break_duration_minutes=BLUEBOOK_SAT_FORMAT["break_minutes"]
        )
        self.db.add(break_obj)

        self.db.commit()
        self.db.refresh(test_session)

        return test_session

    def _get_recently_answered_questions(
        self,
        student_id: UUID,
        days: int
    ) -> List[UUID]:
        """Get question IDs answered by student in last N days."""
        cutoff_date = datetime.now(timezone.utc).timestamp() - (days * 24 * 60 * 60)

        recent_responses = self.db.query(StudentResponse.question_id).filter(
            StudentResponse.student_id == student_id,
            StudentResponse.submitted_at >= datetime.fromtimestamp(cutoff_date, tz=timezone.utc)
        ).distinct().all()

        return [r[0] for r in recent_responses]

    def _select_module_questions(
        self,
        subject_area: SubjectArea,
        num_questions: int,
        exclude_ids: List[UUID]
    ) -> List[Question]:
        """
        Select questions for a single module with balanced difficulty distribution.

        Aims for realistic SAT difficulty distribution:
        - 30% Easy
        - 40% Medium
        - 30% Hard

        Args:
            subject_area: MATH or READING_WRITING
            num_questions: Number of questions to select
            exclude_ids: Questions to avoid

        Returns:
            List of Question objects
        """
        # Calculate target counts per difficulty
        easy_count = int(num_questions * 0.30)
        medium_count = int(num_questions * 0.40)
        hard_count = num_questions - easy_count - medium_count  # Ensure total adds up

        selected_questions = []

        # Select questions by difficulty level
        for difficulty, target_count in [
            (DifficultyLevel.EASY, easy_count),
            (DifficultyLevel.MEDIUM, medium_count),
            (DifficultyLevel.HARD, hard_count)
        ]:
            questions = self.db.query(Question).filter(
                Question.is_active == True,
                Question.subject_area == subject_area,
                Question.difficulty_level == difficulty,
                ~Question.id.in_(exclude_ids + [q.id for q in selected_questions])
            ).order_by(func.random()).limit(target_count).all()

            selected_questions.extend(questions)

            # If not enough questions of this difficulty, fill from other difficulties
            if len(questions) < target_count:
                shortfall = target_count - len(questions)
                backup_questions = self.db.query(Question).filter(
                    Question.is_active == True,
                    Question.subject_area == subject_area,
                    ~Question.id.in_(exclude_ids + [q.id for q in selected_questions])
                ).order_by(func.random()).limit(shortfall).all()
                selected_questions.extend(backup_questions)

        # Shuffle to mix difficulties (SAT doesn't strictly order by difficulty)
        random.shuffle(selected_questions)

        return selected_questions[:num_questions]

    def get_module_questions(
        self,
        module_id: UUID
    ) -> List[Question]:
        """
        Get all questions for a specific module in order.

        Args:
            module_id: Module UUID

        Returns:
            List of Question objects in module order
        """
        module = self.db.query(TestModule).filter(
            TestModule.id == module_id
        ).first()

        if not module:
            raise ValueError(f"Module {module_id} not found")

        # Get questions in the order specified by question_ids
        questions = self.db.query(Question).filter(
            Question.id.in_([UUID(qid) for qid in module.question_ids])
        ).all()

        # Sort by the order in question_ids
        question_dict = {str(q.id): q for q in questions}
        ordered_questions = [question_dict[qid] for qid in module.question_ids if qid in question_dict]

        return ordered_questions

    def start_module(
        self,
        module_id: UUID
    ) -> TestModule:
        """
        Start a module (set status to IN_PROGRESS and record start time).

        Args:
            module_id: Module to start

        Returns:
            Updated TestModule
        """
        module = self.db.query(TestModule).filter(
            TestModule.id == module_id
        ).first()

        if not module:
            raise ValueError(f"Module {module_id} not found")

        if module.status != TestStatus.NOT_STARTED:
            raise ValueError(f"Module already started or completed")

        module.status = TestStatus.IN_PROGRESS
        module.started_at = datetime.now(timezone.utc)

        # Also update test session status if this is the first module
        if module.module_number == 1:
            test_session = module.test_session
            test_session.status = TestStatus.IN_PROGRESS
            test_session.started_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(module)

        return module

    def submit_module(
        self,
        module_id: UUID,
        time_expired: bool = False
    ) -> TestModule:
        """
        Submit a module (mark as completed).

        Args:
            module_id: Module to submit
            time_expired: Whether module was auto-submitted due to time limit

        Returns:
            Updated TestModule with scoring
        """
        module = self.db.query(TestModule).filter(
            TestModule.id == module_id
        ).first()

        if not module:
            raise ValueError(f"Module {module_id} not found")

        module.status = TestStatus.COMPLETED
        module.completed_at = datetime.now(timezone.utc)
        module.time_expired = time_expired

        # Calculate time spent
        if module.started_at:
            time_delta = module.completed_at - module.started_at
            module.time_spent_seconds = int(time_delta.total_seconds())

        # Calculate module scoring from responses
        responses = self.db.query(StudentResponse).filter(
            StudentResponse.test_session_id == module.test_session_id,
            StudentResponse.question_id.in_([UUID(qid) for qid in module.question_ids])
        ).all()

        module.questions_answered = len(responses)
        module.questions_correct = sum(1 for r in responses if r.is_correct)

        if module.questions_answered > 0:
            module.score_percentage = (module.questions_correct / module.questions_answered) * 100

        self.db.commit()
        self.db.refresh(module)

        return module

    def calculate_test_score(
        self,
        test_session_id: UUID
    ) -> Dict[str, Any]:
        """
        Calculate overall SAT score from completed modules.

        Returns scores on SAT scale (200-800 per section, 400-1600 total).

        Args:
            test_session_id: Test session to score

        Returns:
            Dict with math_score, reading_writing_score, total_score
        """
        test_session = self.db.query(TestSession).filter(
            TestSession.id == test_session_id
        ).first()

        if not test_session:
            raise ValueError(f"Test session {test_session_id} not found")

        modules = self.db.query(TestModule).filter(
            TestModule.test_session_id == test_session_id
        ).all()

        # Separate Math and Reading/Writing modules
        math_modules = [m for m in modules if m.subject_area == SubjectArea.MATH]
        rw_modules = [m for m in modules if m.subject_area == SubjectArea.READING_WRITING]

        # Calculate section scores
        math_score = self._calculate_section_score(math_modules)
        rw_score = self._calculate_section_score(rw_modules)

        total_score = math_score + rw_score

        return {
            "math_score": math_score,
            "reading_writing_score": rw_score,
            "total_score": total_score,
            "math_correct": sum(m.questions_correct for m in math_modules),
            "math_total": sum(m.total_questions for m in math_modules),
            "rw_correct": sum(m.questions_correct for m in rw_modules),
            "rw_total": sum(m.total_questions for m in rw_modules)
        }

    def _calculate_section_score(
        self,
        modules: List[TestModule]
    ) -> int:
        """
        Calculate SAT section score (200-800) from modules.

        Uses a simplified linear conversion based on percentage correct.
        College Board uses more complex equating, but this approximates it.

        Args:
            modules: List of modules for this section

        Returns:
            Score from 200-800
        """
        if not modules:
            return 200

        total_correct = sum(m.questions_correct for m in modules)
        total_questions = sum(m.total_questions for m in modules)

        if total_questions == 0:
            return 200

        percentage = total_correct / total_questions

        # Convert percentage to SAT scale (200-800)
        # Rough approximation: 0% = 200, 100% = 800
        # Most students score in the 400-700 range, so adjust curve
        if percentage < 0.5:
            # Below 50%: 200-500 range
            score = 200 + (percentage * 2 * 300)
        else:
            # Above 50%: 500-800 range
            score = 500 + ((percentage - 0.5) * 2 * 300)

        # Round to nearest 10 (SAT scores are multiples of 10)
        score = round(score / 10) * 10

        return max(200, min(800, int(score)))
