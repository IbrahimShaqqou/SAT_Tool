"""
Study-plan prioritization.

Ranks weak skills by how much working them is likely to move a student's score,
given limited time before the test:

    priority = weakness × domain_frequency × learnability × test_proximity

- weakness: how far below mastery the student is (bigger gap → higher priority).
- domain_frequency: official College Board domain weights (share of questions on
  a real Digital SAT). Algebra/Advanced Math dominate Math; R&W is flatter.
- learnability: heuristic — rule-based skills (grammar, algebra) improve fastest
  per hour; reading-comprehension skills move slowly. Prep-community consensus,
  not official; kept as a gentle multiplier.
- test_proximity: when the test is close, sharpen toward the few highest-impact
  skills (raise the exponent on the impact factors).

No fabricated per-question "point values" — College Board does not publish the
IRT equating, so impact is proxied by frequency, which is citable and solid.

Domain codes are the legacy CB codes stored in our `domains` table; they map
1:1 to the current Digital SAT domains.

See docs/superpowers/specs/2026-06-13-study-plan-and-forgetting-notes.md.
"""

from typing import Optional

# Official Digital SAT domain frequency (share of scored questions in its
# section). Source: College Board Digital SAT Specifications Overview.
# Keyed by the legacy domain code stored in our DB.
DOMAIN_FREQUENCY = {
    # Math (~44 Q)
    "H":   0.35,   # Heart of Algebra            → Algebra (~35%)
    "Q":   0.35,   # Passport to Advanced Math   → Advanced Math (~35%)
    "P":   0.15,   # Problem Solving & Data      (~15%)
    "S":   0.15,   # Additional Topics (Geo/Trig)(~15%)
    # Reading & Writing (~54 Q)
    "CAS": 0.28,   # Craft and Structure         (~28%)
    "INI": 0.26,   # Information and Ideas       (~26%)
    "SEC": 0.26,   # Standard English Conventions(~26%)
    "EOI": 0.20,   # Expression of Ideas         (~20%)
}
DEFAULT_FREQUENCY = 0.20

# Learnability: how fast a domain tends to improve per hour of study
# (prep-community heuristic, NOT official). Rule-based > comprehension.
LEARNABILITY = {
    "H":   1.15,   # Algebra — procedural, learnable
    "Q":   1.00,   # Advanced Math — mixed
    "P":   1.05,   # Problem Solving & Data — fairly learnable
    "S":   1.05,   # Geo/Trig — formula-driven
    "SEC": 1.20,   # Grammar — discrete rules, fastest gains
    "EOI": 1.15,   # Transitions/rhetorical synthesis — learnable
    "INI": 0.90,   # Information & Ideas — reading comprehension, slow
    "CAS": 0.90,   # Craft & Structure — reading comprehension, slow
}
DEFAULT_LEARNABILITY = 1.0

WEAK_THRESHOLD = 70.0  # accuracy % below which a skill is "weak" (mirror study_plan_service)


def _proximity_exponent(days_until_test: Optional[int]) -> float:
    """
    How sharply to favor high-impact skills as the test nears. Far out → flatter
    (exponent ~1); close → sharper (exponent up to ~1.6), so the most impactful
    skills rise decisively to the top. None (no test date) → neutral.
    """
    if days_until_test is None:
        return 1.0
    if days_until_test <= 7:
        return 1.6
    if days_until_test <= 14:
        return 1.45
    if days_until_test <= 30:
        return 1.25
    if days_until_test <= 60:
        return 1.1
    return 1.0


def priority_score(
    accuracy: float,
    domain_code: Optional[str],
    days_until_test: Optional[int] = None,
) -> float:
    """
    Higher = work this skill sooner. accuracy is the skill's % on the test
    (0–100). Skills at/above mastery get a near-zero weakness factor.
    """
    weakness = max(0.0, (WEAK_THRESHOLD - accuracy)) / WEAK_THRESHOLD  # 0..1
    freq = DOMAIN_FREQUENCY.get(domain_code, DEFAULT_FREQUENCY)
    learn = LEARNABILITY.get(domain_code, DEFAULT_LEARNABILITY)

    impact = freq * learn                      # how much the skill is worth
    exp = _proximity_exponent(days_until_test)
    # Sharpen the impact factor as the test nears; weakness stays linear so a
    # very weak low-impact skill still surfaces, just lower.
    return weakness * (impact ** exp)


def how_many_hero_skills(days_until_test: Optional[int]) -> int:
    """
    How many skills get prominent 'start here' treatment. Closer test → fewer
    heroes (focus); the rest stay visible but quieter. Never zero.
    """
    if days_until_test is None:
        return 3
    if days_until_test <= 7:
        return 1
    if days_until_test <= 14:
        return 2
    if days_until_test <= 30:
        return 3
    return 4
