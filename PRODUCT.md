# Product

## Register

product

## Users

ZooPrep serves two first-class audiences, equally weighted:

- **Students** (high-school teens prepping for the Digital SAT). They arrive both self-serve (sign up, practice independently, drive their own study plan) and tutor-led (invited by a tutor, completing assigned work). Their context is high-stakes and often high-anxiety: late-night study sessions, timed full-length tests, reviewing why they got a question wrong. The job to be done: raise my SAT score with practice that meets me at my level and tells me exactly what to fix next.
- **Tutors** (the buyer and power user on the managed side). They invite students, assign practice sets, and monitor progress. Their context is triage across a roster: who's struggling, on what skill, and what to assign next. The job to be done: see each student's mastery at a glance and act on it without digging.

## Product Purpose

A Digital SAT tutoring platform built around a 3,271-question College Board-sourced bank with per-skill mastery tracking. Core surfaces: an adaptive (IRT-based) practice engine, a Digital SAT-style full-length test simulator with split-pane passages, a searchable question bank, skill lessons with worked explanations, and a tutor dashboard with student analytics. Success looks like: a student finishes a session knowing their score went up and what to work on; a tutor opens the dashboard and immediately knows where to intervene.

## Brand Personality

Calm and encouraging. The interface should lower test anxiety, not add to it: supportive, reassuring, and clear about progress without being saccharine. Voice is plain and confident, like a good tutor who never talks down to you. Three words: **calm, encouraging, precise**. The emotional goal is steadiness, the feeling that the work is doable and the path is legible, paired with quiet momentum when a student gets something right.

## Anti-references

- **Sterile corporate dashboard.** No gray enterprise-BI feel, no soulless admin-panel density, no walls of data tables. Analytics must feel human and act-on-able, not like a reporting tool.
- **Generic AI-SaaS template.** No indigo gradients, glassmorphism-by-default, hero-metric templates, or identical icon-heading-text card grids. Avoid the 2026 AI-slop look entirely; the existing cyan-teal / mint-emerald identity is the antidote, lean into it.
- (Implied, keep in mind) Not childish or gimmicky either: these are teenagers, not children. No mascots, confetti-spam, or badge-grinding nagging.

## Design Principles

- **Lower the stakes.** Every screen should make a high-pressure task feel more manageable: clear next action, honest-but-kind framing of mistakes, no anxiety-inducing clutter. Calm is a feature.
- **Show the path, not just the score.** Mastery, progress, and "what to do next" are the spine of the product. Numbers always come with a direction to move.
- **Earn premium through restraint.** Apple-like polish: generous whitespace, confident typography, subtle and intentional motion. Quality comes from what's removed and how tuned the details are, not from decoration.
- **Two audiences, one system.** Student and tutor surfaces share the same design language and tokens. A tutor should recognize the student's world; consistency is a feature, not a compromise.
- **Test fidelity is sacred.** The full-length test simulator must feel like the real Digital SAT (split-pane, timer, reference sheet, calculator). In test surfaces, familiarity and zero distraction beat novelty every time.

## Accessibility & Inclusion

Target **WCAG 2.1 AA** as the baseline (inferred default, confirm if a stricter bar is required). Because the test-taking surfaces are high-stakes and used under time pressure by every student:

- Body text ≥4.5:1 contrast; large text ≥3:1. No light-gray body copy on tinted near-white.
- Full keyboard operability for the test interface, question navigation, and forms.
- Honor `prefers-reduced-motion` on all reveal/scroll animations (the landing page already uses scroll-reveal; every motion needs a reduced alternative).
- Color is never the sole carrier of meaning (correct/incorrect, mastery levels) — pair with icon, label, or text.
- Dark mode is a first-class theme, not an afterthought; both themes must meet the same contrast bar.
