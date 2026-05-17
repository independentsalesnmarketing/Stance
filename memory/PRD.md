# Stance Marketing — Lead Pool System PRD

## Original Problem Statement
Build a production-ready Lead Pool system for admin-controlled lead assignment, agent eligibility, and secure lead claiming. Two tiers: Tier 1 (direct provider access, can claim leads) and Tier 2 (website submission, orders become leads for Tier 1).

## Architecture
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Storage**: Vercel Blob (@vercel/blob) for all data
- **Email**: Google Apps Script (GOOGLE_LEADS_SCRIPT_URL)
- **Auth**: Password-based cookie auth (ADMIN_PASSWORD)

## Complete Pipeline Map

### Pipeline 1: Onboarding → Agent
Admin creates onboarding link → Agent completes onboarding → POST /api/onboard → Agent profile created (source: "onboarding") → Admin sets tier/states in Agents tab

### Pipeline 2: Manual Agent Creation
Admin → Agents tab → Add Agent (with tier, states, toggles) → POST /api/agents → Ready for leads

### Pipeline 3: Manual Lead Creation
Admin → Leads tab → Add Lead → POST /api/leads → Select eligible Tier 1 agents → Send notifications → Agent clicks claim link → Claims lead

### Pipeline 4: Tier 2 Orders → Auto-Create Leads
Tier 2 agent submits order → POST /api/submit-order → Order saved → Agent tier checked → If Tier 2: auto-creates unclaimed Lead → Shows in Leads tab for admin to notify Tier 1 agents

### Pipeline 5: Lead Claim Flow
Agent receives email → Clicks claim link → /claim/{token} → Preview (state/provider/product) → Clicks Claim → Lead locked → Full details revealed → Admin notified

## What's Been Implemented (May 17, 2026)

### Backend
- Leads CRUD: GET/POST /api/leads, GET/PATCH/DELETE /api/leads/[id]
- Lead notification: POST /api/leads/[id]/notify
- Lead claiming: GET/POST /api/leads/claim/[token]
- Activity log: GET /api/leads/activity
- Agent CRUD with tier/states: POST/GET /api/agents, PATCH/DELETE /api/agents/[id]
- **Tier 2 auto-lead creation** in POST /api/submit-order
- Agent creation with tier/states included from the start

### Frontend
- **Leads Panel**: Add lead form, search, status filters, pagination, bulk select/delete/status-change, notify agents modal, activity log
- **Agents Panel**: Add agent form WITH tier/states/toggles, search, pagination, bulk select/delete, inline edit with Lead Pool Settings
- **Orders Panel**: Search, status filters, pagination, prominent delete on every row, bulk select/delete/status-change, inline edit
- **Claim Page**: Preview, claim, success with full details, error states
- **Tab order**: Onboarding Links → Agents → Orders → Leads (far right, not default)

### Google Apps Script (appscript-leads.txt)
- Complete: lead notifications, claim emails, admin notifications, LockService, sheet management

## Prioritized Backlog

### P0 (Done)
- [x] All lead fields, state-specific eligibility, secure claims
- [x] Tier 2 orders → auto-create leads
- [x] Agent creation with tier/states from day one
- [x] Pagination, search, bulk ops on all panels
- [x] Prominent delete everywhere

### P1 (Next)
- [ ] Deploy Google Apps Script and set GOOGLE_LEADS_SCRIPT_URL
- [ ] Set NEXT_PUBLIC_BASE_URL for claim link URLs
- [ ] Classify existing 13 agents by tier/state

### P2 (Backlog)
- [ ] Lead expiration cron job
- [ ] CSV export for leads
- [ ] Agent self-service portal
- [ ] Lead analytics dashboard
