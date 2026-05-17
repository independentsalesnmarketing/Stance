import { NextRequest, NextResponse } from "next/server"
import { list, put } from "@vercel/blob"
import { type Order, type OrderStatus } from "@/lib/order-types"

export const dynamic = "force-dynamic"

const VALID_STATUSES: OrderStatus[] = [
  "submitted", "pending", "complete", "paid", "cancelled",
]

// ── GET /api/orders — list all orders ────────────────────────────────────────
export async function GET() {

  try {
    const { blobs } = await list({ prefix: "orders/" })
    const orders = await Promise.all(
      blobs.map(async (blob) => {
        const res = await fetch(`${blob.url}?t=${Date.now()}`, { cache: "no-store" })
        return res.json() as Promise<Order>
      })
    )
    return NextResponse.json(
      orders.sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )
    )
  } catch (err) {
    console.error("Failed to list orders:", err)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

// ── POST /api/orders — bulk status update ────────────────────────────────────
// body: { ids: string[], status: OrderStatus }
export async function POST(req: NextRequest) {

  try {
    const { ids, status } = await req.json()
    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 })
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updated: Order[] = []

    for (const id of ids) {
      const { blobs } = await list({ prefix: `orders/${id}.json` })
      if (!blobs.length) continue
      const res = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: "no-store" })
      if (!res.ok) continue
      const order = await res.json() as Order
      const next: Order = { ...order, status, updatedAt: now }
      await put(`orders/${id}.json`, JSON.stringify(next), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
      })
      updated.push(next)
    }

    return NextResponse.json({ updated })
  } catch (err) {
    console.error("Bulk order update error:", err)
    return NextResponse.json({ error: "Failed to update orders" }, { status: 500 })
  }
}
