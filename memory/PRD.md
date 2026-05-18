# Stance Marketing - PRD

## Original Problem Statement
Review existing Stance Marketing Next.js repo. Three changes requested:
1. Add Direct Deposit step after W-9 in onboarding flow
2. After application completion, show expedite message with mailto link to Justin Johnson (justin.j@stance-marketing.com)
3. AppScripts (onboarding + apply) need to send email notifications to gamblerspassion@gmail.com

## Architecture
- **Framework**: Next.js 14.2 (App Router)
- **Hosting**: Vercel (production), Emergent preview environment
- **Storage**: Vercel Blob (contracts, agent profiles, onboarding links)
- **Sheets**: Google Apps Script (onboarding, applications, orders, leads)
- **Email**: Resend API (admin + contractor notifications)
- **Key pages**: `/apply`, `/onboarding`, `/orders`, `/admin`, `/claim`

## User Personas
- **Applicants**: People applying to join Stance as partners/agents
- **Onboarding contractors**: Approved applicants completing their contractor setup
- **Admin**: Stance team managing applications, agents, orders, leads

## Core Requirements
- Multi-program application flow (referral, sales-agent, business, spectrum-event, tmobile-d2d, verizon-d2d)
- 8-step onboarding: Details, Agreement, Signature, W-9, Direct Deposit, ID Upload, Badge Photo, Review
- Google Sheets integration for all form data
- Email notifications via Resend API and Google Apps Script MailApp
- PDF generation for signed contracts

## What's Been Implemented (Jan 18, 2026)
1. **Direct Deposit Step (Onboarding)**: Added step 5 with bank name, routing number (9 digits), account number, account type (checking/savings). All fields validated. Shown in Review step with masked data. Included in completion summary cards.
2. **Expedite Application Message**: Apply completion screen now shows "Want to expedite the application process?" with clickable mailto link to Director of Sales Justin Johnson (justin.j@stance-marketing.com).
3. **AppScript Email Notifications**: 
   - `appscript.txt`: `appendOnboarding` now includes direct deposit columns + calls `sendOnboardingEmail` to gamblerspassion@gmail.com
   - `appscript-apply.txt`: `appendApplication` now calls `sendApplicationEmail` to gamblerspassion@gmail.com
4. **API Route Update**: `/api/onboard` extracts and passes direct deposit fields to Google Sheet + includes in admin email

## Prioritized Backlog
- P0: None - all requested features implemented
- P1: Deploy updated Google Apps Scripts to production (appscript.txt, appscript-apply.txt must be manually updated in Google Apps Script console)
- P2: Add direct deposit info to contractor confirmation email
- P2: Add direct deposit details to onboarding PDF generation

## Next Tasks
1. User must update Google Apps Scripts in their Google Script console with the new code from `appscript.txt` and `appscript-apply.txt`
2. Consider adding account number confirmation field (re-enter account number) for additional validation
