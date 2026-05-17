# Stance Marketing — Lead Pool System PRD

## Original Problem Statement
Build a production-ready Lead Pool system for admin-controlled lead assignment, agent eligibility, and secure lead claiming. Admin adds leads manually, assigns eligible Tier 1 agents by state, notifies agents by email, and allows exactly one agent to claim each lead. Sensitive lead details hidden until claimed.

## Architecture
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Storage**: Vercel Blob (@vercel/blob) for all data
- **Email**: Google Apps Script (GOOGLE_LEADS_SCRIPT_URL)
- **Auth**: Password-based cookie auth (ADMIN_PASSWORD)
- **Deployment**: Vercel (production) / Emergent (preview)

## User Personas
1. **Admin** — Creates leads, manages agents, monitors claim activity
2. **Tier 1 Agents** — Direct provider access, can claim leads from the pool
3. **Tier 2 Agents** — Website submission agents, cannot claim leads

## Core Requirements (Static)
- Leads tab is farthest left in admin panel
- Provider field is write-in (not dropdown)
- DOB field is write-in with auto-formatting (not calendar picker)
- Provider appears before Product Selected
- State-specific Tier 1 agent eligibility
- Secure claim tokens (UUID-based, 7-day expiry)
- Sensitive data hidden until lead is claimed
- Duplicate claim prevention (token locking, status checks)
- Admin notification to gamblerspassion@gmail.com on claim

## What's Been Implemented (May 17, 2026)

### Backend (Next.js API Routes)
- `GET/POST /api/leads` — List and create leads
- `GET/PATCH/DELETE /api/leads/[id]` — Individual lead CRUD
- `POST /api/leads/[id]/notify` — Send claim emails to selected agents
- `GET/POST /api/leads/claim/[token]` — Verify and execute claims
- `GET /api/leads/activity` — Activity log
- `PATCH /api/agents/[id]` — Extended with tier, approvedStates, activeStatus, directProviderAccess, canReceiveLeads

### Frontend
- **Leads Panel** (`/components/admin/leads-panel.tsx`) — Full lead management UI with add form, status filters, agent notification modal, activity log
- **Agents Panel** (`/components/admin/agents-panel.tsx`) — Updated with Lead Pool Settings (tier, approved states, toggles)
- **Admin Tabs** (`/components/admin/link-generator.tsx`) — Leads tab added as first tab
- **Claim Page** (`/app/claim/[token]/page.tsx`) — Public claim page with preview, claim, and error states

### Data Types (`/lib/order-types.ts`)
- `Lead`, `LeadClaimToken`, `LeadActivityLog`, `AgentTier`, `LeadStatus`
- Extended `AgentProfile` with tier, approvedStates, activeStatus, directProviderAccess, canReceiveLeads

### Google Apps Script (`/appscript-leads.txt`)
- Complete Apps Script for lead notifications, claim emails, admin notifications
- LockService for race condition prevention
- Leads sheet management (farthest left)
- Lead Activity Log sheet
- Agents sheet, Lead Claim Tokens sheet

## Prioritized Backlog

### P0 (Critical)
- [x] Lead creation with all fields
- [x] Agent tier/state classification
- [x] State-specific agent filtering
- [x] Secure claim token flow
- [x] Duplicate claim prevention
- [x] Admin lead status management

### P1 (Important)
- [ ] Deploy Google Apps Script and set GOOGLE_LEADS_SCRIPT_URL
- [ ] Configure NEXT_PUBLIC_BASE_URL for claim links in emails
- [ ] Lead expiration cron job (auto-expire unclaimed leads after X days)

### P2 (Nice to Have)
- [ ] CSV export for leads
- [ ] Bulk lead status updates
- [ ] Agent self-service portal for viewing claimed leads
- [ ] Real-time lead count dashboard
- [ ] Lead analytics/reporting

## Next Tasks
1. Deploy the Google Apps Script from `/appscript-leads.txt` to Google Apps Script
2. Set `GOOGLE_LEADS_SCRIPT_URL` environment variable in Vercel
3. Set `NEXT_PUBLIC_BASE_URL` environment variable for claim link generation
4. Test email notification flow end-to-end
5. Consider adding lead expiration logic
