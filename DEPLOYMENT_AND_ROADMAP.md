# SAT Tutoring Platform - Missing Features, Security & Deployment Guide

> **Last Updated**: December 2024

---

## Table of Contents

1. [Missing Features & Roadmap](#missing-features--roadmap)
2. [Current Security Implementation](#current-security-implementation)
3. [Security Improvements Needed](#security-improvements-needed)
4. [What Needs to Be Hosted](#what-needs-to-be-hosted)
5. [Deployment Options (Cheapest to Production)](#deployment-options)
6. [Step-by-Step Deployment Guide](#step-by-step-deployment-guide)
7. [Cost Estimates](#cost-estimates)

---

## Missing Features & Roadmap

### Critical (Must Have Before Launch)

| Feature | Description | Effort |
|---------|-------------|--------|
| **Email Verification** | Verify email on registration, prevent fake accounts | 1-2 days |
| **Password Reset** | "Forgot password" flow with email link | 1 day |
| **Rate Limiting** | Prevent brute force attacks on login | 0.5 day |
| **Input Sanitization** | XSS protection on HTML content display | 0.5 day |
| **HTTPS Enforcement** | Force all traffic through HTTPS | Config only |
| **Production Secrets** | Strong SECRET_KEY, database passwords | Config only |
| **Error Logging** | Structured logging with Sentry or similar | 1 day |

### High Priority (Should Have)

| Feature | Description | Effort |
|---------|-------------|--------|
| **Question Bank Browser** | Browse all questions by domain/skill, search, filter, preview | 2-3 days |
| **Per-Skill Lessons** | Educational content (text/video) for each skill, shown before practice | 3-5 days |
| **Admin Dashboard** | Manage users, view system stats, moderate content | 3-5 days |
| **Question Editor** | Add/edit/delete questions via UI (not just import) | 3-4 days |
| **Tutor Approval Flow** | Admin approves tutor accounts before activation | 1 day |
| **Student Invitation Email** | Send invite links via email directly | 1 day |
| **Session Timeout Warning** | Warn users before JWT expires, auto-refresh | 0.5 day |
| **Bulk Student Import** | CSV upload for tutors to add multiple students | 1 day |
| **Export Data** | Export student progress to PDF/CSV for tutors | 2 days |
| **Notifications System** | In-app notifications for assignments, due dates | 2-3 days |

### Medium Priority (Nice to Have)

| Feature | Description | Effort |
|---------|-------------|--------|
| **Email Notifications** | Assignment reminders, progress summaries | 2 days |
| **Mobile Responsive Polish** | Better mobile test-taking experience | 2-3 days |
| **Dark Mode** | Theme toggle for UI | 1 day |
| **Practice History Page** | Dedicated page for all past practice sessions | 1 day |
| **Bookmark Questions** | Save questions for later review | 1 day |
| **Notes on Questions** | Students can add personal notes to questions | 1 day |
| **Tutor Notes on Students** | Private notes about student progress | 1 day |
| **Multi-Tutor Support** | Students can have multiple tutors | 2 days |
| **Class/Group Management** | Tutors can create classes, assign to groups | 3 days |

### Lower Priority (Future Enhancements)

| Feature | Description | Effort |
|---------|-------------|--------|
| **OAuth/SSO** | Login with Google, Apple, Clever | 2-3 days |
| **Study Plan Generator** | AI-generated weekly study plans | 3-5 days |
| **Peer Comparison** | Percentile rankings, cohort analytics | 2 days |
| **Gamification** | Badges, streaks, leaderboards | 3-4 days |
| **Parent Dashboard** | View-only access for parents | 2 days |
| **Full-Length Practice Tests** | Timed full SAT simulations | 2-3 days |
| **Writing Section Scoring** | Essay grading with AI | 5+ days |
| **Video Explanations** | Embed video solutions for questions | 1-2 days |
| **IRT Parameter Calibration** | Empirical calibration from response data | 5+ days |
| **A/B Testing Framework** | Test different adaptive algorithms | 3-5 days |
| **API Rate Limiting Tiers** | Different limits for free vs paid users | 2 days |
| **Subscription/Payments** | Stripe integration for paid plans | 3-5 days |

### Technical Debt

| Item | Description | Effort |
|------|-------------|--------|
| **Test Coverage** | Add unit tests for IRT calculations, API endpoints | 3-5 days |
| **API Documentation** | Auto-generate OpenAPI docs, add examples | 1 day |
| **Database Migrations** | Proper Alembic migration files for all changes | 1 day |
| **Caching Layer** | Redis caching for frequently accessed data | 2 days |
| **Query Optimization** | N+1 query fixes, indexing audit | 2 days |
| **Frontend Build Optimization** | Code splitting, lazy loading | 1 day |
| **Accessibility Audit** | WCAG compliance, screen reader testing | 2-3 days |

---

## Current Security Implementation

### What's Already Implemented

| Security Feature | Implementation | Status |
|-----------------|----------------|--------|
| **Password Hashing** | bcrypt via passlib | Complete |
| **JWT Authentication** | HS256 signed tokens | Complete |
| **Access/Refresh Tokens** | 30 min access, 7 day refresh | Complete |
| **Role-Based Access** | Student/Tutor/Admin roles | Complete |
| **CORS Configuration** | Configurable allowed origins | Complete |
| **Non-Root Container** | Dockerfile runs as appuser | Complete |
| **SQL Injection Protection** | SQLAlchemy ORM (parameterized queries) | Complete |
| **Input Validation** | Pydantic schemas on all endpoints | Complete |

### Current Security Configuration

```python
# backend/app/config.py
secret_key: str = "change-this-in-production-use-strong-random-key"
algorithm: str = "HS256"
access_token_expire_minutes: int = 30
refresh_token_expire_days: int = 7
```

### Authentication Flow

```
1. User registers → password hashed with bcrypt → stored in DB
2. User logs in → password verified → JWT access + refresh tokens issued
3. API requests include "Authorization: Bearer <access_token>"
4. Token expires after 30 min → use refresh token to get new access token
5. Refresh token expires after 7 days → must re-login
```

---

## Security Improvements Needed

### Critical (Before Production)

#### 1. Strong Secret Key
```bash
# Generate a strong secret key
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Set in production:
```bash
SECRET_KEY=<64-character-random-string>
```

#### 2. HTTPS Only
```python
# Add to FastAPI app
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

if settings.environment == "production":
    app.add_middleware(HTTPSRedirectMiddleware)
```

#### 3. Rate Limiting
```python
# Install slowapi
# pip install slowapi

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/v1/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, ...):
    ...
```

#### 4. Password Requirements
```python
# Add to registration schema
from pydantic import validator

class UserCreate(BaseModel):
    password: str

    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain a digit')
        return v
```

#### 5. Secure Cookie Settings (for refresh token)
```python
response.set_cookie(
    key="refresh_token",
    value=refresh_token,
    httponly=True,      # Prevents JavaScript access
    secure=True,        # HTTPS only
    samesite="strict",  # CSRF protection
    max_age=7*24*60*60  # 7 days
)
```

#### 6. Database Connection Security
```bash
# Production .env
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
```

### Recommended (Post-Launch)

| Improvement | Description |
|-------------|-------------|
| **Token Blacklist** | Invalidate tokens on logout (use Redis) |
| **Account Lockout** | Lock after 5 failed login attempts |
| **2FA/MFA** | Optional two-factor authentication |
| **Audit Logging** | Log all sensitive operations |
| **Content Security Policy** | CSP headers to prevent XSS |
| **Security Headers** | HSTS, X-Frame-Options, etc. |
| **Dependency Scanning** | Regular vulnerability scans (Snyk, Dependabot) |

---

## What Needs to Be Hosted

### Components Overview

| Component | Type | Purpose | Data Persistence |
|-----------|------|---------|------------------|
| **PostgreSQL** | Database | All application data | Yes (critical) |
| **Redis** | Cache | Session cache, rate limiting | Optional (can rebuild) |
| **FastAPI Backend** | API Server | Business logic, authentication | Stateless |
| **React Frontend** | Static Files | User interface | Stateless |
| **File Storage** | Object Storage | Question images (if any) | Yes |

### Data Storage Requirements

| Data Type | Current Size | Growth Rate | Backup Frequency |
|-----------|--------------|-------------|------------------|
| Questions | ~50 MB (3,271 questions) | Slow | Weekly |
| User Accounts | Small | ~1 KB/user | Daily |
| Student Responses | Medium | ~0.5 KB/response | Daily |
| Test Sessions | Medium | ~2 KB/session | Daily |
| **Total Estimate** | ~100 MB start | ~10 MB/month with 100 users | - |

### Bandwidth Estimates

| Traffic Type | Per Page Load | Per Test Session |
|--------------|---------------|------------------|
| API Calls | ~50 KB | ~500 KB |
| Static Assets | ~500 KB (cached) | 0 (cached) |
| Images | ~200 KB | ~1 MB (math diagrams) |

---

## Deployment Options

### Option 1: Ultra-Cheap (Hobby/Testing) - $0-5/month

**Best For**: Personal use, demos, development

| Service | Provider | Cost |
|---------|----------|------|
| Database | Supabase Free (500 MB) | $0 |
| Backend | Railway Free (500 hrs/mo) | $0 |
| Frontend | Vercel/Netlify Free | $0 |
| **Total** | | **$0** |

**Limitations**:
- Railway sleeps after inactivity (cold starts)
- Supabase pauses after 1 week inactivity
- No custom domain SSL on some free tiers

---

### Option 2: Budget Production - $10-25/month

**Best For**: Small tutoring business (1-10 tutors, up to 100 students)

| Service | Provider | Cost |
|---------|----------|------|
| Database | Supabase Pro (8 GB) | $25/mo |
| -or- | Railway Postgres | $5/mo |
| -or- | Neon Free Tier (0.5 GB) | $0 |
| Backend | Railway Hobby | $5/mo |
| -or- | Render Free | $0 |
| -or- | Fly.io (256 MB) | $0-5/mo |
| Frontend | Vercel Free | $0 |
| **Total** | | **$5-25/mo** |

**Recommended Stack**:
```
Frontend: Vercel (free, auto-deploys from GitHub)
Backend: Railway ($5/mo, includes 500 hrs execution)
Database: Supabase ($25/mo) or Railway Postgres ($5/mo)
```

---

### Option 3: Production Ready - $50-100/month

**Best For**: Growing business (10+ tutors, 500+ students)

| Service | Provider | Cost |
|---------|----------|------|
| Database | DigitalOcean Managed Postgres | $15/mo |
| -or- | AWS RDS (db.t3.micro) | $15/mo |
| Backend | DigitalOcean App Platform | $12/mo |
| -or- | Fly.io (1 GB RAM) | $15/mo |
| Redis | DigitalOcean Managed Redis | $15/mo |
| -or- | Upstash (serverless) | $0-10/mo |
| Frontend | Vercel Pro | $20/mo |
| -or- | Cloudflare Pages | $0 |
| CDN/SSL | Cloudflare Free | $0 |
| Monitoring | Sentry Free Tier | $0 |
| **Total** | | **$50-75/mo** |

---

### Option 4: Single VPS (All-in-One) - $6-24/month

**Best For**: Full control, simple setup, cost-effective

| Provider | RAM | Storage | Cost |
|----------|-----|---------|------|
| Hetzner Cloud (CPX11) | 2 GB | 40 GB | $4.50/mo |
| DigitalOcean Basic | 1 GB | 25 GB | $6/mo |
| DigitalOcean Basic | 2 GB | 50 GB | $12/mo |
| Linode Nanode | 1 GB | 25 GB | $5/mo |
| Vultr | 1 GB | 25 GB | $5/mo |

**What runs on the VPS**:
- PostgreSQL (in Docker)
- Redis (in Docker)
- FastAPI backend (in Docker)
- Nginx (reverse proxy + serve frontend)
- Let's Encrypt SSL (Certbot)

**Pros**: Cheapest for full control, no vendor lock-in
**Cons**: You manage security updates, backups, scaling

---

### Option 5: AWS/GCP/Azure (Enterprise) - $100+/month

**Best For**: Enterprise scale, compliance requirements

Not recommended until you have significant revenue or specific compliance needs.

---

## Step-by-Step Deployment Guide

### Recommended: Option 2 (Railway + Vercel)

#### Step 1: Prepare Production Config

Create `backend/.env.production`:
```bash
# Generate these securely!
SECRET_KEY=<generate-64-char-random-string>
DATABASE_URL=<from-railway-postgres>
REDIS_URL=<from-railway-redis-or-upstash>
ENVIRONMENT=production
DEBUG=false
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

#### Step 2: Deploy Database (Railway)

1. Go to [railway.app](https://railway.app)
2. Create new project → Add PostgreSQL
3. Copy the `DATABASE_URL` from the Variables tab
4. (Optional) Add Redis plugin

#### Step 3: Deploy Backend (Railway)

1. In same Railway project, click "New Service"
2. Connect your GitHub repo
3. Set root directory to `/backend`
4. Add environment variables:
   ```
   DATABASE_URL=<from-step-2>
   SECRET_KEY=<strong-random-key>
   ENVIRONMENT=production
   DEBUG=false
   ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
   ```
5. Railway auto-detects Dockerfile and deploys

#### Step 4: Run Database Migrations

In Railway, open the backend service shell:
```bash
alembic upgrade head
# Or if using raw SQL:
python -c "from app.db.init_db import init_db; init_db()"
```

#### Step 5: Import Questions

```bash
# In Railway shell
python -c "
from app.db.session import SessionLocal
from app.services.question_import import import_math_questions, import_reading_questions
db = SessionLocal()
import_math_questions(db, 'data/math_norm.json', 'initial')
import_reading_questions(db, 'data/reading_norm.json', 'initial')
db.close()
"
```

#### Step 6: Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Set root directory to `/frontend`
4. Add environment variable:
   ```
   REACT_APP_API_URL=https://your-backend.up.railway.app/api/v1
   ```
5. Deploy

#### Step 7: Configure Custom Domain (Optional)

1. In Vercel: Settings → Domains → Add your domain
2. Update DNS records as instructed
3. Vercel auto-provisions SSL certificate

#### Step 8: Update CORS

Update Railway backend environment:
```
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

---

### Alternative: Option 4 (Single VPS with Docker)

#### Step 1: Provision VPS

1. Create account at Hetzner, DigitalOcean, or Linode
2. Create smallest VPS (1-2 GB RAM, Ubuntu 22.04)
3. Note the IP address

#### Step 2: Initial Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Create app user
adduser satapp
usermod -aG docker satapp
```

#### Step 3: Clone and Configure

```bash
su - satapp
git clone https://github.com/your-repo/SAT_Tool.git
cd SAT_Tool

# Create production env file
cat > .env.production << 'EOF'
SECRET_KEY=<generate-strong-key>
DATABASE_URL=postgresql://sat_user:strong_db_password@postgres:5432/sat_tutor
REDIS_URL=redis://redis:6379/0
ENVIRONMENT=production
DEBUG=false
ALLOWED_ORIGINS=https://your-domain.com
EOF
```

#### Step 4: Create Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: sat_user
      POSTGRES_PASSWORD: ${DB_PASSWORD:-strong_password_here}
      POSTGRES_DB: sat_tutor
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: always

  backend:
    build: ./backend
    env_file: .env.production
    depends_on:
      - postgres
      - redis
    restart: always

  frontend:
    build:
      context: ./frontend
      args:
        REACT_APP_API_URL: https://your-domain.com/api/v1
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - backend
      - frontend
    restart: always

volumes:
  postgres_data:
  redis_data:
```

#### Step 5: Setup Nginx and SSL

```bash
# Install certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Create nginx config (nginx.conf)
```

#### Step 6: Deploy

```bash
docker compose -f docker-compose.prod.yml up -d
```

#### Step 7: Setup Backups

```bash
# Daily database backup cron job
crontab -e

# Add line:
0 3 * * * docker exec sat-postgres pg_dump -U sat_user sat_tutor | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

---

## Cost Estimates

### Monthly Cost Summary

| Scale | Users | Option | Monthly Cost |
|-------|-------|--------|--------------|
| Hobby | 1-5 | Free tiers | $0 |
| Small | 10-50 | Railway + Vercel | $10-25 |
| Medium | 50-200 | DigitalOcean stack | $50-75 |
| Single VPS | Any | Hetzner/DO | $6-24 |
| Large | 500+ | AWS/dedicated | $100+ |

### One-Time Costs

| Item | Cost | Notes |
|------|------|-------|
| Domain name | $10-15/year | Namecheap, Cloudflare |
| SSL Certificate | $0 | Let's Encrypt (free) |
| Email sending | $0-20/mo | SendGrid free tier (100/day) |

### Annual Cost Estimate (Small Business)

| Item | Annual Cost |
|------|-------------|
| Hosting (Railway + Vercel) | $120-300 |
| Domain | $12 |
| Email (SendGrid starter) | $0-240 |
| **Total** | **$132-552/year** |

---

## Deployment Checklist

### Before Launch

- [ ] Generate strong SECRET_KEY (64+ characters)
- [ ] Set strong database password
- [ ] Enable HTTPS only
- [ ] Configure production CORS origins
- [ ] Set DEBUG=false
- [ ] Set up error monitoring (Sentry)
- [ ] Configure rate limiting
- [ ] Test password reset flow
- [ ] Test email verification (if implemented)
- [ ] Run security headers check (securityheaders.com)
- [ ] Test on mobile devices
- [ ] Set up database backups
- [ ] Document recovery procedures

### After Launch

- [ ] Monitor error rates
- [ ] Set up uptime monitoring (UptimeRobot - free)
- [ ] Review access logs weekly
- [ ] Update dependencies monthly
- [ ] Rotate secrets quarterly
- [ ] Test backup restoration quarterly

---

## Quick Start Commands

### Local Development
```bash
# Start everything
docker compose up -d

# View logs
docker compose logs -f backend

# Run migrations
docker compose exec backend alembic upgrade head
```

### Production (Railway)
```bash
# Deploy is automatic on git push

# Run one-off command
railway run python -c "..."

# View logs
railway logs
```

### Production (VPS)
```bash
# Deploy updates
git pull && docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Backup database
docker exec sat-postgres pg_dump -U sat_user sat_tutor > backup.sql
```

---

## Feature Specifications: Question Bank & Lessons

### Question Bank Browser

**Purpose**: Allow tutors and students to explore the full question bank, organized by skill and domain.

**Pages**:
- `/tutor/questions` - Tutor question bank (full access)
- `/student/questions` - Student question bank (practice-focused)

**Features**:

| Feature | Description |
|---------|-------------|
| **Domain Tabs** | Filter by Math or Reading & Writing |
| **Skill Tree** | Expandable tree: Domain → Skills |
| **Question List** | Questions for selected skill with difficulty badges |
| **Search** | Search question text, filter by difficulty |
| **Preview Modal** | View question, choices, explanation without starting session |
| **Quick Practice** | "Practice This Skill" button → starts adaptive session |
| **Question Stats** | Show total questions per skill, avg difficulty |
| **Tutor: Assign** | Select questions to create custom assignment |

**API Endpoints Needed**:
```
GET /api/v1/questions/by-skill?skill_id=X     # Questions grouped by skill
GET /api/v1/questions/search?q=term           # Full-text search
GET /api/v1/taxonomy/tree                      # Full domain/skill tree with counts
```

**Database**: No changes needed (questions already have skill_id, domain_id)

**Effort**: 2-3 days

---

### Per-Skill Lessons

**Purpose**: Educational content (text, video, examples) for each skill, shown before or during practice.

**New Database Model**:
```python
class SkillLesson(Base):
    __tablename__ = "skill_lessons"

    id = Column(Integer, primary_key=True)
    skill_id = Column(Integer, ForeignKey("skills.id"), unique=True)

    # Content
    title = Column(String(200))
    summary = Column(Text)                    # Brief overview (shown in skill browser)
    content_html = Column(Text)               # Full lesson content
    video_url = Column(String(500))           # Optional YouTube/Vimeo embed

    # Examples
    worked_examples_json = Column(JSONB)      # Step-by-step examples

    # Metadata
    estimated_minutes = Column(Integer)       # Reading time
    difficulty_level = Column(String(20))     # beginner/intermediate/advanced
    prerequisites = Column(JSONB)             # List of skill_ids to learn first

    # Status
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    created_by_id = Column(UUID, ForeignKey("users.id"))  # Tutor/admin who wrote it
```

**Pages**:
- `/student/learn/:skillId` - View lesson for a skill
- `/tutor/lessons` - Manage lessons (create/edit)
- `/tutor/lessons/:skillId/edit` - Lesson editor

**Features**:

| Feature | Description |
|---------|-------------|
| **Lesson Viewer** | Rich HTML content with math rendering (KaTeX) |
| **Video Embed** | YouTube/Vimeo player integration |
| **Worked Examples** | Step-by-step solutions with "show next step" |
| **"Start Practice"** | Button at end of lesson → adaptive practice for skill |
| **Progress Tracking** | Mark lessons as read, track time spent |
| **Lesson Editor** | WYSIWYG editor for tutors to create content |
| **Prerequisite Chain** | "Learn these first" suggestions |

**API Endpoints Needed**:
```
GET /api/v1/lessons/:skillId          # Get lesson for skill
GET /api/v1/lessons                   # List all lessons (with filters)
POST /api/v1/lessons                  # Create lesson (tutor/admin)
PATCH /api/v1/lessons/:skillId        # Update lesson
DELETE /api/v1/lessons/:skillId       # Delete lesson

POST /api/v1/lessons/:skillId/progress   # Mark as read/track time
GET /api/v1/lessons/progress             # Get user's lesson progress
```

**Integration Points**:
- Dashboard "Areas to Improve" → Link to lesson before practice
- Adaptive practice → "Review lesson" link when struggling
- Question explanation → "Learn more about this skill" link

**Effort**: 3-5 days (depends on editor complexity)

---

## When to Deploy

### Deployment Readiness Assessment

| Category | Current Status | Deploy Blocker? |
|----------|----------------|-----------------|
| **Core Features** | Complete (auth, tests, adaptive, intake) | No |
| **Security** | Basic (needs hardening) | **Yes** |
| **Question Bank** | 3,271 questions loaded | No |
| **IRT System** | Fully functional | No |
| **Error Handling** | Basic | No (but add monitoring) |
| **Mobile Support** | Functional but not optimized | No |

### Minimum Viable Deployment Checklist

**Must complete before ANY public access:**

- [ ] Generate strong SECRET_KEY (64+ chars)
- [ ] Set strong database password
- [ ] Enable HTTPS (automatic with Railway/Vercel)
- [ ] Add rate limiting on `/auth/login` (prevent brute force)
- [ ] Test all critical flows work in production

**Should complete before inviting users:**

- [ ] Password reset flow
- [ ] Basic error monitoring (Sentry free tier)
- [ ] Database backup automation
- [ ] Test on mobile devices

### Recommended Deployment Timeline

```
PHASE 1: Soft Launch (Deploy Now - 1 week)
├── Deploy to Railway + Vercel
├── Security hardening (secrets, rate limiting)
├── You + 1-2 test users only
├── Find and fix bugs
└── Verify IRT works correctly in production

PHASE 2: Beta Launch (Week 2-3)
├── Add password reset
├── Add error monitoring
├── Invite 5-10 real students
├── Gather feedback
└── Fix UX issues

PHASE 3: Limited Launch (Week 4-6)
├── Add Question Bank Browser
├── Open to tutors you know
├── Add email notifications (optional)
└── 50-100 users

PHASE 4: Public Launch (Week 8+)
├── Add Per-Skill Lessons
├── Marketing / public signup
├── Monitor scaling needs
└── Add admin dashboard as needed
```

### Deploy NOW If...

You should deploy immediately (soft launch) if:

- You want to test with real users (even just yourself)
- You need to demo to potential tutors/investors
- You want to validate the product before building more features
- You're comfortable being the only user initially

**The platform is functional enough to deploy today** for internal testing. The core value proposition (adaptive SAT practice with IRT) works.

### Wait to Deploy If...

Consider waiting if:

- You need password reset before any users (1 day to add)
- You want email verification (1-2 days to add)
- You're targeting users who expect a polished experience

### My Recommendation

**Deploy a soft launch THIS WEEK** to Railway + Vercel:

1. **Day 1**: Deploy backend + frontend, test all flows work
2. **Day 2**: Add rate limiting, strong secrets, test security
3. **Day 3-5**: Use it yourself, invite 1-2 trusted testers
4. **Week 2**: Add password reset, then invite more users

**Why deploy early?**
- Real usage reveals bugs you won't find locally
- Production environment differs from development
- User feedback shapes which features to prioritize
- The existing features provide real value already

**Cost to deploy now**: ~$10/month (Railway + Vercel)
**Risk of waiting**: Building features users don't need

---

## Next Steps Action Plan

### Immediate (This Week)

| Task | Priority | Effort |
|------|----------|--------|
| Deploy to Railway + Vercel | Critical | 2-3 hours |
| Generate production secrets | Critical | 10 min |
| Add rate limiting to login | Critical | 1 hour |
| Test all flows in production | Critical | 2 hours |
| Set up database backups | High | 30 min |

### Short Term (Next 2 Weeks)

| Task | Priority | Effort |
|------|----------|--------|
| Password reset flow | High | 1 day |
| Error monitoring (Sentry) | High | 2 hours |
| Question Bank Browser page | High | 2-3 days |
| Mobile testing & fixes | Medium | 1 day |

### Medium Term (Month 1-2)

| Task | Priority | Effort |
|------|----------|--------|
| Per-Skill Lessons system | High | 3-5 days |
| Email notifications | Medium | 2 days |
| Admin dashboard | Medium | 3-5 days |
| Lesson content creation | Medium | Ongoing |

---

*This document should be updated as deployment requirements change.*
