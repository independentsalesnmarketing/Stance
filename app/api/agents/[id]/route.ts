import { NextRequest, NextResponse } from "next/server"
import { list, put, del } from "@vercel/blob"
import type { AgentProfile } from "@/lib/order-types"

async function loadAgent(id: string): Promise<AgentProfile | null> {
  const { blobs } = await list({ prefix: `agent-profiles/${id}.json` })
  if (!blobs.length) return null
  const res = await fetch(blobs[0].url)
  if (!res.ok) return null
  return res.json() as Promise<AgentProfile>
}

// ── GET /api/agents/[id] — fetch single agent (public, for order form) ────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  if (!id || !/^[a-f0-9]{12}$/.test(id)) {
    return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 })
  }

  try {
    const agent = await loadAgent(id)
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }
    return NextResponse.json(agent)
  } catch (err) {
    console.error("Agent fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch agent" }, { status: 500 })
  }
}

// ── PATCH /api/agents/[id] — update agent ────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {

  const { id } = params
  if (!id || !/^[a-f0-9]{12}$/.test(id)) {
    return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 })
  }

  try {
    const body = await req.json()
    const agent = await loadAgent(id)
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    const updated: AgentProfile = {
      ...agent,
      ...(body.firstName  !== undefined && { firstName:  String(body.firstName).trim() }),
      ...(body.lastName   !== undefined && { lastName:   String(body.lastName).trim() }),
      ...(body.email      !== undefined && { email:      String(body.email).trim().toLowerCase() }),
      ...(body.phone      !== undefined && { phone:      String(body.phone).trim() }),
      ...(body.partnerType !== undefined && { partnerType: String(body.partnerType) }),
      ...(body.tier       !== undefined && { tier:       body.tier === "" || body.tier === null ? undefined : Number(body.tier) }),
      ...(body.approvedStates !== undefined && { approvedStates: Array.isArray(body.approvedStates) ? body.approvedStates : [] }),
      ...(body.activeStatus !== undefined && { activeStatus: Boolean(body.activeStatus) }),
      ...(body.directProviderAccess !== undefined && { directProviderAccess: Boolean(body.directProviderAccess) }),
      ...(body.canReceiveLeads !== undefined && { canReceiveLeads: Boolean(body.canReceiveLeads) }),
      updatedAt: new Date().toISOString(),
    }

    if (updated.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updated.email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    await put(`agent-profiles/${id}.json`, JSON.stringify(updated), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error("Agent update error:", err)
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 })
  }
}

// ── DELETE /api/agents/[id] — delete agent ────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {

  const { id } = params
  if (!id || !/^[a-f0-9]{12}$/.test(id)) {
    return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 })
  }

  try {
    const { blobs } = await list({ prefix: `agent-profiles/${id}.json` })
    if (!blobs.length) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }
    await del(blobs[0].url)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Agent delete error:", err)
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 })
  }
}
