"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCircle,
  X,
  Shield,
  MapPin,
} from "lucide-react"
import type { AgentProfile, AgentTier } from "@/lib/order-types"
import { US_STATES, US_STATE_NAMES } from "@/lib/order-types"

const PARTNER_OPTIONS = [
  { value: "referral",         label: "Referral Partner" },
  { value: "sales-agent",      label: "Sales Agent" },
  { value: "business",         label: "Business Partnership" },
  { value: "spectrum-event",   label: "Spectrum Event Team" },
  { value: "tmobile-d2d",      label: "T-Mobile D2D" },
  { value: "verizon-d2d",      label: "Verizon D2D" },
]

function partnerLabel(value: string): string {
  return PARTNER_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function sourceTag(source: string) {
  return source === "onboarding"
    ? <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400 border border-violet-500/30 bg-violet-500/10 rounded-full px-2 py-0.5">Onboarding</span>
    : <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 border border-white/10 bg-white/5 rounded-full px-2 py-0.5">Manual</span>
}

function tierTag(tier?: number) {
  if (tier === 1) return <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded-full px-2 py-0.5">Tier 1</span>
  if (tier === 2) return <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded-full px-2 py-0.5">Tier 2</span>
  return <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 border border-white/10 bg-white/5 rounded-full px-2 py-0.5">No Tier</span>
}

// ── Select ────────────────────────────────────────────────────────────────────
function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-sm px-4 pr-8 appearance-none focus:outline-none focus:border-blue-500/50 focus:ring-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#111827]">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentsPanel() {
  const [agents, setAgents]         = useState<AgentProfile[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [copiedId, setCopiedId]     = useState<string | null>(null)
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError]   = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [edit, setEdit]             = useState<Partial<AgentProfile>>({})
  const [search, setSearch]         = useState("")
  const [page, setPage]             = useState(1)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy]     = useState(false)

  // Form state
  const [firstName, setFirstName]   = useState("")
  const [lastName, setLastName]     = useState("")
  const [email, setEmail]           = useState("")
  const [phone, setPhone]           = useState("")
  const [partnerType, setPartnerType] = useState("sales-agent")
  const [newTier, setNewTier]         = useState<string>("")
  const [newStates, setNewStates]     = useState<string[]>([])
  const [newActive, setNewActive]     = useState(true)
  const [newCanReceive, setNewCanReceive] = useState(true)
  const [newDirectAccess, setNewDirectAccess] = useState(false)

  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/agents")
      if (res.ok) setAgents(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAgents() }, [loadAgents])

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = "Required"
    if (!lastName.trim())  e.lastName  = "Required"
    if (!email.trim())     e.email     = "Required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid email"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCreate = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, email, phone, partnerType,
          tier: newTier ? Number(newTier) : undefined,
          approvedStates: newStates,
          activeStatus: newActive,
          directProviderAccess: newDirectAccess,
          canReceiveLeads: newCanReceive,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErrors({ submit: data?.error || "Failed to create agent" })
        return
      }
      const agent: AgentProfile = await res.json()
      const isDupe = (agent as AgentProfile & { _duplicate?: boolean })._duplicate
      setAgents((prev) => {
        const filtered = prev.filter((a) => a.id !== agent.id)
        return [agent, ...filtered].sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        )
      })
      if (isDupe) {
        setErrors({ submit: "An agent with this email already exists — jumped to existing record." })
      } else {
        setShowForm(false)
        setFirstName(""); setLastName(""); setEmail(""); setPhone("")
        setPartnerType("sales-agent"); setNewTier(""); setNewStates([]); setNewActive(true); setNewCanReceive(true); setNewDirectAccess(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async (agent: AgentProfile) => {
    const url = `${window.location.origin}/orders?a=${agent.id}`
    await navigator.clipboard.writeText(url)
    setCopiedId(agent.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const startEdit = (agent: AgentProfile) => {
    setEditingId(agent.id)
    setEdit({
      firstName: agent.firstName,
      lastName:  agent.lastName,
      email:     agent.email,
      phone:     agent.phone,
      partnerType: agent.partnerType,
      tier:      agent.tier,
      approvedStates: agent.approvedStates || [],
      activeStatus: agent.activeStatus !== false,
      directProviderAccess: agent.directProviderAccess || false,
      canReceiveLeads: agent.canReceiveLeads !== false,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEdit({})
    setEditError(null)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setEditError(null)
    setEditSaving(true)
    try {
      const res = await fetch(`/api/agents/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditError(data?.error || "Failed to save. Please try again.")
        return
      }
      setAgents((prev) =>
        prev.map((a) => (a.id === editingId ? data as AgentProfile : a)).sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        )
      )
      cancelEdit()
    } catch {
      setEditError("Network error. Please try again.")
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (agent: AgentProfile) => {
    if (!confirm(`Delete agent "${agent.firstName} ${agent.lastName}"?\n\nTheir submitted orders will remain in the system, but they will lose access to their personal link.`)) return
    setDeletingId(agent.id)
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" })
      if (res.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== agent.id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  const inputCls = (err?: string) =>
    `bg-white/[0.04] border text-white placeholder:text-slate-600 h-11 rounded-xl focus:ring-0 ${
      err ? "border-red-500/50 focus:border-red-500" : "border-white/[0.1] focus:border-blue-500/50"
    }`

  const PAGE_SIZE = 20
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return agents
    return agents.filter((a) =>
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.phone || "").includes(q) ||
      (a.approvedStates || []).some((s: string) => s.toLowerCase().includes(q))
    )
  }, [agents, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search])

  const allOnPageSelected = paged.length > 0 && paged.every((a) => selected.has(a.id))
  const toggleSelectAll = () => {
    if (allOnPageSelected) setSelected((prev) => { const n = new Set(prev); paged.forEach((a) => n.delete(a.id)); return n })
    else setSelected((prev) => { const n = new Set(prev); paged.forEach((a) => n.add(a.id)); return n })
  }
  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const bulkDeleteAgents = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} agent${selected.size === 1 ? "" : "s"}?\n\nTheir submitted orders will remain but they will lose access.`)) return
    setBulkBusy(true)
    try {
      for (const id of Array.from(selected)) {
        await fetch(`/api/agents/${id}`, { method: "DELETE" })
      }
      setAgents((prev) => prev.filter((a) => !selected.has(a.id)))
      setSelected(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white" data-testid="agents-panel-title">Agent Roster</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {agents.length} agents &middot; Manage agents, tiers, and order submission links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadAgents}
            disabled={loading}
            className="border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl h-9 px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={() => setShowForm((v) => !v)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl h-9 px-4 text-sm shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.08] px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-blue-200">{selected.size} selected</span>
          <Button disabled={bulkBusy} onClick={bulkDeleteAgents} data-testid="bulk-delete-agents-btn" className="h-7 px-3 text-[11px] rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-semibold">
            {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3 mr-1" />Delete</>}
          </Button>
          <Button variant="outline" onClick={() => setSelected(new Set())} className="ml-auto h-7 px-3 text-[11px] border-white/[0.1] bg-transparent text-slate-400 hover:text-white rounded-lg">
            <X className="h-3 w-3 mr-1" />Clear
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agents by name, email, state..." className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 h-9 rounded-xl pl-9 text-sm focus:ring-0 focus:border-blue-500/50" />
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-6">
          <h3 className="text-sm font-bold text-blue-300 uppercase tracking-[0.18em] mb-4">New Agent</h3>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-slate-400 text-sm mb-1.5 block">First name <span className="text-red-500">*</span></Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className={inputCls(errors.firstName)} />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <Label className="text-slate-400 text-sm mb-1.5 block">Last name <span className="text-red-500">*</span></Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" className={inputCls(errors.lastName)} />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>
            <div>
              <Label className="text-slate-400 text-sm mb-1.5 block">Email <span className="text-red-500">*</span></Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="jane@example.com" className={inputCls(errors.email)} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label className="text-slate-400 text-sm mb-1.5 block">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="(555) 555-5555" className={inputCls()} />
            </div>
            <div>
              <Label className="text-slate-400 text-sm mb-1.5 block">Program / Role</Label>
              <Select value={partnerType} onChange={setPartnerType} options={PARTNER_OPTIONS} />
            </div>
            <div>
              <Label className="text-slate-400 text-sm mb-1.5 block">Agent Tier</Label>
              <div className="relative">
                <select value={newTier} onChange={(e) => setNewTier(e.target.value)} className="w-full h-11 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-sm px-4 pr-8 appearance-none focus:outline-none focus:border-blue-500/50">
                  <option value="" className="bg-[#111827]">Not set</option>
                  <option value="1" className="bg-[#111827]">Tier 1 — Direct Provider Access</option>
                  <option value="2" className="bg-[#111827]">Tier 2 — Website Submission</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-slate-400 text-sm mb-1.5 block">Approved States</Label>
              <div className="max-h-28 overflow-y-auto rounded-xl border border-white/[0.1] bg-white/[0.04] p-2 grid grid-cols-6 sm:grid-cols-10 gap-1">
                {US_STATES.map((s) => {
                  const checked = newStates.includes(s)
                  return (
                    <label key={s} className={`flex items-center gap-1 text-xs cursor-pointer rounded px-1.5 py-0.5 ${checked ? "bg-blue-500/20 text-white font-semibold" : "text-slate-500 hover:bg-white/[0.04]"}`}>
                      <input type="checkbox" checked={checked} onChange={() => setNewStates((prev) => checked ? prev.filter((x) => x !== s) : [...prev, s])} className="h-3 w-3 rounded border-white/20 bg-white/[0.05] accent-blue-500" />
                      {s}
                    </label>
                  )
                })}
              </div>
              <p className="text-[10px] text-slate-600 mt-1">{newStates.length} state{newStates.length !== 1 ? "s" : ""} selected</p>
            </div>
            <div className="sm:col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-emerald-500" /><span className="text-xs text-slate-300">Active</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newDirectAccess} onChange={(e) => setNewDirectAccess(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-emerald-500" /><span className="text-xs text-slate-300">Direct Provider Access</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newCanReceive} onChange={(e) => setNewCanReceive(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-emerald-500" /><span className="text-xs text-slate-300">Can Receive Leads</span></label>
            </div>
          </div>
          {errors.submit && <p className="text-red-400 text-sm mb-3">{errors.submit}</p>}
          <div className="flex gap-3">
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl h-10 px-5 text-sm"
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creating…</> : "Create Agent"}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowForm(false); setErrors({}) }}
              className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white rounded-xl h-10 px-5 text-sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Agent list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
          <UserCircle className="h-10 w-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No agents yet. Add one above or wait for onboarding completions.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
          <p className="text-slate-500 text-sm">No agents match your search.</p>
        </div>
      ) : (
        <>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 rounded border-white/20 bg-white/[0.05] accent-blue-500" />
            <span>Select all on page</span>
          </label>
          <span>Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
        </div>
        <div className="space-y-2">
          {paged.map((agent) => {
            const orderUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/orders?a=${agent.id}`
            const copied = copiedId === agent.id
            const isEditing = editingId === agent.id
            const isDeleting = deletingId === agent.id

            if (isEditing) {
              return (
                <div key={agent.id} className="rounded-xl border border-blue-500/30 bg-blue-500/[0.05] p-4 space-y-3" data-testid={`agent-edit-form-${agent.id}`}>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input
                      value={edit.firstName ?? ""}
                      onChange={(e) => setEdit((p) => ({ ...p, firstName: e.target.value }))}
                      placeholder="First name"
                      className={inputCls()}
                    />
                    <Input
                      value={edit.lastName ?? ""}
                      onChange={(e) => setEdit((p) => ({ ...p, lastName: e.target.value }))}
                      placeholder="Last name"
                      className={inputCls()}
                    />
                    <Input
                      value={edit.email ?? ""}
                      onChange={(e) => setEdit((p) => ({ ...p, email: e.target.value }))}
                      type="email"
                      placeholder="Email"
                      className={inputCls()}
                    />
                    <Input
                      value={edit.phone ?? ""}
                      onChange={(e) => setEdit((p) => ({ ...p, phone: e.target.value }))}
                      type="tel"
                      placeholder="Phone"
                      className={inputCls()}
                    />
                    <div className="sm:col-span-2">
                      <Select
                        value={edit.partnerType ?? "sales-agent"}
                        onChange={(v) => setEdit((p) => ({ ...p, partnerType: v }))}
                        options={PARTNER_OPTIONS}
                      />
                    </div>
                  </div>

                  {/* Lead Pool Settings */}
                  <div className="border-t border-blue-500/20 pt-3 mt-3">
                    <p className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.18em] mb-3 flex items-center gap-1.5">
                      <Shield className="h-3 w-3" /> Lead Pool Settings
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {/* Tier */}
                      <div>
                        <Label className="text-slate-400 text-xs mb-1 block">Agent Tier</Label>
                        <div className="relative">
                          <select
                            data-testid={`agent-tier-${agent.id}`}
                            value={edit.tier ?? ""}
                            onChange={(e) => setEdit((p) => ({ ...p, tier: e.target.value ? Number(e.target.value) as AgentTier : undefined }))}
                            className="w-full h-11 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-sm px-4 pr-8 appearance-none focus:outline-none focus:border-blue-500/50"
                          >
                            <option value="" className="bg-[#111827]">Not set</option>
                            <option value="1" className="bg-[#111827]">Tier 1 — Direct Provider Access</option>
                            <option value="2" className="bg-[#111827]">Tier 2 — Website Submission</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                        </div>
                      </div>
                      {/* Approved States */}
                      <div>
                        <Label className="text-slate-400 text-xs mb-1 block flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Approved States
                        </Label>
                        <div className="max-h-32 overflow-y-auto rounded-xl border border-white/[0.1] bg-white/[0.04] p-2 space-y-1">
                          {US_STATES.map((s) => {
                            const checked = (edit.approvedStates as string[] || []).includes(s)
                            return (
                              <label key={s} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/[0.04] rounded px-1 py-0.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setEdit((p) => {
                                      const states = [...(p.approvedStates || [])]
                                      const idx = states.indexOf(s)
                                      if (idx >= 0) states.splice(idx, 1)
                                      else states.push(s)
                                      return { ...p, approvedStates: states }
                                    })
                                  }}
                                  className="h-3 w-3 rounded border-white/20 bg-white/[0.05] accent-blue-500"
                                />
                                <span className={checked ? "text-white font-semibold" : "text-slate-400"}>{s}</span>
                              </label>
                            )
                          })}
                        </div>
                        <p className="text-[10px] text-slate-600 mt-1">
                          {((edit.approvedStates as string[]) || []).length} state{((edit.approvedStates as string[]) || []).length !== 1 ? "s" : ""} selected
                        </p>
                      </div>
                    </div>
                    {/* Toggles */}
                    <div className="grid sm:grid-cols-3 gap-3 mt-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edit.activeStatus !== false}
                          onChange={(e) => setEdit((p) => ({ ...p, activeStatus: e.target.checked }))}
                          className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-emerald-500"
                        />
                        <span className="text-xs text-slate-300">Active</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edit.directProviderAccess === true}
                          onChange={(e) => setEdit((p) => ({ ...p, directProviderAccess: e.target.checked }))}
                          className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-emerald-500"
                        />
                        <span className="text-xs text-slate-300">Direct Provider Access</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edit.canReceiveLeads !== false}
                          onChange={(e) => setEdit((p) => ({ ...p, canReceiveLeads: e.target.checked }))}
                          className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-emerald-500"
                        />
                        <span className="text-xs text-slate-300">Can Receive Leads</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={saveEdit}
                      disabled={editSaving}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl h-9 px-4 text-sm"
                    >
                      {editSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelEdit}
                      className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white rounded-xl h-9 px-4 text-sm"
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                  {editError && (
                    <p className="text-red-400 text-xs mt-1">{editError}</p>
                  )}
                </div>
              )
            }

            return (
              <div
                key={agent.id}
                data-testid={`agent-row-${agent.id}`}
                className={`rounded-xl border transition-colors p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap ${selected.has(agent.id) ? "border-blue-500/40 bg-blue-500/[0.06]" : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"}`}
              >
                {/* Select */}
                <input type="checkbox" checked={selected.has(agent.id)} onChange={() => toggleSelect(agent.id)} className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-blue-500 cursor-pointer flex-shrink-0" />
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-300 text-sm font-bold">
                  {agent.firstName[0]}{agent.lastName[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{agent.firstName} {agent.lastName}</p>
                    {tierTag(agent.tier)}
                    {sourceTag(agent.source)}
                    {agent.activeStatus === false && (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400 border border-red-500/30 bg-red-500/10 rounded-full px-2 py-0.5">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {partnerLabel(agent.partnerType)} &middot; {agent.email}
                    {agent.phone && ` · ${agent.phone}`}
                  </p>
                  {agent.approvedStates && agent.approvedStates.length > 0 && (
                    <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                      States: {agent.approvedStates.join(", ")}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => copyLink(agent)}
                    className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl h-8 px-3 text-xs"
                    title={orderUrl}
                  >
                    {copied
                      ? <><Check className="h-3 w-3 mr-1 text-emerald-400" />Copied</>
                      : <><Copy className="h-3 w-3 mr-1" />Link</>
                    }
                  </Button>
                  <a href={`/orders/history?a=${agent.id}`} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="outline"
                      className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl h-8 w-8 px-0"
                      title="View order history"
                    >
                      <History className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  <a href={orderUrl} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="outline"
                      className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl h-8 w-8 px-0"
                      title="Open agent order link"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    onClick={() => startEdit(agent)}
                    className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl h-8 w-8 px-0"
                    title="Edit agent"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDelete(agent)}
                    disabled={isDeleting}
                    className="border-red-500/20 bg-transparent text-slate-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.06] rounded-xl h-8 w-8 px-0"
                    title="Delete agent"
                  >
                    {isDeleting
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} className="border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-white rounded-lg h-8 w-8 px-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-slate-400 px-3">Page {safePage} of {totalPages}</span>
            <Button variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)} className="border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-white rounded-lg h-8 w-8 px-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        </>
      )}
    </div>
  )
}
