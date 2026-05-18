"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Search, ExternalLink, Download, Pencil, Trash2, X, Check } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
  type Order,
  type OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/lib/order-types"

const PAGE_SIZE = 20

const ALL_STATUSES: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all",       label: "All Statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "pending",   label: "Pending" },
  { value: "complete",  label: "Complete" },
  { value: "paid",      label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
]

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.15em] ${ORDER_STATUS_COLORS[status]}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}

function fmt(dateStr: string) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function OrdersPanel() {
  const [orders, setOrders]           = useState<Order[]>([])
  const [loading, setLoading]         = useState(true)
  const [updating, setUpdating]       = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "all">("all")
  const [timeTab, setTimeTab]         = useState<"all" | "today" | "week" | "month" | "older">("today")
  const [search, setSearch]           = useState("")
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [adminNoteEdit, setAdminNoteEdit] = useState<Record<string, string>>({})
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editForm, setEditForm]       = useState<Partial<Order>>({})
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy]       = useState(false)
  const [page, setPage]               = useState(1)
  const [updateModal, setUpdateModal] = useState<{ order: Order; status: OrderStatus; note: string; notifyAgent: boolean } | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/orders")
      if (res.ok) setOrders(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const updateStatus = useCallback(async (id: string, status: OrderStatus) => {
    setUpdating(id)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated: Order = await res.json()
        setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)))
      }
    } finally {
      setUpdating(null)
    }
  }, [])

  const openUpdateModal = useCallback((order: Order) => {
    setUpdateModal({ order, status: order.status, note: order.adminNotes ?? "", notifyAgent: true })
  }, [])

  const saveModalUpdate = useCallback(async () => {
    if (!updateModal) return
    const { order, status, note, notifyAgent } = updateModal
    setUpdating(order.id)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes: note, notifyAgent }),
      })
      if (res.ok) {
        const updated: Order = await res.json()
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)))
        setUpdateModal(null)
      }
    } finally {
      setUpdating(null)
    }
  }, [updateModal])

  const saveNote = useCallback(async (id: string) => {
    const note = adminNoteEdit[id] ?? ""
    setUpdating(id)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: note }),
      })
      if (res.ok) {
        const updated: Order = await res.json()
        setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)))
        setAdminNoteEdit((prev) => { const n = { ...prev }; delete n[id]; return n })
      }
    } finally {
      setUpdating(null)
    }
  }, [adminNoteEdit])

  const startEdit = useCallback((order: Order) => {
    setEditingId(order.id)
    setEditForm({
      customerFirstName: order.customerFirstName,
      customerLastName:  order.customerLastName,
      customerPhone:     order.customerPhone,
      customerEmail:     order.customerEmail,
      customerAddress:   order.customerAddress,
      customerCity:      order.customerCity,
      customerState:     order.customerState,
      customerZip:       order.customerZip,
      carrier:           order.carrier,
      service:           order.service,
      orderNumber:       order.orderNumber,
      saleDate:          order.saleDate,
      installDate:       order.installDate,
      notes:             order.notes,
    })
  }, [])

  const cancelEdit = useCallback(() => { setEditingId(null); setEditForm({}) }, [])

  const saveEdit = useCallback(async () => {
    if (!editingId) return
    setUpdating(editingId)
    try {
      const res = await fetch(`/api/orders/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        const updated: Order = await res.json()
        setOrders((prev) => prev.map((o) => (o.id === editingId ? updated : o)))
        cancelEdit()
      }
    } finally {
      setUpdating(null)
    }
  }, [editingId, editForm, cancelEdit])

  // ── Delete single order ────────────────────────────────────────────────────
  const deleteOrder = useCallback(async (order: Order) => {
    const label = `${order.customerFirstName} ${order.customerLastName} — ${order.carrier}`.trim()
    if (!confirm(`Permanently delete order for ${label}?\n\nThis cannot be undone.`)) return
    setUpdating(order.id)
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" })
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== order.id))
        setSelected((prev) => { const n = new Set(prev); n.delete(order.id); return n })
        if (expanded === order.id) setExpanded(null)
      }
    } finally {
      setUpdating(null)
    }
  }, [expanded])

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const bulkDelete = useCallback(async () => {
    if (selected.size === 0) return
    if (!confirm(`Permanently delete ${selected.size} order${selected.size === 1 ? "" : "s"}?\n\nThis cannot be undone.`)) return
    setBulkBusy(true)
    try {
      const ids = Array.from(selected)
      for (const id of ids) {
        await fetch(`/api/orders/${id}`, { method: "DELETE" })
      }
      setOrders((prev) => prev.filter((o) => !selected.has(o.id)))
      setSelected(new Set())
    } finally {
      setBulkBusy(false)
    }
  }, [selected])

  // ── Bulk status update ─────────────────────────────────────────────────────
  const bulkUpdate = useCallback(async (status: OrderStatus) => {
    if (selected.size === 0) return
    if (!confirm(`Mark ${selected.size} order${selected.size === 1 ? "" : "s"} as "${ORDER_STATUS_LABELS[status]}"?`)) return
    setBulkBusy(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), status }),
      })
      if (res.ok) {
        const { updated } = await res.json() as { updated: Order[] }
        setOrders((prev) => prev.map((o) => { const u = updated.find((x) => x.id === o.id); return u || o }))
        setSelected(new Set())
      }
    } finally {
      setBulkBusy(false)
    }
  }, [selected])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  // ── Filtering + pagination ─────────────────────────────────────────────────
  // Time-bucket helper: which bucket does this order's submittedAt belong to?
  const bucketFor = (iso: string): "today" | "week" | "month" | "older" => {
    const t = new Date(iso).getTime()
    if (isNaN(t)) return "older"
    const ms = Date.now() - t
    const day = 86_400_000
    if (ms < day) return "today"
    if (ms < 7 * day) return "week"
    if (ms < 30 * day) return "month"
    return "older"
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return orders.filter((o) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false
      if (timeTab !== "all" && bucketFor(o.submittedAt) !== timeTab) return false
      if (!q) return true
      return (
        o.agentName.toLowerCase().includes(q) ||
        `${o.customerFirstName} ${o.customerLastName}`.toLowerCase().includes(q) ||
        o.carrier.toLowerCase().includes(q) ||
        o.service.toLowerCase().includes(q) ||
        (o.orderNumber || "").toLowerCase().includes(q)
      )
    })
  }, [orders, filterStatus, search, timeTab])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, filterStatus, timeTab])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length }
    for (const o of orders) c[o.status] = (c[o.status] || 0) + 1
    return c
  }, [orders])

  // Live counts per timeline tab (respect the active status + search filters so the
  // tab labels reflect what you'll actually see when you click)
  const timeCounts = useMemo(() => {
    const q = search.toLowerCase()
    const pool = orders.filter((o) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false
      if (!q) return true
      return (
        o.agentName.toLowerCase().includes(q) ||
        `${o.customerFirstName} ${o.customerLastName}`.toLowerCase().includes(q) ||
        o.carrier.toLowerCase().includes(q) ||
        o.service.toLowerCase().includes(q) ||
        (o.orderNumber || "").toLowerCase().includes(q)
      )
    })
    const out = { all: pool.length, today: 0, week: 0, month: 0, older: 0 }
    for (const o of pool) out[bucketFor(o.submittedAt)]++
    return out
  }, [orders, filterStatus, search])

  // ── Select all on current page ─────────────────────────────────────────────
  const allOnPageSelected = paged.length > 0 && paged.every((o) => selected.has(o.id))
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelected((prev) => { const n = new Set(prev); paged.forEach((o) => n.delete(o.id)); return n })
    } else {
      setSelected((prev) => { const n = new Set(prev); paged.forEach((o) => n.add(o.id)); return n })
    }
  }

  return (
    <>
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white" data-testid="orders-panel-title">Orders</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {orders.length} total &middot; {counts.submitted ?? 0} new &middot; {counts.pending ?? 0} pending &middot; {counts.paid ?? 0} paid
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/orders/export" download>
            <Button variant="outline" className="border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl h-9 px-3 text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
            </Button>
          </a>
          <Button variant="outline" onClick={loadOrders} disabled={loading} className="border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl h-9 px-3">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.08] px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-blue-200">{selected.size} selected</span>
          <span className="text-xs text-slate-500">Mark as:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["pending", "complete", "paid", "cancelled"] as OrderStatus[]).map((s) => (
              <Button key={s} disabled={bulkBusy} onClick={() => bulkUpdate(s)} className="h-7 px-3 text-[11px] rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white font-semibold">
                {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : ORDER_STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
          <Button disabled={bulkBusy} onClick={bulkDelete} data-testid="bulk-delete-orders-btn" className="h-7 px-3 text-[11px] rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-semibold">
            {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3 mr-1" />Delete</>}
          </Button>
          <Button variant="outline" onClick={() => setSelected(new Set())} className="ml-auto h-7 px-3 text-[11px] border-white/[0.1] bg-transparent text-slate-400 hover:text-white rounded-lg">
            <X className="h-3 w-3 mr-1" />Clear
          </Button>
        </div>
      )}

      {/* Timeline tabs */}
      <div className="flex items-center gap-1.5 flex-wrap border-b border-white/[0.06] pb-px">
        {[
          { key: "today",  label: "Today",       count: timeCounts.today,  accent: "blue" },
          { key: "week",   label: "This Week",   count: timeCounts.week,   accent: "emerald" },
          { key: "month",  label: "This Month",  count: timeCounts.month,  accent: "violet" },
          { key: "older",  label: "Older",       count: timeCounts.older,  accent: "amber" },
          { key: "all",    label: "All",         count: timeCounts.all,    accent: "slate" },
        ].map((t) => {
          const active = timeTab === t.key
          const activeCls =
            t.accent === "blue"     ? "border-blue-500 text-blue-300 bg-blue-500/[0.06]" :
            t.accent === "emerald"  ? "border-emerald-500 text-emerald-300 bg-emerald-500/[0.06]" :
            t.accent === "violet"   ? "border-violet-500 text-violet-300 bg-violet-500/[0.06]" :
            t.accent === "amber"    ? "border-amber-500 text-amber-300 bg-amber-500/[0.06]" :
                                      "border-slate-500 text-slate-200 bg-slate-500/[0.08]"
          return (
            <button
              key={t.key}
              onClick={() => setTimeTab(t.key as typeof timeTab)}
              data-testid={`orders-time-tab-${t.key}`}
              className={`relative flex items-center gap-2 px-4 h-10 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
                active ? activeCls : "border-transparent text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]"
              }`}
            >
              {t.label}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                active ? "bg-white/[0.1] text-white" : "bg-white/[0.04] text-slate-500"
              }`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agent, customer, carrier…" className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 h-9 rounded-xl pl-9 text-sm focus:ring-0 focus:border-blue-500/50" />
        </div>
        <div className="relative">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as OrderStatus | "all")} className="h-9 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-sm px-3 pr-8 appearance-none focus:outline-none focus:border-blue-500/50">
            {ALL_STATUSES.map((s) => (
              <option key={s.value} value={s.value} className="bg-[#111827]">{s.label}{s.value !== "all" && counts[s.value] ? ` (${counts[s.value]})` : ""}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl"><p className="text-slate-500 text-sm">No orders match your filter.</p></div>
      ) : (
        <>
        {/* Select all + pagination header */}
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 rounded border-white/20 bg-white/[0.05] accent-blue-500" />
            <span>Select all on page</span>
          </label>
          <span>Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
        </div>

        <div className="space-y-2">
          {paged.map((order) => {
            const isOpen = expanded === order.id
            const isEditing = editingId === order.id
            const isSelected = selected.has(order.id)
            const noteVal = adminNoteEdit[order.id] ?? order.adminNotes ?? ""
            const noteChanged = adminNoteEdit[order.id] !== undefined && adminNoteEdit[order.id] !== order.adminNotes

            return (
              <div key={order.id} data-testid={`order-row-${order.id}`} className={`rounded-xl border transition-colors ${isSelected ? "border-blue-500/40 bg-blue-500/[0.06]" : isOpen ? "border-blue-500/30 bg-blue-500/[0.04]" : "border-white/[0.07] bg-white/[0.02]"}`}>
                <div className="p-4 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(order.id)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-blue-500 cursor-pointer flex-shrink-0" />
                  <button onClick={() => setExpanded(isOpen ? null : order.id)} className="flex-1 min-w-0 text-left grid sm:grid-cols-4 gap-y-1 gap-x-4">
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-0.5">Agent</p>
                      <p className="text-sm font-semibold text-white truncate">{order.agentName}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-0.5">Customer</p>
                      <p className="text-sm text-slate-300 truncate">{order.customerFirstName} {order.customerLastName}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-0.5">Carrier / Plan</p>
                      <p className="text-sm text-slate-300 truncate">{order.carrier}{order.service ? ` — ${order.service}` : ""}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-0.5">Sale Date</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-slate-400">{fmt(order.saleDate)}</p>
                        {(() => {
                          const t = new Date(order.submittedAt).getTime()
                          if (isNaN(t)) return null
                          const days = Math.floor((Date.now() - t) / 86_400_000)
                          const label = days < 1 ? "today" : days === 1 ? "1d" : `${days}d`
                          const tone =
                            days <= 1 ? "bg-blue-500/15 text-blue-300 border-blue-500/25" :
                            days <= 7 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" :
                            days <= 30 ? "bg-violet-500/15 text-violet-300 border-violet-500/25" :
                                         "bg-amber-500/15 text-amber-300 border-amber-500/25"
                          return (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${tone}`}
                              title={`Submitted ${days} day${days === 1 ? "" : "s"} ago`}
                              data-testid={`order-age-${order.id}`}
                            >
                              {label}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {updating === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" /> : (
                      <button onClick={(e) => { e.stopPropagation(); openUpdateModal(order) }} className="flex items-center gap-1.5 rounded-lg px-2 py-1 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] transition-colors" title="Update status">
                        <StatusBadge status={order.status} />
                        <Pencil className="h-3 w-3 text-slate-500" />
                      </button>
                    )}
                    <Button variant="outline" onClick={(e) => { e.stopPropagation(); deleteOrder(order) }} disabled={updating === order.id} data-testid={`delete-order-btn-${order.id}`} className="border-red-500/20 bg-transparent text-slate-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.06] rounded-xl h-8 w-8 px-0" title="Delete order">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && !isEditing && (
                  <div className="border-t border-white/[0.07] px-4 pb-5 pt-4 grid sm:grid-cols-2 gap-5">
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-1">Customer Contact</p>
                          <p className="text-slate-300">{order.customerFirstName} {order.customerLastName}</p>
                          <p className="text-slate-500">{order.customerPhone}{order.customerEmail && ` · ${order.customerEmail}`}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{[order.customerAddress, order.customerCity, order.customerState, order.customerZip].filter(Boolean).join(", ")}</p>
                          {order.customerDob && <p className="text-slate-500 text-xs mt-0.5">DOB: {order.customerDob}</p>}
                          {order.customerSsn && <p className="text-slate-500 text-xs mt-0.5">SSN: {order.customerSsn}</p>}
                          {order.customerCcNumber && <p className="text-slate-500 text-xs mt-0.5">Card: {order.customerCcNumber}{order.customerCcExpiry && `  exp ${order.customerCcExpiry}`}{order.customerCcCvv && `  CVV ${order.customerCcCvv}`}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="outline" onClick={() => startEdit(order)} className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg h-8 px-2.5 text-xs">
                            <Pencil className="h-3 w-3 mr-1" />Edit
                          </Button>
                          <Button variant="outline" onClick={() => deleteOrder(order)} disabled={updating === order.id} className="border-red-500/30 bg-transparent text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg h-8 px-2.5 text-xs">
                            <Trash2 className="h-3 w-3 mr-1" />Delete
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Order / Conf #", value: order.orderNumber || "—" },
                          { label: "Install Date", value: fmt(order.installDate) },
                          { label: "Submitted", value: fmt(order.submittedAt) },
                          { label: "Last Updated", value: fmt(order.updatedAt) },
                        ].map((r) => (
                          <div key={r.label}>
                            <p className="text-[10px] text-slate-600 uppercase tracking-[0.12em] font-semibold mb-0.5">{r.label}</p>
                            <p className="text-slate-300 text-xs">{r.value}</p>
                          </div>
                        ))}
                      </div>
                      {order.notes && (<div><p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-1">Agent Notes</p><p className="text-slate-400 text-xs leading-relaxed">{order.notes}</p></div>)}
                      {order.agentId && (
                        <a href={`/orders/history?a=${order.agentId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                          <ExternalLink className="h-3 w-3" />View all orders for {order.agentName}
                        </a>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-2">Admin Notes</p>
                      <textarea rows={4} value={noteVal} onChange={(e) => setAdminNoteEdit((prev) => ({ ...prev, [order.id]: e.target.value }))} placeholder="Internal notes (not visible to agent)…" className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-sm placeholder:text-slate-600 px-3 py-2 resize-none focus:outline-none focus:border-blue-500/50" />
                      {noteChanged && (
                        <Button onClick={() => saveNote(order.id)} disabled={updating === order.id} className="mt-2 h-8 px-4 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                          {updating === order.id ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving…</> : "Save Note"}
                        </Button>
                      )}
                      <div className="mt-3"><p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-2">Status</p><StatusBadge status={order.status} /></div>
                    </div>
                  </div>
                )}

                {/* Inline edit form */}
                {isOpen && isEditing && (
                  <div className="border-t border-blue-500/20 px-4 pb-5 pt-4 bg-blue-500/[0.02]">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-blue-300 uppercase tracking-[0.18em]">Edit Order</h4>
                      <Button variant="outline" onClick={cancelEdit} className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white rounded-lg h-7 px-2 text-xs"><X className="h-3 w-3 mr-1" />Cancel</Button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        { k: "customerFirstName", l: "First name" },
                        { k: "customerLastName",  l: "Last name" },
                        { k: "customerPhone",     l: "Phone" },
                        { k: "customerEmail",     l: "Email" },
                        { k: "customerAddress",   l: "Address" },
                        { k: "customerCity",      l: "City" },
                        { k: "customerState",     l: "State" },
                        { k: "customerZip",       l: "Zip" },
                        { k: "carrier",           l: "Carrier" },
                        { k: "service",           l: "Service" },
                        { k: "orderNumber",       l: "Order / Conf #" },
                        { k: "saleDate",          l: "Sale date", type: "date" },
                        { k: "installDate",       l: "Install date", type: "date" },
                      ].map(({ k, l, type }) => (
                        <div key={k}><Label className="text-slate-400 text-xs mb-1 block">{l}</Label>
                          <Input type={type || "text"} value={(editForm as any)[k] ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, [k]: e.target.value }))} className="bg-white/[0.04] border-white/[0.1] text-white h-9 rounded-lg text-sm focus:ring-0 focus:border-blue-500/50" />
                        </div>
                      ))}
                      <div className="sm:col-span-2"><Label className="text-slate-400 text-xs mb-1 block">Agent Notes</Label>
                        <textarea rows={2} value={editForm.notes ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))} className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] text-white text-sm px-3 py-2 resize-none focus:outline-none focus:border-blue-500/50" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button onClick={saveEdit} disabled={updating === order.id} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg h-9 px-5 text-sm">
                        {updating === order.id ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : <><Check className="h-3.5 w-3.5 mr-1.5" />Save Changes</>}
                      </Button>
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

    {/* ── Update Status + Note Modal ── */}
    {updateModal && (() => {
      const m = updateModal
      return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setUpdateModal(null)}>
        <div className="bg-[#0d1117] border border-white/[0.12] rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.07]">
            <div><h3 className="text-sm font-bold text-white">Update Order</h3><p className="text-xs text-slate-500 mt-0.5">{m.order.customerFirstName} {m.order.customerLastName} · {m.order.carrier}{m.order.service ? ` — ${m.order.service}` : ""}</p></div>
            <button onClick={() => setUpdateModal(null)} className="text-slate-500 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <Label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-[0.12em]">Status</Label>
              <div className="relative">
                <select value={m.status} onChange={(e) => setUpdateModal((prev) => prev ? { ...prev, status: e.target.value as OrderStatus } : null)} className="w-full h-9 rounded-lg border border-white/[0.1] bg-white/[0.04] text-white text-sm px-3 pr-8 appearance-none focus:outline-none focus:border-blue-500/50">
                  {(["submitted", "pending", "complete", "paid", "cancelled"] as OrderStatus[]).map((s) => (<option key={s} value={s} className="bg-[#111827]">{ORDER_STATUS_LABELS[s]}</option>))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <Label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-[0.12em]">Note <span className="normal-case tracking-normal text-slate-600">(optional)</span></Label>
              <textarea rows={3} value={m.note} onChange={(e) => setUpdateModal((prev) => prev ? { ...prev, note: e.target.value } : null)} placeholder="Add an internal note…" className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] text-white text-sm placeholder:text-slate-600 px-3 py-2 resize-none focus:outline-none focus:border-blue-500/50" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={m.notifyAgent} onChange={(e) => setUpdateModal((prev) => prev ? { ...prev, notifyAgent: e.target.checked } : null)} className="h-4 w-4 rounded border-white/20 bg-white/[0.05] accent-blue-500" />
              <span className="text-sm text-slate-300">Email agent about this update</span>
            </label>
          </div>
          <div className="flex items-center gap-2 px-5 pb-5">
            <Button onClick={saveModalUpdate} disabled={!!updating} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg h-9 text-sm">
              {updating ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : <><Check className="h-3.5 w-3.5 mr-1.5" />Save</>}
            </Button>
            <Button variant="outline" onClick={() => setUpdateModal(null)} className="border-white/[0.1] bg-transparent text-slate-400 hover:text-white rounded-lg h-9 px-4 text-sm">Cancel</Button>
          </div>
        </div>
      </div>
      )
    })()}
    </>
  )
}
