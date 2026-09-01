"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  ChevronDown,
  Users,
  TrendingUp,
  Building2,
  Radio,
  Smartphone,
  Wifi,
  ClipboardList,
  Send,
  Clock,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────

type PartnerType =
  | "referral"
  | "sales-agent"
  | "business"
  | "spectrum-event"
  | "tmobile-d2d"
  | "verizon-d2d"

interface ProgramOption {
  id: PartnerType
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  fields: FieldConfig[]
}

interface FieldConfig {
  name: string
  label: string
  type: "text" | "select" | "textarea"
  options?: string[]
  required?: boolean
  placeholder?: string
}

interface FormValues {
  partnerType: PartnerType | ""
  selectedProviders: string
  firstName: string
  lastName: string
  email: string
  phone: string
  state: string
  company: string
  [key: string]: string
}

// ── Program Configurations ─────────────────────────────────────────

const providerLogos = [
  { name: "Frontier", src: "/images/frontier-logo.png" },
  { name: "AT&T", src: "/images/att-logo.png" },
  { name: "Verizon", src: "/images/verizon-logo.png" },
  { name: "Spectrum", src: "/images/spectrum-logo.png" },
  { name: "T-Mobile", src: "/images/tmobile-fiber-logo.png" },
  { name: "Optimum", src: "/images/optimum-logo.png" },
  { name: "Brightspeed", src: "/images/brightspeed-logo.png" },
  { name: "Kinetic", src: "/images/kinetic-logo.png" },
  { name: "EarthLink", src: "/images/earthlink-logo.png" },
  { name: "Altafiber", src: "/images/altafiber-logo.png" },
]

const PROGRAMS: ProgramOption[] = [
  {
    id: "referral",
    title: "Referral",
    description: "Earn per referral — no selling",
    icon: Users,
    fields: [
      {
        name: "referralMethod",
        label: "How will you refer customers?",
        type: "select",
        options: ["Word of mouth", "Social media", "Professional network", "Online / blog", "Local business foot traffic", "Other"],
        required: true,
      },
      { name: "industry", label: "Industry or profession", type: "text", placeholder: "e.g. Real estate, IT consulting" },
    ],
  },
  {
    id: "sales-agent",
    title: "Sales Agent",
    description: "Commission-based — online or field",
    icon: TrendingUp,
    fields: [
      {
        name: "salesExperience",
        label: "Sales experience",
        type: "select",
        options: ["None", "< 1 year", "1-3 years", "3-5 years", "5+ years"],
        required: true,
      },
      {
        name: "preferredChannel",
        label: "Preferred channel",
        type: "select",
        options: ["Online / phone", "Door-to-door", "Events / retail", "Team manager", "Open to all"],
        required: true,
      },
      { name: "territoryPreference", label: "Territory preference", type: "text", placeholder: "City, region, or nationwide" },
    ],
  },
  {
    id: "business",
    title: "Business (IBO)",
    description: "Established business with active sales agents",
    icon: Building2,
    fields: [
      {
        name: "businessType",
        label: "Type of business",
        type: "select",
        options: ["Solar", "Alarm / Security", "Call Center", "D2D / Field Sales", "Retail / Events", "Insurance", "Real Estate", "IT / Technology", "Moving Company", "Other"],
        required: true,
      },
      {
        name: "customerBase",
        label: "Forecasted Monthly Sales",
        type: "select",
        options: ["Under 10 sales/mo", "10–25 sales/mo", "25–50 sales/mo", "50–100 sales/mo", "100+ sales/mo"],
        required: true,
      },
    ],
  },
  {
    id: "spectrum-event",
    title: "Spectrum Events",
    description: "Retail locations & events",
    icon: Radio,
    fields: [
      {
        name: "eventExperience",
        label: "Event / D2D experience",
        type: "select",
        options: ["None", "< 1 year", "1-3 years", "3-5 years", "5+ years"],
        required: true,
      },
      { name: "previousCarriers", label: "Prior carrier experience", type: "text", placeholder: "e.g. Spectrum, AT&T" },
      { name: "hasTransportation", label: "Reliable transportation?", type: "select", options: ["Yes", "No"], required: true },
    ],
  },
  {
    id: "tmobile-d2d",
    title: "T-Mobile D2D",
    description: "Door-to-door fiber sales",
    icon: Wifi,
    fields: [
      {
        name: "d2dExperience",
        label: "D2D experience",
        type: "select",
        options: ["None", "< 1 year", "1-3 years", "3-5 years", "5+ years"],
        required: true,
      },
      { name: "teamSize", label: "Team size", type: "select", options: ["Solo", "2-5", "6-15", "16-30", "30+"] },
      { name: "territoryInterest", label: "Territory of interest", type: "text", placeholder: "City, metro, or region", required: true },
    ],
  },
  {
    id: "verizon-d2d",
    title: "Verizon D2D",
    description: "Fios & 5G door-to-door",
    icon: Smartphone,
    fields: [
      {
        name: "d2dExperience",
        label: "D2D experience",
        type: "select",
        options: ["None", "< 1 year", "1-3 years", "3-5 years", "5+ years"],
        required: true,
      },
      { name: "teamSize", label: "Team size", type: "select", options: ["Solo", "2-5", "6-15", "16-30", "30+"] },
      { name: "territoryInterest", label: "Territory of interest", type: "text", placeholder: "City, metro, or region (NE preferred)", required: true },
    ],
  },
]

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

