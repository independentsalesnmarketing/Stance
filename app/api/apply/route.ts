import { NextResponse } from "next/server"

const RESEND_API_KEY = process.env.RESEND_API_KEY || ""
const GOOGLE_APPLY_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNRcZLXEry7OJZrcFO-mNSKzIcfLSXA-o7qiadL0usGla7_eqJtQHKch7Xw8dRgOmh/exec"
const TO_EMAIL = process.env.ADMIN_EMAIL || "gamblerspassion@gmail.com"

const PROGRAM_LABELS: Record<string, string> = {
  referral: "Referral Partner",
  "sales-agent": "Sales Agent",
  business: "Business (IBO)",
  "spectrum-event": "Spectrum Event Team",
  "tmobile-d2d": "T-Mobile Fiber D2D",
  "verizon-d2d": "Verizon Fios D2D",
}

const PROGRAM_FIELD_KEYS = [
  "referralMethod",
  "industry",
  "salesExperience",
  "preferredChannel",
  "territoryPreference",
  "businessType",
  "customerBase",
  "eventExperience",
  "previousCarriers",
  "hasTransportation",
  "d2dExperience",
  "teamSize",
  "territoryInterest",
  "additionalNotes",
] as const

function normalizeProgramFields(input: Record<string, unknown>) {
  const normalized: Record<(typeof PROGRAM_FIELD_KEYS)[number], string> = {
    referralMethod: "",
    industry: "",
    salesExperience: "",
    preferredChannel: "",
    territoryPreference: "",
    businessType: "",
    customerBase: "",
    eventExperience: "",
    previousCarriers: "",
    hasTransportation: "",
    d2dExperience: "",
    teamSize: "",
    territoryInterest: "",
    additionalNotes: "",
  }

  for (const key of PROGRAM_FIELD_KEYS) {
    const value = input[key]
    if (typeof value === "string") {
      normalized[key] = value.trim()
    }
  }

  return normalized
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      partnerType,
      firstName,
      lastName,
      email,
      phone,
      state,
      company,
      selectedProviders,
      ...programFields
    } = body

    if (!partnerType || !firstName || !lastName || !email || !phone || typeof selectedProviders !== "string" || !selectedProviders.trim()) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (!(partnerType in PROGRAM_LABELS)) {
      return NextResponse.json(
        { error: "Invalid program selection" },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    const name = `${firstName} ${lastName}`.trim()
    const programLabel = PROGRAM_LABELS[partnerType] || partnerType
    const normalizedProgramFields = normalizeProgramFields(programFields)

    // Build program-specific field summary
    const programFieldSummary = Object.entries(normalizedProgramFields)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ")

    // 1. Submit to Google Sheet
    if (!GOOGLE_APPLY_SCRIPT_URL) {
      return NextResponse.json(
        { error: "Google Apply Script URL is not configured" },
        { status: 500 }
      )
    }

    const sheetRes = await fetch(GOOGLE_APPLY_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formType: "application",
        name,
        email,
        phone: phone || "",
        state: state || "",
        company: company || "",
        program: programLabel,
        ...normalizedProgramFields,
        // Fallback summary in case script columns are changed later.
        details: programFieldSummary,
      }),
    })

    if (!sheetRes.ok) {
      const sheetText = await sheetRes.text()
      console.error("Google Sheet HTTP error:", sheetRes.status, sheetText)
      return NextResponse.json(
        { error: "Unable to write application to Google Sheet" },
        { status: 502 }
      )
    }

    const sheetBody = await sheetRes.text()
    let parsed: { success?: boolean; error?: string } | null = null

    try {
      parsed = JSON.parse(sheetBody) as { success?: boolean; error?: string }
    } catch {
      console.error("Google Sheet non-JSON response:", sheetBody)
      return NextResponse.json(
        { error: "Google Sheet script returned an invalid response" },
        { status: 502 }
      )
    }

    if (parsed?.success !== true) {
      console.error("Google Sheet script error:", parsed?.error || parsed)
      return NextResponse.json(
        { error: "Google Sheet script returned an error" },
        { status: 502 }
      )
    }

    // 2. Build email rows for program-specific fields
    const programRows = Object.entries(normalizedProgramFields)
      .filter(([, v]) => v)
      .map(
        ([key, value]) => `
          <tr>
            <td style="padding:10px 16px;color:#9ca3af;font-size:14px;white-space:nowrap;vertical-align:top">${key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase())}</td>
            <td style="padding:10px 16px;color:#fff;font-size:14px">${value}</td>
          </tr>`
      )
      .join("")

    // 3. Send notification email to you
    const adminRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Stance Applications <onboarding@resend.dev>",
        to: [TO_EMAIL],
        subject: `New ${programLabel} Application — ${name}`,
        html: `
          <div style="background:#0a0e13;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
            <div style="max-width:600px;margin:0 auto">
              <div style="border-bottom:2px solid #ef4444;padding-bottom:20px;margin-bottom:24px">
                <h1 style="color:#fff;font-size:22px;margin:0">New Partner Application</h1>
                <p style="color:#ef4444;font-size:14px;margin:4px 0 0">${programLabel}</p>
              </div>
              <table style="width:100%;border-collapse:collapse;background:#111827;border:1px solid #1f2937">
                <tr style="background:#1a1f2e">
                  <td style="padding:10px 16px;color:#9ca3af;font-size:14px">Name</td>
                  <td style="padding:10px 16px;color:#fff;font-size:14px;font-weight:600">${name}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;color:#9ca3af;font-size:14px">Email</td>
                  <td style="padding:10px 16px;color:#fff;font-size:14px"><a href="mailto:${email}" style="color:#60a5fa">${email}</a></td>
                </tr>
                <tr style="background:#1a1f2e">
                  <td style="padding:10px 16px;color:#9ca3af;font-size:14px">Phone</td>
                  <td style="padding:10px 16px;color:#fff;font-size:14px">${phone}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;color:#9ca3af;font-size:14px">State</td>
                  <td style="padding:10px 16px;color:#fff;font-size:14px">${state || "N/A"}</td>
                </tr>
                <tr style="background:#1a1f2e">
                  <td style="padding:10px 16px;color:#9ca3af;font-size:14px">Company</td>
                  <td style="padding:10px 16px;color:#fff;font-size:14px">${company || "N/A"}</td>
                </tr>
                ${programRows}
              </table>
              <div style="margin-top:24px;padding:16px;background:#111827;border:1px solid #1f2937;border-left:3px solid #ef4444">
                <p style="color:#9ca3af;font-size:13px;margin:0">
                  Generate onboarding link at <a href="https://stance-marketing.com/admin" style="color:#60a5fa">stance-marketing.com/admin</a>
                </p>
              </div>
              <p style="color:#4b5563;font-size:11px;margin-top:20px">Submitted via stance-marketing.com/apply</p>
            </div>
          </div>
        `,
      }),
    })

    if (!adminRes.ok) {
      console.error("Admin email error:", await adminRes.text())
    }

    // 4. Send confirmation to applicant
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Stance Marketing <onboarding@resend.dev>",
          to: [email],
          subject: "Application Received — Stance Marketing",
          html: `
            <div style="background:#0a0e13;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
              <div style="max-width:600px;margin:0 auto">
                <h1 style="color:#fff;font-size:22px;margin:0 0 16px">Application Received</h1>
                <p style="color:#d1d5db;font-size:15px;line-height:1.6">
                  Hi ${firstName},<br><br>
                  Thank you for applying to the <strong style="color:#fff">${programLabel}</strong> program at Stance Marketing.
                  Our team is reviewing your application and will reach out within 24-48 business hours with next steps, including your onboarding link.
                </p>
                <div style="margin-top:24px;padding:16px;background:#111827;border:1px solid #1f2937;border-left:3px solid #ef4444">
                  <p style="color:#9ca3af;font-size:13px;margin:0">
                    Questions? Contact us at <a href="mailto:info@stance-marketing.com" style="color:#60a5fa">info@stance-marketing.com</a>
                  </p>
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

    return NextResponse.json({
      success: true,
    })
  } catch (err) {
    console.error("Application API error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
