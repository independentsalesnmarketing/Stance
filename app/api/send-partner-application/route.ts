import { NextResponse } from "next/server"

const RESEND_API_KEY = process.env.RESEND_API_KEY || ""
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx5yjGHJQ_hUof7SQ8FEx_vbwzvBhJLmDogYdGkkJUN0F_UH8ivZXBVIVkTLF_nC0US/exec"
const TO_EMAIL = process.env.ADMIN_EMAIL || "gamblerspassion@gmail.com"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { firstName, lastName, email, phone, company, partnerType, selectedProviders, experience, state, message } = body

    const name = `${firstName} ${lastName}`.trim()

    // 1. Submit to Google Sheet
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "partnerApplication",
          name,
          email,
          phone: phone || "",
          company: company || "",
          partnerType: partnerType || "",
          selectedProviders: selectedProviders || "",
          state: state || "",
          experience: experience || "",
          notes: message || "",
        }),
      })
    } catch (sheetErr) {
      console.error("Google Sheet error:", sheetErr)
      // Non-fatal: continue to send email
    }

    // 2. Send email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Stance Partner Applications <onboarding@resend.dev>",
        to: [TO_EMAIL],
        subject: `New Partner Application from ${name}`,
        html: `
          <h2>New Partner Application</h2>
          <table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:600px;">
            <tr><td><strong>Name</strong></td><td>${name}</td></tr>
            <tr style="background:#f9f9f9"><td><strong>Email</strong></td><td><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td><strong>Phone</strong></td><td>${phone || "N/A"}</td></tr>
            <tr style="background:#f9f9f9"><td><strong>Company</strong></td><td>${company || "N/A"}</td></tr>
            <tr><td><strong>Partnership Type</strong></td><td>${partnerType}</td></tr>
            <tr style="background:#f9f9f9"><td><strong>Providers</strong></td><td>${selectedProviders || "N/A"}</td></tr>
            <tr><td><strong>State</strong></td><td>${state || "N/A"}</td></tr>
            <tr><td><strong>Experience</strong></td><td>${experience || "N/A"}</td></tr>
            <tr style="background:#f9f9f9"><td><strong>Notes</strong></td><td>${message || "N/A"}</td></tr>
          </table>
          <p style="margin-top:16px;color:#666;font-size:12px;">Submitted via stance-marketing.com</p>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("Resend error:", err)
      // Google Sheet already got the data — still consider a partial success
      return NextResponse.json({ success: true, emailSent: false })
    }

    return NextResponse.json({ success: true, emailSent: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
