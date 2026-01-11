# ZooPrep - Remaining Work

This document outlines all remaining work needed before the platform is production-ready.

**Domain:** https://zooprep.com

---

## Critical Issues (Must Fix Before Launch)

### 1. ~~Missing Pages (Redirect to Dashboard)~~ DONE
~~These pages are linked in the UI but have no implementation.~~

**Completed:**
- [x] Created `ProfilePage.jsx` - User profile with edit capability
- [x] Created `SettingsPage.jsx` - Notification and display preferences
- [x] Created `ProgressPage.jsx` - Comprehensive skill progress view
- [x] Added routes for `/student/profile`, `/student/settings`, `/student/progress`
- [x] Added routes for `/tutor/profile`, `/tutor/settings`
- [x] Updated Header.jsx to use role-based navigation

### 2. Production Database Sync
**Issue:** Transitions and Rhetorical Synthesis skills are in wrong domain on deployed database.

**Fix Required (run on Railway PostgreSQL):**
```sql
UPDATE skills SET domain_id = 7 WHERE id IN (55, 56);
UPDATE questions SET domain_id = 7 WHERE skill_id IN (55, 56);
```

### 3. Email System Not Implemented
**Location:** `backend/app/api/v1/auth.py`

**Current state:**
- Password reset URL now uses `FRONTEND_URL` environment variable (fixed)
- No actual emails are sent yet

**Required:**
- [ ] Set up email service (SendGrid, AWS SES, or similar)
- [ ] Add email configuration to settings (SMTP_HOST, SMTP_PORT, etc.)
- [ ] Implement `send_password_reset_email()` function

### 4. ~~Reference Sheet Missing from Adaptive Practice~~ DONE
**Completed:**
- [x] Imported ReferenceSheet component
- [x] Added state for `showReferenceSheet`
- [x] Added Reference Sheet button to header (shows for math questions)
- [x] Renders ReferenceSheet component

---

## High Priority (Should Fix Before Launch)

### 5. Token Refresh Not Implemented
**Location:** `frontend/src/services/api.js` lines 48-55

**Current state:** Token refresh code is commented out

**Required:**
- [ ] Implement token refresh endpoint in backend (if not exists)
- [ ] Uncomment and complete the token refresh logic in frontend
- [ ] Test token expiration and auto-refresh flow

### 6. CORS Configuration for Production
**Location:** `backend/app/config.py` and Railway environment variables

**Required:**
- [ ] Set `ALLOWED_ORIGINS` on Railway to include `https://zooprep.com`
- [ ] Ensure all production domains are whitelisted

### 7. ~~Remove Debug/Development Code~~ DONE
**Completed:**
- [x] Removed print statements from `assess.py` - converted to proper logging
- [x] Removed console.log from `api.js`

### 8. ~~Hardcoded URLs and Secrets~~ DONE
**Completed:**
- [x] Added `FRONTEND_URL` to config.py
- [x] Password reset URL now uses `settings.frontend_url`
- [ ] Ensure SECRET_KEY is set via environment variable in production (already supported)

---

## Medium Priority (Enhancement)

### 9. IRT Response-Based Calibration
**Location:** `backend/app/services/irt_calibration.py` lines 200-231

**Current state:** `recalibrate_from_responses()` is a placeholder returning "not_implemented"

**Required:**
- [ ] Implement MMLE or EM algorithm for IRT parameter estimation
- [ ] Schedule periodic recalibration based on response data
- [ ] Add admin endpoint to trigger recalibration

### 10. Role-Based Authorization on Admin Endpoints
**Locations:**
- `backend/app/api/v1/adaptive.py` lines 819, 841

**Current state:** TODO comments for role checks

**Required:**
- [ ] Add `get_current_admin` or role check dependency
- [ ] Protect calibration endpoints with admin-only access

### 11. ~~Time Tracking in Adaptive Practice~~ DONE
**Completed:**
- [x] Added `questionStartTime` state to track when question was shown
- [x] Calculate actual time spent when submitting answer
- [x] Reset timer when moving to next question

### 12. Notifications System
**Current state:** No notification system exists

**Required:**
- [ ] Email notifications for:
  - Assignment due dates approaching
  - New assignments created
  - Assessment results ready
  - Account verification
- [ ] In-app notification center (optional)

---

## Low Priority (Nice to Have)

### 13. Admin Panel
**Current state:** `UserRole.ADMIN` exists but no admin routes/pages

**Required:**
- [ ] Create admin dashboard
- [ ] User management (view/edit/delete users)
- [ ] System statistics
- [ ] Question management
- [ ] IRT calibration controls

### 14. Export Functionality
**Current state:** Not implemented

**Required:**
- [ ] PDF export for:
  - Assessment results
  - Student progress reports
  - Tutor analytics
- [ ] CSV export for:
  - Question data
  - Response data
  - Analytics data

### 15. Advanced Analytics
**Current state:** Basic implementation

