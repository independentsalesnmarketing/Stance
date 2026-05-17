import { NextResponse } from "next/server"
import { put, list } from "@vercel/blob"
import type { Order, AgentProfile } from "@/lib/order-types"

const GOOGLE_ORDERS_SCRIPT_URL = process.env.GOOGLE_ORDERS_SCRIPT_URL || ""

const PROGRAM_LABELS: Record<string, string> = {
  referral: "Referral Partner",
  "sales-agent": "Sales Agent",
  business: "Business (IBO)",
  "spectrum-event": "Spectrum Event Team",
  "tmobile-d2d": "T-Mobile Fiber D2D",
  "verizon-d2d": "Verizon Fios D2D",
}

// Convert YYYY-MM-DD → M/D/YYYY
function fmtDate(iso: string): string {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  return `${parseInt(m)}/${parseInt(d)}/${y}`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      agentId,
      agentFirstName,
      agentLastName,
      agentEmail,
      agentPhone,
      partnerType,
      customerFirstName,
      customerLastName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerCity,
      customerState,
      customerZip,
      customerDob,
      customerSsn,
      customerCcNumber,
      customerCcExpiry,
      customerCcCvv,
      carrier,
      service,
      saleDate,
      installDate,
      installTime,
      notes,
    } = body

    // ── Validation ──────────────────────────────────────────────────────────
    const missing: string[] = []
    if (!agentFirstName?.trim()) missing.push("agentFirstName")
    if (!agentLastName?.trim()) missing.push("agentLastName")
    if (!agentEmail?.trim()) missing.push("agentEmail")
    if (!agentPhone?.trim()) missing.push("agentPhone")
    if (!customerFirstName?.trim()) missing.push("customerFirstName")
    if (!customerLastName?.trim()) missing.push("customerLastName")
    if (!customerPhone?.trim()) missing.push("customerPhone")
    if (!customerEmail?.trim()) missing.push("customerEmail")
    if (!customerAddress?.trim()) missing.push("customerAddress")
    if (!customerCity?.trim()) missing.push("customerCity")
    if (!customerState?.trim()) missing.push("customerState")
    if (!customerZip?.trim()) missing.push("customerZip")
    if (!carrier?.trim()) missing.push("carrier")
    if (!service?.trim() && partnerType !== "referral") missing.push("service")
    if (!saleDate?.trim()) missing.push("saleDate")

    if (missing.length > 0) {
      return NextResponse.json({ error: "Missing required fields", missing }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(agentEmail)) {
      return NextResponse.json({ error: "Invalid agent email address" }, { status: 400 })
    }
    if (!emailRegex.test(customerEmail)) {
      return NextResponse.json({ error: "Invalid customer email address" }, { status: 400 })
    }

    const orderId = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
    const now = new Date().toISOString()
    const agentName = `${agentFirstName} ${agentLastName}`.trim()
    const customerName = `${customerFirstName} ${customerLastName}`.trim()
    const programLabel = PROGRAM_LABELS[partnerType] || partnerType || "Unknown"
    const customerAddressFull = [customerAddress, customerCity, customerState, customerZip]
      .filter(Boolean)
      .join(", ")

    // ── 1. Submit to Google Sheet (primary — sends email notification) ────
    if (GOOGLE_ORDERS_SCRIPT_URL) {
      try {
        await fetch(GOOGLE_ORDERS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formType: "order",
            orderId,
            agentName,
            agentEmail,
            agentPhone: agentPhone || "",
            partnerType: programLabel,
            customerName,
            customerPhone,
            customerEmail,
            customerAddress: customerAddressFull,
            customerDob: fmtDate(customerDob || ""),
            customerSsn: customerSsn || "",
            customerCcNumber: customerCcNumber || "",
            customerCcExpiry: customerCcExpiry || "",
            customerCcCvv: customerCcCvv || "",
            carrier,
            service: service || "",
            saleDate: fmtDate(saleDate),
            installDate: fmtDate(installDate || ""),
            installTime: installTime || "",
            notes: notes || "",
          }),
        })
      } catch (sheetErr) {
        console.error("Google Sheet error:", sheetErr)
      }
    }

    // ── 2. Persist to Vercel Blob (powers admin panel) ────────────────────
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const order: Order = {
        id: orderId,
        agentId: agentId || "",
        agentName,
        agentEmail,
        partnerType: programLabel,
        customerFirstName,
        customerLastName,
        customerPhone,
        customerEmail,
        customerAddress,
        customerCity,
        customerState,
        customerZip,
        customerDob: customerDob || "",
        customerSsn: customerSsn || "",
        customerCcNumber: customerCcNumber || "",
        customerCcExpiry: customerCcExpiry || "",
        customerCcCvv: customerCcCvv || "",
        carrier,
        service,
        orderNumber: "",
        saleDate,
        installDate: installDate || "",
        installTime: installTime || "",
        notes: notes || "",
        status: "submitted",
        submittedAt: now,
        updatedAt: now,
        adminNotes: "",
      }
      try {
        await put(`orders/${orderId}.json`, JSON.stringify(order), {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
          allowOverwrite: true,
        })
      } catch (blobErr) {
        console.error("Blob storage error:", blobErr)
      }

      // ── 3. Tier 2 agent orders auto-create leads for Tier 1 agents ────
      if (agentId) {
        try {
          const { blobs: agentBlobs } = await list({ prefix: `agent-profiles/${agentId}.json` })
          if (agentBlobs.length) {
            const agentRes = await fetch(agentBlobs[0].url, { cache: "no-store" })
            if (agentRes.ok) {
              const agentData = await agentRes.json() as AgentProfile
              if (agentData.tier === 2) {
                const leadId = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
                const customerFullName = `${customerFirstName} ${customerLastName}`.trim()
                const fullAddress = [customerAddress, customerCity, customerState, customerZip].filter(Boolean).join(", ")
                const lead = {
                  id: leadId,
                  createdAt: now,
                  createdBy: `Tier 2 Order (${agentName})`,
                  status: "unclaimed",
                  fullName: customerFullName,
                  address: fullAddress,
                  state: (customerState || "").toUpperCase(),
                  email: customerEmail || "",
                  phone: customerPhone || "",
                  dob: customerDob || "",
                  provider: carrier || "",
                  productSelected: service || "",
                  preferredInstallDate: installDate || "",
                  preferredInstallTime: installTime || "",
                  notes: notes ? `From Tier 2 order by ${agentName}: ${notes}` : `Auto-created from Tier 2 order by ${agentName}`,
                  eligibleAgentIds: [] as string[],
                  notifiedAgentIds: [] as string[],
                  claimedByAgentId: "",
                  claimedByAgentName: "",
                  claimedByAgentEmail: "",
                  claimedAt: "",
                  removedBy: "",
                  removedAt: "",
                  adminNotes: `Auto-generated from order ${orderId} submitted by Tier 2 agent ${agentName}`,
                  updatedAt: now,
                }
                await put(`leads/${leadId}.json`, JSON.stringify(lead), {
                  access: "public",
                  contentType: "application/json",
                  addRandomSuffix: false,
                  allowOverwrite: true,
                })
                console.log(`Auto-created lead ${leadId} from Tier 2 order ${orderId}`)
              }
            }
          }
        } catch (leadErr) {
          console.error("Auto-lead creation error:", leadErr)
        }
      }
    }

    return NextResponse.json({ success: true, orderId })
  } catch (err) {
    console.error("Order submission error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
