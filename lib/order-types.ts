// ── US States ─────────────────────────────────────────────────────────────────

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
] as const

export const US_STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",
  KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",
  MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",
  NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",
  NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",
  OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
  DC:"District of Columbia",
}

// ── Agent Profile ─────────────────────────────────────────────────────────────

export type AgentTier = 1 | 2

export interface AgentProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  partnerType: string
  createdAt: string
  source: "manual" | "onboarding"
  // Lead pool fields
  tier?: AgentTier
  approvedStates?: string[]
  activeStatus?: boolean
  directProviderAccess?: boolean
  canReceiveLeads?: boolean
  updatedAt?: string
}

// ── Lead ──────────────────────────────────────────────────────────────────────

export type LeadStatus = "unclaimed" | "claimed" | "removed" | "expired" | "completed"

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  unclaimed:  "Unclaimed",
  claimed:    "Claimed",
  removed:    "Removed",
  expired:    "Expired",
  completed:  "Completed",
}

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  unclaimed:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  claimed:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  removed:    "bg-red-500/15 text-red-400 border-red-500/30",
  expired:    "bg-slate-500/15 text-slate-400 border-slate-500/30",
  completed:  "bg-violet-500/15 text-violet-300 border-violet-500/30",
}

export interface Lead {
  id: string
  createdAt: string
  createdBy: string
  status: LeadStatus
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
  eligibleAgentIds: string[]
  notifiedAgentIds: string[]
  claimedByAgentId: string
  claimedByAgentName: string
  claimedByAgentEmail: string
  claimedAt: string
  removedBy: string
  removedAt: string
  adminNotes: string
  updatedAt: string
}

export interface LeadClaimToken {
  token: string
  leadId: string
  agentId: string
  agentEmail: string
  createdAt: string
  expiresAt: string
  usedAt: string
  status: "active" | "used" | "expired" | "revoked"
}

export interface LeadActivityLog {
  id: string
  timestamp: string
  leadId: string
  action: string
  actorName: string
  actorEmail: string
  details: string
}

// ── Order ─────────────────────────────────────────────────────────────────────

export type OrderStatus = "submitted" | "pending" | "complete" | "paid" | "cancelled"

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: "Submitted",
  pending:   "Pending",
  complete:  "Complete",
  paid:      "Paid",
  cancelled: "Cancelled",
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  submitted: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  pending:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  complete:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  paid:      "bg-violet-500/15 text-violet-300 border-violet-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
}

export const ORDER_STATUS_COLORS_LIGHT: Record<OrderStatus, string> = {
  submitted: "bg-blue-100 text-blue-800 border-blue-300",
  pending:   "bg-amber-100 text-amber-800 border-amber-300",
  complete:  "bg-emerald-100 text-emerald-800 border-emerald-300",
  paid:      "bg-violet-100 text-violet-800 border-violet-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
}

export interface Order {
  id: string
  agentId: string
  agentName: string
  agentEmail: string
  partnerType: string
  customerFirstName: string
  customerLastName: string
  customerPhone: string
  customerEmail: string
  customerAddress: string
  customerCity: string
  customerState: string
  customerZip: string
  customerDob: string
  customerSsn: string
  customerCcNumber: string
  customerCcExpiry: string
  customerCcCvv: string
  carrier: string
  service: string
  orderNumber: string
  saleDate: string
  installDate: string
  installTime: string
  notes: string
  status: OrderStatus
  submittedAt: string
  updatedAt: string
  adminNotes: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

import { PROVIDERS, type RoleKey } from "@/lib/exhibits"

const PARTNER_TO_ROLE: Record<string, RoleKey> = {
  "referral":       "referral",
  "sales-agent":    "salesAgent",
  "business":       "ibo",
  "spectrum-event": "salesAgent",
  "tmobile-d2d":    "salesAgent",
  "verizon-d2d":    "salesAgent",
}

/**
 * Returns the commission amount for a given order based on the agent's
 * partnerType, the carrier, and the service. Returns 0 if no match.
 */
export function lookupCommission(order: Pick<Order, "carrier" | "service" | "partnerType">): number {
  const role: RoleKey = PARTNER_TO_ROLE[order.partnerType] ?? "salesAgent"
  const provider = PROVIDERS.find(
    (p) => p.provider.toLowerCase() === order.carrier.toLowerCase()
  )
  if (!provider) return 0
  const row = provider.rows.find(
    (r) => r.service.toLowerCase() === order.service.toLowerCase()
  )
  if (!row) return 0
  return row[role] ?? 0
}
