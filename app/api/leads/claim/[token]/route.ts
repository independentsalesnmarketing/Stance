import { NextRequest, NextResponse } from "next/server"
import { put, list } from "@vercel/blob"
import type { Lead, LeadClaimToken, AgentProfile } from "@/lib/order-types"

export const dynamic = "force-dynamic"

async function loadToken(token: string): Promise<LeadClaimToken | null> {
  const { blobs } = await list({ prefix: `leads/tokens/${token}.json` })
  const match = blobs.find((b) => b.pathname === `leads/tokens/${token}.json`)
  if (!match) return null
  const res = await fetch(match.url, { cache: "no-store" })
  if (!res.ok) return null
  return res.json() as Promise<LeadClaimToken>
}

async function loadLead(id: string): Promise<Lead | null> {
  const { blobs } = await list({ prefix: `leads/${id}.json` })
  const match = blobs.find((b) => b.pathname === `leads/${id}.json`)
  if (!match) return null
  const res = await fetch(match.url, { cache: "no-store" })
  if (!res.ok) return null
  return res.json() as Promise<Lead>
}

async function loadAgent(id: string): Promise<AgentProfile | null> {
  const { blobs } = await list({ prefix: `agent-profiles/${id}.json` })
  if (!blobs.length) return null
  const res = await fetch(blobs[0].url, { cache: "no-store" })
  if (!res.ok) return null
  return res.json() as Promise<AgentProfile>
}

