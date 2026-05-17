import { NextRequest, NextResponse } from "next/server"
import { put, list, del } from "@vercel/blob"
import type { Lead, LeadStatus, LeadActivityLog } from "@/lib/order-types"

export const dynamic = "force-dynamic"

const VALID_STATUSES: LeadStatus[] = ["unclaimed", "claimed", "removed", "expired", "completed"]

async function loadLead(id: string): Promise<Lead | null> {
  const { blobs } = await list({ prefix: `leads/${id}.json` })
  const match = blobs.find((b) => b.pathname === `leads/${id}.json`)
  if (!match) return null
  const res = await fetch(`${match.url}?t=${Date.now()}`, { cache: "no-store" })
  if (!res.ok) return null
  return res.json() as Promise<Lead>
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

// ── GET /api/leads/[id] ─────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  try {
    const lead = await loadLead(id)
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    return NextResponse.json(lead)
  } catch (err) {
    console.error("Lead fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 })
  }
}

// ── PATCH /api/leads/[id] ───────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  try {
    const body = await req.json()
    const lead = await loadLead(id)
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    const now = new Date().toISOString()
    let actionLog = ""

    // Status change
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      const oldStatus = lead.status
      lead.status = body.status

      if (body.status === "removed") {
        lead.removedBy = "admin"
        lead.removedAt = now
        actionLog = `Lead status changed from ${oldStatus} to removed`
      } else if (body.status === "unclaimed" && oldStatus === "claimed") {
        // Reopening a claimed lead
        lead.claimedByAgentId = ""
        lead.claimedByAgentName = ""
        lead.claimedByAgentEmail = ""
        lead.claimedAt = ""
        actionLog = `Lead reopened — was previously claimed`
      } else {
        actionLog = `Lead status changed from ${oldStatus} to ${body.status}`
      }
    }

    // Admin notes
    if (body.adminNotes !== undefined) lead.adminNotes = body.adminNotes
    if (body.notes !== undefined) lead.notes = body.notes
    if (body.eligibleAgentIds !== undefined) lead.eligibleAgentIds = body.eligibleAgentIds
    if (body.notifiedAgentIds !== undefined) lead.notifiedAgentIds = body.notifiedAgentIds

    // Order number tracking (set when agent processes the sale)
    if (body.orderNumber !== undefined) {
      const orderNum = String(body.orderNumber).trim()
      lead.orderNumber = orderNum
      if (orderNum && !lead.orderSubmittedAt) {
        lead.orderSubmittedAt = now
      }
      if (!orderNum) {
        lead.orderSubmittedAt = ""
      }
      actionLog = actionLog
        ? `${actionLog}; order number set to ${orderNum || "(cleared)"}`
        : `Order number ${orderNum ? "set to " + orderNum : "cleared"}`
    }

    // Editable lead fields
    const editableFields = [
      "fullName", "address", "state", "email", "phone", "dob",
      "provider", "productSelected", "preferredInstallDate",
      "preferredInstallTime",
    ] as const
    for (const f of editableFields) {
      if (body[f] !== undefined) (lead as any)[f] = body[f]
    }

    lead.updatedAt = now

    await put(`leads/${id}.json`, JSON.stringify(lead), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    })

    if (actionLog) {
      await logActivity({
        timestamp: now,
        leadId: id,
        action: actionLog,
        actorName: "Admin",
        actorEmail: "",
        details: actionLog,
      })
    }

    return NextResponse.json(lead)
  } catch (err) {
    console.error("Lead update error:", err)
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 })
  }
}

// ── DELETE /api/leads/[id] ──────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  try {
    const { blobs } = await list({ prefix: `leads/${id}.json` })
    const match = blobs.find((b) => b.pathname === `leads/${id}.json`)
    if (!match) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    await del(match.url)

    await logActivity({
      timestamp: new Date().toISOString(),
      leadId: id,
      action: "Lead Deleted",
      actorName: "Admin",
      actorEmail: "",
      details: `Lead permanently deleted`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Lead delete error:", err)
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 })
  }
}
