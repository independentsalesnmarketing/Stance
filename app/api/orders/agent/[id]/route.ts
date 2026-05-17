import { NextRequest, NextResponse } from "next/server"
import { list } from "@vercel/blob"
import type { Order } from "@/lib/order-types"

export const dynamic = "force-dynamic"

// ── GET /api/orders/agent/[id] — agent's own order history ───────────────────
// Authenticated by possession of the agent ID (same trust model as the order link).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: "Missing agent ID" }, { status: 400 })
  }

  try {
    const { blobs } = await list({ prefix: "orders/" })
    const all = await Promise.all(
      blobs.map(async (blob) => {
        const res = await fetch(`${blob.url}?t=${Date.now()}`, { cache: "no-store" })
        return res.json() as Promise<Order>
      })
    )
    const agentOrders = all
      .filter((o) => o.agentId === id)
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )
    return NextResponse.json(agentOrders)
  } catch (err) {
    console.error("Agent orders fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}
