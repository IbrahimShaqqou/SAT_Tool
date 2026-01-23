# ZooPrep - Remaining Work

This document outlines all remaining work needed before the platform is production-ready.

**Domain:** https://zooprep.com

---

## Critical (Must Fix Before Launch)

### 1. ~~Database Domain Fix~~ DONE
Fixed Transitions and Rhetorical Synthesis skills domain assignment.

### 2. ~~Email System~~ DONE
SendGrid integration complete. Password reset emails working.

**Setup required on Railway:**
1. Add `SENDGRID_API_KEY=SG.xxxxx` environment variable
2. Redeploy

### 3. ~~Admin Role Protection~~ DONE
Protected IRT calibration endpoints with admin-only access.

### 4. ~~Timer Persistence~~ DONE
Timer now persists when students leave and resume assignments.

### 5. ~~User Settings Persistence~~ DONE
Dark mode and timezone settings persist to localStorage.

---

## Completed Recently

- [x] **Admin Role Protection** - Calibration endpoints now require admin access
- [x] **Timer Persistence** - Students can't exploit timer by refreshing
- [x] **Settings Persistence** - Dark mode and timezone saved to localStorage
- [x] **Adaptive Exit Fix** - Exit button now saves progress without grading
- [x] **Time Limit Display** - Timer only shows when tutor sets a time limit
- [x] **Time Expired Tracking** - Tutors see when students ran out of time
- [x] **Skill Selector** - Beautiful domain/skill selector for adaptive assignments
- [x] **Resume Bug Fix** - Students can't uncheck answers by resuming
- [x] **Dark Mode** - Full dark mode support across all pages
- [x] **Email System** - SendGrid integration for password reset emails
- [x] **Token Refresh** - Auto-refreshes access tokens, users stay logged in for 7 days
- [x] **Remember Me** - Saves email on login page
- [x] **Reference Sheet** - Added to Adaptive Practice
- [x] **Time Tracking** - Tracks actual time per question
- [x] **Profile/Settings/Progress Pages** - All implemented

---

## High Priority

### 6. Better Mastery & Ability Scores
**Description:** Current mastery calculation is confusing and may not feel representative.

**Issues:**
- Mastery formula uses complex theta conversion
- Difficulty cap is harsh (easy questions cap at 55% mastery)
- No time decay for skills not practiced
- Volatile with few questions
- No confidence indicator

**Recommended:**
- [ ] Add "confidence" indicator (low/medium/high based on question count)
- [ ] Show tutors: "Mastery: 72% (based on 8 questions)"
- [ ] Add time decay: skills practiced 30+ days ago should fade
- [ ] Require minimum 5 questions before showing numeric mastery
- [ ] Simplify formula: weighted accuracy by difficulty level

### 7. Skill Lessons Enhancement
**Description:** Lessons exist but could be improved.

**Optional enhancements:**
- [ ] Track lesson completion per student
- [ ] Link lessons from Question Bank and Adaptive Practice
- [ ] Admin interface to create/edit lessons

---

## Medium Priority (Enhancements)

### 8. IRT Recalibration
**Location:** `backend/app/services/irt_calibration.py`

**Current state:** `recalibrate_from_responses()` is a placeholder

**Required:**
- [ ] Implement MMLE or EM algorithm for IRT parameter estimation
- [ ] Schedule periodic recalibration
- [ ] Add admin endpoint to trigger recalibration

---

## Low Priority (Nice to Have)

### 9. Admin Panel
- [ ] Admin dashboard with system stats
- [ ] User management (view/edit/delete)
- [ ] Question management
- [ ] IRT calibration controls
- [ ] Lesson management

### 10. Export Functionality
- [ ] PDF export for assessment results, progress reports
- [ ] CSV export for data analysis

### 11. Advanced Analytics
- [ ] Custom date range selection
- [ ] Student vs class average comparisons
- [ ] Trend analysis
- [ ] Skill gap identification

### 12. Real-Time Features
- [ ] WebSocket for live updates
- [ ] Tutor viewing student progress in real-time

### 13. UI Enhancements
- [ ] Profile picture upload
- [ ] Progress over time charts
- [ ] Achievements/milestones

---

## Environment Variables Checklist

### Backend (Railway)
```env
# Required
DATABASE_URL=postgresql://...
SECRET_KEY=<strong-random-key>
ALLOWED_ORIGINS=https://zooprep.com,https://www.zooprep.com
FRONTEND_URL=https://zooprep.com

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxxx
FROM_EMAIL=noreply@zooprep.com

# Optional
SENTRY_DSN=
```

### Frontend (Vercel)
```env
REACT_APP_API_URL=https://your-railway-app.up.railway.app/api/v1
```

---

## Quick Reference: File Locations

| Feature | Frontend | Backend |
|---------|----------|---------|
| Authentication | `pages/auth/*` | `api/v1/auth.py` |
| Assignments | `pages/*/AssignmentsPage.jsx` | `api/v1/assignments.py` |
| Questions | `pages/*/QuestionBankPage.jsx` | `api/v1/questions.py` |
| Adaptive | `pages/student/AdaptivePracticePage.jsx` | `api/v1/adaptive.py` |
| IRT | N/A | `services/irt_service.py` |
| Profile | `pages/shared/ProfilePage.jsx` | `api/v1/auth.py` |
| Settings | `pages/shared/SettingsPage.jsx` | localStorage (client-side) |
| Progress | `pages/shared/ProgressPage.jsx` | `api/v1/progress.py` |

---

*Last updated: January 2026*
