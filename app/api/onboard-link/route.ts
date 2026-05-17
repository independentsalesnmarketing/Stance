import { NextRequest, NextResponse } from "next/server"
import { put, list } from "@vercel/blob"

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage not configured" }, { status: 500 })
  }

  try {
    const payload = await req.json()
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12)

    await put(`onboarding-links/${id}.json`, JSON.stringify(payload), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    })

    return NextResponse.json({ id })
  } catch (error) {
    console.error("Link creation error:", error)
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage not configured" }, { status: 500 })
  }

  try {
    const { blobs } = await list({ prefix: `onboarding-links/${id}.json` })

    if (!blobs.length) {
      return NextResponse.json({ error: "Link not found or expired" }, { status: 404 })
    }

    const res = await fetch(blobs[0].url)
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch link data" }, { status: 500 })
    }

    const payload = await res.json()
    return NextResponse.json(payload)
  } catch (error) {
    console.error("Link retrieval error:", error)
    return NextResponse.json({ error: "Failed to retrieve link" }, { status: 500 })
  }
}
