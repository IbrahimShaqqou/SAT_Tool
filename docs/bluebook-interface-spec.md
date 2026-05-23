# Bluebook Digital SAT Interface Specification

## Official Bluebook Key Features (to match)

### 1. Test Structure
- **4 Modules Total**:
  - Math Module 1: 22 questions, 35 minutes
  - Math Module 2: 22 questions, 35 minutes  
  - 10-minute break
  - Reading/Writing Module 1: 27 questions, 32 minutes
  - Reading/Writing Module 2: 27 questions, 32 minutes

- **Cannot Navigate Back**: Once you submit a module, you CANNOT return to it
- **Linear Within Module**: Can navigate freely within current module only

### 2. Timer Display
- **Countdown Timer**: Shows MM:SS format
- **Always Visible**: Top right corner of screen
- **Color Warnings**:
  - Normal: Black/dark gray text
  - 5 minutes remaining: Orange/amber warning
  - 1 minute remaining: Red alert
- **Auto-Submit**: When timer hits 0:00, module automatically submits

### 3. Question Navigation
- **Question Numbers**: Grid/list showing all questions in current module
- **Visual Indicators**:
  - Answered: Filled circle or checkmark
  - Unanswered: Empty circle
  - Flagged for Review: Star/flag icon
  - Current: Highlighted/selected state
- **Bottom Bar**: "Question X of Y" indicator
- **Navigation Buttons**: "Back" and "Next" arrows

### 4. Available Tools (Sidebar/Toolbar)
- **Calculator** (Math sections only):
  - Desmos graphing calculator
  - Opens in side panel or overlay
  - Can minimize/maximize
  - Stays open across questions if desired

- **Reference Sheet** (Math sections):
  - Geometry formulas
  - Opens as modal/overlay
  - Can be accessed any time during Math modules

- **Mark for Review**:
  - Flag icon button
  - Allows students to mark questions to revisit
  - Shows in question navigation grid

- **Annotations** (Digital highlighting):
  - Highlight text in passages (Reading/Writing)
  - Strikethrough answer choices (process of elimination)
  - Notes/annotations may be available

### 5. Layout
- **Clean, Minimal Design**:
  - White/light gray background
  - Sans-serif font (readable, likely Arial or similar)
  - Good spacing between elements
  - No distractions

- **Two-Column for Reading**:
  - Left: Passage text
  - Right: Question and answer choices
  - Resizable divider in some implementations

- **Single Column for Math**:
  - Question at top
  - Answer choices below
  - Space for calculator/tools on side

### 6. Question Display
- **Question Number**: Top left (e.g., "Question 5")
- **Mark for Review Button**: Top right
- **Question Text**: Clear, large font
- **Answer Choices**:
  - Radio buttons for multiple choice
  - Text input for student-produced response (SPR)
  - Letters A, B, C, D clearly labeled

### 7. Module Transitions
- **Module Complete Screen**:
  - "You have completed Module X"
  - Option to review answers before submitting
  - "Submit Module" button (primary action)
  - Warning: "You cannot return to this module after submitting"

- **Break Screen**:
  - "Break Time - X minutes"
  - Countdown timer for break
  - "Resume Test" button (available after minimum time or can skip)
  - Recommendation to stretch, use restroom, etc.

- **Module Start Screen**:
  - "Module X: [Math/Reading and Writing]"
  - Number of questions and time limit
  - "Start Module" button
  - Timer doesn't start until button clicked

### 8. Colors & Branding
- **College Board Blue**: #0077C8 (primary brand color)
- **Neutrals**: Grays and whites for backgrounds
- **Green**: For correct answers (in practice mode)
- **Red**: For incorrect answers (in practice mode) and timer warnings
- **Orange**: For timer warnings (5 min remaining)

### 9. Responsive Design
- **Works on**:
  - Desktop (Windows/Mac)
  - iPad
  - Chromebook
- **Minimum Resolution**: Designed for standard laptop/tablet screens
- **Touch-Friendly**: Large tap targets for touch devices

### 10. Accessibility
- **Screen Reader Support**: ARIA labels
- **Keyboard Navigation**: Tab, Enter, Arrow keys
- **High Contrast Mode**: Available for visual impairments
- **Text-to-Speech**: Available in accessibility settings

## Implementation Priorities for Our Platform

### Must-Have (Match Bluebook Exactly):
1. ✅ 4-module structure with correct timing
2. ✅ Cannot navigate back to previous modules
3. ✅ Countdown timer with auto-submit
4. ✅ Module submission workflow with confirmation
5. ✅ 10-minute break between Math and Reading/Writing

### Should-Have (Core Features):
6. Question navigation grid/list
7. Mark for Review functionality
8. Calculator integration (Desmos)
9. Reference sheet modal
10. Module start/complete screens

### Nice-to-Have (Enhanced Features):
11. Annotation tools (highlight, strikethrough)
12. Two-column layout for reading passages
13. Timer color warnings (5 min, 1 min)
14. Keyboard shortcuts
15. High contrast mode

## UI/UX Decisions for Our Platform

### What We'll Match Exactly:
- Module structure (4 modules, timing, breaks)
- Timer behavior (countdown, auto-submit)
- Navigation restrictions (can't go back)
- Question numbering and progress indicators
- Calculator and reference sheet availability

### What We'll Adapt:
- **Styling**: Use our existing design system (Tailwind) while keeping the clean, minimal aesthetic
- **Colors**: Use our brand colors but maintain similar visual hierarchy
- **Layout**: Match the general structure but optimize for our existing components
- **Features**: Include practice-specific features (check answer, explanations) that don't exist in real SAT

### Practice Mode Enhancements (Not in Bluebook):
- "Check Answer" button (immediate feedback)
- Step-by-step explanations after checking
- Skill breakdown in results
- Score comparison to previous attempts
- Ability to pause (not available on real SAT)

## Technical Implementation Notes

### Frontend Components to Build:
1. `FullLengthTestPage.jsx` - Main test container
2. `ModuleStartScreen.jsx` - "Start Module" screen
3. `ModuleTestInterface.jsx` - Active test-taking UI
4. `ModuleCompleteScreen.jsx` - Review before submit
5. `BreakScreen.jsx` - 10-minute break timer
6. `FullLengthResultsPage.jsx` - Final score report

### State Management:
- Current module number (1-4)
- Module status (not_started, in_progress, completed)
- Timer state per module
- Answers per module (can't change after submit)
- Flagged questions per module
- Break timer state

### API Integration:
- GET /practice/full-length/{id} - Load test
- POST /practice/full-length/modules/{id}/start - Start module timer
- GET /practice/full-length/modules/{id}/questions - Load questions
- POST /practice/full-length/modules/{id}/submit - Submit module
- GET /practice/full-length/{id}/results - Final scores

## References
- College Board Bluebook: https://bluebook.collegeboard.org
- Official SAT: https://satsuite.collegeboard.org
- Digital SAT Guide: Available within Bluebook app

## Screenshots Needed
- [ ] Module start screen
- [ ] Active test interface
- [ ] Question navigation grid
- [ ] Calculator interface
- [ ] Reference sheet
- [ ] Module complete screen
- [ ] Break screen
- [ ] Results screen

---

**Last Updated**: 2026-05-22
**Status**: Ready for implementation
