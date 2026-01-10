# SAT Tutoring Platform - Remaining Work

This document outlines all remaining work needed before the platform is production-ready.

---

## Critical Issues (Must Fix Before Launch)

### 1. Missing Pages (Redirect to Dashboard)
These pages are linked in the UI but have no implementation:

| Page | Link Location | Route Needed | Priority |
|------|--------------|--------------|----------|
| Profile | Header dropdown | `/profile` or `/student/profile` & `/tutor/profile` | High |
| Settings | Header dropdown | `/settings` or `/student/settings` & `/tutor/settings` | High |
| My Progress | Student sidebar | `/student/progress` | High |

**Files to modify:**
- `frontend/src/App.js` - Add routes
- Create new page components in `frontend/src/pages/`

### 2. Production Database Sync
**Issue:** Transitions and Rhetorical Synthesis skills are in wrong domain on deployed database.

**Fix Required:**
```sql
-- Run on Railway PostgreSQL
UPDATE skills SET domain_id = 7 WHERE id IN (55, 56);
UPDATE questions SET domain_id = 7 WHERE skill_id IN (55, 56);
```

### 3. Email System Not Implemented
**Location:** `backend/app/api/v1/auth.py` lines 253-296

**Current state:**
- Password reset only works in development (hardcoded localhost URL)
- No actual emails are sent

**Required:**
- [ ] Set up email service (SendGrid, AWS SES, or similar)
- [ ] Add email configuration to settings
- [ ] Implement `send_password_reset_email()` function
- [ ] Update reset URL to use environment variable for production domain

### 4. Reference Sheet Missing from Adaptive Practice
**Location:** `frontend/src/pages/student/AdaptivePracticePage.jsx`

**Required:**
- [ ] Import ReferenceSheet component
- [ ] Add state for `showReferenceSheet`
- [ ] Add Reference Sheet button to header (for math questions)
- [ ] Render ReferenceSheet component

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
- [ ] Set `ALLOWED_ORIGINS` on Railway to include Vercel frontend URL
- [ ] Ensure all production domains are whitelisted

### 7. Remove Debug/Development Code
**Locations:**
- `backend/app/api/v1/assess.py` lines 544, 548-549, 551 - print statements
- `frontend/src/services/api.js` line 13 - console.log for API URL

**Required:**
- [ ] Remove or convert to proper logging
- [ ] Use conditional logging based on environment

### 8. Hardcoded URLs and Secrets
**Locations:**
- `backend/app/api/v1/auth.py` line 286 - `http://localhost:3000/reset-password`
- `backend/app/config.py` - default secret key

**Required:**
- [ ] Move password reset URL to environment variable
- [ ] Ensure SECRET_KEY is set via environment variable in production
- [ ] Add FRONTEND_URL environment variable

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

### 11. Time Tracking in Adaptive Practice
**Location:** `frontend/src/pages/student/AdaptivePracticePage.jsx` line 288

**Current state:** `time_spent_seconds` hardcoded to 60

**Required:**
- [ ] Implement actual time tracking per question
- [ ] Use timer hook to track time spent

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

### 17. Profile & Settings Features
**When implementing Profile page:**
- [ ] Profile picture upload
- [ ] Edit name, email
- [ ] Change password
- [ ] View account statistics

**When implementing Settings page:**
- [ ] Notification preferences
- [ ] Theme/display settings (dark mode?)
- [ ] Timezone settings
- [ ] Privacy settings

### 18. My Progress Page Features
**When implementing:**
- [ ] Overall ability/skill level visualization
- [ ] Progress over time charts
- [ ] Skill breakdown by domain
- [ ] Recent activity
- [ ] Achievements/milestones
- [ ] Areas needing improvement
- [ ] Recommended practice areas

---

## Database Fields Not Yet Utilized

| Field | Model | Purpose | Status |
|-------|-------|---------|--------|
| `subdomains` | Question | Subdomain categorization | Table empty |
| `ability_estimate_before/after` | StudentResponse | IRT tracking | Not populated |
| `ability_se` | StudentSkill | Standard error | Rarely used |
| `profile_data` | User | Extended profile info | No edit form |

---

## Environment Variables Checklist

### Backend (Railway)
```env
# Required
DATABASE_URL=postgresql://...
SECRET_KEY=<strong-random-key>
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app

# Email (when implemented)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
FROM_EMAIL=

# URLs
FRONTEND_URL=https://your-vercel-app.vercel.app

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
- [ ] CORS works from production frontend to backend
- [ ] Database migrations are up to date on production

### Security
- [ ] No hardcoded secrets in code
- [ ] CORS properly configured
- [ ] Rate limiting on auth endpoints
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using ORM)
- [ ] XSS prevention (React handles this)

---

## Deployment Checklist

### Railway (Backend)
1. [ ] Push latest code
2. [ ] Set all environment variables
3. [ ] Run database migrations
4. [ ] Fix skills domain (Transitions, Rhetorical Synthesis)
5. [ ] Verify health endpoint responds

### Vercel (Frontend)
1. [ ] Push latest code
2. [ ] Set REACT_APP_API_URL
3. [ ] Verify build succeeds
4. [ ] Test all major flows

---

## Files Modified in Recent Session

### Frontend
- `src/components/test/ReferenceSheet.jsx` - Fixed triangle labels
- `src/pages/shared/QuestionBankPage.jsx` - Optimized API calls
- `src/services/questionService.js` - Added getQuestionsWithDetails
- `src/services/api.js` - Added timeout and logging

### Backend
- `app/api/v1/questions.py` - Added full parameter, increased limit to 500
- `app/schemas/question.py` - Added QuestionDetailListResponse
- `app/main.py` - Added global exception handler for CORS

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

---

*Last updated: January 2026*
