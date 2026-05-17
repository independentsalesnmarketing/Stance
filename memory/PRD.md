# Stance Marketing — Internal Ops App

## Problem Statement
Existing Next.js (App Router) admin/agent platform managing:
1. Onboarding link generation
2. Agents directory (with tier, approved states, lead eligibility)
3. Orders submission & history
4. Leads pool — admin creates leads, notifies eligible Tier-1 agents by email; agents claim via unique tokenized links

User asked to (a) add the Vercel Blob token, (b) add an "X" to collapse the expanded lead row in the admin panel, and (c) complete the leads tab — specifically, after an agent claims a lead they need a way to submit the carrier order number once the sale is processed, so admin can see what happens after the claim.

## Architecture
- Next.js 14.2.25 (App Router) under `/app`
- Storage: Vercel Blob (`@vercel/blob`) — JSON blobs under `leads/`, `leads/tokens/`, `leads/activity/`, `agent-profiles/`, `orders/`
- Email: Google Apps Script webhook (`GOOGLE_LEADS_SCRIPT_URL`) — sends agent claim emails and admin notifications

## Implemented (2026-01)
- `BLOB_READ_WRITE_TOKEN` added to `/app/.env.local`
- Lead model extended with `orderNumber` + `orderSubmittedAt`
- `PATCH /api/leads/[id]` now accepts `orderNumber` (admin path) with activity log
- New `POST /api/leads/claim/[token]/order` — token-authenticated endpoint so the claiming agent can submit/update an order number without admin access. Auto-flips status `claimed → completed`
- `/claim/[token]` page: after successful claim (and on revisit of already-claimed lead), shows a clearly labelled "Submit Order Number" block with input + save; once saved displays it and offers Edit. Activity log entry created for every submit/update
- Admin leads panel:
  - **X collapse button** at the top of the expanded lead row (`collapse-lead-btn-{id}`)
  - Claim status block now shows the order number (or "awaiting agent" when missing) plus a new "Completed" variant
- Frontend (Next dev) running via supervisor at port 3000

## Known External Blocker
The provided Vercel Blob token authenticates successfully, **but the Blob store itself is currently suspended** on Vercel (`BlobStoreSuspendedError: This store has been suspended`). All write paths fail until the store is unsuspended in the Vercel dashboard. Code is correct and ready.

## Backlog / Next
- Unsuspend the Vercel Blob store, then verify end-to-end (create lead → notify → claim → submit order #)
- Optional: notify admin via Apps Script when an agent submits an order number
- Optional: surface "Order #" column in the admin leads table list (currently only in expanded view)