const TOTAL_STEPS = 3

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 40 : -40, opacity: 0 }),
}

// ── Helpers ────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10)
  if (digits.length < 4) return digits
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// ── Component ──────────────────────────────────────────────────────

export function ApplyContent() {
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [formData, setFormData] = useState<FormValues>({
    partnerType: "",
    selectedProviders: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    state: "",
    company: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const selectedProgram = PROGRAMS.find((p) => p.id === formData.partnerType)

  const updateField = useCallback(
    (name: string, value: string) => {
      setFormData((prev) => ({ ...prev, [name]: value }))
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
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      if (!formData.partnerType) newErrors.partnerType = "Select a program"
      if (!formData.selectedProviders.trim()) newErrors.selectedProviders = "Select at least one provider"
      if (!formData.firstName.trim()) newErrors.firstName = "Required"
      if (!formData.lastName.trim()) newErrors.lastName = "Required"
      if (!formData.email.trim()) {
        newErrors.email = "Required"
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Enter a valid email"
      }
      if (!formData.phone.trim()) newErrors.phone = "Required"
      if (!formData.state) newErrors.state = "Required"
    }

    if (step === 2 && selectedProgram) {
      for (const field of selectedProgram.fields) {
        if (field.required && !formData[field.name]?.trim()) {
          newErrors[field.name] = "Required"
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [step, formData, selectedProgram])

  const goNext = useCallback(() => {
    if (!validateStep()) return
    setDirection(1)
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }, [validateStep])

  const goBack = useCallback(() => {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 1))
  }, [])

  // Scroll to top of page on every step change
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      // Some locked-down browser contexts can reject smooth scrolling.
      window.scrollTo(0, 0)
    }
  }, [step])

  // Step completion detection for green button
  const isStepReady = useMemo(() => {
    if (step === 1) {
      return !!(
        formData.partnerType &&
        formData.selectedProviders.trim() &&
        formData.firstName.trim() &&
        formData.lastName.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
        formData.phone.trim() &&
        formData.state
      )
    }
    if (step === 2 && selectedProgram) {
      return selectedProgram.fields
        .filter((f) => f.required)
        .every((f) => !!formData[f.name]?.trim())
    }
    return true
  }, [step, formData, selectedProgram])

  const handleSubmit = useCallback(async () => {
    if (!validateStep()) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        let message = "Something went wrong. Please try again."
        try {
          const parsed = await res.json() as { error?: string }
          if (parsed?.error) message = parsed.error
        } catch {
          // Keep default fallback message.
        }
        throw new Error(message)
      }
      setIsComplete(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again."
      setErrors({ submit: message })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateStep])

  // ── Landing Page ──
  if (!started) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">

        {/* ── MOBILE: Brand Hero ── */}
        <div className="lg:hidden relative bg-[#0d0406] overflow-hidden px-6 pt-10 pb-16 flex-shrink-0">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-25"
            style={{ background: "radial-gradient(circle, #e11d48 0%, transparent 70%)" }}
          />
          <div
            aria-hidden
            className="absolute -top-16 right-0 w-56 h-56 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #f97316 0%, transparent 70%)" }}
          />
          <div className="relative z-10 text-center">
            <Image
              src="/images/stance-logo-white.png"
              alt="Stance Marketing"
              width={140}
              height={32}
              className="h-7 w-auto mx-auto mb-5"
            />
            <span className="inline-block text-[10px] font-bold tracking-[0.28em] text-red-400 uppercase mb-3">
              Partner Program
            </span>
            <h2 className="text-2xl font-bold text-white leading-tight mb-2">
              Built to earn.
            </h2>
            <p className="text-white/50 text-sm">
              Every program. Every market.
            </p>
          </div>
        </div>

        {/* ── LEFT: Brand Panel (desktop only) ── */}
        <div className="relative hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 bg-[#0d0406] flex-col overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #e11d48 0%, transparent 70%)" }}
          />

          <div className="relative z-10 flex flex-col h-full p-8 lg:p-12 xl:p-14">
            <div className="mb-auto pb-8 lg:pb-0">
              <Image
                src="/images/stance-logo-white.png"
                alt="Stance Marketing"
                width={160}
                height={36}
                className="h-8 w-auto"
              />
            </div>

            <div className="hidden lg:flex flex-col flex-1 justify-center py-10">
              <span className="text-xs font-bold tracking-[0.22em] text-red-400 uppercase mb-4">
                Partner Program
              </span>
              <h2 className="text-3xl xl:text-4xl font-bold text-white leading-[1.15] mb-5">
                Built to earn.<br />Every program,<br />every market.
              </h2>
              <p className="text-white/55 text-[15px] leading-relaxed max-w-[280px]">
                Join a growing network of partners earning real commissions with the top carriers in the U.S.
              </p>
            </div>

            <div className="hidden lg:grid grid-cols-2 gap-3 mt-auto">
              {[
                { value: "6", label: "Programs" },
                { value: "24-48h", label: "Review Time" },
                { value: "Top", label: "U.S. Carriers" },
                { value: "Real", label: "Commissions" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-lg font-bold text-white">{stat.value}</p>
                  <p className="text-white/40 text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            <p className="hidden lg:block text-white/20 text-xs mt-8">© 2026 Stance Marketing LLC</p>
          </div>
        </div>

        {/* ── RIGHT: Form Intro ── */}
        <div className="flex-1 bg-gray-100 flex items-center justify-center px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-[440px]"
          >
            <div className="bg-white rounded-2xl border border-gray-300 shadow-2xl shadow-gray-900/20 p-8 sm:p-10">
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-3">
                Apply to join<br className="hidden sm:block" /> Stance
              </h1>
              <p className="text-slate-600 text-lg leading-relaxed mb-10">
                Choose a partnership program, fill out a short form, and our team will review your application within 24-48 hours.
              </p>

              <div className="mb-10 space-y-0">
                {[
                  { icon: ClipboardList, label: "Choose your program & enter your info", sub: "Step 1" },
                  { icon: Send, label: "Answer a few program-specific questions", sub: "Step 2" },
                  { icon: Clock, label: "Review & submit — we'll be in touch shortly", sub: "Step 3" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${i === 0 ? "bg-red-500 text-white" : "bg-slate-200 border border-slate-300 text-slate-600"}`}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      {i < 2 && <div className="w-px flex-1 bg-slate-300 my-1.5" style={{ minHeight: "24px" }} />}
                    </div>
                    <div className="pt-1.5 pb-6">
                      <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.3em] mb-1">{item.sub}</p>
                      <p className="text-slate-800 text-base font-semibold">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => setStarted(true)}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl h-12 text-[15px] shadow-lg shadow-red-500/30 transition-all"
              >
                Start Application
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <p className="text-slate-600 text-sm mt-4 text-center">Takes about 2 minutes to complete</p>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Completion ──
  if (isComplete) {
    return (
      <div className="min-h-screen bg-[#090d14] relative overflow-hidden flex flex-col">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 10% 15%, rgba(225,29,72,0.30), transparent 35%), radial-gradient(circle at 85% 85%, rgba(249,115,22,0.20), transparent 32%), linear-gradient(180deg, #0b111d 0%, #090d14 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        <div className="relative z-10 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between">
            <Image
              src="/images/stance-logo-white.png"
              alt="Stance Marketing"
              width={140}
              height={32}
              className="h-7 w-auto"
            />
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.24em] text-white/65 font-semibold">
              Partner Application
            </span>
          </div>
        </div>

        <div className="relative z-10 flex-1 px-5 py-10 sm:py-14 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="w-full max-w-4xl"
          >
            <div className="rounded-3xl border border-white/15 bg-white/[0.06] backdrop-blur-md shadow-[0_30px_90px_rgba(0,0,0,0.45)] overflow-hidden">
              <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
                <div className="p-7 sm:p-10 border-b lg:border-b-0 lg:border-r border-white/10">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-300/25 px-3 py-1.5 mb-5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs uppercase tracking-[0.22em] text-emerald-100 font-bold">Successfully Submitted</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-bold text-white leading-[1.05] mb-4">
                    Application<br />Received
                  </h1>
                  <p className="text-white/75 text-base sm:text-lg leading-relaxed max-w-xl mb-6">
                    Thanks {formData.firstName}. Your {selectedProgram?.title || "partner"} application is in our queue. We&apos;ll review your submission and contact you with onboarding steps.
                  </p>

                  <div className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-5 py-4 mb-6">
                    <p className="text-sm text-blue-100 font-semibold mb-1">Want to expedite the application process?</p>
                    <p className="text-sm text-white/70">
                      Email Director of Sales <span className="font-semibold text-white">Justin Johnson</span> at{" "}
                      <a
                        href="mailto:justin.j@stance-marketing.com"
                        data-testid="expedite-email-link"
                        className="text-blue-300 hover:text-blue-200 underline underline-offset-2 font-semibold transition-colors"
                      >
                        justin.j@stance-marketing.com
                      </a>
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { label: "Status", value: "In Review" },
                      { label: "Response Window", value: "24-48 Hours" },
                      { label: "Program", value: selectedProgram?.title || "Selected" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-white/15 bg-black/25 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-1">{item.label}</p>
                        <p className="text-sm sm:text-base font-semibold text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-7 sm:p-9 bg-slate-950/35">
                  <p className="text-xs uppercase tracking-[0.2em] text-red-200/80 font-bold mb-4">What Happens Next</p>
                  <div className="space-y-4 mb-7">
                    {[
                      "You already received a confirmation email.",
                      "Our recruiting team validates your fit for the selected channel.",
                      "Qualified applicants receive onboarding access and next-step instructions.",
                    ].map((line, idx) => (
                      <div key={line} className="flex gap-3 items-start">
                        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 border border-red-300/30 text-red-100 text-xs font-bold">
                          {idx + 1}
                        </span>
                        <p className="text-sm text-white/80 leading-relaxed">{line}</p>
                      </div>
                    ))}
                  </div>

                  <Link href="/" className="block">
                    <Button className="w-full h-11 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold shadow-lg shadow-red-500/25">
                      Return Home
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Application Flow ──
  return (
    <div className="min-h-screen bg-[#edf1f7] text-slate-900 flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b border-slate-800/30 bg-slate-900/95 backdrop-blur-xl shadow-lg shadow-slate-900/20">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/stance-logo-white.png"
                alt="Stance Marketing"
                width={120}
                height={28}
                className="h-6 w-auto"
              />
              <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-0.5 text-[11px] font-semibold tracking-[0.25em] text-slate-200 uppercase">
                Apply
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

      {/* Content */}
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
                <StepInfoAndProgram formData={formData} errors={errors} onChange={updateField} />
              )}
              {step === 2 && selectedProgram && (
                <StepProgramDetails program={selectedProgram} formData={formData} errors={errors} onChange={updateField} />
              )}
              {step === 3 && selectedProgram && (
                <StepReview formData={formData} program={selectedProgram} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed sm:sticky bottom-0 left-0 right-0 z-50 border-t border-slate-900/40 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-slate-900/30">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between gap-3">
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
          <Button
            onClick={step < TOTAL_STEPS ? goNext : handleSubmit}
            disabled={step === TOTAL_STEPS && isSubmitting}
            className={`flex-1 sm:flex-none font-semibold rounded-xl px-8 h-11 shadow-lg transition-all disabled:opacity-50 text-white ${
              isStepReady
                ? "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/40"
                : "bg-red-500 hover:bg-red-400 shadow-red-500/40"
            }`}
          >
            {step < TOTAL_STEPS ? (
              <>Continue<ArrowRight className="ml-2 h-4 w-4" /></>
            ) : isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting</>
            ) : (
              <><Check className="mr-2 h-4 w-4" />Submit Application</>
            )}
          </Button>
        </div>
        {errors.submit && (
          <p className="text-red-500 text-sm text-center pb-2">{errors.submit}</p>
        )}
      </div>
    </div>
  )
}

// ── Step 1: Program + Personal Info ────────────────────────────────

function StepInfoAndProgram({
  formData,
  errors,
  onChange,
}: {
  formData: FormValues
  errors: Record<string, string>
  onChange: (name: string, value: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Choose your program</h2>
        <p className="text-slate-600 text-base">Select the option that best fits you, then fill in your details.</p>
      </div>

      {/* Program grid */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PROGRAMS.map((p) => {
            const selected = formData.partnerType === p.id
            const Icon = p.icon
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange("partnerType", p.id)}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl border p-4 sm:p-5 text-center transition-all duration-150 shadow-sm ${
                  selected
                    ? "border-red-500 bg-slate-900 text-white shadow-red-500/30"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Icon className={`h-5 w-5 ${selected ? "text-red-400" : "text-slate-500"}`} />
                <span className={`text-sm sm:text-base font-semibold leading-tight ${selected ? "text-white" : "text-slate-800"}`}>
                  {p.title}
                </span>
                <span className={`text-[11px] leading-tight hidden sm:block ${selected ? "text-slate-200" : "text-slate-500"}`}>{p.description}</span>
                {selected && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center shadow-md shadow-red-500/40">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {errors.partnerType && <p className="text-red-500 text-xs mt-1.5">{errors.partnerType}</p>}
      </div>

      {/* Provider selector */}
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900 mb-3">Providers you want to represent <span className="text-red-500">*</span></legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {providerLogos.map((provider) => {
            const selected = formData.selectedProviders.split(",").filter(Boolean).includes(provider.name)
            return (
              <label key={provider.name} className={`cursor-pointer rounded-xl border-2 p-2 transition-colors ${selected ? "border-red-500 bg-red-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <input type="checkbox" className="sr-only" checked={selected} onChange={() => {
                  const providers = formData.selectedProviders.split(",").filter(Boolean)
                  const next = selected ? providers.filter((name) => name !== provider.name) : [...providers, provider.name]
                  onChange("selectedProviders", next.join(","))
                }} />
                <span className="flex h-10 items-center justify-center">
                  <img src={provider.src} alt={`${provider.name} logo`} className="h-6 w-auto max-w-[80px] object-contain" />
                </span>
              </label>
            )
          })}
        </div>
        {errors.selectedProviders && <p className="text-red-500 text-xs mt-1.5">{errors.selectedProviders}</p>}
      </fieldset>

      {/* Divider */}
      <div className="border-t border-slate-200" />

      {/* Personal Info */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Your information</h2>
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="First name" required error={errors.firstName}>
              <Input
                value={formData.firstName}
                onChange={(e) => onChange("firstName", e.target.value)}
                placeholder="First name"
                className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
              />
            </FormField>
            <FormField label="Last name" required error={errors.lastName}>
              <Input
                value={formData.lastName}
                onChange={(e) => onChange("lastName", e.target.value)}
                placeholder="Last name"
                className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
              />
            </FormField>
          </div>
          <FormField label="Email" required error={errors.email}>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="you@example.com"
              className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
            />
          </FormField>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Phone" required error={errors.phone}>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => onChange("phone", formatPhone(e.target.value))}
                placeholder="(555) 555-5555"
                className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
              />
            </FormField>
            <FormField label="State" required error={errors.state}>
              <div className="relative">
                <select
                  value={formData.state}
                  onChange={(e) => onChange("state", e.target.value)}
                  className="w-full h-12 bg-white border border-slate-300 text-slate-900 rounded-xl px-4 pr-12 text-base appearance-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </FormField>
          </div>
          <FormField label="Company / DBA">
            <Input
              value={formData.company}
              onChange={(e) => onChange("company", e.target.value)}
              placeholder="Optional"
              className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
            />
          </FormField>
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Program Details ────────────────────────────────────────

function StepProgramDetails({
  program,
  formData,
  errors,
  onChange,
}: {
  program: ProgramOption
  formData: FormValues
  errors: Record<string, string>
  onChange: (name: string, value: string) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">{program.title} details</h2>
        <p className="text-slate-600 text-base">A few more things so we can set you up right.</p>
      </div>

      <div className="space-y-5">
        {program.fields.map((field) => (
          <FormField key={field.name} label={field.label} required={field.required} error={errors[field.name]}>
            {field.type === "select" && field.options ? (
              <div className="relative">
                <select
                  value={formData[field.name] || ""}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  className="w-full h-12 bg-white border border-slate-300 text-slate-900 rounded-xl px-4 pr-12 text-base appearance-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                >
                  <option value="">Select</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            ) : field.type === "textarea" ? (
                <Textarea
                value={formData[field.name] || ""}
                onChange={(e) => onChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                  className="bg-white border border-slate-300 text-slate-900 min-h-[90px] rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
              />
            ) : (
              <Input
                value={formData[field.name] || ""}
                onChange={(e) => onChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                  className="bg-white border border-slate-300 text-slate-900 h-12 rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
              />
            )}
          </FormField>
        ))}

        <FormField label="Anything else?">
          <Textarea
            value={formData.additionalNotes || ""}
            onChange={(e) => onChange("additionalNotes", e.target.value)}
            placeholder="Optional notes"
            className="bg-white border border-slate-300 text-slate-900 min-h-[90px] rounded-xl text-base shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400"
          />
        </FormField>
      </div>
    </div>
  )
}

// ── Step 3: Review ─────────────────────────────────────────────────

function StepReview({
  formData,
  program,
}: {
  formData: FormValues
  program: ProgramOption
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Review your application</h2>
        <p className="text-slate-600 text-base">Make sure everything looks right before submitting.</p>
      </div>

      <ReviewSection title="Program">
        <ReviewRow label="Type" value={program.title} />
      </ReviewSection>

      <ReviewSection title="Your Info">
        <ReviewRow label="Name" value={`${formData.firstName} ${formData.lastName}`} />
        <ReviewRow label="Email" value={formData.email} />
        <ReviewRow label="Phone" value={formData.phone} />
        <ReviewRow label="State" value={formData.state} />
        {formData.company && <ReviewRow label="Company" value={formData.company} />}
      </ReviewSection>

      <ReviewSection title="Details">
        {program.fields.map((field) => {
          const val = formData[field.name]
          if (!val) return null
          return <ReviewRow key={field.name} label={field.label} value={val} />
        })}
        {formData.additionalNotes && <ReviewRow label="Notes" value={formData.additionalNotes} />}
      </ReviewSection>

      <p className="text-slate-500 text-sm pt-1">
        By submitting, you agree to be contacted by Stance Marketing regarding your application.
      </p>
    </div>
  )
}

// ── Shared Components ──────────────────────────────────────────────

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
    <div>
      <Label className="text-base text-slate-700 mb-2 block font-semibold">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </Label>
      {children}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-[0.2em]">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-base text-slate-900 font-semibold">{value}</span>
    </div>
  )
}
