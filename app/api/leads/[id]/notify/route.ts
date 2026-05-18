import { NextRequest, NextResponse } from "next/server"
import { put, list } from "@vercel/blob"
import type { Lead, LeadClaimToken, AgentProfile } from "@/lib/order-types"

export const dynamic = "force-dynamic"

async function loadLead(id: string): Promise<Lead | null> {
  const { blobs } = await list({ prefix: `leads/${id}.json` })
  const match = blobs.find((b) => b.pathname === `leads/${id}.json`)
  if (!match) return null
  const res = await fetch(`${match.url}?t=${Date.now()}`, { cache: "no-store" })
  if (!res.ok) return null
  return res.json() as Promise<Lead>
}

async function loadAgent(id: string): Promise<AgentProfile | null> {
  const { blobs } = await list({ prefix: `agent-profiles/${id}.json` })
  if (!blobs.length) return null
  const res = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: "no-store" })
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
    cacheControlMaxAge: 0,
  })
}

// ── POST /api/leads/[id]/notify — send claim emails to selected agents ──────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  try {
    const body = await req.json()
    const { agentIds } = body as { agentIds: string[] }

    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json({ error: "No agents selected" }, { status: 400 })
    }

    const lead = await loadLead(id)
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    if (lead.status !== "unclaimed") {
      return NextResponse.json({ error: "This lead is no longer available for notification" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const tokens: LeadClaimToken[] = []
    const notifiedAgents: { name: string; email: string }[] = []

    // Create claim tokens for each selected agent
    for (const agentId of agentIds) {
      const agent = await loadAgent(agentId)
      if (!agent) continue

      const token = crypto.randomUUID().replace(/-/g, "")
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

      const claimToken: LeadClaimToken = {
        token,
        leadId: id,
        agentId,
        agentEmail: agent.email,
        createdAt: now,
        expiresAt,
        usedAt: "",
        status: "active",
      }

      await put(`leads/tokens/${token}.json`, JSON.stringify(claimToken), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
      })

      tokens.push(claimToken)
      notifiedAgents.push({ name: `${agent.firstName} ${agent.lastName}`, email: agent.email })
    }

    // Update lead with only successfully notified agent IDs
    const successAgentIds = tokens.map(t => t.agentId)
    lead.eligibleAgentIds = [...new Set([...lead.eligibleAgentIds, ...successAgentIds])]
    lead.notifiedAgentIds = [...new Set([...lead.notifiedAgentIds, ...successAgentIds])]
    lead.updatedAt = now

    await put(`leads/${id}.json`, JSON.stringify(lead), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    })

    // Send emails via Google Apps Script
    const scriptUrl = "https://script.google.com/macros/s/AKfycbzMLyTEUsrjIjuDLLaYzv-5kgVkSwgUd7hPZiScfb5VRmKzDfkH6tYnorLDzPe_Vrjn/exec"
    if (scriptUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://v0-stance.vercel.app"

      for (const ct of tokens) {
        const agent = notifiedAgents.find((a) => a.email === ct.agentEmail)
        try {
          await fetch(scriptUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              formType: "leadNotification",
              agentEmail: ct.agentEmail,
              agentName: agent?.name || "",
              leadState: lead.state,
              leadProvider: lead.provider,
              leadProduct: lead.productSelected,
              claimUrl: `${baseUrl}/claim/${ct.token}`,
              leadId: lead.id,
            }),
          })
        } catch (err) {
          console.error(`Failed to notify agent ${ct.agentEmail}:`, err)
        }
      }
    }

    await logActivity({
      timestamp: now,
      leadId: id,
      action: "Agents Notified",
      actorName: "Admin",
      actorEmail: "",
      details: `Notified ${notifiedAgents.length} agents: ${notifiedAgents.map((a) => a.name).join(", ")}`,
    })

    return NextResponse.json({
      success: true,
      notifiedCount: notifiedAgents.length,
      notifiedAgents,
      tokens: tokens.map((t) => ({ token: t.token, agentId: t.agentId, agentEmail: t.agentEmail })),
    })
  } catch (err) {
    console.error("Lead notify error:", err)
    return NextResponse.json({ error: "Failed to send notifications" }, { status: 500 })
  }
}
