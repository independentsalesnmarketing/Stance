"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { upload } from "@vercel/blob/client"
import { ContractViewer, CONTRACT_SECTIONS } from "@/components/onboarding/contract-viewer"
import { SignaturePad } from "@/components/onboarding/signature-pad"
import { FileUpload } from "@/components/onboarding/file-upload"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Loader2,
  FileText,
  Shield,
  ClipboardList,
  Upload,
  PenTool,
  Camera,
  Landmark,
} from "lucide-react"
import { type CompensationExhibit } from "@/lib/exhibits"

// ── Helpers ──

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10)
  if (digits.length < 4) return digits
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function formatDob(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

function isAtLeast18(dob: string): boolean {
  const parts = dob.split("/")
  if (parts.length !== 3) return false
  const month = parseInt(parts[0], 10)
  const day = parseInt(parts[1], 10)
  const year = parseInt(parts[2], 10)
  if (!month || !day || !year || year < 1900) return false
  const birth = new Date(year, month - 1, day)
  const cutoff = new Date(birth)
  cutoff.setFullYear(cutoff.getFullYear() + 18)
  return new Date() >= cutoff
}

// ── Types ──

const PROGRAM_LABELS: Record<string, string> = {
  referral: "Referral Partner",
  "sales-agent": "Sales Agent",
  business: "Business Partnership",
  "spectrum-event": "Spectrum Event Team",
  "tmobile-d2d": "T-Mobile Fiber D2D",
  "verizon-d2d": "Verizon Fios D2D",
}

interface OnboardingData {
  // from application
  firstName: string
  lastName: string
  email: string
  phone: string
  state: string
  company: string
  partnerType: string
  token: string
  // contractor details
  legalName: string
  dob: string
  dbaName: string
  entityType: string
  address: string
  city: string
  zipCode: string
  einLast4: string
  // signature
  signatureDataUrl: string
  isAcknowledged: boolean
  isContractRead: boolean
  // uploads
  idDocUrl: string
  idDocName: string
  badgePhotoUrl: string
  badgePhotoName: string
  // W-9
  tinType: "ssn" | "ein" | ""
  w9Certified: boolean
  exemptPayeeCode: string
  w9SignatureDataUrl: string
}

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming",
]

const ENTITY_TYPES = [
  "Individual / Sole Proprietor",
  "Single-Member LLC",
  "Multi-Member LLC",
  "S Corporation",
  "C Corporation",
  "Partnership",
  "Other",
]

const TOTAL_STEPS = 8

const STEP_LABELS = [
  "Details",
  "Agreement",
  "Signature",
  "W-9",
  "Direct Deposit",
  "ID Upload",
  "Badge Photo",
  "Review",
]

// ── Component ──

interface OnboardingContentProps {
  token: string
  prefill?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    state?: string
    company?: string
    partnerType?: string
    legalName?: string
  }
  exhibits?: CompensationExhibit[]
  leadsProvided?: boolean
}

