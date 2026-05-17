import { NextRequest, NextResponse } from "next/server"
import { put, list } from "@vercel/blob"
import type { Lead, LeadStatus, LeadActivityLog } from "@/lib/order-types"

export const dynamic = "force-dynamic"

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadAllLeads(): Promise<Lead[]> {
  const { blobs } = await list({ prefix: "leads/" })
  const leads = await Promise.all(
    blobs
      .filter((b) => b.pathname.startsWith("leads/") && b.pathname.endsWith(".json") && !b.pathname.includes("/tokens/") && !b.pathname.includes("/activity/"))
      .map(async (blob) => {
        const res = await fetch(`${blob.url}?t=${Date.now()}`, { cache: "no-store" })
        return res.json() as Promise<Lead>
      })
  )
  return leads
}

async function logActivity(entry: Omit<LeadActivityLog, "id">) {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
  const log: LeadActivityLog = { id, ...entry }
  await put(`leads/activity/${id}.json`, JSON.stringify(log), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  })
}

// ── GET /api/leads — list all leads ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const leads = await loadAllLeads()
    return NextResponse.json(
      leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    )
  } catch (err) {
    console.error("Failed to list leads:", err)
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
  }
}

// ── POST /api/leads — create a new lead ──────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const required = ["fullName", "address", "state", "email", "phone", "provider", "productSelected"]
    const missing = required.filter((f) => !body[f]?.toString().trim())
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
    const now = new Date().toISOString()

    const lead: Lead = {
      id,
      createdAt: now,
      createdBy: "admin",
      status: "unclaimed",
      fullName: body.fullName.trim(),
      address: body.address.trim(),
      state: body.state.trim().toUpperCase(),
      email: body.email.trim(),
      phone: body.phone.trim(),
      dob: body.dob?.trim() || "",
      provider: body.provider.trim(),
      productSelected: body.productSelected.trim(),
      preferredInstallDate: body.preferredInstallDate || "",
      preferredInstallTime: body.preferredInstallTime || "",
      notes: body.notes?.trim() || "",
      eligibleAgentIds: [],
      notifiedAgentIds: [],
      claimedByAgentId: "",
      claimedByAgentName: "",
      claimedByAgentEmail: "",
      claimedAt: "",
      removedBy: "",
      removedAt: "",
      adminNotes: "",
      updatedAt: now,
    }

    await put(`leads/${id}.json`, JSON.stringify(lead), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    })

    await logActivity({
      timestamp: now,
      leadId: id,
      action: "Lead Created",
      actorName: "Admin",
      actorEmail: "",
      details: `Lead created for ${lead.fullName} in ${lead.state}`,
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (err) {
    console.error("Failed to create lead:", err)
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 })
  }
}