async function logActivity(entry: { timestamp: string; leadId: string; action: string; actorName: string; actorEmail: string; details: string }) {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
  await put(`leads/activity/${id}.json`, JSON.stringify({ id, ...entry }), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

// ── GET /api/leads/claim/[token] — verify token and show claim status ──────
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params
  try {
    const claimToken = await loadToken(token)
    if (!claimToken) {
      return NextResponse.json({
        valid: false,
        message: "This claim link is not valid. Please check your email for the correct link.",
      })
    }

    if (claimToken.status === "used") {
      const lead = await loadLead(claimToken.leadId)
      const isSameAgent = lead?.claimedByAgentId === claimToken.agentId
      return NextResponse.json({
        valid: false,
        alreadyClaimed: true,
        claimedBySelf: isSameAgent,
        message: isSameAgent
          ? "You have already claimed this lead. Your claim was successful."
          : "This lead has already been claimed by another agent.",
        lead: isSameAgent && lead ? {
          fullName: lead.fullName,
          address: lead.address,
          state: lead.state,
          email: lead.email,
          phone: lead.phone,
          dob: lead.dob,
          provider: lead.provider,
          productSelected: lead.productSelected,
          preferredInstallDate: lead.preferredInstallDate,
          preferredInstallTime: lead.preferredInstallTime,
          notes: lead.notes,
          orderNumber: lead.orderNumber || "",
        } : null,
      })
    }

    if (claimToken.status === "expired" || new Date(claimToken.expiresAt) < new Date()) {
      return NextResponse.json({
        valid: false,
        message: "This claim link has expired. Please contact the admin for a new notification.",
      })
    }

    if (claimToken.status === "revoked") {
      return NextResponse.json({
        valid: false,
        message: "This claim link is no longer active.",
      })
    }

    // Check lead is still available
    const lead = await loadLead(claimToken.leadId)
    if (!lead || lead.status !== "unclaimed") {
      return NextResponse.json({
        valid: false,
        message: lead?.status === "claimed"
          ? "This lead has already been claimed by another agent."
          : "This lead is no longer available.",
      })
    }

    // Check agent eligibility
    const agent = await loadAgent(claimToken.agentId)
    if (!agent) {
      return NextResponse.json({
        valid: false,
        message: "Your agent profile was not found. Please contact the admin.",
      })
    }

    if (agent.tier !== 1) {
      return NextResponse.json({
        valid: false,
        message: "Only Tier 1 agents with direct provider access can claim leads.",
      })
    }

    if (agent.activeStatus === false) {
      return NextResponse.json({
        valid: false,
        message: "Your agent account is currently inactive. Please contact the admin.",
      })
    }

    // Return preview (non-sensitive) info
    return NextResponse.json({
      valid: true,
      preview: {
        state: lead.state,
        provider: lead.provider,
        productSelected: lead.productSelected,
        createdAt: lead.createdAt,
      },
      agentName: `${agent.firstName} ${agent.lastName}`,
    })
  } catch (err) {
    console.error("Claim verify error:", err)
    return NextResponse.json({ valid: false, message: "Something went wrong. Please try again." }, { status: 500 })
  }
}

// ── POST /api/leads/claim/[token] — execute the claim ────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params
  try {
    const claimToken = await loadToken(token)
    if (!claimToken || claimToken.status !== "active") {
      return NextResponse.json({
        success: false,
        message: claimToken?.status === "used"
          ? "You have already claimed this lead."
          : "This claim link is no longer valid.",
      })
    }

    if (new Date(claimToken.expiresAt) < new Date()) {
      // Mark as expired
      claimToken.status = "expired"
      await put(`leads/tokens/${token}.json`, JSON.stringify(claimToken), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      return NextResponse.json({
        success: false,
        message: "This claim link has expired. Please contact the admin.",
      })
    }

    // Load lead
    const lead = await loadLead(claimToken.leadId)
    if (!lead) {
      return NextResponse.json({ success: false, message: "This lead is no longer available." })
    }

    // LOCK: Check lead is still unclaimed (atomic check)
    if (lead.status !== "unclaimed") {
      return NextResponse.json({
        success: false,
        message: lead.status === "claimed"
          ? "This lead has already been claimed by another agent."
          : "This lead is no longer available.",
      })
    }

    // Verify agent
    const agent = await loadAgent(claimToken.agentId)
    if (!agent) {
      return NextResponse.json({ success: false, message: "Your agent profile was not found." })
    }

    if (agent.tier !== 1) {
      return NextResponse.json({ success: false, message: "Only Tier 1 agents can claim leads." })
    }

    if (!lead.notifiedAgentIds.includes(claimToken.agentId)) {
      return NextResponse.json({
        success: false,
        message: "You are not approved to claim this lead.",
      })
    }

    const now = new Date().toISOString()
    const agentFullName = `${agent.firstName} ${agent.lastName}`

    // Claim the lead
    lead.status = "claimed"
    lead.claimedByAgentId = agent.id
    lead.claimedByAgentName = agentFullName
    lead.claimedByAgentEmail = agent.email
    lead.claimedAt = now
    lead.updatedAt = now

    await put(`leads/${lead.id}.json`, JSON.stringify(lead), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    // Mark token as used
    claimToken.status = "used"
    claimToken.usedAt = now
    await put(`leads/tokens/${token}.json`, JSON.stringify(claimToken), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    // Revoke all other tokens for this lead
    const { blobs: tokenBlobs } = await list({ prefix: "leads/tokens/" })
    for (const blob of tokenBlobs) {
      if (blob.pathname === `leads/tokens/${token}.json`) continue
      try {
        const res = await fetch(blob.url, { cache: "no-store" })
        const otherToken = await res.json() as LeadClaimToken
        if (otherToken.leadId === lead.id && otherToken.status === "active") {
          otherToken.status = "revoked"
          await put(blob.pathname, JSON.stringify(otherToken), {
            access: "public",
            contentType: "application/json",
            addRandomSuffix: false,
            allowOverwrite: true,
          })
        }
      } catch {}
    }

    // Log activity
    await logActivity({
      timestamp: now,
      leadId: lead.id,
      action: "Lead Claimed",
      actorName: agentFullName,
      actorEmail: agent.email,
      details: `Lead claimed by ${agentFullName} (${agent.email})`,
    })

    // Notify admin via Google Apps Script
    const scriptUrl = process.env.GOOGLE_LEADS_SCRIPT_URL
    if (scriptUrl) {
      try {
        await fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formType: "leadClaimed",
            adminEmail: "gamblerspassion@gmail.com",
            leadName: lead.fullName,
            leadState: lead.state,
            provider: lead.provider,
            productSelected: lead.productSelected,
            claimedByName: agentFullName,
            claimedByEmail: agent.email,
            claimedAt: now,
            leadId: lead.id,
          }),
        })
      } catch (err) {
        console.error("Admin claim notification failed:", err)
      }
    }

    // Return full lead details to the claiming agent
    return NextResponse.json({
      success: true,
      message: "This lead is now assigned to you!",
      lead: {
        fullName: lead.fullName,
        address: lead.address,
        state: lead.state,
        email: lead.email,
        phone: lead.phone,
        dob: lead.dob,
        provider: lead.provider,
        productSelected: lead.productSelected,
        preferredInstallDate: lead.preferredInstallDate,
        preferredInstallTime: lead.preferredInstallTime,
        notes: lead.notes,
      },
    })
  } catch (err) {
    console.error("Claim error:", err)
    return NextResponse.json({
      success: false,
      message: "Something went wrong while processing your claim. Please try again.",
    }, { status: 500 })
  }
}
