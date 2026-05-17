import { NextRequest, NextResponse } from "next/server"
import { put, list, del } from "@vercel/blob"
import {
  type Order,
  type OrderStatus,
  ORDER_STATUS_LABELS,
} from "@/lib/order-types"

export const dynamic = "force-dynamic"

const VALID_STATUSES: OrderStatus[] = [
  "submitted",
  "pending",
  "complete",
  "paid",
  "cancelled",
]

// Fields that an admin is allowed to edit on the order itself
const EDITABLE_FIELDS = [
  "customerFirstName",
  "customerLastName",
  "customerPhone",
  "customerEmail",
  "customerAddress",
  "customerCity",
  "customerState",
  "customerZip",
  "carrier",
  "service",
  "orderNumber",
  "saleDate",
  "installDate",
  "installTime",
  "notes",
] as const

async function notifyAgentStatusChange(order: Order) {
  const scriptUrl = process.env.GOOGLE_ORDERS_SCRIPT_URL
  if (!scriptUrl || !order.agentEmail) return

  const statusLabel = ORDER_STATUS_LABELS[order.status]
  const customer    = `${order.customerFirstName} ${order.customerLastName}`.trim()

  try {
    await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formType:    "statusUpdate",
        agentEmail:  order.agentEmail,
        agentName:   order.agentName,
        status:      order.status,
        statusLabel,
        customer,
        carrier:     order.carrier,
        service:     order.service || "",
        orderId:     order.id,
        notes:       order.notes || "",
        adminNotes:  order.adminNotes || "",
      }),
    })
  } catch (err) {
    console.error("Status notification failed:", err)
  }
}

async function updateSheetStatus(order: Order) {
  const scriptUrl = process.env.GOOGLE_ORDERS_SCRIPT_URL
  if (!scriptUrl) return
  try {
    await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formType:    "sheetStatusUpdate",
        orderId:     order.id,
        status:      order.status,
        statusLabel: ORDER_STATUS_LABELS[order.status],
        adminNotes:  order.adminNotes || "",
      }),
    })
  } catch (err) {
    console.error("Sheet status update failed:", err)
  }
}

// ── GET /api/orders/[id] — fetch single order ────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: "Missing order ID" }, { status: 400 })

  try {
    const { blobs } = await list({ prefix: `orders/${id}.json` })
    if (!blobs.length) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    const res = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: "no-store" })
    return NextResponse.json(await res.json() as Order)
  } catch (err) {
    console.error("Order fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 })
  }
}

// ── PATCH /api/orders/[id] — update status, notes, or details ────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: "Missing order ID" }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { status, adminNotes, notifyAgent } = body

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const { blobs } = await list({ prefix: `orders/${id}.json` })
    if (!blobs.length) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const res = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to load order" }, { status: 500 })
    }

    const existing = await res.json() as Order
    const prevStatus = existing.status

    const editPatch: Partial<Order> = {}
    for (const k of EDITABLE_FIELDS) {
      if (body[k] !== undefined) (editPatch as any)[k] = String(body[k] ?? "")
    }

    const updated: Order = {
      ...existing,
      ...editPatch,
      ...(status !== undefined && { status }),
      ...(adminNotes !== undefined && { adminNotes }),
      updatedAt: new Date().toISOString(),
    }

    await put(`orders/${id}.json`, JSON.stringify(updated), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    })

    // Always update the Google Sheet status column when status changes
    if (status !== undefined && status !== prevStatus) {
      updateSheetStatus(updated)
    }

    // Fire-and-forget email on status change (only if admin requested it)
    if (notifyAgent === true && status !== undefined && status !== prevStatus) {
      notifyAgentStatusChange(updated)
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error("Order update error:", err)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

// ── DELETE /api/orders/[id] — delete order ───────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {

  const { id } = params
  if (!id) return NextResponse.json({ error: "Missing order ID" }, { status: 400 })

  try {
    const { blobs } = await list({ prefix: `orders/${id}.json` })
    if (!blobs.length) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    await del(blobs[0].url)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Order delete error:", err)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
