import { NextRequest, NextResponse } from "next/server"
import { put, list } from "@vercel/blob"
import type { Lead, LeadClaimToken } from "@/lib/order-types"

export const dynamic = "force-dynamic"

async function loadToken(token: string): Promise<LeadClaimToken | null> {
  const { blobs } = await list({ prefix: `leads/tokens/${token}.json` })
  const match = blobs.find((b) => b.pathname === `leads/tokens/${token}.json`)
  if (!match) return null
  const res = await fetch(`${match.url}?t=${Date.now()}`, { cache: "no-store" })
  if (!res.ok) return null
  return res.json() as Promise<LeadClaimToken>
}

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

// POST /api/leads/claim/[token]/order — agent submits the order number after processing the sale
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params
  try {
    const body = await req.json()
    const orderNumber = String(body.orderNumber || "").trim()
    if (!orderNumber) {
      return NextResponse.json({ success: false, message: "Order number is required." }, { status: 400 })
    }

    const claimToken = await loadToken(token)
    if (!claimToken) {
      return NextResponse.json({ success: false, message: "Invalid claim link." }, { status: 404 })
    }

    const lead = await loadLead(claimToken.leadId)
    if (!lead) {
      return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 })
    }

    // Trust the token: each agent has a unique token per lead, and a used token
    // proves they're the rightful claimer. Self-heal stale claim fields if CDN
    // hasn't propagated the claim write yet.
    if (claimToken.status === "used" && lead.claimedByAgentId !== claimToken.agentId) {
      lead.claimedByAgentId = claimToken.agentId
      lead.claimedByAgentEmail = claimToken.agentEmail || lead.claimedByAgentEmail
      if (!lead.claimedAt) lead.claimedAt = claimToken.usedAt || new Date().toISOString()
      if (lead.status === "unclaimed") lead.status = "claimed"
    } else if (claimToken.status !== "used" || lead.claimedByAgentId !== claimToken.agentId) {
      return NextResponse.json({ success: false, message: "This lead is not assigned to you." }, { status: 403 })
    }

    const now = new Date().toISOString()
    const previousOrder = lead.orderNumber
    lead.orderNumber = orderNumber
    if (!lead.orderSubmittedAt) lead.orderSubmittedAt = now
    // Mark lead as completed once an order number is on file
    if (lead.status === "claimed") lead.status = "completed"
    lead.updatedAt = now

    await put(`leads/${lead.id}.json`, JSON.stringify(lead), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    })

    await logActivity({
      timestamp: now,
      leadId: lead.id,
      action: previousOrder ? "Order Number Updated" : "Order Number Submitted",
      actorName: lead.claimedByAgentName || "Agent",
      actorEmail: lead.claimedByAgentEmail || "",
      details: previousOrder
        ? `Order number changed from ${previousOrder} to ${orderNumber}`
        : `Order number ${orderNumber} submitted; lead marked completed`,
    })

    // Notify admin via Google Apps Script
    const scriptUrl = "https://script.google.com/macros/s/AKfycbzdTG41hZ2eiNpNE1eY9WIxxfu1pQDiL5wOEzD_LDblRfUCojKfqaU0PRK4dH8bi_E/exec"
    if (scriptUrl) {
      try {
        await fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formType: "leadOrderSubmitted",
            adminEmail: "gamblerspassion@gmail.com",
            leadId: lead.id,
            leadName: lead.fullName,
            leadState: lead.state,
            provider: lead.provider,
            productSelected: lead.productSelected,
            orderNumber,
            previousOrderNumber: previousOrder || "",
            agentName: lead.claimedByAgentName,
            agentEmail: lead.claimedByAgentEmail,
            submittedAt: now,
          }),
        })
      } catch (err) {
        console.error("Admin order-submitted notification failed:", err)
      }
    }

    return NextResponse.json({
      success: true,
      message: previousOrder ? "Order number updated." : "Order number saved. This lead is now complete.",
      orderNumber: lead.orderNumber,
      status: lead.status,
    })
  } catch (err) {
    console.error("Order number submit error:", err)
    return NextResponse.json({ success: false, message: "Failed to save order number." }, { status: 500 })
  }
}
