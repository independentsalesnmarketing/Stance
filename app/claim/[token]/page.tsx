"use client"

import React, { useState, useEffect } from "react"
import { Loader2, CheckCircle2, XCircle, MapPin, Building2, Package, Shield, Hash, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface PreviewInfo {
  state: string
  provider: string
  productSelected: string
  createdAt: string
}

interface LeadDetails {
  fullName: string
  address: string
  state: string
  email: string
  phone: string
  dob: string
  provider: string
  productSelected: string
  preferredInstallDate: string
  preferredInstallTime: string
  notes: string
  orderNumber?: string
}

export default function ClaimPage({ params }: { params: { token: string } }) {
  const { token } = params
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [valid, setValid] = useState(false)
  const [message, setMessage] = useState("")
  const [preview, setPreview] = useState<PreviewInfo | null>(null)
  const [agentName, setAgentName] = useState("")
  const [claimed, setClaimed] = useState(false)
  const [leadDetails, setLeadDetails] = useState<LeadDetails | null>(null)
  const [alreadyClaimed, setAlreadyClaimed] = useState(false)
  const [orderNumber, setOrderNumber] = useState("")
  const [orderEditMode, setOrderEditMode] = useState(false)
  const [orderSaving, setOrderSaving] = useState(false)
  const [orderError, setOrderError] = useState("")
  const [orderSuccess, setOrderSuccess] = useState("")

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch(`/api/leads/claim/${token}`)
        const data = await res.json()
        setValid(data.valid)
        setMessage(data.message || "")
        if (data.valid) {
          setPreview(data.preview)
          setAgentName(data.agentName)
        } else if (data.alreadyClaimed && data.claimedBySelf && data.lead) {
          setAlreadyClaimed(true)
          setLeadDetails(data.lead)
          if (data.lead.orderNumber) setOrderNumber(data.lead.orderNumber)
        }
      } catch {
        setMessage("Something went wrong. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [token])

  const handleClaim = async () => {
    setClaiming(true)
    try {
      const res = await fetch(`/api/leads/claim/${token}`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setClaimed(true)
        setLeadDetails(data.lead)
        setMessage(data.message)
      } else {
        setValid(false)
        setMessage(data.message)
      }
    } catch {
      setMessage("Something went wrong while processing your claim. Please try again.")
    } finally {
      setClaiming(false)
    }
  }

  const handleOrderSubmit = async () => {
    const trimmed = orderNumber.trim()
    if (!trimmed) {
      setOrderError("Please enter the order number.")
      return
    }
    setOrderSaving(true)
    setOrderError("")
    setOrderSuccess("")
    try {
      const res = await fetch(`/api/leads/claim/${token}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: trimmed }),
      })
      const data = await res.json()
      if (data.success) {
        setOrderSuccess(data.message || "Order number saved.")
        setOrderEditMode(false)
        setLeadDetails((prev) => (prev ? { ...prev, orderNumber: data.orderNumber } : prev))
      } else {
        setOrderError(data.message || "Failed to save order number.")
      }
    } catch {
      setOrderError("Network error. Please try again.")
    } finally {
      setOrderSaving(false)
    }
  }

  // Renders the order-number capture / display block (used in both claimed and alreadyClaimed views)
  const renderOrderBlock = () => {
    const hasOrder = !!leadDetails?.orderNumber && !orderEditMode
    return (
      <div className="mt-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4" data-testid="order-number-block">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-blue-300" />
            <p className="text-xs font-bold text-blue-200 uppercase tracking-[0.15em]">
              {hasOrder ? "Order Number on File" : "Submit Order Number"}
            </p>
          </div>
          {hasOrder && (
            <button
              type="button"
              onClick={() => { setOrderEditMode(true); setOrderSuccess(""); setOrderError("") }}
              data-testid="order-number-edit-btn"
              className="text-xs text-blue-300 hover:text-blue-200 inline-flex items-center gap-1"
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          )}
        </div>

        {hasOrder ? (
          <p className="text-base text-white font-mono tracking-wider" data-testid="order-number-display">
            {leadDetails?.orderNumber}
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              After you process this sale, paste the carrier order number here so admin can track the commission.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={orderNumber}
                onChange={(e) => { setOrderNumber(e.target.value); if (orderError) setOrderError("") }}
                placeholder="e.g. ABC123456789"
                disabled={orderSaving}
                data-testid="order-number-input"
                className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-500 h-11 rounded-xl font-mono"
              />
              <Button
                onClick={handleOrderSubmit}
                disabled={orderSaving || !orderNumber.trim()}
                data-testid="order-number-submit-btn"
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl h-11 px-5 text-sm whitespace-nowrap"
              >
                {orderSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving...</> : "Save Order #"}
              </Button>
            </div>
            {orderEditMode && (
              <button
                type="button"
                onClick={() => { setOrderEditMode(false); setOrderError(""); setOrderNumber(leadDetails?.orderNumber || "") }}
                className="mt-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            )}
          </>
        )}
        {orderError && <p className="text-red-400 text-xs mt-2" data-testid="order-number-error">{orderError}</p>}
        {orderSuccess && <p className="text-emerald-400 text-xs mt-2" data-testid="order-number-success">{orderSuccess}</p>}
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e13] flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400 text-sm" data-testid="claim-loading">Verifying your claim link...</p>
        </div>
      </div>
    )
  }

  // Successfully claimed — show full details
  if (claimed && leadDetails) {
    return (
      <div className="min-h-screen bg-[#0a0e13] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg" data-testid="claim-success">
          <div className="rounded-2xl border border-emerald-500/20 bg-[#0d1117] overflow-hidden">
            <div className="bg-emerald-500/[0.08] border-b border-emerald-500/20 px-6 py-5 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <div>
                <h1 className="text-lg font-bold text-white">Lead Claimed Successfully</h1>
                <p className="text-sm text-emerald-300/80">This lead is now assigned to you.</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Full Lead Details</p>
              {([
                { label: "Full Name", value: leadDetails.fullName },
                { label: "Address", value: leadDetails.address },
                { label: "State", value: leadDetails.state },
                { label: "Email", value: leadDetails.email },
                { label: "Phone", value: leadDetails.phone },
                { label: "Date of Birth", value: leadDetails.dob },
                { label: "Provider", value: leadDetails.provider },
                { label: "Product Selected", value: leadDetails.productSelected },
                { label: "Preferred Install Date", value: leadDetails.preferredInstallDate },
                { label: "Preferred Install Time", value: leadDetails.preferredInstallTime },
                { label: "Notes", value: leadDetails.notes },
              ]).filter(r => r.value).map(r => (
                <div key={r.label} className="flex justify-between gap-4 py-2 border-b border-white/[0.05] last:border-0">
                  <span className="text-xs text-slate-500 flex-shrink-0">{r.label}</span>
                  <span className="text-sm text-white text-right" data-testid={`lead-detail-${r.label.toLowerCase().replace(/\s+/g, "-")}`}>{r.value}</span>
                </div>
              ))}
              {renderOrderBlock()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Already claimed by self — show details again
  if (alreadyClaimed && leadDetails) {
    return (
      <div className="min-h-screen bg-[#0a0e13] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg" data-testid="claim-already-self">
          <div className="rounded-2xl border border-blue-500/20 bg-[#0d1117] overflow-hidden">
            <div className="bg-blue-500/[0.08] border-b border-blue-500/20 px-6 py-5 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-blue-400" />
              <div>
                <h1 className="text-lg font-bold text-white">Already Claimed</h1>
                <p className="text-sm text-blue-300/80">{message}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Your Lead Details</p>
              {([
                { label: "Full Name", value: leadDetails.fullName },
                { label: "Address", value: leadDetails.address },
                { label: "State", value: leadDetails.state },
                { label: "Email", value: leadDetails.email },
                { label: "Phone", value: leadDetails.phone },
                { label: "Date of Birth", value: leadDetails.dob },
                { label: "Provider", value: leadDetails.provider },
                { label: "Product Selected", value: leadDetails.productSelected },
                { label: "Preferred Install Date", value: leadDetails.preferredInstallDate },
                { label: "Preferred Install Time", value: leadDetails.preferredInstallTime },
                { label: "Notes", value: leadDetails.notes },
              ]).filter(r => r.value).map(r => (
                <div key={r.label} className="flex justify-between gap-4 py-2 border-b border-white/[0.05] last:border-0">
                  <span className="text-xs text-slate-500 flex-shrink-0">{r.label}</span>
                  <span className="text-sm text-white text-right">{r.value}</span>
                </div>
              ))}
              {renderOrderBlock()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Invalid or expired
  if (!valid) {
    return (
      <div className="min-h-screen bg-[#0a0e13] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center" data-testid="claim-invalid">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-8">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Lead Unavailable</h1>
            <p className="text-slate-400 text-sm leading-relaxed">{message}</p>
          </div>
        </div>
      </div>
    )
  }

  // Valid — show preview and claim button
  return (
    <div className="min-h-screen bg-[#0a0e13] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md" data-testid="claim-available">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
          <div className="bg-amber-500/[0.08] border-b border-amber-500/20 px-6 py-5">
            <h1 className="text-lg font-bold text-white mb-1">New Lead Available</h1>
            <p className="text-sm text-amber-300/80">
              Hi {agentName}, a new lead is available for you to claim.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Lead Preview</p>

            {preview && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 py-2">
                  <MapPin className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">State</p>
                    <p className="text-sm text-white font-medium" data-testid="preview-state">{preview.state}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <Building2 className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Provider</p>
                    <p className="text-sm text-white font-medium" data-testid="preview-provider">{preview.provider}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <Package className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Product</p>
                    <p className="text-sm text-white font-medium" data-testid="preview-product">{preview.productSelected}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex items-start gap-2">
              <Shield className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Full lead details including name, address, and contact information will be revealed after you claim this lead.
              </p>
            </div>

            <Button
              onClick={handleClaim}
              disabled={claiming}
              data-testid="claim-button"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-12 shadow-lg shadow-emerald-500/25 transition-all text-sm"
            >
              {claiming ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Claiming...</>
              ) : (
                "Claim This Lead"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