**Required:**
- [ ] Custom date range selection
- [ ] Comparison views (student vs class average)
- [ ] Trend analysis
- [ ] Skill gap identification

### 16. Real-Time Features
**Current state:** No WebSocket implementation

**Optional:**
- [ ] Live score updates
- [ ] Real-time collaboration (tutor viewing student progress)
- [ ] Instant notifications

### 17. Profile & Settings Enhancements
**Current implementation includes:**
- [x] View/edit name
- [x] View email and role
- [x] Change password (redirects to forgot password)
- [x] Notification toggles (UI only, backend storage needed)
- [x] Timezone selection (UI only)

**Future enhancements:**
- [ ] Profile picture upload
- [ ] Persist settings to backend
- [ ] Dark mode implementation

### 18. My Progress Page Enhancements
**Current implementation includes:**
- [x] Overall stats (accuracy, questions answered, assignments, time)
- [x] Skills to focus on (weak skills)
- [x] Strong skills display
- [x] All skills grouped by domain with mastery levels

**Future enhancements:**
- [ ] Progress over time charts
- [ ] Achievements/milestones
- [ ] Recommended practice areas

---

## Database Fields Not Yet Utilized

| Field | Model | Purpose | Status |
|-------|-------|---------|--------|
| `subdomains` | Question | Subdomain categorization | Table empty |
| `ability_estimate_before/after` | StudentResponse | IRT tracking | Now populated |
| `ability_se` | StudentSkill | Standard error | Used in IRT |
| `profile_data` | User | Extended profile info | No edit form |

---

## Environment Variables Checklist

### Backend (Railway)
```env
# Required
DATABASE_URL=postgresql://...
SECRET_KEY=<strong-random-key>
ALLOWED_ORIGINS=https://zooprep.com
FRONTEND_URL=https://zooprep.com

# Email (when implemented)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
FROM_EMAIL=noreply@zooprep.com

# Optional
SENTRY_DSN=
REDIS_URL=
```

### Frontend (Vercel)
```env
REACT_APP_API_URL=https://your-railway-app.up.railway.app/api/v1
```

---

## Testing Checklist

### Before Production
- [ ] All API endpoints return proper error messages
- [ ] Authentication flow works (login, logout, password reset)
- [ ] Assignment creation and completion flow
- [ ] Adaptive practice session flow
- [ ] Question Bank browsing and practice
- [ ] IRT ability estimation updates correctly
- [ ] CORS works from https://zooprep.com to backend
- [ ] Database migrations are up to date on production

### Security
- [ ] No hardcoded secrets in code
- [ ] CORS properly configured for zooprep.com
- [ ] Rate limiting on auth endpoints
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using ORM)
- [ ] XSS prevention (React handles this)

---

## Deployment Checklist

### Railway (Backend)
1. [ ] Push latest code
2. [ ] Set all environment variables:
   - `FRONTEND_URL=https://zooprep.com`
   - `ALLOWED_ORIGINS=https://zooprep.com`
   - `SECRET_KEY=<strong-random-key>`
3. [ ] Run database migrations
4. [ ] Fix skills domain (Transitions, Rhetorical Synthesis) - see SQL above
5. [ ] Verify health endpoint responds

### Vercel (Frontend)
1. [ ] Push latest code
2. [ ] Set `REACT_APP_API_URL` to Railway backend URL
3. [ ] Domain `zooprep.com` is configured
4. [ ] Verify build succeeds
5. [ ] Test all major flows

---

## Files Modified for ZooPrep Rebranding

### Frontend
- `public/index.html` - Updated title and meta description
- `src/components/layout/Sidebar.jsx` - Updated logo text
- `src/components/layout/PublicLayout.jsx` - Updated branding
- `src/pages/student/DashboardPage.jsx` - Updated subtitle
- `src/pages/shared/ProgressPage.jsx` - Updated subtitle
- `package.json` - Updated package name

### Backend
- `app/main.py` - Updated API title, health check, and root endpoint
- `app/config.py` - Updated module docstring

---

## Quick Reference: File Locations

| Feature | Frontend | Backend |
|---------|----------|---------|
| Authentication | `pages/auth/*` | `api/v1/auth.py` |
| Assignments | `pages/*/AssignmentsPage.jsx` | `api/v1/assignments.py` |
| Questions | `pages/*/QuestionBankPage.jsx` | `api/v1/questions.py` |
| Adaptive | `pages/student/AdaptivePracticePage.jsx` | `api/v1/adaptive.py` |
| IRT | N/A | `services/irt_service.py` |
| Assessment | `pages/assess/*` | `api/v1/assess.py` |
| Profile | `pages/shared/ProfilePage.jsx` | `api/v1/auth.py` |
| Settings | `pages/shared/SettingsPage.jsx` | N/A (UI only) |
| Progress | `pages/shared/ProgressPage.jsx` | `api/v1/progress.py` |

---

*Last updated: January 2026*
