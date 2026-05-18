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
  FileText,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User,
  X,
  RotateCcw,
  Activity,
  CheckCircle2,
} from "lucide-react"
import {
  type Lead,
  type LeadStatus,
  type AgentProfile,
  type LeadActivityLog,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  US_STATES,
  US_STATE_NAMES,
} from "@/lib/order-types"

const PAGE_SIZE = 20

const TIME_OPTIONS = [
  "8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM",
  "11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM",
  "2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM",
  "5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM","7:30 PM",
]

function formatDob(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span data-testid={`lead-status-badge-${status}`} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.15em] ${LEAD_STATUS_COLORS[status]}`}>
      {LEAD_STATUS_LABELS[status]}
    </span>
  )
}

export function LeadsPanel() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [notifying, setNotifying] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Bulk ops
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  // Activity log
  const [showActivity, setShowActivity] = useState(false)
  const [activityLogs, setActivityLogs] = useState<LeadActivityLog[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activitySearch, setActivitySearch] = useState("")
  const [activityFilter, setActivityFilter] = useState<"all" | "notify" | "claim" | "order" | "removed">("all")
  const [activityAgent, setActivityAgent]   = useState<string>("all") // agent id, or "all", or "admin"

  // Agent selection for notification
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [notifyLeadId, setNotifyLeadId] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    fullName: "", address: "", state: "", email: "", phone: "",
    dob: "", provider: "", productSelected: "",
    preferredInstallDate: "", preferredInstallTime: "", notes: "",
  })

  const updateForm = (field: string, value: string) => {
    if (field === "dob") setForm((prev) => ({ ...prev, [field]: formatDob(value) }))
    else setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [leadsRes, agentsRes, activityRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/agents"),
        fetch("/api/leads/activity"),
      ])
      if (leadsRes.ok) setLeads(await leadsRes.json())
      if (agentsRes.ok) setAgents(await agentsRes.json())
      if (activityRes.ok) setActivityLogs(await activityRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const loadActivity = async () => {
    setActivityLoading(true)
    try {
      const res = await fetch("/api/leads/activity")
      if (res.ok) setActivityLogs(await res.json())
    } finally {
      setActivityLoading(false)
    }
  }

  // Activity events in the last 24h (used to badge the Activity button)
  const recentActivityCount = activityLogs.filter(l => {
    const ts = new Date(l.timestamp).getTime()
    return !isNaN(ts) && (Date.now() - ts) < 24 * 60 * 60 * 1000
  }).length

  // Quick lookup: leadId → display name (for activity modal "jump to lead" chip)
  const leadNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of leads) m.set(l.id, l.fullName || "(no name)")
    return m
  }, [leads])

  // Activity icon + accent color per action type
  const activityStyle = (action: string): { dot: string; ring: string } => {
    const a = action.toLowerCase()
    if (a.includes("created")) return { dot: "bg-slate-400", ring: "border-slate-500/30" }
    if (a.includes("notif"))    return { dot: "bg-blue-400",  ring: "border-blue-500/30" }
    if (a.includes("claim"))    return { dot: "bg-emerald-400", ring: "border-emerald-500/30" }
    if (a.includes("order"))    return { dot: "bg-violet-400", ring: "border-violet-500/30" }
    if (a.includes("removed") || a.includes("deleted")) return { dot: "bg-red-400", ring: "border-red-500/30" }
    if (a.includes("status"))   return { dot: "bg-amber-400", ring: "border-amber-500/30" }
    return { dot: "bg-slate-500", ring: "border-slate-500/30" }
  }

  const getEligibleAgents = useCallback((state: string): AgentProfile[] => {
    return agents.filter((a) => {
      if (a.tier !== 1) return false
      if (a.activeStatus === false) return false
      if (a.canReceiveLeads === false) return false
      if (!a.approvedStates || a.approvedStates.length === 0) return false
      return a.approvedStates.includes(state.toUpperCase())
    })
  }, [agents])

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.fullName.trim()) e.fullName = "Full name is required"
    if (!form.address.trim()) e.address = "Address is required"
    if (!form.state.trim()) e.state = "State is required"
    if (!form.email.trim()) e.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Please enter a valid email"
    if (!form.phone.trim()) e.phone = "Phone number is required"
    if (!form.provider.trim()) e.provider = "Provider is required"
    if (!form.productSelected.trim()) e.productSelected = "Product is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCreate = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErrors({ submit: data?.error || "Failed to create lead. Please try again." })
        return
      }
      const lead: Lead = await res.json()
      setLeads((prev) => [lead, ...prev])
      setShowForm(false)
      setForm({ fullName: "", address: "", state: "", email: "", phone: "", dob: "", provider: "", productSelected: "", preferredInstallDate: "", preferredInstallTime: "", notes: "" })
      setErrors({})
    } catch {
      setErrors({ submit: "Network error. Please check your connection and try again." })
    } finally {
      setSaving(false)
    }
  }

  // ── Status updates ──────────────────────────────────────────────────
  const updateLeadStatus = async (id: string, status: LeadStatus) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated = await res.json()
        setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)))
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const deleteLead = async (lead: Lead) => {
    if (!confirm(`Remove lead for "${lead.fullName}"?\n\nThis will mark the lead as removed.`)) return
    await updateLeadStatus(lead.id, "removed")
  }

  const permanentlyDeleteLead = async (lead: Lead) => {
    if (!confirm(`Permanently delete lead for "${lead.fullName}"?\n\nThis cannot be undone.`)) return
    setUpdatingId(lead.id)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" })
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== lead.id))
        setSelected((prev) => { const n = new Set(prev); n.delete(lead.id); return n })
        if (expanded === lead.id) setExpanded(null)
      }
    } finally {
      setUpdatingId(null)
    }
  }

  // ── Bulk operations ─────────────────────────────────────────────────
  const bulkUpdateStatus = async (status: LeadStatus) => {
    if (selected.size === 0) return
    if (!confirm(`Mark ${selected.size} lead${selected.size === 1 ? "" : "s"} as "${LEAD_STATUS_LABELS[status]}"?`)) return
    setBulkBusy(true)
    try {
      const ids = Array.from(selected)
      for (const id of ids) {
        await fetch(`/api/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
      }
      await loadData()
      setSelected(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkDeleteLeads = async () => {
    if (selected.size === 0) return
    if (!confirm(`Permanently delete ${selected.size} lead${selected.size === 1 ? "" : "s"}?\n\nThis cannot be undone.`)) return
    setBulkBusy(true)
    try {
      for (const id of Array.from(selected)) {
        await fetch(`/api/leads/${id}`, { method: "DELETE" })
      }
      setLeads((prev) => prev.filter((l) => !selected.has(l.id)))
      setSelected(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ── Notify ──────────────────────────────────────────────────────────
  const openNotifyModal = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return
    setNotifyLeadId(leadId)
    setSelectedAgents(new Set(lead.notifiedAgentIds))
  }

  const sendNotifications = async () => {
    if (!notifyLeadId || selectedAgents.size === 0) return
    setNotifying(notifyLeadId)
    try {
      const res = await fetch(`/api/leads/${notifyLeadId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentIds: Array.from(selectedAgents) }),
      })
      if (res.ok) {
        const leadsRes = await fetch("/api/leads")
        if (leadsRes.ok) setLeads(await leadsRes.json())
        setNotifyLeadId(null)
        setSelectedAgents(new Set())
      }
    } finally {
      setNotifying(null)
    }
  }

  // ── Filtering + Pagination ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return leads.filter((l) => {
      if (filterStatus !== "all" && l.status !== filterStatus) return false
      if (!q) return true
      return (
        (l.fullName || "").toLowerCase().includes(q) ||
        (l.state || "").toLowerCase().includes(q) ||
        (l.provider || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.productSelected || "").toLowerCase().includes(q) ||
        (l.claimedByAgentName || "").toLowerCase().includes(q)
      )
    })
  }, [leads, filterStatus, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, filterStatus])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length }
    for (const l of leads) c[l.status] = (c[l.status] || 0) + 1
    return c
  }, [leads])

  const allOnPageSelected = paged.length > 0 && paged.every((l) => selected.has(l.id))
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelected((prev) => { const n = new Set(prev); paged.forEach((l) => n.delete(l.id)); return n })
    } else {
      setSelected((prev) => { const n = new Set(prev); paged.forEach((l) => n.add(l.id)); return n })
    }
  }

  const inputCls = (err?: string) =>
    `bg-white/[0.04] border text-white placeholder:text-slate-600 h-11 rounded-xl focus:ring-0 ${err ? "border-red-500/50 focus:border-red-500" : "border-white/[0.1] focus:border-blue-500/50"}`

  const currentLeadForNotify = notifyLeadId ? leads.find((l) => l.id === notifyLeadId) : null
  const eligibleForNotify = currentLeadForNotify ? getEligibleAgents(currentLeadForNotify.state) : []

  return (
    <>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-white" data-testid="leads-panel-title">Lead Pool</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {leads.length} total &middot; {counts.unclaimed ?? 0} unclaimed &middot; {counts.claimed ?? 0} claimed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => { setShowActivity(true); loadActivity() }}
              data-testid="view-activity-btn"
              className="relative bg-blue-500/[0.08] border border-blue-500/30 text-blue-200 hover:bg-blue-500/[0.16] hover:text-white rounded-xl h-9 px-3.5 text-xs font-semibold shadow-lg shadow-blue-500/10"
            >
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Activity
              {recentActivityCount > 0 && (
                <span
                  className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-bold tracking-wider"
                  data-testid="activity-badge-24h"
                  title={`${recentActivityCount} event${recentActivityCount === 1 ? "" : "s"} in the last 24h`}
                >
                  {recentActivityCount > 99 ? "99+" : recentActivityCount}
                </span>
              )}
            </Button>
            <Button variant="outline" onClick={loadData} disabled={loading} data-testid="refresh-leads-btn" className="border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl h-9 px-3">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => setShowForm((v) => !v)} data-testid="add-lead-btn" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl h-9 px-4 text-sm shadow-lg shadow-emerald-500/25">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add Lead
            </Button>
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-emerald-200">{selected.size} selected</span>
            <span className="text-xs text-slate-500">Mark as:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["unclaimed", "removed", "completed"] as LeadStatus[]).map((s) => (
                <Button key={s} disabled={bulkBusy} onClick={() => bulkUpdateStatus(s)} className="h-7 px-3 text-[11px] rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white font-semibold">
                  {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : LEAD_STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
            <Button disabled={bulkBusy} onClick={bulkDeleteLeads} data-testid="bulk-delete-leads-btn" className="h-7 px-3 text-[11px] rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-semibold">
              {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3 mr-1" />Delete</>}
            </Button>
            <Button variant="outline" onClick={() => setSelected(new Set())} className="ml-auto h-7 px-3 text-[11px] border-white/[0.1] bg-transparent text-slate-400 hover:text-white rounded-lg">
              <X className="h-3 w-3 mr-1" />Clear
            </Button>
          </div>
        )}

        {/* Create Lead Form */}
        {showForm && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6" data-testid="add-lead-form">
            <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-[0.18em] mb-4">New Lead</h3>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-slate-400 text-sm mb-1.5 block">Full Name <span className="text-red-500">*</span></Label>
                <Input data-testid="lead-fullname" value={form.fullName} onChange={(e) => updateForm("fullName", e.target.value)} placeholder="John Doe" className={inputCls(errors.fullName)} />
                {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
              </div>
              <div>
                <Label className="text-slate-400 text-sm mb-1.5 block">Address <span className="text-red-500">*</span></Label>
                <Input data-testid="lead-address" value={form.address} onChange={(e) => updateForm("address", e.target.value)} placeholder="123 Main St, City, ZIP" className={inputCls(errors.address)} />
                {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
              </div>
              <div>
                <Label className="text-slate-400 text-sm mb-1.5 block">State <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <select data-testid="lead-state" value={form.state} onChange={(e) => updateForm("state", e.target.value)} className={`w-full h-11 rounded-xl px-4 pr-8 text-sm appearance-none focus:outline-none ${errors.state ? "border border-red-500/50 bg-white/[0.04] text-white" : "border border-white/[0.1] bg-white/[0.04] text-white focus:border-blue-500/50"}`}>
                    <option value="" className="bg-[#111827]">Select state...</option>
                    {US_STATES.map((s) => (<option key={s} value={s} className="bg-[#111827]">{s} — {US_STATE_NAMES[s]}</option>))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                </div>
                {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                {form.state && <p className="text-xs text-slate-500 mt-1">{getEligibleAgents(form.state).length} eligible Tier 1 agent{getEligibleAgents(form.state).length !== 1 ? "s" : ""} for {form.state}</p>}
              </div>
              <div>
                <Label className="text-slate-400 text-sm mb-1.5 block">Email <span className="text-red-500">*</span></Label>
                <Input data-testid="lead-email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} type="email" placeholder="john@example.com" className={inputCls(errors.email)} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label className="text-slate-400 text-sm mb-1.5 block">Phone <span className="text-red-500">*</span></Label>
                <Input data-testid="lead-phone" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} type="tel" placeholder="(555) 555-5555" className={inputCls(errors.phone)} />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
              <div>
                <Label className="text-slate-400 text-sm mb-1.5 block">Date of Birth</Label>
                <Input data-testid="lead-dob" value={form.dob} onChange={(e) => updateForm("dob", e.target.value)} placeholder="MM/DD/YYYY" maxLength={10} className={inputCls()} />
                <p className="text-[10px] text-slate-600 mt-1">Auto-formats as you type</p>
              </div>
              <div>
                <Label className="text-slate-400 text-sm mb-1.5 block">Provider <span className="text-red-500">*</span></Label>
                <Input data-testid="lead-provider" value={form.provider} onChange={(e) => updateForm("provider", e.target.value)} placeholder="e.g. AT&T, Spectrum, Frontier..." className={inputCls(errors.provider)} />
                {errors.provider && <p className="text-red-500 text-xs mt-1">{errors.provider}</p>}
              </div>
              <div>
                <Label className="text-slate-400 text-sm mb-1.5 block">Product Selected <span className="text-red-500">*</span></Label>
                <Input data-testid="lead-product" value={form.productSelected} onChange={(e) => updateForm("productSelected", e.target.value)} placeholder="e.g. Internet 1 Gig" className={inputCls(errors.productSelected)} />
                {errors.productSelected && <p className="text-red-500 text-xs mt-1">{errors.productSelected}</p>}
              </div>
              <div>
                <Label className="text-slate-400 text-sm mb-1.5 block">Preferred Install Date</Label>
                <Input data-testid="lead-install-date" value={form.preferredInstallDate} onChange={(e) => updateForm("preferredInstallDate", e.target.value)} type="date" className={inputCls()} />
              </div>
              <div>
                <Label className="text-slate-400 text-sm mb-1.5 block">Preferred Install Time</Label>
                <div className="relative">
                  <select data-testid="lead-install-time" value={form.preferredInstallTime} onChange={(e) => updateForm("preferredInstallTime", e.target.value)} className="w-full h-11 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-sm px-4 pr-8 appearance-none focus:outline-none focus:border-blue-500/50">
                    <option value="" className="bg-[#111827]">Select time...</option>
                    {TIME_OPTIONS.map((t) => (<option key={t} value={t} className="bg-[#111827]">{t}</option>))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-slate-400 text-sm mb-1.5 block">Notes</Label>
                <textarea data-testid="lead-notes" rows={3} value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Additional notes about this lead..." className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-sm placeholder:text-slate-600 px-3 py-2 resize-none focus:outline-none focus:border-blue-500/50" />
              </div>
            </div>
            {errors.submit && <p className="text-red-400 text-sm mb-3">{errors.submit}</p>}
            <div className="flex gap-3">
              <Button onClick={handleCreate} disabled={saving} data-testid="submit-lead-btn" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl h-10 px-5 text-sm">
                {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creating...</> : "Create Lead"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setErrors({}) }} className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white rounded-xl h-10 px-5 text-sm">Cancel</Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
            <Input data-testid="leads-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads by name, state, provider..." className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 h-9 rounded-xl pl-9 text-sm focus:ring-0 focus:border-blue-500/50" />
          </div>
          <div className="relative">
            <select data-testid="leads-status-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as LeadStatus | "all")} className="h-9 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-sm px-3 pr-8 appearance-none focus:outline-none focus:border-blue-500/50">
              <option value="all" className="bg-[#111827]">All Statuses</option>
              {(["unclaimed", "claimed", "removed", "expired", "completed"] as LeadStatus[]).map((s) => (
                <option key={s} value={s} className="bg-[#111827]">{LEAD_STATUS_LABELS[s]}{counts[s] ? ` (${counts[s]})` : ""}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Lead List */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl"><FileText className="h-10 w-10 text-slate-700 mx-auto mb-3" /><p className="text-slate-500 text-sm">No leads match your filter.</p></div>
        ) : (
          <>
          {/* Select all + pagination header */}
          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 rounded border-white/20 bg-white/[0.05] accent-emerald-500" />
              <span>Select all on page</span>
            </label>
            <span>Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          </div>

          <div className="space-y-2">
            {paged.map((lead) => {
              const isOpen = expanded === lead.id
              const isSelected = selected.has(lead.id)
              return (
                <div key={lead.id} data-testid={`lead-row-${lead.id}`} data-lead-row={lead.id} className={`rounded-xl border transition-colors ${isSelected ? "border-emerald-500/40 bg-emerald-500/[0.06]" : isOpen ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-white/[0.07] bg-white/[0.02]"}`}>
                  <div className="p-4 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(lead.id)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-emerald-500 cursor-pointer flex-shrink-0" />
                    <button onClick={() => setExpanded(isOpen ? null : lead.id)} className="flex-1 min-w-0 text-left grid sm:grid-cols-6 gap-y-1 gap-x-4">
                      <div className="min-w-0"><p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-0.5">Name</p><p className="text-sm font-semibold text-white truncate">{lead.fullName || "—"}</p></div>
                      <div className="min-w-0"><p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-0.5">State</p><p className="text-sm text-slate-300">{lead.state || "—"}</p></div>
                      <div className="min-w-0"><p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-0.5">Provider</p><p className="text-sm text-slate-300 truncate">{lead.provider || "—"}</p></div>
                      <div className="min-w-0"><p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-0.5">Product</p><p className="text-sm text-slate-300 truncate">{lead.productSelected || "—"}</p></div>
                      <div className="min-w-0"><p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-0.5">Order #</p><p className={`text-sm font-mono truncate ${lead.orderNumber ? "text-violet-300" : "text-slate-600"}`} data-testid={`lead-list-order-${lead.id}`}>{lead.orderNumber || "—"}</p></div>
                      <div><p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-0.5">Created</p><p className="text-sm text-slate-400">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</p></div>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {updatingId === lead.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" /> : <LeadStatusBadge status={lead.status} />}
                      <Button variant="outline" onClick={(e) => { e.stopPropagation(); permanentlyDeleteLead(lead) }} disabled={updatingId === lead.id} className="border-red-500/20 bg-transparent text-slate-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.06] rounded-xl h-8 w-8 px-0" title="Delete lead">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded */}
                  {isOpen && (
                    <div className="border-t border-white/[0.07] px-4 pb-5 pt-4 space-y-5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Lead Detail</p>
                        <Button
                          variant="outline"
                          onClick={() => setExpanded(null)}
                          data-testid={`collapse-lead-btn-${lead.id}`}
                          title="Collapse this lead"
                          aria-label="Collapse this lead"
                          className="border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg h-7 w-7 p-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-5">
                        <div className="space-y-3 text-sm">
                          <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold">Lead Information</p>
                          {([
                            { label: "Full Name", value: lead.fullName },
                            { label: "Address", value: lead.address },
                            { label: "State", value: lead.state },
                            { label: "Email", value: lead.email },
                            { label: "Phone", value: lead.phone },
                            { label: "DOB", value: lead.dob },
                            { label: "Provider", value: lead.provider },
                            { label: "Product", value: lead.productSelected },
                            { label: "Install Date", value: lead.preferredInstallDate },
                            { label: "Install Time", value: lead.preferredInstallTime },
                            { label: "Notes", value: lead.notes },
                          ]).filter(r => r.value).map(r => (
                            <div key={r.label} className="flex gap-4"><span className="text-xs text-slate-500 w-28 flex-shrink-0">{r.label}</span><span className="text-xs text-slate-300">{r.value}</span></div>
                          ))}
                        </div>
                        <div className="space-y-3 text-sm">
                          <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold">Claim Status</p>
                          {lead.status === "claimed" ? (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 space-y-2">
                              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-xs text-emerald-300 font-semibold">Claimed</span></div>
                              <div className="space-y-1">
                                <p className="text-xs text-slate-400">By: <span className="text-white">{lead.claimedByAgentName}</span></p>
                                <p className="text-xs text-slate-400">Email: <span className="text-white">{lead.claimedByAgentEmail}</span></p>
                                {lead.claimedAt && <p className="text-xs text-slate-400">At: <span className="text-white">{new Date(lead.claimedAt).toLocaleString()}</span></p>}
                                <p className="text-xs text-slate-400">Order #: <span className={`font-mono ${lead.orderNumber ? "text-emerald-300" : "text-amber-400"}`} data-testid={`admin-order-number-${lead.id}`}>{lead.orderNumber || "awaiting agent"}</span></p>
                              </div>
                            </div>
                          ) : lead.status === "completed" ? (
                            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-3 space-y-2">
                              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-400" /><span className="text-xs text-violet-300 font-semibold">Completed</span></div>
                              <div className="space-y-1">
                                <p className="text-xs text-slate-400">By: <span className="text-white">{lead.claimedByAgentName || "—"}</span></p>
                                <p className="text-xs text-slate-400">Email: <span className="text-white">{lead.claimedByAgentEmail || "—"}</span></p>
                                <p className="text-xs text-slate-400">Order #: <span className="text-violet-200 font-mono" data-testid={`admin-order-number-${lead.id}`}>{lead.orderNumber || "—"}</span></p>
                                {lead.orderSubmittedAt && <p className="text-xs text-slate-400">Submitted: <span className="text-white">{new Date(lead.orderSubmittedAt).toLocaleString()}</span></p>}
                              </div>
                            </div>
                          ) : lead.status === "unclaimed" ? (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
                              <p className="text-xs text-amber-300">Awaiting claim</p>
                              {lead.notifiedAgentIds && lead.notifiedAgentIds.length > 0 && <p className="text-xs text-slate-500 mt-1">{lead.notifiedAgentIds.length} agent{lead.notifiedAgentIds.length !== 1 ? "s" : ""} notified</p>}
                            </div>
                          ) : null}
                          <div>
                            <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-2">Eligible Tier 1 Agents for {lead.state}</p>
                            {getEligibleAgents(lead.state || "").length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No eligible agents for this state</p>
                            ) : (
                              <div className="space-y-1">
                                {getEligibleAgents(lead.state || "").map((a) => (
                                  <div key={a.id} className="flex items-center gap-2 text-xs">
                                    <div className="h-5 w-5 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-[10px] font-bold">{a.firstName[0]}</div>
                                    <span className="text-slate-300">{a.firstName} {a.lastName}</span>
                                    {lead.notifiedAgentIds && lead.notifiedAgentIds.includes(a.id) && <span className="text-[10px] text-blue-400 border border-blue-500/30 bg-blue-500/10 rounded-full px-1.5 py-0.5">notified</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Per-lead activity timeline */}
                      {(() => {
                        const leadLogs = activityLogs.filter(l => l.leadId === lead.id)
                        if (leadLogs.length === 0) return null
                        return (
                          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5" data-testid={`lead-timeline-${lead.id}`}>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2.5">
                                <Activity className="h-4 w-4 text-slate-300" />
                                <p className="text-xs text-slate-300 uppercase tracking-[0.2em] font-bold">Timeline</p>
                                <span className="text-xs text-slate-500 font-medium">· {leadLogs.length} event{leadLogs.length === 1 ? "" : "s"}</span>
                              </div>
                            </div>
                            <div className="relative pl-1">
                              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/[0.08]" />
                              <div className="space-y-4">
                                {leadLogs.slice(0, 25).map((log) => {
                                  const style = activityStyle(log.action)
                                  return (
                                    <div key={log.id} className="relative flex gap-3.5" data-testid={`timeline-event-${log.id}`}>
                                      <div className={`relative z-10 flex-shrink-0 h-[22px] w-[22px] rounded-full bg-[#0d1117] border ${style.ring} flex items-center justify-center`}>
                                        <div className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline gap-2 flex-wrap">
                                          <p className="text-sm font-bold text-white">{log.action}</p>
                                          <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                                        </div>
                                        {log.details && <p className="text-sm text-slate-300 mt-1 leading-relaxed">{log.details}</p>}
                                        {log.actorName && <p className="text-xs text-slate-500 mt-1">by <span className="text-slate-400 font-medium">{log.actorName}</span>{log.actorEmail ? ` · ${log.actorEmail}` : ""}</p>}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/[0.06]">
                        {lead.status === "unclaimed" && (
                          <>
                            <Button onClick={() => openNotifyModal(lead.id)} data-testid={`notify-agents-btn-${lead.id}`} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl h-8 px-4 text-xs"><Send className="h-3 w-3 mr-1.5" />Send to Agents</Button>
                            <Button variant="outline" onClick={() => deleteLead(lead)} className="border-red-500/20 bg-transparent text-slate-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.06] rounded-xl h-8 px-3 text-xs"><Trash2 className="h-3 w-3 mr-1.5" />Remove</Button>
                          </>
                        )}
                        {lead.status === "claimed" && (
                          <>
                            <Button variant="outline" onClick={() => updateLeadStatus(lead.id, "completed")} className="border-emerald-500/20 bg-transparent text-emerald-400 hover:bg-emerald-500/[0.06] rounded-xl h-8 px-3 text-xs"><Check className="h-3 w-3 mr-1.5" />Mark Completed</Button>
                            <Button variant="outline" onClick={() => { if (confirm("Reopen this lead?")) updateLeadStatus(lead.id, "unclaimed") }} className="border-amber-500/20 bg-transparent text-amber-400 hover:bg-amber-500/[0.06] rounded-xl h-8 px-3 text-xs"><RotateCcw className="h-3 w-3 mr-1.5" />Reopen</Button>
                            <Button variant="outline" onClick={() => deleteLead(lead)} className="border-red-500/20 bg-transparent text-slate-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.06] rounded-xl h-8 px-3 text-xs"><Trash2 className="h-3 w-3 mr-1.5" />Remove</Button>
                          </>
                        )}
                        {(lead.status === "removed" || lead.status === "expired") && (
                          <>
                            <Button variant="outline" onClick={() => { if (confirm("Reopen this lead?")) updateLeadStatus(lead.id, "unclaimed") }} className="border-amber-500/20 bg-transparent text-amber-400 hover:bg-amber-500/[0.06] rounded-xl h-8 px-3 text-xs"><RotateCcw className="h-3 w-3 mr-1.5" />Reopen</Button>
                            <Button variant="outline" onClick={() => permanentlyDeleteLead(lead)} className="border-red-500/20 bg-transparent text-red-400 hover:bg-red-500/[0.06] rounded-xl h-8 px-3 text-xs"><Trash2 className="h-3 w-3 mr-1.5" />Delete Permanently</Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} className="border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-white rounded-lg h-8 w-8 px-0"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs text-slate-400 px-3">Page {safePage} of {totalPages}</span>
              <Button variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)} className="border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-white rounded-lg h-8 w-8 px-0"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
          </>
        )}
      </div>

      {/* Notify Agents Modal */}
      {notifyLeadId && currentLeadForNotify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setNotifyLeadId(null)}>
          <div className="bg-[#0d1117] border border-white/[0.12] rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="notify-agents-modal">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.07]">
              <div><h3 className="text-sm font-bold text-white">Send Lead to Agents</h3><p className="text-xs text-slate-500 mt-0.5">{currentLeadForNotify.fullName} &middot; {currentLeadForNotify.state} &middot; {currentLeadForNotify.provider}</p></div>
              <button onClick={() => setNotifyLeadId(null)} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-bold mb-3">Eligible Tier 1 Agents for {currentLeadForNotify.state}</p>
              {eligibleForNotify.length === 0 ? (
                <div className="text-center py-8"><User className="h-8 w-8 text-slate-700 mx-auto mb-2" /><p className="text-slate-500 text-sm">No eligible Tier 1 agents for {currentLeadForNotify.state}</p><p className="text-slate-600 text-xs mt-1">Add agents approved for this state in the Agents tab</p></div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => { selectedAgents.size === eligibleForNotify.length ? setSelectedAgents(new Set()) : setSelectedAgents(new Set(eligibleForNotify.map((a) => a.id))) }} className="text-xs text-blue-400 hover:text-blue-300">{selectedAgents.size === eligibleForNotify.length ? "Deselect All" : "Select All"}</button>
                    <span className="text-xs text-slate-500">{selectedAgents.size} selected</span>
                  </div>
                  {eligibleForNotify.map((agent) => {
                    const isAgentSelected = selectedAgents.has(agent.id)
                    const wasNotified = currentLeadForNotify.notifiedAgentIds?.includes(agent.id)
                    return (
                      <label key={agent.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${isAgentSelected ? "border-blue-500/30 bg-blue-500/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                        <input type="checkbox" checked={isAgentSelected} onChange={() => setSelectedAgents((prev) => { const n = new Set(prev); n.has(agent.id) ? n.delete(agent.id) : n.add(agent.id); return n })} className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-blue-500" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white">{agent.firstName} {agent.lastName}</p><p className="text-xs text-slate-500 truncate">{agent.email}</p></div>
                        {wasNotified && <span className="text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded-full px-2 py-0.5 flex-shrink-0">previously notified</span>}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            {eligibleForNotify.length > 0 && (
              <div className="flex items-center gap-2 px-5 pb-5">
                <Button onClick={sendNotifications} disabled={selectedAgents.size === 0 || !!notifying} data-testid="send-notifications-btn" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl h-9 text-sm">
                  {notifying ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</> : <><Mail className="h-3.5 w-3.5 mr-1.5" />Send Claim Emails ({selectedAgents.size})</>}
                </Button>
                <Button variant="outline" onClick={() => setNotifyLeadId(null)} className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white rounded-xl h-9 px-4 text-sm">Cancel</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Log Modal — redesigned: stats, filters, search, grouped by time bucket */}
      {showActivity && (() => {
        const filterTypes = [
          { key: "all",     label: "All",            match: () => true },
          { key: "notify",  label: "Notifications",  match: (a: string) => a.toLowerCase().includes("notif") },
          { key: "claim",   label: "Claims",         match: (a: string) => a.toLowerCase().includes("claim") },
          { key: "order",   label: "Orders",         match: (a: string) => a.toLowerCase().includes("order") },
          { key: "removed", label: "Removed",        match: (a: string) => { const x = a.toLowerCase(); return x.includes("removed") || x.includes("deleted") } },
        ] as const

        const q = activitySearch.trim().toLowerCase()
        const filter = filterTypes.find(f => f.key === activityFilter)!

        // Tier 1 agents are the only ones who appear in lead activity. Build a
        // picker list of Tier 1 agents that actually have activity attributed to them.
        const tier1Agents = agents.filter(a => a.tier === 1)
        const agentMatches = (log: LeadActivityLog) => {
          if (activityAgent === "all") return true
          if (activityAgent === "admin") {
            const n = (log.actorName || "").toLowerCase()
            return n === "admin" || n === ""
          }
          const a = tier1Agents.find(x => x.id === activityAgent)
          if (!a) return false
          const targetEmail = (a.email || "").toLowerCase()
          const targetName  = `${a.firstName} ${a.lastName}`.trim().toLowerCase()
          const logEmail = (log.actorEmail || "").toLowerCase()
          const logName  = (log.actorName  || "").toLowerCase()
          // Match by either actor email OR actor name OR (for notify events) the details string mentions them
          if (targetEmail && logEmail === targetEmail) return true
          if (targetName  && logName  === targetName)  return true
          if (targetName  && (log.details || "").toLowerCase().includes(targetName)) return true
          return false
        }

        const filtered = activityLogs.filter(l => {
          if (!filter.match(l.action)) return false
          if (!agentMatches(l)) return false
          if (!q) return true
          const leadName = leadNameMap.get(l.leadId) || ""
          return (
            l.action.toLowerCase().includes(q) ||
            (l.details || "").toLowerCase().includes(q) ||
            (l.actorName || "").toLowerCase().includes(q) ||
            (l.actorEmail || "").toLowerCase().includes(q) ||
            leadName.toLowerCase().includes(q)
          )
        })

        // Time buckets
        const now = Date.now()
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
        const startOfYesterday = new Date(startOfDay); startOfYesterday.setDate(startOfYesterday.getDate() - 1)
        const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - 7)
        type Bucket = { label: string; items: LeadActivityLog[] }
        const buckets: Bucket[] = [
          { label: "Today",       items: [] },
          { label: "Yesterday",   items: [] },
          { label: "This Week",   items: [] },
          { label: "Earlier",     items: [] },
        ]
        for (const l of filtered) {
          const t = new Date(l.timestamp).getTime()
          if (isNaN(t)) { buckets[3].items.push(l); continue }
          if (t >= startOfDay.getTime())      buckets[0].items.push(l)
          else if (t >= startOfYesterday.getTime()) buckets[1].items.push(l)
          else if (t >= startOfWeek.getTime())      buckets[2].items.push(l)
          else                                       buckets[3].items.push(l)
        }

        const todayCount = buckets[0].items.length
        const weekCount  = todayCount + buckets[1].items.length + buckets[2].items.length

        const fmtTime = (iso: string) => {
          const d = new Date(iso)
          if (isNaN(d.getTime())) return iso
          const diff = now - d.getTime()
          if (diff < 60_000) return "just now"
          if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
          if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
          return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowActivity(false)}>
            <div className="bg-[#0d1117] border border-white/[0.12] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()} data-testid="activity-log-modal">
              {/* Header */}
              <div className="px-6 pt-5 pb-4 border-b border-white/[0.07]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-400" />
                      Lead Activity Log
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      <span className="text-blue-300 font-bold">{todayCount}</span> today
                      <span className="text-slate-700 mx-2">·</span>
                      <span className="text-white font-bold">{weekCount}</span> this week
                      <span className="text-slate-700 mx-2">·</span>
                      <span className="text-slate-300">{activityLogs.length}</span> total
                    </p>
                  </div>
                  <button onClick={() => setShowActivity(false)} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06]" data-testid="close-activity-modal">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                  <Input
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    placeholder="Search by lead, agent, or detail..."
                    data-testid="activity-search-input"
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-500 h-10 pl-10 pr-3 rounded-xl text-sm"
                  />
                </div>

                {/* Agent picker — leads are Tier 1 only, so this lists Tier 1 agents */}
                <div className="flex items-center gap-2 mb-3">
                  <Label className="text-xs text-slate-400 font-semibold whitespace-nowrap">Filter by agent:</Label>
                  <div className="relative flex-1">
                    <select
                      value={activityAgent}
                      onChange={(e) => setActivityAgent(e.target.value)}
                      data-testid="activity-agent-filter"
                      className="w-full h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-sm px-3 pr-8 appearance-none focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="all" className="bg-[#111827]">All agents ({activityLogs.length})</option>
                      <option value="admin" className="bg-[#111827]">Admin only</option>
                      <optgroup label="Tier 1 Agents" className="bg-[#111827]">
                        {tier1Agents
                          .map(a => {
                            const cnt = activityLogs.filter(l => {
                              const e = (a.email || "").toLowerCase()
                              const n = `${a.firstName} ${a.lastName}`.trim().toLowerCase()
                              return (l.actorEmail || "").toLowerCase() === e
                                || (l.actorName  || "").toLowerCase() === n
                                || (n && (l.details || "").toLowerCase().includes(n))
                            }).length
                            return { agent: a, count: cnt }
                          })
                          .sort((x, y) => y.count - x.count)
                          .map(({ agent: a, count: cnt }) => (
                            <option key={a.id} value={a.id} className="bg-[#111827]">
                              {a.firstName} {a.lastName} ({cnt})
                            </option>
                          ))}
                      </optgroup>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                  </div>
                  {activityAgent !== "all" && (
                    <button
                      onClick={() => setActivityAgent("all")}
                      data-testid="activity-agent-clear"
                      className="text-xs text-slate-400 hover:text-white px-2 h-9 rounded-lg hover:bg-white/[0.06] font-semibold"
                      title="Clear agent filter"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {filterTypes.map(f => {
                    const cnt = f.key === "all" ? activityLogs.length : activityLogs.filter(l => f.match(l.action)).length
                    const active = activityFilter === f.key
                    return (
                      <button
                        key={f.key}
                        onClick={() => setActivityFilter(f.key)}
                        data-testid={`activity-filter-${f.key}`}
                        className={`inline-flex items-center gap-2 px-3.5 h-8 rounded-full text-sm font-semibold transition-colors ${
                          active
                            ? "bg-blue-500 text-white"
                            : "bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                        }`}
                      >
                        {f.label}
                        <span className={`text-xs ${active ? "text-blue-100" : "text-slate-500"}`}>{cnt}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {activityLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-base text-slate-400">
                      {activityLogs.length === 0 ? "No activity recorded yet." : "No events match your filter."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {buckets.filter(b => b.items.length > 0).map(bucket => (
                      <div key={bucket.label} data-testid={`activity-bucket-${bucket.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <div className="flex items-center gap-2 mb-3 sticky top-0 bg-[#0d1117] py-1.5 z-[1]">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">{bucket.label}</p>
                          <div className="flex-1 h-px bg-white/[0.05]" />
                          <span className="text-xs text-slate-500 font-semibold">{bucket.items.length}</span>
                        </div>
                        <div className="space-y-2">
                          {bucket.items.map(log => {
                            const style = activityStyle(log.action)
                            const leadName = leadNameMap.get(log.leadId)
                            return (
                              <div
                                key={log.id}
                                className="group flex gap-3 p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.04] hover:border-white/[0.08] transition-colors"
                                data-testid={`activity-event-${log.id}`}
                              >
                                <div className={`flex-shrink-0 h-8 w-8 rounded-full bg-[#0d1117] border ${style.ring} flex items-center justify-center`}>
                                  <div className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <p className="text-sm font-bold text-white">{log.action}</p>
                                    {leadName ? (
                                      <button
                                        onClick={() => {
                                          setExpanded(log.leadId)
                                          setShowActivity(false)
                                          setTimeout(() => {
                                            const el = document.querySelector(`[data-testid="lead-timeline-${log.leadId}"]`)
                                              || document.querySelector(`[data-lead-row="${log.leadId}"]`)
                                            el?.scrollIntoView({ behavior: "smooth", block: "center" })
                                          }, 100)
                                        }}
                                        className="text-xs text-blue-300 hover:text-blue-200 border border-blue-500/20 bg-blue-500/[0.06] hover:bg-blue-500/[0.12] rounded-full px-2.5 py-0.5 font-semibold transition-colors"
                                        data-testid={`activity-jump-${log.leadId}`}
                                        title="Jump to this lead"
                                      >
                                        {leadName}
                                      </button>
                                    ) : (
                                      <span className="text-xs text-slate-500 italic">lead removed</span>
                                    )}
                                  </div>
                                  {log.details && <p className="text-sm text-slate-300 mt-1 leading-relaxed">{log.details}</p>}
                                  <p className="text-xs text-slate-500 mt-1.5">
                                    {fmtTime(log.timestamp)}
                                    {log.actorName && <> · <span className="text-slate-400 font-medium">{log.actorName}</span></>}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
