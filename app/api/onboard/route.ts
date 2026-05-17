import { NextResponse } from "next/server"
import { put, list } from "@vercel/blob"
import type { AgentProfile } from "@/lib/order-types"

const RESEND_API_KEY = process.env.RESEND_API_KEY || ""
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxrE78Z0cd_qGq1KxcVyvOqxOk5LN2i87sX-HJ-dMFpd-EggkIu4ar2UtucCRtLiRU/exec"
const TO_EMAIL = process.env.ADMIN_EMAIL || "gamblerspassion@gmail.com"

const PROGRAM_LABELS: Record<string, string> = {
  referral: "Referral Partner",
  "sales-agent": "Sales Agent",
  business: "Business Partnership",
  "spectrum-event": "Spectrum Event Team",
  "tmobile-d2d": "T-Mobile Fiber D2D",
  "verizon-d2d": "Verizon Fios D2D",
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      token,
      partnerType,
      legalName,
      dob,
      dbaName,
      entityType,
      address,
      city,
      state,
      zipCode,
      phone,
      taxId,
      tinType,
      w9Certified,
      w9SignatureDataUrl,
      exemptPayeeCode,
      signatureDataUrl,
      idDocUrl,
      badgePhotoUrl,
      onboardingPdfUrl,
      isContractRead,
      isAcknowledged,
      email,
      programLabel: clientProgramLabel,
    } = body
    const resolvedTaxId = taxId || body.einLast4 || ""
    const tokenSafe = token || `manual-${Date.now()}`

    const missingFields: string[] = []
    if (!legalName?.trim()) missingFields.push("legalName")
    if (!signatureDataUrl?.trim()) missingFields.push("signatureDataUrl")
    if (!isContractRead) missingFields.push("isContractRead")

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Missing required onboarding fields",
          missingFields,
        },
        { status: 400 }
      )
    }

    const programLabel = clientProgramLabel || PROGRAM_LABELS[partnerType] || partnerType || "Unknown"
    const now = new Date()
    const signedDate =
      now.toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " EST"

    const tinLabel = tinType === "ssn" ? "SSN" : tinType === "ein" ? "EIN" : ""

    // 1. Submit to Google Sheets with proper columns
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "onboarding",
          legalName: legalName || "",
          dbaName: dbaName || "",
          entityType: entityType || "",
          email: email || "",
          phone: phone || "",
          address: address || "",
          city: city || "",
          state: state || "",
          zipCode: zipCode || "",
          program: programLabel,
          tinType: tinLabel,
          tin: resolvedTaxId
            ? tinType === "ssn"
              ? resolvedTaxId.replace(/^(\d{3})(\d{2})(\d{4})$/, "$1-$2-$3")
              : resolvedTaxId.replace(/^(\d{2})(\d{7})$/, "$1-$2")
            : "",
          idDocUrl: idDocUrl || "",
          badgePhotoUrl: badgePhotoUrl || "",
          onboardingPdfUrl: onboardingPdfUrl || "",
          token: tokenSafe,
        }),
      })
    } catch (sheetErr) {
      console.error("Google Sheet error:", sheetErr)
    }

    // 2. Send admin notification
    const pdfButton = onboardingPdfUrl
      ? `<div style="margin-top:16px;padding:16px;background:#0d2a1a;border:1px solid #166534">
          <p style="color:#86efac;font-size:13px;font-weight:600;margin:0 0 10px">Onboarding Documents</p>
          <a href="${onboardingPdfUrl}" style="display:inline-block;background:#22c55e;color:#fff;padding:10px 20px;text-decoration:none;font-size:14px;font-weight:600">Download Contract / W-9 PDF</a>
        </div>`
      : ""

    const docLinks = [
      idDocUrl ? `<p style="margin:0 0 8px"><a href="${idDocUrl}" style="color:#60a5fa;font-size:14px">View Government ID →</a></p>` : "",
      badgePhotoUrl ? `<p style="margin:0"><a href="${badgePhotoUrl}" style="color:#60a5fa;font-size:14px">View Badge Photo →</a></p>` : "",
    ]
      .filter(Boolean)
      .join("")

    const adminRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Stance Onboarding <onboarding@resend.dev>",
        to: [TO_EMAIL],
        subject: `Onboarding Complete — ${legalName} (${programLabel})`,
        html: `
          <div style="background:#0a0e13;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
            <div style="max-width:600px;margin:0 auto">
              <div style="border-bottom:2px solid #22c55e;padding-bottom:20px;margin-bottom:24px">
                <h1 style="color:#fff;font-size:22px;margin:0">Onboarding Complete</h1>
                <p style="color:#22c55e;font-size:14px;margin:4px 0 0">${programLabel} — Contract Signed</p>
              </div>
              <table style="width:100%;border-collapse:collapse;background:#111827;border:1px solid #1f2937">
                <tr style="background:#1a1f2e"><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Legal Name</td><td style="padding:10px 16px;color:#fff;font-size:14px;font-weight:600">${legalName}</td></tr>
                <tr><td style="padding:10px 16px;color:#9ca3af;font-size:14px">DBA / Company</td><td style="padding:10px 16px;color:#fff;font-size:14px">${dbaName || "N/A"}</td></tr>
                <tr style="background:#1a1f2e"><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Entity Type</td><td style="padding:10px 16px;color:#fff;font-size:14px">${entityType || "N/A"}</td></tr>
                <tr><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Address</td><td style="padding:10px 16px;color:#fff;font-size:14px">${[address, city, state, zipCode].filter(Boolean).join(", ") || "N/A"}</td></tr>
                <tr style="background:#1a1f2e"><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Phone</td><td style="padding:10px 16px;color:#fff;font-size:14px">${phone || "N/A"}</td></tr>
                <tr><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Email</td><td style="padding:10px 16px;color:#fff;font-size:14px">${email ? `<a href="mailto:${email}" style="color:#60a5fa">${email}</a>` : "N/A"}</td></tr>
                <tr style="background:#1a1f2e"><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Program</td><td style="padding:10px 16px;color:#fff;font-size:14px">${programLabel}</td></tr>
                <tr><td style="padding:10px 16px;color:#9ca3af;font-size:14px">TIN Type</td><td style="padding:10px 16px;color:#fff;font-size:14px">${tinLabel || "N/A"}</td></tr>
                <tr style="background:#1a1f2e"><td style="padding:10px 16px;color:#9ca3af;font-size:14px">TIN (last 4)</td><td style="padding:10px 16px;color:#fff;font-size:14px">${resolvedTaxId || "N/A"}</td></tr>
                <tr><td style="padding:10px 16px;color:#9ca3af;font-size:14px">W-9 Certified</td><td style="padding:10px 16px;color:#fff;font-size:14px">${w9Certified ? "Yes" : "No"}</td></tr>
                <tr style="background:#1a1f2e"><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Signed At</td><td style="padding:10px 16px;color:#fff;font-size:14px">${signedDate}</td></tr>
                <tr><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Acknowledged</td><td style="padding:10px 16px;color:#fff;font-size:14px">${isAcknowledged ? "Yes" : "No"}</td></tr>
              </table>
              ${docLinks ? `<div style="margin-top:16px;background:#111827;border:1px solid #1f2937;padding:16px"><p style="color:#9ca3af;font-size:13px;margin:0 0 10px;font-weight:600">Uploaded Files</p>${docLinks}</div>` : ""}
              ${pdfButton}
              <div style="margin-top:16px;padding:16px;background:#111827;border:1px solid #1f2937">
                <p style="color:#9ca3af;font-size:13px;margin:0 0 8px">Electronic Signature</p>
                <img src="${signatureDataUrl}" alt="Signature" style="max-width:300px;height:auto;background:#fff;padding:8px" />
              </div>
              <div style="margin-top:12px;padding:12px;background:#0d1117;border:1px solid #1f2937">
                <p style="color:#4b5563;font-size:12px;margin:0">Token: ${tokenSafe}</p>
              </div>
              <p style="color:#4b5563;font-size:11px;margin-top:20px">Submitted via stance-marketing.com/onboarding</p>
            </div>
          </div>
        `,
      }),
    })

    if (!adminRes.ok) {
      console.error("Admin email error:", await adminRes.text())
    }

    // 3. Send contract + W-9 copy to contractor
    if (email) {
      try {
        const contractorPdfButton = onboardingPdfUrl
          ? `<div style="text-align:center;margin:28px 0">
              <a href="${onboardingPdfUrl}" style="display:inline-block;background:#22c55e;color:#fff;padding:14px 28px;text-decoration:none;font-size:16px;font-weight:700;border-radius:6px">Download Your Contract & W-9 Copy</a>
            </div>`
          : ""

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Stance Marketing <onboarding@resend.dev>",
            to: [email],
            subject: "Onboarding Complete — Your Contract & W-9 Copy | Stance Marketing",
            html: `
              <div style="background:#0a0e13;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
                <div style="max-width:600px;margin:0 auto">
                  <div style="border-bottom:2px solid #22c55e;padding-bottom:20px;margin-bottom:24px">
                    <h1 style="color:#fff;font-size:22px;margin:0">Welcome to Stance Marketing</h1>
                    <p style="color:#22c55e;font-size:14px;margin:4px 0 0">Onboarding Complete</p>
                  </div>
                  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px">Hi ${legalName.split(" ")[0]},</p>
                  <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px">
                    Your Independent Contractor Agreement and W-9 information have been received and saved. Your copy of the contract is linked below — please download and keep it for your records.
                  </p>
                  ${contractorPdfButton}
                  <table style="width:100%;border-collapse:collapse;background:#111827;border:1px solid #1f2937;margin-bottom:24px">
                    <tr style="background:#1a1f2e"><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Program</td><td style="padding:10px 16px;color:#fff;font-size:14px">${programLabel}</td></tr>
                    <tr><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Contract Signed</td><td style="padding:10px 16px;color:#22c55e;font-size:14px">${signedDate}</td></tr>
                    <tr style="background:#1a1f2e"><td style="padding:10px 16px;color:#9ca3af;font-size:14px">W-9 On File</td><td style="padding:10px 16px;color:#22c55e;font-size:14px">${w9Certified ? "Yes — Certified" : "No"}</td></tr>
                    <tr><td style="padding:10px 16px;color:#9ca3af;font-size:14px">Uploaded Documents</td><td style="padding:10px 16px;color:#fff;font-size:14px">${[idDocUrl ? "Government ID" : null, badgePhotoUrl ? "Badge Photo" : null].filter(Boolean).join(", ") || "None"}</td></tr>
                  </table>
                  <div style="padding:16px;background:#111827;border:1px solid #1f2937;border-left:3px solid #22c55e">
                    <p style="color:#d1d5db;font-size:14px;margin:0 0 8px;font-weight:600">What happens next?</p>
                    <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0">Our team will review your documents and finalize your account setup within 1–2 business days.</p>
                  </div>
                  <div style="margin-top:24px;padding:16px;background:#111827;border:1px solid #1f2937;border-left:3px solid #ef4444">
                    <p style="color:#9ca3af;font-size:13px;margin:0">Questions? Contact us at <a href="mailto:info@stance-marketing.com" style="color:#60a5fa">info@stance-marketing.com</a></p>
                  </div>
                  <p style="color:#4b5563;font-size:11px;margin-top:20px">Stance Marketing LLC</p>
                </div>
              </div>
            `,
          }),
        })
      } catch {
        // Non-fatal
      }
    }

    // ── Auto-create (or reuse) agent profile for order system ─────────────
    let agentId: string | null = null
    if (process.env.BLOB_READ_WRITE_TOKEN && email?.trim()) {
      try {
        const normalizedEmail = email.trim().toLowerCase()

        // Dedupe: find an existing agent with this email
        const { blobs } = await list({ prefix: "agent-profiles/" })
        let existing: AgentProfile | null = null
        for (const b of blobs) {
          const r = await fetch(b.url)
          if (!r.ok) continue
          const a = await r.json() as AgentProfile
          if (a.email === normalizedEmail) { existing = a; break }
        }

        if (existing) {
          agentId = existing.id
        } else {
          const nameParts = (legalName || "").trim().split(/\s+/)
          const firstName = nameParts[0] || legalName || ""
          const lastName  = nameParts.slice(1).join(" ") || ""
          agentId = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
          const agent: AgentProfile = {
            id: agentId,
            firstName,
            lastName,
            email: normalizedEmail,
            phone: phone?.trim() || "",
            partnerType: partnerType || "sales-agent",
            createdAt: new Date().toISOString(),
            source: "onboarding",
          }
          await put(`agent-profiles/${agentId}.json`, JSON.stringify(agent), {
            access: "public",
            contentType: "application/json",
            addRandomSuffix: false,
            allowOverwrite: true,
            cacheControlMaxAge: 0,
          })
        }
      } catch (agentErr) {
        console.error("Agent profile creation error:", agentErr)
        // Non-fatal
      }
    }

    return NextResponse.json({ success: true, agentId })
  } catch (err) {
    console.error("Onboarding API error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
