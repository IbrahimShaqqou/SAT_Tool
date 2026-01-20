"""
Seed lessons into the database.
Run from backend directory: python -m scripts.seed_lessons
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import engine
from app.models import Lesson, Skill

# Embedded lesson data
LESSONS = [
    {
        "skill_code": "H.D.",  # Systems of two linear equations
        "title": "Systems of Two Linear Equations",
        "subtitle": "Master solving systems using substitution, elimination, and Desmos",
        "estimated_minutes": 20,
        "difficulty_level": "intermediate",
        "content": {
            "sections": [
                {
                    "id": "intro",
                    "type": "text",
                    "title": "What is a System of Linear Equations?",
                    "content": "A **system of linear equations** is a set of two or more linear equations that share the same variables. On the SAT, you'll typically work with systems of **two equations** with **two variables** (usually $x$ and $y$).\n\nFor example:\n$$\\begin{aligned}2x + 3y &= 12 \\\\ x - y &= 1\\end{aligned}$$\n\nThe **solution** to a system is the set of values that makes **ALL** equations true at the same time. For two equations with two variables, the solution is an ordered pair $(x, y)$."
                },
                {
                    "id": "graph-meaning",
                    "type": "text",
                    "title": "What Does the Solution Mean Graphically?",
                    "content": "Each linear equation represents a **line** on a graph. The solution to the system is the **point where the two lines intersect** - the coordinates that lie on both lines.\n\nWhen you graph a system, you can literally see where the solution is!"
                },
                {
                    "id": "three-cases-intro",
                    "type": "text",
                    "title": "Three Possible Outcomes",
                    "content": "When you solve a system of two linear equations, there are exactly **three possible outcomes**. The key is understanding how many times the lines intersect:"
                },
                {
                    "id": "one-solution-image",
                    "type": "image",
                    "title": "One Solution: Lines Intersect",
                    "url": "/lessons/systems-intersection.png",
                    "alt": "Graph showing two lines intersecting at point (3, 2)",
                    "caption": "Lines cross at exactly one point. This point satisfies BOTH equations."
                },
                {
                    "id": "case-1",
                    "type": "text",
                    "content": "**1. One Solution** - The lines have **different slopes**, so they cross at exactly one point. This is the most common case on the SAT."
                },
                {
                    "id": "no-solution-image",
                    "type": "image",
                    "title": "No Solution: Parallel Lines",
                    "url": "/lessons/systems-no-solution.png",
                    "alt": "Graph showing two parallel lines that never intersect",
                    "caption": "Same slope, different y-intercepts. They never cross."
                },
                {
                    "id": "case-2",
                    "type": "text",
                    "content": "**2. No Solution** - The lines are **parallel** (same slope, different y-intercepts). They never intersect, so no point satisfies both equations."
                },
                {
                    "id": "infinite-solution-image",
                    "type": "image",
                    "title": "Infinite Solutions: Same Line",
                    "url": "/lessons/sytstems-infinite-solutions.png",
                    "alt": "Graph showing two lines that are exactly the same",
                    "caption": "Both equations represent the SAME line! Every point is a solution."
                },
                {
                    "id": "case-3",
                    "type": "text",
                    "content": "**3. Infinite Solutions** - Both equations represent the **same line** (one equation is just a multiple of the other). Every point on the line satisfies both equations."
                },
                {
                    "id": "infinite-tip",
                    "type": "tip",
                    "content": "In Desmos, when two lines have infinite solutions, they overlap completely. Click the colored circle next to one equation to hide it - you'll see the other line is in the exact same spot!"
                },
                {
                    "id": "infinite-line-off-image",
                    "type": "image",
                    "title": "Hiding One Line Reveals They're Identical",
                    "url": "/lessons/systems-infinite-solutions-line-off.png",
                    "alt": "Graph showing one line hidden to reveal they overlap",
                    "caption": "With one equation hidden, you can see the lines are identical."
                },
                {
                    "id": "desmos-section",
                    "type": "divider",
                    "title": "Using Desmos to Solve Systems"
                },
                {
                    "id": "desmos-strategy",
                    "type": "text",
                    "title": "The Desmos Strategy",
                    "content": "On the digital SAT, you have access to the **Desmos graphing calculator**. This is incredibly powerful for systems of equations!\n\n**Here's how to use it:**\n\n1. Type each equation into Desmos exactly as given\n2. Look for the **intersection point** - that's your solution!\n3. Click on the intersection point to see the exact coordinates\n\n**Important:** If the problem uses variables other than $x$ and $y$ (like $m$ and $n$, or $a$ and $b$), **replace them with $x$ and $y$** so Desmos can graph them."
                },
                {
                    "id": "desmos-tip",
                    "type": "tip",
                    "title": "Variable Substitution",
                    "content": "If you see a system like $2m + 3n = 12$ and $m - n = 1$, just mentally replace $m$ with $x$ and $n$ with $y$ when typing into Desmos. The intersection point will give you $(m, n)$."
                },
                {
                    "id": "algebraic-section",
                    "type": "divider",
                    "title": "Algebraic Methods"
                },
                {
                    "id": "when-algebra",
                    "type": "text",
                    "content": "While Desmos is fast for finding solutions, you'll sometimes need algebra - especially when the problem asks you to **set up** a system or when the solution isn't a nice integer."
                },
                {
                    "id": "method-1-sub",
                    "type": "text",
                    "title": "Method 1: Substitution",
                    "content": "**Substitution** works best when one equation already has a variable isolated (like $y = 3x + 2$).\n\n**Steps:**\n1. Solve one equation for one variable\n2. Substitute that expression into the other equation\n3. Solve for the remaining variable\n4. Substitute back to find the other variable"
                },
                {
                    "id": "method-2-elim",
                    "type": "text",
                    "title": "Method 2: Elimination",
                    "content": "**Elimination** works by adding or subtracting equations to eliminate one variable.\n\n**Steps:**\n1. Multiply equations (if needed) so one variable has opposite coefficients\n2. Add the equations to eliminate that variable\n3. Solve for the remaining variable\n4. Substitute back to find the other variable"
                },
                {
                    "id": "elim-example",
                    "type": "worked-example",
                    "title": "Elimination Example",
                    "source": "SAT Practice Question",
                    "problem": "$$\\begin{aligned}2x + 8y &= 198 \\\\ 2x + 4y &= 98\\end{aligned}$$\n\nWhat is the value of $y$?",
                    "desmos_equations": ["2x + 8y = 198", "2x + 4y = 98"],
                    "desmos_bounds": {"left": -10, "right": 60, "bottom": -10, "top": 35},
                    "steps": [
                        {"step": 1, "description": "Notice both equations have 2x. Subtract the second from the first to eliminate x", "math": "(2x + 8y) - (2x + 4y) = 198 - 98"},
                        {"step": 2, "description": "Simplify", "math": "4y = 100"},
                        {"step": 3, "description": "Solve for y", "math": "y = 25"}
                    ],
                    "answer": "$y = 25$",
                    "tip": "When coefficients already match, subtraction eliminates the variable immediately - no multiplication needed! Note: We changed $a$ and $b$ to $x$ and $y$ so Desmos can graph these equations."
                },
                {
                    "id": "word-problems-section",
                    "type": "divider",
                    "title": "Word Problems"
                },
                {
                    "id": "word-intro",
                    "type": "text",
                    "title": "Setting Up Systems from Word Problems",
                    "content": "Many SAT problems give you a real-world scenario and ask you to set up or solve a system. The key is:\n\n1. **Define your variables** - What do $x$ and $y$ represent?\n2. **Find two relationships** - Write an equation for each\n\nLook for phrases like \"total,\" \"combined,\" \"sum of,\" or \"costs.\""
                },
                {
                    "id": "word-example",
                    "type": "worked-example",
                    "title": "Word Problem Example",
                    "source": "SAT Practice Question",
                    "problem": "A petting zoo sells two types of tickets. The **standard ticket**, for admission only, costs **5 dollars**. The **premium ticket**, which includes admission and food, costs **12 dollars**. One Saturday, the petting zoo sold a total of **250 tickets** and collected **2,300 dollars** from ticket sales.\n\nWhich system of equations can find the number of standard tickets ($s$) and premium tickets ($p$)?",
                    "steps": [
                        {"step": 1, "description": "Define variables: s = standard tickets, p = premium tickets"},
                        {"step": 2, "description": "First equation: Total tickets sold", "math": "s + p = 250"},
                        {"step": 3, "description": "Second equation: Total revenue (price times quantity for each type)", "math": "5s + 12p = 2300"}
                    ],
                    "answer": "The system is: $s + p = 250$ and $5s + 12p = 2300$",
                    "options": [
                        {"text": "$$\\begin{aligned}s + p &= 250 \\\\ 5s + 12p &= 2300\\end{aligned}$$", "correct": True},
                        {"text": "$$\\begin{aligned}s + p &= 250 \\\\ 12s + 5p &= 2300\\end{aligned}$$", "correct": False, "explanation": "Coefficients are swapped - 5 goes with standard, 12 with premium"},
                        {"text": "$$\\begin{aligned}5s + 12p &= 250 \\\\ s + p &= 2300\\end{aligned}$$", "correct": False, "explanation": "Equations are swapped - ticket count doesn't involve prices"},
                        {"text": "$$\\begin{aligned}12s + 5p &= 250 \\\\ s + p &= 2300\\end{aligned}$$", "correct": False, "explanation": "Both equations have errors"}
                    ]
                },
                {
                    "id": "special-section",
                    "type": "divider",
                    "title": "Recognizing Special Cases"
                },
                {
                    "id": "no-solution-explain",
                    "type": "text",
                    "title": "No Solution Questions",
                    "content": "When a problem says the system has **no solution**, the lines must be parallel.\n\n**What to look for:** Same slope, different y-intercepts.\n\nIn slope-intercept form ($y = mx + b$), parallel lines have the same $m$ but different $b$."
                },
                {
                    "id": "no-solution-example",
                    "type": "worked-example",
                    "title": "No Solution Example",
                    "source": "SAT Practice Question",
                    "problem": "$$y = 6x + 18$$\n\nThe system has **no solution**. Which could be the second equation?",
                    "desmos_equations": ["y = 6x + 18", "-6x + y = 22"],
                    "desmos_bounds": {"left": -5, "right": 5, "bottom": -10, "top": 50},
                    "steps": [
                        {"step": 1, "description": "The given line has slope 6", "math": "y = 6x + 18 \\Rightarrow \\text{slope} = 6"},
                        {"step": 2, "description": "For no solution, we need the same slope but different y-intercept", "math": "y = 6x + b \\text{ where } b \\neq 18"},
                        {"step": 3, "description": "In standard form: -6x + y = b", "math": "-6x + y = 22 \\text{ (same slope, different intercept)}"}
                    ],
                    "answer": "$-6x + y = 22$ (which is the same as $y = 6x + 22$)",
                    "options": [
                        {"text": "$-6x + y = 18$", "correct": False, "explanation": "This is the same line - would give infinite solutions"},
                        {"text": "$-6x + y = 22$", "correct": True},
                        {"text": "$-12x + y = 36$", "correct": False, "explanation": "Slope is 12, not 6 - lines would intersect"},
                        {"text": "$-12x + y = 18$", "correct": False, "explanation": "Slope is 12, not 6 - lines would intersect"}
                    ]
                },
                {
                    "id": "infinite-explain",
                    "type": "text",
                    "title": "Infinite Solutions Questions",
                    "content": "When a problem says the system has **infinitely many solutions**, both equations represent the same line.\n\n**What to look for:** One equation is a **multiple** of the other.\n\nFor example, $2x + 4y = 10$ and $x + 2y = 5$ are the same line (the first is just 2 times the second)."
                },
                {
                    "id": "summary",
                    "type": "summary",
                    "title": "Key Takeaways",
                    "items": [
                        "The **solution** is the intersection point of two lines",
                        "**One solution**: Different slopes (lines cross once)",
                        "**No solution**: Same slope, different intercepts (parallel lines)",
                        "**Infinite solutions**: Same line (one equation is a multiple of the other)",
                        "**Use Desmos!** Graph both equations and find the intersection",
                        "Replace other variables (like $a$, $b$, $m$, $n$) with $x$ and $y$ for Desmos"
                    ]
                },
                {
                    "id": "common-mistakes",
                    "type": "warning",
                    "title": "Common Mistakes",
                    "content": "- Forgetting to distribute negative signs when subtracting equations\n- Mixing up coefficients in word problems (which number goes with which variable?)\n- Confusing \"no solution\" with \"infinite solutions\" - both involve same slopes!\n- Not checking your answer in BOTH equations"
                }
            ],
            "sat_tips": [
                "Use Desmos whenever possible - it's faster and less error-prone than algebra",
                "For 'set up the system' questions, you don't need to solve - just match the equations",
                "If a question mentions 'no solution', focus on making slopes equal",
                "Always define what your variables represent before writing equations"
            ]
        }
    }
]


def seed_lesson(db: Session, data: dict) -> bool:
    """Seed a single lesson into the database."""
    skill_code = data["skill_code"]

    # Look up skill by code instead of ID
    skill = db.query(Skill).filter(Skill.code == skill_code).first()
    if not skill:
        print(f"  Skill '{skill_code}' not found, skipping")
        return False

    existing = db.query(Lesson).filter(Lesson.skill_id == skill.id).first()
    if existing:
        existing.title = data["title"]
        existing.subtitle = data["subtitle"]
        existing.content_json = data["content"]
        existing.estimated_minutes = data["estimated_minutes"]
        existing.difficulty_level = data["difficulty_level"]
        existing.status = "published"
        existing.is_active = True
        print(f"  Updated: {data['title']} (skill_id={skill.id})")
    else:
        lesson = Lesson(
            skill_id=skill.id,
            domain_id=skill.domain_id,
            title=data["title"],
            subtitle=data["subtitle"],
            content_json=data["content"],
            estimated_minutes=data["estimated_minutes"],
            difficulty_level=data["difficulty_level"],
            status="published",
            is_active=True,
            display_order=skill.id,
        )
        db.add(lesson)
        print(f"  Created: {data['title']} (skill_id={skill.id})")

    return True


def main():
    print(f"Seeding {len(LESSONS)} lesson(s)...")

    with Session(engine) as db:
        count = 0
        for lesson_data in LESSONS:
            if seed_lesson(db, lesson_data):
                count += 1

        db.commit()
        print(f"Done! {count} lesson(s) seeded.")


if __name__ == "__main__":
    main()
