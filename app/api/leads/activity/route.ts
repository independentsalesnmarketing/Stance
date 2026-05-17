import { NextResponse } from "next/server"
import { list } from "@vercel/blob"
import type { LeadActivityLog } from "@/lib/order-types"

export const dynamic = "force-dynamic"

// ── GET /api/leads/activity — list all lead activity logs ────────────────────
export async function GET() {
  try {
    const { blobs } = await list({ prefix: "leads/activity/" })
    const logs = await Promise.all(
      blobs.map(async (blob) => {
        const res = await fetch(`${blob.url}?t=${Date.now()}`, { cache: "no-store" })
        return res.json() as Promise<LeadActivityLog>
      })
    )
    return NextResponse.json(
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    )
  } catch (err) {
    console.error("Failed to list activity:", err)
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 })
  }
}