export function OnboardingContent({ token, prefill, exhibits, leadsProvided = false }: OnboardingContentProps) {
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [completedAgentId, setCompletedAgentId] = useState<string | null>(null)
  const [copiedOrderLink, setCopiedOrderLink] = useState(false)

  const [data, setData] = useState<OnboardingData>({
    firstName: prefill?.firstName || "",
    lastName: prefill?.lastName || "",
    email: prefill?.email || "",
    phone: prefill?.phone || "",
    state: prefill?.state || "",
    company: prefill?.company || "",
    partnerType: prefill?.partnerType || "",
    token,
    legalName: prefill?.legalName || "",
    dob: "",
    dbaName: "",
    entityType: "",
    address: "",
    city: "",
    zipCode: "",
    einLast4: "",
    signatureDataUrl: "",
    isAcknowledged: false,
    isContractRead: false,
    idDocUrl: "",
    idDocName: "",
    badgePhotoUrl: "",
    badgePhotoName: "",
    tinType: "",
    w9Certified: false,
    exemptPayeeCode: "",
    w9SignatureDataUrl: "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
    accountType: "",
  })

  const [effectiveDate] = useState(() =>
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  )

  const programLabel = PROGRAM_LABELS[data.partnerType] || data.partnerType || "Partner Program"
  const contractorName = data.legalName || `${data.firstName} ${data.lastName}`.trim()
  const roleFallback = ["sales-agent", "spectrum-event", "tmobile-d2d", "verizon-d2d"].includes(data.partnerType)
    ? "New Agent"
    : "Partner"

  const updateField = useCallback(
    (name: string, value: string | boolean) => {
      setData((prev) => ({ ...prev, [name]: value }))
      if (errors[name]) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next[name]
          return next
        })
      }
    },
    [errors]
  )

  const validateStep = useCallback((): boolean => {
    const e: Record<string, string> = {}

    if (step === 1) {
      if (!data.legalName.trim()) e.legalName = "Required"
      if (!data.email.trim()) {
        e.email = "Required"
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        e.email = "Enter a valid email address"
      }
      if (!data.dob.trim()) {
        e.dob = "Required"
      } else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data.dob)) {
        e.dob = "Enter a valid date (MM/DD/YYYY)"
      } else if (!isAtLeast18(data.dob)) {
        e.dob = "Must be 18 years of age or older"
      }
      if (!data.address.trim()) e.address = "Required"
      if (!data.city.trim()) e.city = "Required"
      if (!data.state) e.state = "Required"
      if (!data.zipCode.trim()) e.zipCode = "Required"
      if (!data.einLast4.trim()) {
        e.einLast4 = "Required"
      } else if (!/^\d{9}$/.test(data.einLast4)) {
        e.einLast4 = "Enter exactly 9 digits"
      }
    }

    if (step === 2) {
      if (!data.isContractRead) {
        e.contract = "You must read the full agreement to continue"
      }
    }

    if (step === 3) {
      if (!data.signatureDataUrl) e.signature = "Please provide your signature"
      if (!data.isAcknowledged) e.acknowledge = "Acknowledgment is required"
    }

    if (step === 4) {
      if (!data.tinType) e.tinType = "Please select SSN or EIN"
      if (!data.w9Certified) e.w9Certified = "You must certify your W-9 information"
      if (!data.w9SignatureDataUrl) e.w9Signature = "W-9 signature is required"
    }

    if (step === 5) {
      if (!data.bankName.trim()) e.bankName = "Required"
      if (!data.routingNumber.trim()) {
        e.routingNumber = "Required"
      } else if (!/^\d{9}$/.test(data.routingNumber)) {
        e.routingNumber = "Enter exactly 9 digits"
      }
      if (!data.accountNumber.trim()) e.accountNumber = "Required"
      if (!data.accountType) e.accountType = "Required"
    }

    if (step === 6) {
      if (!data.idDocUrl) e.idDoc = "Government ID is required"
    }

    if (step === 7) {
      if (!data.badgePhotoUrl) e.badgePhoto = "Badge photo is required"
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }, [step, data])

  // Scroll to top of page whenever the step changes
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      // Some locked-down browser contexts can reject smooth scrolling.
      window.scrollTo(0, 0)
    }
  }, [step])

  // Determine if the current step has all required fields filled
  const isStepReady = useMemo(() => {
    if (step === 1) {
      return !!(
        data.legalName.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
        /^\d{2}\/\d{2}\/\d{4}$/.test(data.dob) &&
        isAtLeast18(data.dob) &&
        data.address.trim() &&
        data.city.trim() &&
        data.state &&
        data.zipCode.trim() &&
        /^\d{9}$/.test(data.einLast4)
      )
    }
    if (step === 2) return data.isContractRead
    if (step === 3) return !!(data.signatureDataUrl && data.isAcknowledged)
    if (step === 4) return !!(data.tinType && data.w9Certified && data.w9SignatureDataUrl)
    if (step === 5) return !!(data.bankName.trim() && /^\d{9}$/.test(data.routingNumber) && data.accountNumber.trim() && data.accountType)
    if (step === 6) return !!data.idDocUrl
    if (step === 7) return !!data.badgePhotoUrl
    return true
  }, [step, data])

  const goNext = useCallback(() => {
    if (!validateStep()) {
      setTimeout(() => {
        const el = document.querySelector('[data-error="true"]')
        if (el) {
          try {
            el.scrollIntoView({ behavior: "smooth", block: "center" })
          } catch {
            el.scrollIntoView()
          }
        }
      }, 60)
      return
    }
    setDirection(1)
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }, [validateStep])

  const goBack = useCallback(() => {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 1))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!validateStep()) return

    setIsSubmitting(true)
    try {
      let onboardingPdfUrl = ""
      try {
        onboardingPdfUrl = await uploadOnboardingPDF(data, programLabel, contractorName, effectiveDate, exhibits)
      } catch {
        // Non-fatal — continue without PDF URL
      }

      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          taxId: data.einLast4,
          effectiveDate,
          programLabel,
          contractorName,
          onboardingPdfUrl,
        }),
      })
      if (!res.ok) {
        const errorJson = await res.json().catch(() => null) as
          | { error?: string; missingFields?: string[] }
          | null
        const detailedMessage = errorJson?.missingFields?.length
          ? `Missing required fields: ${errorJson.missingFields.join(", ")}`
          : errorJson?.error || "Submission failed"
        throw new Error(detailedMessage)
      }
      const onboardResult = await res.json().catch(() => null) as { success?: boolean; agentId?: string | null } | null
      if (onboardResult?.agentId) setCompletedAgentId(onboardResult.agentId)
      setIsComplete(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again."
      setErrors({ submit: message })
    } finally {
      setIsSubmitting(false)
    }
  }, [data, effectiveDate, programLabel, contractorName, validateStep])

  // ── Completion Screen ──
  const [isDownloading, setIsDownloading] = useState(false)

  if (isComplete) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#eef2ff_42%,_#f8fafc_100%)] flex flex-col">
        <div className="border-b border-slate-800/30 bg-slate-900/95 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-4 py-4">
            <Image src="/images/stance-logo-white.png" alt="Stance Marketing" width={140} height={32} className="h-7 w-auto" />
          </div>
        </div>

        <div className="flex-1 px-4 py-8 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mx-auto max-w-5xl"
          >
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_25px_70px_-35px_rgba(15,23,42,0.35)] overflow-hidden">
              <div className="px-6 sm:px-10 pt-8 sm:pt-10 pb-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-100 mb-1">Onboarding Completed</p>
                    <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight">Welcome to Stance, {data.firstName || roleFallback}</h1>
                    <p className="mt-2 text-emerald-50/95 text-sm sm:text-base max-w-2xl">
                      Your agreement is fully executed and your onboarding package is ready.
                      Download your complete signed contract packet below.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 sm:px-10 py-7 sm:py-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-7">
                  {[
                    { title: "Contract", note: "Signed and included", tone: "bg-emerald-50 border-emerald-200 text-emerald-900" },
                    { title: "W-9", note: "Certified and signed", tone: "bg-blue-50 border-blue-200 text-blue-900" },
                    { title: "Direct Deposit", note: "Bank info on file", tone: "bg-amber-50 border-amber-200 text-amber-900" },
                    { title: "Photos", note: "ID + badge embedded", tone: "bg-violet-50 border-violet-200 text-violet-900" },
                  ].map((item) => (
                    <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
                      <p className="text-xs uppercase tracking-wider font-semibold opacity-75">Included in PDF</p>
                      <p className="text-lg font-bold mt-1">{item.title}</p>
                      <p className="text-sm mt-0.5 opacity-90">{item.note}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    disabled={isDownloading}
                    onClick={async () => {
                      setIsDownloading(true)
                      try {
                        await downloadOnboardingPDF(data, programLabel, contractorName, effectiveDate, exhibits)
                      } finally {
                        setIsDownloading(false)
                      }
                    }}
                    className="h-12 rounded-xl px-6 bg-slate-900 hover:bg-black text-white font-semibold"
                  >
                    {isDownloading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating Complete PDF…</>
                    ) : (
                      <><Download className="mr-2 h-4 w-4" />Download Full Signed Packet</>
                    )}
                  </Button>

                  <Link href="/" className="w-full sm:w-auto">
                    <Button className="h-12 w-full sm:w-auto rounded-xl px-6 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold">
                      Return Home
                    </Button>
                  </Link>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-700">
                    A copy has also been sent to <span className="font-semibold">{data.email}</span>. Your manager will follow up within 24 hours.
                  </p>
                </div>

                {/* ── Personal order link ── */}
                {completedAgentId && (
                  <div className="mt-4 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white px-5 py-5">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-blue-600 mb-1.5">Your Personal Order Link</p>
                    <h3 className="text-base font-bold text-slate-900 mb-1">Bookmark this — it&apos;s how you submit orders</h3>
                    <p className="text-sm text-slate-600 mb-3">Use this link whenever you close a sale. Your name and program are auto-filled, so submissions are quick.</p>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 mb-3">
                      <code className="flex-1 min-w-0 text-xs text-slate-700 font-mono truncate">
                        {typeof window !== "undefined" ? `${window.location.origin}/orders?a=${completedAgentId}` : `/orders?a=${completedAgentId}`}
                      </code>
                      <button
                        onClick={async () => {
                          const url = `${window.location.origin}/orders?a=${completedAgentId}`
                          await navigator.clipboard.writeText(url)
                          setCopiedOrderLink(true)
                          setTimeout(() => setCopiedOrderLink(false), 2000)
                        }}
                        className="flex-shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                      >
                        {copiedOrderLink ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/orders?a=${completedAgentId}`}>
                        <Button className="h-10 rounded-xl px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">
                          Submit Your First Order
                        </Button>
                      </Link>
                      <Link href={`/orders/history?a=${completedAgentId}`}>
                        <Button variant="outline" className="h-10 rounded-xl px-4 border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm">
                          View Order History
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Slide animation ──
  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 40 : -40, opacity: 0 }),
  }

  const isContractStep = step === 2

  // ── Landing Page ──
  if (!started) {
    return (
      <div className="min-h-screen bg-[#edf1f7] flex flex-col">
        <div className="border-b border-slate-800/30 bg-slate-900/95 shadow-lg shadow-slate-900/20">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <Image src="/images/stance-logo-white.png" alt="Stance Marketing" width={140} height={32} className="h-7 w-auto" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-lg text-center"
          >
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
              <ClipboardList className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              Welcome, {data.firstName || roleFallback}
            </h1>
            <p className="text-slate-600 text-base sm:text-lg mb-8 max-w-md mx-auto leading-relaxed">
              Complete your onboarding to finalize your {programLabel} agreement. You&apos;ll review and sign your contract, upload documents, and be ready to start.
            </p>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 mb-8 text-left shadow-xl shadow-slate-300/60">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-5">What you&apos;ll need</p>
              <div className="space-y-4">
                {[
                  { icon: ClipboardList, label: "Your legal name, address, and full 9-digit EIN/SSN", color: "text-red-500 bg-red-500/10" },
                  { icon: FileText, label: "Review and agree to the contractor agreement", color: "text-slate-600 bg-slate-100" },
                  { icon: PenTool, label: "Provide your electronic signature", color: "text-slate-600 bg-slate-100" },
                  { icon: FileText, label: "Complete your W-9 tax certification", color: "text-slate-600 bg-slate-100" },
                  { icon: Landmark, label: "Bank details for direct deposit setup", color: "text-slate-600 bg-slate-100" },
                  { icon: Upload, label: "Government-issued ID (front side)", color: "text-slate-600 bg-slate-100" },
                  { icon: Camera, label: "Professional headshot for your badge", color: "text-slate-600 bg-slate-100" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${item.color}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className="text-base text-slate-800 font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setStarted(true)}
              className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl px-10 h-12 shadow-lg shadow-red-500/30 transition-all"
            >
              Begin Onboarding
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-slate-500 text-sm mt-4">Takes about 5–10 minutes</p>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isContractStep ? "h-[100dvh] overflow-hidden" : "min-h-screen"} bg-[#edf1f7] flex flex-col`}>
      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-40 border-b border-slate-800/30 bg-slate-900/95 backdrop-blur-xl shadow-lg shadow-slate-900/20">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <Image src="/images/stance-logo-white.png" alt="Stance Marketing" width={120} height={28} className="h-6 w-auto" />
              <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-0.5 text-[11px] font-semibold tracking-[0.25em] text-slate-200 uppercase">
                Onboarding
              </span>
            </div>
            <p className="text-sm font-medium text-slate-200">
              Step {step} <span className="text-slate-400">/ {TOTAL_STEPS}</span>
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-red-500"
              initial={false}
              animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>

      {/* ── Step Content ── */}
      {isContractStep ? (
        /* Contract step — full-width, fill remaining viewport height */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Instruction header */}
          <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 pt-3 pb-2 shrink-0">
            <p className="text-xs text-red-500 uppercase tracking-widest font-semibold mb-0.5">
              Step 2 of {TOTAL_STEPS} — Contract Review
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Review Your Agreement</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Read the full agreement below, then check the acknowledgment box at the bottom to continue.
            </p>
          </div>
          {/* Contract card — fills remaining space */}
          <div className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-3 sm:px-4 pb-2 flex flex-col">
            <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-300/60 overflow-hidden flex flex-col">
            <ContractViewer
              contractorName={contractorName}
              contractorAddress={data.address}
              contractorCity={data.city}
              contractorState={data.state}
              contractorZip={data.zipCode}
              contractorPhone={data.phone}
              contractorEmail={data.email}
              contractorEin={data.einLast4}
              contractorEntity={data.entityType}
              contractorDba={data.dbaName}
              programLabel={programLabel}
              effectiveDate={effectiveDate}
              onReadComplete={() => {}}
              onAcknowledgeChange={(checked) => updateField("isContractRead", checked)}
              isReadComplete={data.isContractRead}
              exhibits={exhibits}
              leadsProvided={leadsProvided}
            />
            </div>
          </div>
          {errors.contract && (
            <div data-error="true" className="mx-auto w-full max-w-5xl px-3 sm:px-4 mt-1">
              <p className="border border-red-200 bg-red-50 rounded-xl px-4 py-2.5 text-red-600 text-sm font-medium flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {errors.contract}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 mx-auto w-full max-w-3xl px-4 pt-6 sm:pt-10 pb-28 sm:pb-10">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-300/60">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {step === 1 && (
                  <StepDetails data={data} errors={errors} onChange={updateField} />
                )}
                {step === 3 && (
                  <StepSignature data={data} errors={errors} onChange={updateField} />
                )}
                {step === 4 && (
                  <StepW9 data={data} errors={errors} onChange={updateField} effectiveDate={effectiveDate} />
                )}
                {step === 5 && (
                  <StepDirectDeposit data={data} errors={errors} onChange={updateField} />
                )}
                {step === 6 && (
                  <StepIdUpload data={data} errors={errors} onChange={updateField} />
                )}
                {step === 7 && (
                  <StepBadgePhoto data={data} errors={errors} onChange={updateField} />
                )}
                {step === 8 && (
                  <StepReview
                    data={data}
                    programLabel={programLabel}
                    contractorName={contractorName}
                    effectiveDate={effectiveDate}
                    exhibits={exhibits}
                    leadsProvided={leadsProvided}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <div className={`z-50 border-t border-slate-900/40 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-slate-900/30 shrink-0 ${isContractStep ? "sticky bottom-0" : "fixed sm:sticky bottom-0 left-0 right-0"}`}>
        <div className={`mx-auto ${isContractStep ? "max-w-5xl" : "max-w-3xl"} px-4 py-4 flex items-center justify-between gap-3`}>
          {step > 1 ? (
            <Button
              variant="ghost"
              onClick={goBack}
              className="text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl px-5 h-11"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {errors.submit && (
            <p className="text-red-400 text-sm font-medium border border-red-500/30 bg-red-500/10 px-3 py-1.5 rounded-lg">{errors.submit}</p>
          )}

          {step < TOTAL_STEPS ? (
            <Button
              onClick={goNext}
              disabled={step === 2 && !data.isContractRead}
              className={`flex-1 sm:flex-none font-semibold rounded-xl px-8 h-11 shadow-lg transition-all disabled:opacity-50 text-white ${
                isStepReady
                  ? "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/40"
                  : "bg-red-500 hover:bg-red-400 shadow-red-500/40"
              }`}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl px-8 h-11 shadow-lg shadow-emerald-500/40 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting</>
              ) : (
                <><Check className="mr-2 h-4 w-4" />Complete Onboarding</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Contractor Details ──

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div data-error={error ? "true" : undefined}>
      <Label className="text-base text-slate-700 mb-2 block font-semibold">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1.5 font-medium">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

function StepDetails({
  data,
  errors,
  onChange,
}: {
  data: OnboardingData
  errors: Record<string, string>
  onChange: (name: string, value: string | boolean) => void
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-red-500 uppercase tracking-widest mb-1 font-semibold">
          Step 1 of {TOTAL_STEPS}
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
          Contractor Details
        </h2>
        <p className="text-base text-slate-600">
          Enter your legal name as it should appear on the contract.
        </p>
      </div>

      <div className="space-y-5">
        <FormField label="Legal full name" required error={errors.legalName}>
          <Input
            value={data.legalName}
            onChange={(e) => onChange("legalName", e.target.value)}
            placeholder={data.legalName || `${data.firstName} ${data.lastName}`.trim() || "Your full legal name"}
            className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
          />
        </FormField>

        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Email address" required error={errors.email}>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="your@email.com"
              className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
            />
          </FormField>
          <FormField label="Phone number" error={errors.phone}>
            <Input
              type="tel"
              value={data.phone}
              onChange={(e) => onChange("phone", formatPhone(e.target.value))}
              placeholder="(555) 555-5555"
              className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
            />
          </FormField>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Business / DBA name">
            <Input
              value={data.dbaName}
              onChange={(e) => onChange("dbaName", e.target.value)}
              placeholder="If applicable"
              className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
            />
          </FormField>
          <FormField label="Entity type">
            <div className="relative">
              <select
                value={data.entityType}
                onChange={(e) => onChange("entityType", e.target.value)}
                className="w-full h-12 bg-white border border-slate-300 text-slate-900 rounded-xl px-4 pr-12 text-base appearance-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              >
                <option value="">Select if applicable</option>
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            </div>
          </FormField>
        </div>

        <FormField label="Street address" required error={errors.address}>
          <Input
            value={data.address}
            onChange={(e) => onChange("address", e.target.value)}
            placeholder="123 Main Street"
            className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
          />
        </FormField>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <FormField label="City" required error={errors.city}>
            <Input
              value={data.city}
              onChange={(e) => onChange("city", e.target.value)}
              placeholder="City"
              className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
            />
          </FormField>
          <FormField label="State" required error={errors.state}>
            <div className="relative">
              <select
                value={data.state}
                onChange={(e) => onChange("state", e.target.value)}
                className="w-full h-12 bg-white border border-slate-300 text-slate-900 rounded-xl px-4 pr-12 text-base appearance-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              >
                <option value="">State</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            </div>
          </FormField>
          <FormField label="ZIP code" required error={errors.zipCode}>
            <Input
              value={data.zipCode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 5)
                onChange("zipCode", v)
              }}
              placeholder="ZIP"
              inputMode="numeric"
              className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
            />
          </FormField>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Date of birth" required error={errors.dob}>
            <Input
              value={data.dob}
              onChange={(e) => onChange("dob", formatDob(e.target.value))}
              placeholder="MM/DD/YYYY"
              inputMode="numeric"
              maxLength={10}
              className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
            />
          </FormField>
          <FormField label="EIN or SSN (9 digits)" required error={errors.einLast4}>
            <Input
              value={data.einLast4}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 9)
                onChange("einLast4", v)
              }}
              placeholder="9 digits"
              maxLength={9}
              inputMode="numeric"
              className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
            />
          </FormField>
        </div>

        <div className="border border-slate-200 bg-slate-50 p-4 mt-5 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-600 leading-relaxed">
              Your information is handled confidentially and used solely for
              contractor onboarding, identity verification, and tax compliance
              as described in the agreement.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Signature ──

function StepSignature({
  data,
  errors,
  onChange,
}: {
  data: OnboardingData
  errors: Record<string, string>
  onChange: (name: string, value: string | boolean) => void
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-red-500 uppercase tracking-widest mb-1 font-semibold">
          Step 3 of {TOTAL_STEPS}
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
          Sign your agreement
        </h2>
        <p className="text-base text-slate-600">
          Draw or type your legal name to apply your electronic signature.
        </p>
      </div>

      {errors.signature && (
        <div data-error="true" className="mb-4 border border-red-200 bg-red-50 rounded-xl px-4 py-2.5">
          <p className="text-red-600 text-sm font-medium flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {errors.signature}
          </p>
        </div>
      )}
      {errors.acknowledge && (
        <div data-error="true" className="mb-4 border border-red-200 bg-red-50 rounded-xl px-4 py-2.5">
          <p className="text-red-600 text-sm font-medium flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {errors.acknowledge}
          </p>
        </div>
      )}

      <SignaturePad
        contractorName={data.legalName || `${data.firstName} ${data.lastName}`.trim()}
        onSignatureComplete={(url) => onChange("signatureDataUrl", url)}
        onAcknowledge={(v) => onChange("isAcknowledged", v)}
        isAcknowledged={data.isAcknowledged}
        signatureDataUrl={data.signatureDataUrl}
      />
    </div>
  )
}

// ── Step 6: ID Upload ──

function StepIdUpload({
  data,
  errors,
  onChange,
}: {
  data: OnboardingData
  errors: Record<string, string>
  onChange: (name: string, value: string) => void
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-red-500 uppercase tracking-widest mb-1 font-semibold">
          Step 6 of {TOTAL_STEPS}
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
          Government-issued ID
        </h2>
        <p className="text-base text-slate-600">
          Upload a clear photo of the front of your driver&apos;s license or government-issued ID.
        </p>
      </div>

      {errors.idDoc && (
        <div data-error="true" className="mb-4 border border-red-200 bg-red-50 rounded-xl px-4 py-2.5">
          <p className="text-red-600 text-sm font-medium flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {errors.idDoc}
          </p>
        </div>
      )}

      <FileUpload
        label="Government ID"
        description="Front side only. Must be valid and not expired."
        onFileUploaded={(url, name) => {
          onChange("idDocUrl", url)
          onChange("idDocName", name)
        }}
        uploadedUrl={data.idDocUrl}
        uploadedName={data.idDocName}
      />

      <div className="border border-slate-200 bg-slate-50 p-4 mt-6 rounded-xl">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-slate-600 leading-relaxed">
            Your ID is stored securely with encryption at rest and is used
            exclusively for identity verification, credentialing, and compliance
            as described in Section 10 of your agreement.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Step 7: Badge Photo ──

function StepBadgePhoto({
  data,
  errors,
  onChange,
}: {
  data: OnboardingData
  errors: Record<string, string>
  onChange: (name: string, value: string) => void
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-red-500 uppercase tracking-widest mb-1 font-semibold">
          Step 7 of {TOTAL_STEPS}
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
          Upload your photo
        </h2>
        <p className="text-base text-slate-600">
          A clear, professional headshot for your identification badge.
        </p>
      </div>

      {errors.badgePhoto && (
        <div data-error="true" className="mb-4 border border-red-200 bg-red-50 rounded-xl px-4 py-2.5">
          <p className="text-red-600 text-sm font-medium flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {errors.badgePhoto}
          </p>
        </div>
      )}

      <FileUpload
        label="Badge Photo"
        description="Professional headshot. Clear, well-lit, front-facing."
        accept="image/*"
        onFileUploaded={(url, name) => {
          onChange("badgePhotoUrl", url)
          onChange("badgePhotoName", name)
        }}
        uploadedUrl={data.badgePhotoUrl}
        uploadedName={data.badgePhotoName}
      />

      <div className="mt-6 border border-slate-200 bg-slate-50 p-5 rounded-2xl">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Photo Guidelines
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-green-700 text-sm mb-2 font-semibold">Recommended</p>
            <ul className="text-slate-600 space-y-1.5 text-sm">
              <li>Front-facing, centered</li>
              <li>Even lighting, no shadows</li>
              <li>Solid or neutral background</li>
              <li>Professional appearance</li>
            </ul>
          </div>
          <div>
            <p className="text-red-600 text-sm mb-2 font-semibold">Avoid</p>
            <ul className="text-slate-600 space-y-1.5 text-sm">
              <li>Sunglasses or hats</li>
              <li>Group photos or cropped images</li>
              <li>Blurry or low-resolution</li>
              <li>Filters or heavy editing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 8: Review ──

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-base text-slate-900 font-semibold">{value}</span>
    </div>
  )
}

function ReviewSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-[0.2em]">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  )
}

function StepReview({
  data,
  programLabel,
  contractorName,
  effectiveDate,
  exhibits,
  leadsProvided,
}: {
  data: OnboardingData
  programLabel: string
  contractorName: string
  effectiveDate: string
  exhibits?: CompensationExhibit[]
  leadsProvided?: boolean
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-red-500 uppercase tracking-widest mb-1 font-semibold">
          Step 8 of {TOTAL_STEPS}
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
          Review and complete
        </h2>
        <p className="text-base text-slate-600">
          Confirm everything is correct before finalizing.
        </p>
      </div>

      <div className="space-y-4">
        <ReviewSection title="Contractor Details">
          <ReviewRow label="Legal name" value={contractorName} />
          {data.dbaName && <ReviewRow label="DBA" value={data.dbaName} />}
          {data.entityType && <ReviewRow label="Entity type" value={data.entityType} />}
          <ReviewRow label="Address" value={`${data.address}, ${data.city}, ${data.state} ${data.zipCode}`} />
          <ReviewRow label="Email" value={data.email} />
          <ReviewRow label="Phone" value={data.phone} />
          <ReviewRow
            label="EIN/SSN"
            value={
              data.einLast4
                ? data.tinType === "ssn"
                  ? data.einLast4.replace(/^(\d{3})(\d{2})(\d{4})$/, "$1-$2-$3")
                  : data.einLast4.replace(/^(\d{2})(\d{7})$/, "$1-$2")
                : "N/A"
            }
          />
        </ReviewSection>

        <ReviewSection title="W-9 Tax Information">
          <ReviewRow
            label="TIN type"
            value={data.tinType === "ssn" ? "Social Security Number (SSN)" : data.tinType === "ein" ? "Employer ID Number (EIN)" : "—"}
          />
          <ReviewRow label="W-9 Certification" value={data.w9Certified ? "Certified ✓" : "Not certified"} />
          {data.exemptPayeeCode ? <ReviewRow label="Exempt payee code" value={data.exemptPayeeCode} /> : null}
        </ReviewSection>

        <ReviewSection title="Direct Deposit">
          <ReviewRow label="Bank name" value={data.bankName || "—"} />
          <ReviewRow label="Routing number" value={data.routingNumber ? "••••" + data.routingNumber.slice(-4) : "—"} />
          <ReviewRow label="Account number" value={data.accountNumber ? "••••" + data.accountNumber.slice(-4) : "—"} />
          <ReviewRow label="Account type" value={data.accountType ? data.accountType.charAt(0).toUpperCase() + data.accountType.slice(1) : "—"} />
        </ReviewSection>

        <ReviewSection title="Agreement">
          <ReviewRow label="Program" value={programLabel} />
          <ReviewRow label="Effective date" value={effectiveDate} />
          <ReviewRow label="Agreement reviewed" value={data.isContractRead ? "Yes" : "No"} />
          <ReviewRow label="Signature" value={data.signatureDataUrl ? "Provided" : "Missing"} />
          <ReviewRow label="Acknowledgment" value={data.isAcknowledged ? "Accepted" : "Pending"} />
          {exhibits && exhibits.length > 0 && (
            <ReviewRow
              label="Compensation exhibits"
              value={exhibits.map((e) => e.name).join("; ")}
            />
          )}
        </ReviewSection>

        {exhibits && exhibits.length > 0 && (
          <div className="space-y-3">
            {exhibits.map((exhibit) => {
              const reduced = (n: number) => Math.round(n * 0.5 * 100) / 100
              const fmtAmt = (n: number) => n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`
              return (
                <div key={exhibit.id} className="border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3 bg-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{exhibit.provider}</h3>
                    {leadsProvided && (
                      <span className="text-[10px] font-bold tracking-wider uppercase bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-0.5 rounded-full">
                        Two-rate schedule
                      </span>
                    )}
                  </div>
                  <div>
                    {leadsProvided ? (
                      <>
                        <div className="grid grid-cols-[1fr_auto_auto]">
                          <div className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase bg-slate-100 border-b border-slate-200">Service</div>
                          <div className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase text-right bg-slate-100 border-b border-slate-200">Self-Sourced</div>
                          <div className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] text-orange-500 uppercase text-right bg-slate-100 border-b border-slate-200">Co. Lead (−50%)</div>
                          {exhibit.payStructure.map((row, i) => {
                            const cellBg = i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                            return (
                              <React.Fragment key={i}>
                                <div className={`px-4 py-2.5 text-sm text-slate-700 font-medium ${cellBg}`}>{row.service}</div>
                                <div className={`px-4 py-2.5 text-sm font-bold text-emerald-700 tabular-nums text-right ${cellBg}`}>{fmtAmt(row.amount)}</div>
                                <div className={`px-4 py-2.5 text-sm font-bold text-orange-600 tabular-nums text-right ${cellBg}`}>{fmtAmt(reduced(row.amount))}</div>
                              </React.Fragment>
                            )
                          })}
                        </div>
                        <div className="px-4 py-2.5 bg-orange-50 border-t border-orange-100">
                          <p className="text-[11px] text-orange-700 leading-relaxed">
                            Company lead rate is 50% less than self-sourced rate. Applies to all company-provided leads as set forth in the agreement.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-[1fr_auto] border-b border-slate-100 bg-slate-50">
                          <div className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase">Service</div>
                          <div className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase text-right">Your Payout</div>
                        </div>
                        {exhibit.payStructure.map((row, i) => (
                          <div key={i} className={`grid grid-cols-[1fr_auto] items-center border-b border-slate-50 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                            <div className="px-4 py-2.5 text-sm text-slate-700 font-medium">{row.service}</div>
                            <div className="px-4 py-2.5 text-sm font-bold text-emerald-700 tabular-nums text-right">{fmtAmt(row.amount)}</div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <ReviewSection title="Documents">
          <ReviewRow label="Government ID" value={data.idDocName || "Not uploaded"} />
          <ReviewRow label="Badge photo" value={data.badgePhotoName || "Not uploaded"} />
        </ReviewSection>

        {data.signatureDataUrl && (
          <div className="border border-slate-200 bg-slate-50 p-5 rounded-2xl">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Your Signature
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.signatureDataUrl}
              alt="Signature"
              className="max-h-16 w-auto"
            />
          </div>
        )}

        <p className="text-slate-500 text-sm pt-2">
          By completing onboarding, your electronic signature is applied to the
          Independent Contractor Agreement with Stance Marketing LLC, effective{" "}
          {effectiveDate}. A signed copy will be emailed to you.
        </p>
      </div>
    </div>
  )
}

// ── Step 4: W-9 Tax Information ──

// Lightweight inline signature capture for W-9 (independent of contract signature)
function W9SignaturePad({
  contractorName,
  signatureDataUrl,
  onSignatureComplete,
}: {
  contractorName: string
  signatureDataUrl: string
  onSignatureComplete: (url: string) => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = React.useState(false)
  const [hasDrawn, setHasDrawn] = React.useState(false)
  const hasDrawnRef = React.useRef(false)
  const [typedName, setTypedName] = React.useState("")
  const [mode, setMode] = React.useState<"draw" | "type">("draw")
  const lastPos = React.useRef<{ x: number; y: number } | null>(null)

  const setupCanvas = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const dpr = window.devicePixelRatio || 1
    const rect = parent.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    const ctx = canvas.getContext("2d")
    if (ctx) { ctx.scale(dpr, dpr); ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round" }
  }, [])

  React.useEffect(() => {
    setupCanvas()
    window.addEventListener("resize", setupCanvas)
    return () => window.removeEventListener("resize", setupCanvas)
  }, [setupCanvas])

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => { e.preventDefault(); setIsDrawing(true); lastPos.current = getPos(e) }
  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing || !lastPos.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
    if (!hasDrawnRef.current) { hasDrawnRef.current = true; setHasDrawn(true) }
  }
  const endDraw = () => {
    setIsDrawing(false); lastPos.current = null
    if (hasDrawnRef.current && canvasRef.current) onSignatureComplete(canvasRef.current.toDataURL("image/png"))
  }
  const clearCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawnRef.current = false; setHasDrawn(false); onSignatureComplete("")
  }
  const generateTyped = React.useCallback((name: string) => {
    if (!name.trim()) { onSignatureComplete(""); return }
    const canvas = document.createElement("canvas"); const dpr = window.devicePixelRatio || 1
    canvas.width = 600 * dpr; canvas.height = 120 * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr); ctx.fillStyle = "#1f2937"; ctx.font = "italic 42px 'Georgia', 'Times New Roman', serif"
    ctx.textBaseline = "middle"; ctx.fillText(name, 16, 60)
    onSignatureComplete(canvas.toDataURL("image/png"))
  }, [onSignatureComplete])

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["draw", "type"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
              mode === m ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >{m === "draw" ? "Draw" : "Type"}</button>
        ))}
      </div>

      {mode === "draw" && (
        <>
          <div className="relative border-2 border-slate-300 bg-white rounded-xl overflow-hidden" style={{ height: "140px" }}>
            <div className="absolute bottom-10 left-6 right-6 border-b border-slate-300" />
            <p className="absolute bottom-3 left-6 text-xs text-slate-400">Sign above this line</p>
            <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair touch-none"
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-slate-400 text-sm">Draw your signature here</p>
              </div>
            )}
          </div>
          {hasDrawn && (
            <button type="button" onClick={clearCanvas} className="mt-2 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Clear
            </button>
          )}
        </>
      )}

      {mode === "type" && (
        <div className="space-y-3">
          <Input
            value={typedName}
            onChange={(e) => { setTypedName(e.target.value); generateTyped(e.target.value) }}
            placeholder={contractorName || "Type your full legal name"}
            className="bg-white border border-slate-300 text-slate-900 h-11 rounded-xl text-base focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
          {typedName && (
            <div className="border border-slate-200 bg-slate-50 px-4 py-3 rounded-xl min-h-[56px] flex items-center">
              <p className="text-slate-900 text-3xl italic" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{typedName}</p>
            </div>
          )}
        </div>
      )}

      {signatureDataUrl && mode === "draw" && !hasDrawn && (
        <div className="mt-3 border border-slate-200 bg-slate-50 p-3 rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signatureDataUrl} alt="W-9 signature" className="max-h-10 w-auto" />
        </div>
      )}
    </div>
  )
}

function formatTin(tin: string, type: "ssn" | "ein" | ""): string {
  if (!tin || tin.length !== 9) return tin
  if (type === "ssn") return `${tin.slice(0, 3)}-${tin.slice(3, 5)}-${tin.slice(5)}`
  if (type === "ein") return `${tin.slice(0, 2)}-${tin.slice(2)}`
  return tin
}

function StepW9({
  data,
  errors,
  onChange,
  effectiveDate,
}: {
  data: OnboardingData
  errors: Record<string, string>
  onChange: (name: string, value: string | boolean) => void
  effectiveDate: string
}) {
  const fullName = data.legalName || `${data.firstName} ${data.lastName}`.trim()

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-red-500 uppercase tracking-widest mb-1 font-semibold">
          Step 4 of {TOTAL_STEPS}
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">W-9 Tax Information</h2>
        <p className="text-base text-slate-600">
          Complete your W-9 for tax reporting. Your details have been pre-filled from Step 1.
        </p>
      </div>

      {errors.w9Signature && (
        <div data-error="true" className="mb-4 border border-red-200 bg-red-50 rounded-xl px-4 py-2.5">
          <p className="text-red-600 text-sm font-medium flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {errors.w9Signature}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Pre-filled info confirmation */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">Pre-filled from your details</p>
            <span className="text-xs text-slate-400">Tap Back to edit</span>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-sm text-slate-500">Name on tax return</span>
              <span className="text-sm font-semibold text-slate-900">{fullName || "—"}</span>
            </div>
            {data.dbaName && (
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-sm text-slate-500">Business / DBA name</span>
                <span className="text-sm font-semibold text-slate-900">{data.dbaName}</span>
              </div>
            )}
            {data.entityType && (
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-sm text-slate-500">Federal tax classification</span>
                <span className="text-sm font-semibold text-slate-900">{data.entityType}</span>
              </div>
            )}
            <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-sm text-slate-500">Address</span>
              <span className="text-sm font-semibold text-slate-900 sm:text-right">
                {[data.address, data.city, data.state, data.zipCode].filter(Boolean).join(", ")}
              </span>
            </div>
          </div>
        </div>

        {/* TIN type selection */}
        <FormField label="Taxpayer Identification Number (TIN) type" required error={errors.tinType}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            {(["ssn", "ein"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange("tinType", type)}
                className={`h-16 rounded-xl border-2 text-sm font-semibold transition-all px-4 text-left flex flex-col justify-center ${
                  data.tinType === type
                    ? "border-green-500 bg-green-50 text-green-800 shadow-md shadow-green-100"
                    : errors.tinType
                    ? "border-red-200 bg-white text-slate-700 hover:border-red-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="block">{type === "ssn" ? "Social Security Number" : "Employer ID Number"}</span>
                <span className="block text-xs font-normal mt-1 text-current/70">{type === "ssn" ? "For individuals & sole proprietors" : "For LLCs, corporations & partnerships"}</span>
              </button>
            ))}
          </div>
        </FormField>

        {/* TIN masked display */}
        {data.tinType && data.einLast4 && (
          <div className="border border-slate-200 bg-slate-50 rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">
                Your {data.tinType === "ssn" ? "SSN" : "EIN"}
              </p>
              <p className="text-lg font-mono font-bold text-slate-900 tracking-widest">
                {formatTin(data.einLast4, data.tinType)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Shield className="h-4 w-4" />
              <span className="text-xs">Encrypted</span>
            </div>
          </div>
        )}

        {/* Exempt payee code */}
        <FormField label="Exempt payee code (if applicable)">
          <Input
            value={data.exemptPayeeCode}
            onChange={(e) => onChange("exemptPayeeCode", e.target.value)}
            placeholder="Leave blank if not applicable"
            className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400 max-w-xs"
          />
          <p className="text-xs text-slate-400 mt-1.5">Most individual contractors leave this blank.</p>
        </FormField>

        {/* W-9 Certification — prominent, amber when unchecked, green when checked */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onChange("w9Certified", !data.w9Certified)}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onChange("w9Certified", !data.w9Certified) }}
          data-error={errors.w9Certified ? "true" : undefined}
          className={`border-2 rounded-2xl p-5 cursor-pointer transition-all ${
            errors.w9Certified
              ? "border-red-400 bg-red-50 ring-2 ring-red-100"
              : data.w9Certified
              ? "border-green-400 bg-green-50"
              : "border-amber-300 bg-amber-50 hover:border-amber-400"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 flex-shrink-0 h-6 w-6 rounded border-2 flex items-center justify-center transition-all ${
              data.w9Certified ? "bg-green-500 border-green-500" : errors.w9Certified ? "bg-white border-red-400" : "bg-white border-amber-400"
            }`}>
              {data.w9Certified && <Check className="h-4 w-4 text-white" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <p className={`text-sm font-bold ${
                  data.w9Certified ? "text-green-800" : errors.w9Certified ? "text-red-700" : "text-amber-900"
                }`}>W-9 Certification</p>
                {!data.w9Certified && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    errors.w9Certified ? "bg-red-100 text-red-700" : "bg-amber-200 text-amber-800"
                  }`}>Required</span>
                )}
                {data.w9Certified && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-200 text-green-800">Certified ✓</span>
                )}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Under penalties of perjury, I certify that: (1) the number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); (2) I am not subject to backup withholding; and (3) I am a U.S. citizen or other U.S. person.
              </p>
            </div>
          </div>
          {errors.w9Certified && (
            <p className="text-red-600 text-xs mt-2 ml-10 flex items-center gap-1.5 font-medium">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {errors.w9Certified}
            </p>
          )}
        </div>

        {/* W-9 Signature + Auto Date — independent of the contract signature */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">W-9 Signature &amp; Date</p>
            <p className="text-xs text-slate-400 mt-0.5">Sign here to certify your W-9 tax information. This is separate from your contract signature.</p>
          </div>
          <div className="p-5">
            <W9SignaturePad
              contractorName={data.legalName || `${data.firstName} ${data.lastName}`.trim()}
              signatureDataUrl={data.w9SignatureDataUrl}
              onSignatureComplete={(url: string) => onChange("w9SignatureDataUrl", url)}
            />
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Date</p>
                <p className="text-base font-semibold text-slate-900">
                  {effectiveDate}
                </p>
              </div>
              {data.w9SignatureDataUrl && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700">Signed ✓</span>
              )}
            </div>
          </div>
        </div>

        {/* Reference PDF link — official IRS document */}
        <a
          href="https://www.irs.gov/pub/irs-pdf/fw9.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm transition-colors"
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span>View official IRS W-9 form PDF for reference</span>
        </a>
      </div>
    </div>
  )
}

// ── Step 5: Direct Deposit ──

function StepDirectDeposit({
  data,
  errors,
  onChange,
}: {
  data: OnboardingData
  errors: Record<string, string>
  onChange: (name: string, value: string | boolean) => void
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-red-500 uppercase tracking-widest mb-1 font-semibold">
          Step 5 of {TOTAL_STEPS}
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
          Direct Deposit Information
        </h2>
        <p className="text-base text-slate-600">
          Enter your bank details for commission payments via direct deposit.
        </p>
      </div>

      <div className="space-y-5">
        <FormField label="Bank name" required error={errors.bankName}>
          <Input
            data-testid="bank-name-input"
            value={data.bankName}
            onChange={(e) => onChange("bankName", e.target.value)}
            placeholder="e.g. Chase, Bank of America"
            className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
          />
        </FormField>

        <FormField label="Routing number (9 digits)" required error={errors.routingNumber}>
          <Input
            data-testid="routing-number-input"
            value={data.routingNumber}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 9)
              onChange("routingNumber", v)
            }}
            placeholder="9-digit routing number"
            maxLength={9}
            inputMode="numeric"
            className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
          />
        </FormField>

        <FormField label="Account number" required error={errors.accountNumber}>
          <Input
            data-testid="account-number-input"
            value={data.accountNumber}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 17)
              onChange("accountNumber", v)
            }}
            placeholder="Account number"
            inputMode="numeric"
            className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
          />
        </FormField>

        <FormField label="Account type" required error={errors.accountType}>
          <div className="grid grid-cols-2 gap-3 mt-1">
            {(["checking", "savings"] as const).map((type) => (
              <button
                key={type}
                type="button"
                data-testid={`account-type-${type}`}
                onClick={() => onChange("accountType", type)}
                className={`h-14 rounded-xl border-2 text-sm font-semibold transition-all ${
                  data.accountType === type
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {type === "checking" ? "Checking" : "Savings"}
              </button>
            ))}
          </div>
        </FormField>

        <div className="border border-slate-200 bg-slate-50 p-4 mt-5 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-600 leading-relaxed">
              Your banking information is encrypted and used exclusively for
              commission payments. It will never be shared with third parties.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Download helpers ──

async function buildOnboardingPDF(
  data: OnboardingData,
  programLabel: string,
  contractorName: string,
  effectiveDate: string,
  exhibits?: CompensationExhibit[],
) {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentW = pageW - margin * 2
  let y = margin

  const companyAddress = "6871 Lakota Plaza Dr. Ste. 11, West Chester, OH 45069"
  const tinFormatted = data.einLast4
    ? data.tinType === "ssn"
      ? data.einLast4.replace(/^(\d{3})(\d{2})(\d{4})$/, "$1-$2-$3")
      : data.einLast4.replace(/^(\d{2})(\d{7})$/, "$1-$2")
    : "—"

  // Brand accent
  const RED = "#ef4444"
  const RUNNING_H = 13   // running header height on pages 2+
  let rowParity = 0

  const addPage = () => {
    doc.addPage()
    rowParity = 0
    // Dark running header band
    doc.setFillColor("#0f172a")
    doc.rect(0, 0, pageW, RUNNING_H, "F")
    doc.setFillColor(RED)
    doc.rect(0, RUNNING_H, pageW, 0.7, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor("#ffffff")
    doc.text("STANCE MARKETING LLC", margin, RUNNING_H - 4)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor("#94a3b8")
    doc.text("Independent Contractor Agreement — Confidential", pageW - margin, RUNNING_H - 4, { align: "right" })
    doc.setFont("helvetica", "normal")
    doc.setTextColor("#0f172a")
    y = RUNNING_H + 8
  }
  const checkPageBreak = (needed = 10) => {
    if (y + needed > pageH - 16) addPage()  // leave room for footer
  }
  const line = (x1: number, y1: number, x2: number, y2: number, color = "#e2e8f0") => {
    doc.setDrawColor(color)
    doc.line(x1, y1, x2, y2)
  }
  const text = (
    str: string,
    x: number,
    ty: number,
    options?: { align?: "left" | "center" | "right"; color?: string; size?: number; bold?: boolean },
  ) => {
    if (options?.color) doc.setTextColor(options.color)
    if (options?.size) doc.setFontSize(options.size)
    doc.setFont("helvetica", options?.bold ? "bold" : "normal")
    doc.text(str, x, ty, { align: options?.align || "left" })
    doc.setTextColor("#0f172a")
    doc.setFont("helvetica", "normal")
  }
  const sectionHeader = (title: string) => {
    checkPageBreak(16)
    doc.setFillColor("#fff1f2")
    doc.rect(margin, y, contentW, 10, "F")
    doc.setFillColor(RED)
    doc.rect(margin, y, 3.5, 10, "F")
    text(title, margin + 7, y + 7, { size: 9, bold: true, color: "#0f172a" })
    y += 14
    rowParity = 0
  }
  const row = (label: string, value: string) => {
    const rowH = 9
    checkPageBreak(rowH + 1)
    doc.setFillColor(rowParity % 2 === 0 ? "#f8fafc" : "#ffffff")
    doc.rect(margin, y, contentW, rowH, "F")
    text(label, margin + 4, y + 6, { size: 8.5, color: "#64748b" })
    text(value || "—", pageW - margin - 4, y + 6, { align: "right", size: 8.5, bold: true, color: "#0f172a" })
    doc.setDrawColor("#e9edf2")
    doc.line(margin, y + rowH, pageW - margin, y + rowH)
    rowParity++
    y += rowH
  }
  const paragraph = (value: string, size = 9, color = "#334155") => {
    const lines = doc.splitTextToSize(value, contentW)
    for (const ln of lines) {
      checkPageBreak(5.5)
      text(ln, margin, y, { size, color })
      y += 4.8
    }
  }
  const loadImageAsDataUrl = async (src: string): Promise<string | null> => {
    try {
      const res = await fetch(src)
      if (!res.ok) return null
      const blob = await res.blob()
      return await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }
  const createCompanySignatureDataUrl = (): string => {
    const canvas = document.createElement("canvas")
    canvas.width = 520
    canvas.height = 120
    const ctx = canvas.getContext("2d")
    if (!ctx) return ""
    ctx.fillStyle = "#0f172a"
    ctx.font = "italic 56px Georgia"
    ctx.fillText("Ron Rice", 10, 72)
    return canvas.toDataURL("image/png")
  }

  // Try to load white logo for cover
  let logoDataUrl: string | null = null
  try {
    const logoRes = await fetch("/images/stance-logo-white.png")
    if (logoRes.ok) {
      const logoBlb = await logoRes.blob()
      logoDataUrl = await new Promise<string | null>((resolve) => {
        const rdr = new FileReader()
        rdr.onloadend = () => resolve(typeof rdr.result === "string" ? rdr.result : null)
        rdr.readAsDataURL(logoBlb)
      })
    }
  } catch { /* proceed without logo */ }

  // ── Cover Page ────────────────────────────────────────────────────────────
  const coverH = 46
  doc.setFillColor("#0f172a")
  doc.rect(0, 0, pageW, coverH, "F")
  doc.setFillColor(RED)
  doc.rect(0, coverH, pageW, 1.5, "F")
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", margin, coverH / 2 - 6, 52, 13, "", "FAST") }
    catch { text("STANCE MARKETING LLC", margin, coverH / 2 + 3, { size: 13, bold: true, color: "#ffffff" }) }
  } else {
    text("STANCE MARKETING LLC", margin, coverH / 2 + 3, { size: 13, bold: true, color: "#ffffff" })
  }
  text("EXECUTED CONTRACT PACKET", pageW - margin, coverH / 2 - 4, { align: "right", size: 7.5, bold: true, color: RED })
  text("Independent Contractor Agreement", pageW - margin, coverH / 2 + 4, { align: "right", size: 8, color: "#cbd5e1" })

  y = coverH + 14
  text("INDEPENDENT CONTRACTOR AGREEMENT", margin, y, { size: 18, bold: true, color: "#0f172a" })
  y += 5
  doc.setFillColor(RED)
  doc.rect(margin, y, 28, 1.5, "F")
  y += 9

  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor("#94a3b8")
  doc.text("PROGRAM", margin, y)
  doc.setFont("helvetica", "normal"); doc.setTextColor("#334155")
  doc.text(programLabel, margin + 22, y)
  y += 5.5
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor("#94a3b8")
  doc.text("EFFECTIVE DATE", margin, y)
  doc.setFont("helvetica", "normal"); doc.setTextColor("#334155")
  doc.text(effectiveDate, margin + 35, y)
  doc.setFont("helvetica", "normal"); doc.setTextColor("#0f172a")
  y += 11

  // Two-column party panel
  const panelH = 42
  const panelColW = (contentW - 5) / 2
  // Company (dark)
  doc.setFillColor("#0f172a")
  doc.rect(margin, y, panelColW, panelH, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor("#64748b")
  doc.text("COMPANY", margin + 5, y + 8)
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor("#ffffff")
  doc.text("Stance Marketing LLC", margin + 5, y + 16)
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor("#94a3b8")
  ;(doc.splitTextToSize(companyAddress, panelColW - 10) as string[]).forEach((ln, i) =>
    doc.text(ln, margin + 5, y + 23 + i * 4.5)
  )
  // Contractor (light + red accent)
  const panelRX = margin + panelColW + 5
  doc.setFillColor("#f1f5f9")
  doc.rect(panelRX, y, panelColW, panelH, "F")
  doc.setFillColor(RED)
  doc.rect(panelRX, y, 3, panelH, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor("#64748b")
  doc.text("CONTRACTOR", panelRX + 7, y + 8)
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor("#0f172a")
  doc.text(contractorName, panelRX + 7, y + 16)
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor("#475569")
  let cLineY = y + 23
  if (data.email) { doc.text(data.email, panelRX + 7, cLineY); cLineY += 4.5 }
  if (data.phone) { doc.text(data.phone, panelRX + 7, cLineY); cLineY += 4.5 }
  if (data.address) {
    const aStr = [data.address, data.city, data.state, data.zipCode].filter(Boolean).join(", ")
    ;(doc.splitTextToSize(aStr, panelColW - 14) as string[]).slice(0, 2).forEach((ln, i) =>
      doc.text(ln, panelRX + 7, cLineY + i * 4)
    )
  }
  doc.setFont("helvetica", "normal"); doc.setTextColor("#0f172a")
  y += panelH + 12

  sectionHeader("CONTRACT TERMS (FULL TEXT)")
  paragraph("This executed packet includes the full Independent Contractor Agreement accepted electronically by the contractor.", 8.5, "#64748b")
  y += 2
  for (const section of CONTRACT_SECTIONS) {
    checkPageBreak(14)
    text(`${section.num}. ${section.title}`, margin, y, { size: 9.5, bold: true, color: "#1e293b" })
    y += 5
    for (const clause of section.clauses) {
      paragraph(clause, 8.2, "#334155")
      y += 1.2
    }
    y += 2
  }

  // Force a fresh page for signatures so the block is never split
  addPage()
  sectionHeader("EXECUTION & SIGNATURES")

  // Two-column bordered signature boxes
  const sigColW = (contentW - 8) / 2
  const sigBoxH = 52
  const leftX = margin
  const rightX = margin + sigColW + 8

  // Company signature box
  doc.setFillColor("#f8fafc")
  doc.setDrawColor("#e2e8f0")
  doc.rect(leftX, y, sigColW, sigBoxH, "FD")
  doc.setFillColor("#0f172a")
  doc.rect(leftX, y, sigColW, 9, "F")
  text("COMPANY SIGNATURE", leftX + 5, y + 6.5, { size: 7.5, bold: true, color: "#ffffff" })
  const companySignature = createCompanySignatureDataUrl()
  if (companySignature) {
    try { doc.addImage(companySignature, "PNG", leftX + 4, y + 14, 50, 13, "", "FAST") }
    catch { text("Ron Rice", leftX + 4, y + 22, { size: 11, bold: true }) }
  }
  doc.setDrawColor("#cbd5e1")
  doc.line(leftX + 4, y + 30, leftX + sigColW - 4, y + 30)
  text("Ron Rice, President", leftX + 5, y + 36, { size: 8.5, bold: true })
  text("Stance Marketing LLC", leftX + 5, y + 41.5, { size: 7.5, color: "#64748b" })
  text(effectiveDate, leftX + 5, y + 47, { size: 7.5, color: "#64748b" })

  // Contractor signature box
  doc.setFillColor("#f8fafc")
  doc.setDrawColor("#e2e8f0")
  doc.rect(rightX, y, sigColW, sigBoxH, "FD")
  doc.setFillColor(RED)
  doc.rect(rightX, y, sigColW, 9, "F")
  text("CONTRACTOR SIGNATURE", rightX + 5, y + 6.5, { size: 7.5, bold: true, color: "#ffffff" })
  if (data.signatureDataUrl) {
    try { doc.addImage(data.signatureDataUrl, "PNG", rightX + 4, y + 14, 50, 13, "", "FAST") }
    catch { text("(Signature on file)", rightX + 4, y + 22, { size: 8, color: "#64748b" }) }
  }
  doc.setDrawColor("#cbd5e1")
  doc.line(rightX + 4, y + 30, rightX + sigColW - 4, y + 30)
  text(contractorName, rightX + 5, y + 36, { size: 8.5, bold: true })
  text(data.isAcknowledged ? "Electronically Acknowledged ✓" : "Pending", rightX + 5, y + 41.5, { size: 7.5, color: "#64748b" })
  text(effectiveDate, rightX + 5, y + 47, { size: 7.5, color: "#64748b" })

  y += sigBoxH + 8
  line(margin, y, pageW - margin, y)
  y += 6

  addPage()
  sectionHeader("W-9 TAX CERTIFICATION")
  row("Name on tax return", contractorName)
  row("Taxpayer ID Type", data.tinType === "ssn" ? "SSN" : data.tinType === "ein" ? "EIN" : "N/A")
  row("Taxpayer ID", tinFormatted)
  row("W-9 Certified", data.w9Certified ? "Yes" : "No")
  row("Exempt Payee Code", data.exemptPayeeCode || "N/A")
  if (data.w9SignatureDataUrl) {
    checkPageBreak(28)
    text("W-9 Signature", margin, y, { size: 8.5, bold: true, color: "#475569" })
    y += 3
    try {
      doc.addImage(data.w9SignatureDataUrl, "PNG", margin, y, 55, 14, "", "FAST")
    } catch {
      text("(W-9 signature on file)", margin, y + 6, { size: 8, color: "#64748b" })
    }
    y += 16
  }
  row("W-9 Signature Date", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))

  addPage()
  sectionHeader("UPLOADED DOCUMENTS")
  row("Government ID File", data.idDocName || "Not uploaded")
  row("Badge Photo File", data.badgePhotoName || "Not uploaded")
  y += 3

  const addRemoteImagePanel = async (title: string, url: string | undefined, maxW = 110, maxH = 80) => {
    checkPageBreak(maxH + 20)
    text(title, margin, y, { size: 9, bold: true, color: "#334155" })
    y += 4
    if (!url) {
      text("Not uploaded", margin, y + 2, { size: 8.5, color: "#94a3b8" })
      y += 8
      return
    }
    const dataUrl = await loadImageAsDataUrl(url)
    if (!dataUrl) {
      text("Uploaded file available by URL:", margin, y + 2, { size: 8, color: "#94a3b8" })
      y += 5
      paragraph(url, 7.5, "#2563eb")
      y += 2
      return
    }

    // Determine natural dimensions to preserve aspect ratio
    let dispW = maxW
    let dispH = maxH
    try {
      const imgEl = new window.Image()
      await new Promise<void>((res) => {
        imgEl.onload = () => {
          const ratio = imgEl.naturalWidth / imgEl.naturalHeight
          if (ratio > 1) {
            dispW = maxW
            dispH = maxW / ratio
          } else {
            dispH = maxH
            dispW = maxH * ratio
          }
          res()
        }
        imgEl.onerror = () => res()
        imgEl.src = dataUrl
      })
    } catch { /* use defaults */ }

    const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG"
    try {
      doc.addImage(dataUrl, fmt, margin, y, dispW, dispH, "", "FAST")
    } catch {
      text("File included (preview unavailable), URL:", margin, y + 2, { size: 8, color: "#94a3b8" })
      y += 5
      paragraph(url, 7.5, "#2563eb")
      y += 2
      return
    }
    y += dispH + 5
  }

  await addRemoteImagePanel("Government ID", data.idDocUrl)
  await addRemoteImagePanel("Badge Photo", data.badgePhotoUrl)

  // ── Compensation Schedule ──
  if (exhibits && exhibits.length > 0) {
    addPage()
    sectionHeader("COMPENSATION SCHEDULE")
    paragraph(
      "The following compensation rates apply to this Independent Contractor Agreement. All amounts represent per-sale commissions paid by Stance Marketing LLC.",
      8.5,
      "#64748b",
    )
    y += 4

    const colServiceW = contentW * 0.72
    const colAmountW = contentW * 0.28

    for (const exhibit of exhibits) {
      checkPageBreak(32)

      // Exhibit header band
      doc.setFillColor("#0f172a")
      doc.rect(margin, y, contentW, 10, "F")
      doc.setFillColor(RED)
      doc.rect(margin, y, 3.5, 10, "F")
      text(exhibit.name, margin + 7, y + 7, { size: 9, bold: true, color: "#ffffff" })
      text(exhibit.provider, pageW - margin - 4, y + 7, { align: "right", size: 8, color: "#94a3b8" })
      y += 10

      // Table column headers
      doc.setFillColor("#1e293b")
      doc.rect(margin, y, contentW, 8, "F")
      text("SERVICE", margin + 4, y + 5.5, { size: 7.5, bold: true, color: "#94a3b8" })
      text("AMOUNT", pageW - margin - 4, y + 5.5, { align: "right", size: 7.5, bold: true, color: "#94a3b8" })
      y += 8

      rowParity = 0
      for (const payRow of exhibit.payStructure) {
        const rH = 8
        checkPageBreak(rH + 1)
        doc.setFillColor(rowParity % 2 === 0 ? "#f8fafc" : "#ffffff")
        doc.rect(margin, y, contentW, rH, "F")
        text(payRow.service, margin + 4, y + 5.5, { size: 8.5, color: "#334155" })
        const amt = payRow.amount % 1 === 0 ? `$${payRow.amount}` : `$${payRow.amount.toFixed(2)}`
        text(amt, pageW - margin - 4, y + 5.5, { align: "right", size: 8.5, bold: true, color: "#0f172a" })
        doc.setDrawColor("#e9edf2")
        doc.line(margin, y + rH, pageW - margin, y + rH)
        rowParity++
        y += rH
      }
      y += 8
    }
  }

  checkPageBreak(14)
  line(margin, y, pageW - margin, y)
  y += 6
  paragraph(
    `This packet contains the executed Independent Contractor Agreement, W-9 certification, electronic signatures, uploaded onboarding documents${
      exhibits && exhibits.length > 0 ? ", and compensation schedule" : ""
    } for ${contractorName}.`,
    8,
    "#64748b",
  )

  // ── Footer on every page ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(RED)
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor("#94a3b8")
    doc.text("CONFIDENTIAL — Stance Marketing LLC", margin, pageH - 8)
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 8, { align: "right" })
    doc.setTextColor("#0f172a")
    doc.setFont("helvetica", "normal")
  }

  return doc
}

async function downloadOnboardingPDF(
  data: OnboardingData,
  programLabel: string,
  contractorName: string,
  effectiveDate: string,
  exhibits?: CompensationExhibit[],
): Promise<void> {
  const doc = await buildOnboardingPDF(data, programLabel, contractorName, effectiveDate, exhibits)
  doc.save(`Stance-Onboarding-${contractorName.replace(/\s+/g, "-")}.pdf`)
}

async function uploadOnboardingPDF(
  data: OnboardingData,
  programLabel: string,
  contractorName: string,
  effectiveDate: string,
  exhibits?: CompensationExhibit[],
): Promise<string> {
  const doc = await buildOnboardingPDF(data, programLabel, contractorName, effectiveDate, exhibits)
  const pdfBlob = doc.output("blob")
  const file = new File(
    [pdfBlob],
    `Stance-Onboarding-${contractorName.replace(/\s+/g, "-")}.pdf`,
    { type: "application/pdf" },
  )
  const blob = await upload(`contracts/${file.name}`, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    multipart: file.size > 5 * 1024 * 1024,
  })
  return blob.url
}
