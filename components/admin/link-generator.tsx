"use client"

import React, { useState, useCallback, useMemo } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  Users,
  ShoppingBag,
  Zap,
} from "lucide-react"
import { AgentsPanel } from "@/components/admin/agents-panel"
import { OrdersPanel } from "@/components/admin/orders-panel"
import { LeadsPanel } from "@/components/admin/leads-panel"
import {
  PROVIDERS,
  getDefaultAmountsForProvider,
  getDefaultRole,
  type OnboardingPayload,
  type RoleKey,
} from "@/lib/exhibits"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return "$0"
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`
}

const ROLE_OPTIONS: { value: RoleKey; label: string; description: string }[] = [
  { value: "referral",   label: "Referral",       description: "Earn per qualified referral — no selling required" },
  { value: "salesAgent", label: "Sales Agent",     description: "Commission-based — online, phone, or field" },
  { value: "manager",    label: "Manager / TL",    description: "Team leader override on activations" },
  { value: "ibo",        label: "Business Partner (IBO)", description: "Full IBO / business partnership rate" },
]

const PARTNER_TYPE_OPTIONS = [
  { value: "referral",         label: "Referral" },
  { value: "sales-agent",      label: "Sales Agent" },
  { value: "business",         label: "Business Partnership" },
  { value: "spectrum-event",   label: "Spectrum Event Team" },
  { value: "tmobile-d2d",      label: "T-Mobile D2D" },
  { value: "verizon-d2d",      label: "Verizon D2D" },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminLinkGenerator() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"leads" | "link" | "agents" | "orders">("leads")
  // ── Form state
  const [name, setName]               = useState("")
  const [email, setEmail]             = useState("")
  const [phone, setPhone]             = useState("")
  const [partnerType, setPartnerType] = useState("sales-agent")
  const [role, setRole]               = useState<RoleKey>("salesAgent")
  const [isGeneric, setIsGeneric]     = useState(false)

  // ── Provider state: which are enabled, their per-row amounts, and expansion
  const [enabledIds, setEnabledIds]       = useState<Set<string>>(new Set())
  const [amounts, setAmounts]             = useState<Record<string, number[]>>({})
  const [expandedIds, setExpandedIds]     = useState<Set<string>>(new Set())

  // ── Commission settings
  const [leadsProvided, setLeadsProvided] = useState(false)

  // ── URL state
  const [generatedUrl, setGeneratedUrl]   = useState<string | null>(null)
  const [copied, setCopied]               = useState(false)
  const [errors, setErrors]               = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating]   = useState(false)

  // When role changes, refresh amounts for already-enabled providers
  const handleRoleChange = useCallback((newRole: RoleKey) => {
    setRole(newRole)
    setAmounts((prev) => {
      const next = { ...prev }
      enabledIds.forEach((id) => {
        next[id] = getDefaultAmountsForProvider(id, newRole)
      })
      return next
    })
    setGeneratedUrl(null)
  }, [enabledIds])

  const handlePartnerTypeChange = useCallback((pt: string) => {
    setPartnerType(pt)
    const inferredRole = getDefaultRole(pt)
    handleRoleChange(inferredRole)
  }, [handleRoleChange])

  const toggleProvider = useCallback((id: string) => {
    setEnabledIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // initialize amounts if not already set
        setAmounts((a) => {
          if (a[id]) return a
          return { ...a, [id]: getDefaultAmountsForProvider(id, role) }
        })
        setExpandedIds((e) => new Set(e).add(id))
      }
      return next
    })
    setGeneratedUrl(null)
  }, [role])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const updateAmount = useCallback((providerId: string, rowIndex: number, raw: string) => {
    const parsed = parseFloat(raw.replace(/[^0-9.]/g, ""))
    setAmounts((prev) => {
      const copy = [...(prev[providerId] ?? [])]
      copy[rowIndex] = isNaN(parsed) ? 0 : parsed
      return { ...prev, [providerId]: copy }
    })
    setGeneratedUrl(null)
  }, [])

  const resetToDefaults = useCallback((id: string) => {
    setAmounts((prev) => ({ ...prev, [id]: getDefaultAmountsForProvider(id, role) }))
    setGeneratedUrl(null)
  }, [role])

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {}
    if (!isGeneric) {
      if (!name.trim()) e.name = "Name is required"
      if (!email.trim()) e.email = "Email is required"
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email"
    }
    if (enabledIds.size === 0) e.providers = "Select at least one provider"
    setErrors(e)
    return Object.keys(e).length === 0
  }, [name, email, enabledIds, isGeneric])

  const generateLink = useCallback(async () => {
    if (!validate()) return

    const exhibitIds = Array.from(enabledIds)
    const overrides: Record<string, Record<number, number>> = {}

    for (const id of exhibitIds) {
      const rowAmounts = amounts[id] ?? getDefaultAmountsForProvider(id, role)
      const override: Record<number, number> = {}
      rowAmounts.forEach((amt, i) => { override[i] = amt })
      overrides[id] = override
    }

    const payload: OnboardingPayload = {
      name: isGeneric ? "" : name.trim(),
      email: isGeneric ? "" : email.trim(),
      phone: isGeneric ? undefined : phone.trim() || undefined,
      partnerType,
      exhibitIds,
      overrides,
      leadsProvided: leadsProvided || undefined,
    }

    setIsGenerating(true)
    try {
      const res = await fetch("/api/onboard-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to create link")
      const { id } = await res.json()
      const base = typeof window !== "undefined" ? window.location.origin : ""
      setGeneratedUrl(`${base}/onboarding?id=${id}`)
    } catch {
      setErrors((prev) => ({ ...prev, submit: "Failed to generate link. Check your connection and try again." }))
    } finally {
      setIsGenerating(false)
    }
  }, [validate, name, email, partnerType, enabledIds, amounts, role, leadsProvided, isGeneric])

  const copyUrl = useCallback(async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatedUrl])

  const enabledCount = enabledIds.size

  const totalRows = useMemo(() =>
    Array.from(enabledIds).reduce((sum, id) => {
      const p = PROVIDERS.find((p) => p.id === id)
      return sum + (p?.rows.length ?? 0)
    }, 0),
  [enabledIds])

  return (
    <div className="min-h-screen bg-[#0a0e13]">
      {/* ── Header ── */}
      <div className="border-b border-white/[0.06] bg-[#0d1117] relative overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-600 via-red-400 to-transparent" />
        <div className="mx-auto max-w-5xl px-5 py-5 flex items-center gap-3">
          <Image src="/images/stance-logo-white.png" alt="Stance Marketing" width={130} height={30} className="h-7 w-auto" />
          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-0.5 text-[11px] font-bold tracking-[0.2em] text-red-400 uppercase">
            Admin
          </span>
          <span className="ml-auto text-xs text-slate-600 hidden sm:block">
            {activeTab === "link" ? "Onboarding Links" : activeTab === "agents" ? "Agents" : "Orders"}
          </span>
          <button
            onClick={async () => {
              await fetch("/api/admin-auth", { method: "DELETE" })
              router.push("/admin/login")
            }}
            className="ml-4 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="border-b border-white/[0.06] bg-[#0d1117]">
        <div className="mx-auto max-w-5xl px-5 flex items-center gap-1">
          {([
            { key: "leads",  label: "Leads",            icon: FileText },
            { key: "link",   label: "Onboarding Links", icon: Zap },
            { key: "agents", label: "Agents",           icon: Users },
            { key: "orders", label: "Orders",           icon: ShoppingBag },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === key
                  ? "border-red-500 text-white"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-10 space-y-8">

        {/* ── Leads tab ── */}
        {activeTab === "leads" && <LeadsPanel />}

        {/* ── Agents tab ── */}
        {activeTab === "agents" && <AgentsPanel />}

        {/* ── Orders tab ── */}
        {activeTab === "orders" && <OrdersPanel />}

        {/* ── Link generator tab ── */}
        {activeTab === "link" && (<>

        {/* ── Section: Contractor Info ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3 flex-wrap">
            <div className="w-1 h-5 rounded-full bg-red-500 flex-shrink-0" />
            <h2 className="text-sm font-bold text-white uppercase tracking-[0.18em]">Contractor Info</h2>
            <div className="ml-auto flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
              <button
                onClick={() => { setIsGeneric(false); setGeneratedUrl(null) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  !isGeneric ? "bg-red-500 text-white shadow" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Personalized
              </button>
              <button
                onClick={() => { setIsGeneric(true); setGeneratedUrl(null) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isGeneric ? "bg-red-500 text-white shadow" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Generic / Bulk
              </button>
            </div>
          </div>
          <div className="p-6 grid sm:grid-cols-2 gap-5">
            {isGeneric ? (
              <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-3.5">
                <div className="mt-0.5 h-5 w-5 rounded-full border border-blue-500/40 bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">i</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-300">Generic link — no personal info required</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Applicants fill in their own name, email, and phone during onboarding. Safe to send to multiple people.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-slate-400 text-sm mb-2 block">Full name <span className="text-red-500">*</span></Label>
                  <Input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setGeneratedUrl(null) }}
                    placeholder="Jane Smith"
                    className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 h-11 rounded-xl focus:border-red-500/60 focus:ring-0"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1.5">{errors.name}</p>}
                </div>
                <div>
                  <Label className="text-slate-400 text-sm mb-2 block">Email address <span className="text-red-500">*</span></Label>
                  <Input
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setGeneratedUrl(null) }}
                    placeholder="jane@example.com"
                    type="email"
                    className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 h-11 rounded-xl focus:border-red-500/60 focus:ring-0"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email}</p>}
                </div>
                <div>
                  <Label className="text-slate-400 text-sm mb-2 block">Phone number</Label>
                  <Input
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setGeneratedUrl(null) }}
                    placeholder="(555) 555-5555"
                    type="tel"
                    className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 h-11 rounded-xl focus:border-red-500/60 focus:ring-0"
                  />
                </div>
              </>
            )}
            <div>
              <Label className="text-slate-400 text-sm mb-2 block">Program type</Label>
              <div className="relative">
                <select
                  value={partnerType}
                  onChange={(e) => handlePartnerTypeChange(e.target.value)}
                  className="w-full h-11 bg-white/[0.04] border border-white/[0.1] text-white rounded-xl px-4 pr-10 text-sm appearance-none focus:outline-none focus:border-red-500/60"
                >
                  {PARTNER_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#0d1117]">{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <Label className="text-slate-400 text-sm mb-2 block">Compensation tier</Label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((o) => {
                  const isActive = role === o.value
                  const colorMap: Record<string, string> = {
                    referral:   isActive ? "border-sky-500/60 bg-sky-500/10 text-sky-300"              : "border-white/[0.08] bg-white/[0.02] text-slate-500",
                    salesAgent: isActive ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"  : "border-white/[0.08] bg-white/[0.02] text-slate-500",
                    manager:    isActive ? "border-amber-500/60 bg-amber-500/10 text-amber-300"        : "border-white/[0.08] bg-white/[0.02] text-slate-500",
                    ibo:        isActive ? "border-red-500/60 bg-red-500/10 text-red-300"              : "border-white/[0.08] bg-white/[0.02] text-slate-500",
                  }
                  return (
                    <button
                      key={o.value}
                      onClick={() => handleRoleChange(o.value)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-all ${colorMap[o.value]}`}
                    >
                      <p className="text-xs font-bold">{o.label}</p>
                      <p className="text-[10px] opacity-70 mt-0.5 leading-tight">{o.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Leads toggle — full-width row below the grid */}
          <div className="px-6 pb-6">
            <div
              role="button"
              tabIndex={0}
              onClick={() => { setLeadsProvided((v) => !v); setGeneratedUrl(null) }}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { setLeadsProvided((v) => !v); setGeneratedUrl(null) } }}
              className={`flex items-center justify-between rounded-xl border px-5 py-4 cursor-pointer transition-all ${
                leadsProvided
                  ? "border-orange-500/40 bg-orange-500/[0.07]"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14]"
              }`}
            >
              <div>
                <p className={`text-sm font-bold ${leadsProvided ? "text-orange-300" : "text-slate-400"}`}>
                  Company provides leads
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {leadsProvided
                    ? "Commission is 50% less — both rates shown in contract"
                    : "Contractor self-sources leads — full commission applies"}
                </p>
              </div>
              <div
                className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${
                  leadsProvided ? "bg-orange-500" : "bg-white/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    leadsProvided ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section: Providers ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 rounded-full bg-amber-500 flex-shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-[0.18em]">Providers</h2>
                <p className="text-xs text-slate-600 mt-0.5">Toggle which carriers this contractor is authorized for</p>
              </div>
            </div>
            {enabledCount > 0 && (
              <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400">
                {enabledCount} active · {totalRows} lines
              </span>
            )}
          </div>
          {errors.providers && (
            <p className="px-6 pt-4 text-red-500 text-sm">{errors.providers}</p>
          )}
          <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PROVIDERS.map((provider) => {
              const enabled = enabledIds.has(provider.id)
              const expanded = expandedIds.has(provider.id)
              const rowAmounts = amounts[provider.id] ?? []

              return (
                <div
                  key={provider.id}
                  className={`rounded-xl border transition-all ${
                    enabled
                      ? "border-amber-500/30 bg-amber-500/[0.04]"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  {/* Provider header row */}
                  <div className="flex items-center gap-3 p-4">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleProvider(provider.id)}
                      className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${
                        enabled ? "bg-amber-500" : "bg-white/10"
                      }`}
                      aria-label={`Toggle ${provider.provider}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => enabled && toggleExpand(provider.id)}
                      className="flex-1 flex items-center justify-between min-w-0 text-left"
                      disabled={!enabled}
                    >
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm truncate ${enabled ? "text-amber-100" : "text-slate-500"}`}>
                          {provider.provider}
                        </p>
                        <p className={`text-xs mt-0.5 ${enabled ? "text-amber-500/60" : "text-slate-700"}`}>{provider.rows.length} services</p>
                      </div>
                      {enabled && (
                        expanded
                          ? <ChevronUp className="h-3.5 w-3.5 text-amber-500/60 flex-shrink-0" />
                          : <ChevronDown className="h-3.5 w-3.5 text-amber-500/60 flex-shrink-0" />
                      )}
                    </button>
                  </div>

                  {/* Expanded rows */}
                  <AnimatePresence initial={false}>
                    {enabled && expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-amber-500/10 bg-black/20 px-4 pt-3 pb-4 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold tracking-[0.2em] text-amber-500/70 uppercase">Service / Payout</span>
                            <button
                              onClick={() => resetToDefaults(provider.id)}
                              className="text-[10px] text-slate-600 hover:text-amber-400 transition-colors"
                            >
                              Reset defaults
                            </button>
                          </div>
                          {provider.rows.map((row, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 flex-1 min-w-0 truncate" title={row.service}>
                                {row.service}
                              </span>
                              <div className="relative flex-shrink-0 w-20">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-amber-500/70 pointer-events-none">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={rowAmounts[i] ?? ""}
                                  onChange={(e) => updateAmount(provider.id, i, e.target.value)}
                                  className="w-full h-7 bg-amber-500/[0.06] border border-amber-500/20 text-amber-100 text-xs rounded-lg pl-5 pr-2 focus:outline-none focus:border-amber-500/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Generate button ── */}
        <div className="rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/[0.07] to-transparent p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Button
            onClick={generateLink}
            disabled={isGenerating}
            className="bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl px-8 h-12 shadow-lg shadow-red-500/40 transition-all text-sm tracking-wide disabled:opacity-60"
          >
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving link...</>
            ) : (
              <><Zap className="mr-2 h-4 w-4" />Generate Onboarding Link</>
            )}
          </Button>
          {enabledCount === 0 ? (
            <p className="text-slate-600 text-sm">Select at least one provider above to continue</p>
          ) : errors.submit ? (
            <p className="text-red-400 text-sm">{errors.submit}</p>
          ) : (
            <p className="text-slate-500 text-sm">
              Ready — <span className="text-red-400 font-semibold">{enabledCount} provider{enabledCount !== 1 ? "s" : ""}</span> will be included in the link
            </p>
          )}
        </div>

        {/* ── Generated URL ── */}
        <AnimatePresence>
          {generatedUrl && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-green-500/20 bg-green-500/[0.04] overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-green-500/10 flex items-center gap-2">
                <Check className="h-4 w-4 text-green-400" />
                <h3 className="text-sm font-semibold text-green-400">Onboarding link ready</h3>
              </div>
              <div className="p-6">
                <div className="mb-4 flex items-start gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                  <code className="text-xs text-slate-300 break-all flex-1 leading-relaxed font-mono">
                    {generatedUrl}
                  </code>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={copyUrl}
                    variant="outline"
                    className="border-white/[0.12] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white rounded-xl h-10 px-5"
                  >
                    {copied ? (
                      <><Check className="mr-2 h-4 w-4 text-green-400" />Copied!</>
                    ) : (
                      <><Copy className="mr-2 h-4 w-4" />Copy Link</>
                    )}
                  </Button>
                  <a
                    href={generatedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      className="border-white/[0.12] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white rounded-xl h-10 px-5"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                  </a>
                </div>
                <div className="mt-5 pt-5 border-t border-white/[0.06] grid sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Contractor</p>
                    <p className="text-sm font-medium">
                      {isGeneric
                        ? <span className="text-blue-400">Generic / Bulk</span>
                        : <span className="text-slate-300">{name}</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Email</p>
                    <p className="text-sm font-medium">
                      {isGeneric
                        ? <span className="text-slate-600 italic">filled in by applicant</span>
                        : <span className="text-slate-300">{email}</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Exhibits</p>
                    <p className="text-sm text-slate-300 font-medium">
                      {Array.from(enabledIds)
                        .map((id) => PROVIDERS.find((p) => p.id === id)?.provider)
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Reference table ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-emerald-500 flex-shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-[0.18em]">Full Compensation Reference</h2>
              <p className="text-xs text-slate-600 mt-0.5">Read-only — all providers and rates across all tiers</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left px-5 py-3 text-slate-400 font-bold">Provider</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-bold">Service</th>
                  <th className="text-right px-4 py-3 text-sky-400 font-bold">Referral</th>
                  <th className="text-right px-4 py-3 text-emerald-400 font-bold">Sales Agent</th>
                  <th className="text-right px-4 py-3 text-amber-400 font-bold">Manager</th>
                  <th className="text-right px-4 py-3 text-red-400 font-bold">IBO</th>
                </tr>
              </thead>
              <tbody>
                {PROVIDERS.map((p) =>
                  p.rows.map((row, i) => (
                    <tr key={`${p.id}-${i}`} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      {i === 0 && (
                        <td className="px-5 py-2.5 text-white font-bold align-top" rowSpan={p.rows.length}>
                          {p.provider}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-slate-400">{row.service}</td>
                      <td className="px-4 py-2.5 text-right text-sky-400">{fmt(row.referral)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-semibold">{fmt(row.salesAgent)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-400">{fmt(row.manager)}</td>
                      <td className="px-4 py-2.5 text-right text-red-400">{fmt(row.ibo)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        </>)}

      </div>
    </div>
  )
}
