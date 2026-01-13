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

**Files created/modified:**
- `backend/app/services/email_service.py` - Email sending utilities
- `backend/app/config.py` - SendGrid configuration
- `backend/app/api/v1/auth.py` - Password reset sends email
- `backend/requirements.txt` - Added sendgrid==6.11.0

---

## Completed Recently

- [x] **Dark Mode** - Full dark mode support across all pages, components, charts, calculator, and reference sheet. Toggle in Settings.
- [x] **Email System** - SendGrid integration for password reset emails
- [x] **Token Refresh** - Auto-refreshes access tokens, users stay logged in for 7 days
- [x] **Remember Me** - Saves email on login page
- [x] **Registration Bug Fix** - Fixed password field issue on validation errors
- [x] **Reference Sheet** - Added to Adaptive Practice
- [x] **Time Tracking** - Tracks actual time per question
- [x] **Profile/Settings/Progress Pages** - All implemented
- [x] **ZooPrep Branding** - Updated throughout

---

## High Priority

### 3. Skill Lessons (NEW)
**Description:** Educational content for each skill to help students learn concepts before practicing.

**Required:**
- [ ] Create `Lesson` model in backend (linked to skills)
- [ ] Admin interface to create/edit lessons
- [ ] Lesson content editor (rich text/markdown)
- [ ] Student lesson viewer page
- [ ] Track lesson completion
- [ ] Link lessons from Question Bank and Adaptive Practice
- [ ] Optional: Video embed support

### 4. Admin Role Protection
**Locations:** `backend/app/api/v1/adaptive.py`

**Required:**
- [ ] Add `get_current_admin` dependency
- [ ] Protect calibration endpoints with admin-only access

---

## Medium Priority (Enhancements)

### 5. IRT Recalibration
**Location:** `backend/app/services/irt_calibration.py`

**Current state:** `recalibrate_from_responses()` is a placeholder

**Required:**
- [ ] Implement MMLE or EM algorithm for IRT parameter estimation
- [ ] Schedule periodic recalibration
- [ ] Add admin endpoint to trigger recalibration

### 6. Notifications System
**Required:**
- [ ] Email notifications for:
  - Assignment due dates approaching
  - New assignments created
  - Assessment results ready
- [ ] In-app notification center (optional)

### 7. Persist User Settings
**Current state:** Settings page is UI-only

**Required:**
- [ ] Add settings fields to User model or create UserSettings table
- [ ] API endpoints to save/load settings
- [ ] Connect frontend to backend

---

## Low Priority (Nice to Have)

### 8. Admin Panel
- [ ] Admin dashboard with system stats
- [ ] User management (view/edit/delete)
- [ ] Question management
- [ ] IRT calibration controls
- [ ] Lesson management

### 9. Export Functionality
- [ ] PDF export for assessment results, progress reports
- [ ] CSV export for data analysis

### 10. Advanced Analytics
- [ ] Custom date range selection
- [ ] Student vs class average comparisons
- [ ] Trend analysis
- [ ] Skill gap identification

### 11. Real-Time Features
- [ ] WebSocket for live updates
- [ ] Tutor viewing student progress in real-time

### 12. UI Enhancements
- [ ] Profile picture upload
- [x] ~~Dark mode~~ DONE
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
| Settings | `pages/shared/SettingsPage.jsx` | N/A (UI only) |
| Progress | `pages/shared/ProgressPage.jsx` | `api/v1/progress.py` |

---

*Last updated: January 2026*
