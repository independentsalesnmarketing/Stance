import { NextRequest, NextResponse } from "next/server"
import { put, list } from "@vercel/blob"
import type { AgentProfile } from "@/lib/order-types"

async function loadAllAgents(): Promise<AgentProfile[]> {
  const { blobs } = await list({ prefix: "agent-profiles/" })
  return Promise.all(
    blobs.map(async (blob) => {
      const res = await fetch(blob.url)
      return res.json() as Promise<AgentProfile>
    })
  )
}

// ── GET /api/agents — list all agents ────────────────────────────────────────
export async function GET() {

  try {
    const agents = await loadAllAgents()
    return NextResponse.json(
      agents.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      )
    )
  } catch (err) {
    console.error("Failed to list agents:", err)
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 })
  }
}

// ── POST /api/agents — create agent profile ──────────────────────────────────
export async function POST(req: NextRequest) {

  try {
    const body = await req.json()
    const { firstName, lastName, email, phone, partnerType } = body

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "firstName, lastName, and email are required" },
        { status: 400 }
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Dedupe: if an agent with this email already exists, return it
    const existing = await loadAllAgents().catch(() => [] as AgentProfile[])
    const dupe = existing.find((a) => a.email.toLowerCase() === normalizedEmail)
    if (dupe) {
      return NextResponse.json(
        { ...dupe, _duplicate: true },
        { status: 200 }
      )
    }

    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    const agent: AgentProfile = {
      id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || "",
      partnerType: partnerType || "sales-agent",
      createdAt: new Date().toISOString(),
      source: "manual",
      ...(body.tier !== undefined && body.tier !== "" && body.tier !== null && { tier: Number(body.tier) }),
      ...(body.approvedStates !== undefined && { approvedStates: Array.isArray(body.approvedStates) ? body.approvedStates : [] }),
      ...(body.activeStatus !== undefined && { activeStatus: Boolean(body.activeStatus) }),
      ...(body.directProviderAccess !== undefined && { directProviderAccess: Boolean(body.directProviderAccess) }),
      ...(body.canReceiveLeads !== undefined && { canReceiveLeads: Boolean(body.canReceiveLeads) }),
    }

    await put(`agent-profiles/${id}.json`, JSON.stringify(agent), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (err) {
    console.error("Failed to create agent:", err)
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 })
  }
}
