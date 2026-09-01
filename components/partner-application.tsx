"use client"

import type React from "react"

import { useState, useRef } from "react"
import { motion, useInView } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, Mail, Phone, CheckCircle2 } from "lucide-react"
import Image from "next/image"

type FormData = {
  name: string
  selectedProviders: string
  email: string
  company: string
  phone: string
  website: string
  partnershipType: string
  message: string
}

const partnershipTypes = [
  {
    id: "referral",
    label: "Referral Partner",
    description: "Refer clients and earn commissions without selling",
  },
  {
    id: "sales-agent",
    label: "Sales Agent",
    description: "Online or field sales representing top providers",
  },
  {
    id: "business-partnership",
    label: "Business Partnership",
    description: "Integrate internet services into your existing business",
  },
  {
    id: "spectrum-event",
    label: "Spectrum Event Team",
    description: "Represent Spectrum at retail locations & events",
  },
  {
    id: "tmobile-d2d",
    label: "T-Mobile Fiber D2D",
    description: "Door-to-door fiber sales as dealer or contractor",
  },
  {
    id: "verizon-d2d",
    label: "Verizon Fios D2D",
    description: "Verizon fiber & 5G wireless door-to-door sales",
  },
]

const PROVIDER_ELIGIBLE_TYPES = ["referral", "sales-agent", "business-partnership"]

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

export function PartnerApplication() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })

  const [formData, setFormData] = useState<FormData>({
    name: "",
    selectedProviders: "",
    email: "",
    company: "",
    phone: "",
    website: "",
    partnershipType: "",
    message: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")
  const providersRequired = PROVIDER_ELIGIBLE_TYPES.includes(formData.partnershipType)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.name || !formData.email || !formData.company || (providersRequired && !formData.selectedProviders)) {
      setError(providersRequired ? "Please fill in all required fields and select at least one provider." : "Please fill in all required fields.")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch("/api/send-partner-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error("Unable to submit application")
      setIsSubmitted(true)
      setTimeout(() => {
        setIsSubmitted(false)
        setFormData({ name: "", selectedProviders: "", email: "", company: "", phone: "", website: "", partnershipType: "", message: "" })
      }, 5000)
    } catch {
      setError("Unable to submit application. Please try again.")
    } finally {
      setIsSubmitting(false)
    }

    if (isSubmitted) {
      setTimeout(() => {
        setIsSubmitted(false)
        setFormData({
          name: "",
          selectedProviders: "",
          email: "",
          company: "",
          phone: "",
          website: "",
          partnershipType: "",
          message: "",
        })
      }, 5000)
    }
  }

  return (
    <section id="partner-application" className="py-20 bg-gray-900" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">
            Apply to Become a <span className="text-red-500">Stance Partner</span>
          </h2>
          <div className="w-16 md:w-20 h-1 bg-red-500 mx-auto mb-4 md:mb-6" />
          <p className="text-gray-400 max-w-2xl mx-auto">
            Fill out the form below to start your journey as a Stance Channel Partner. Our team will review your
            application and contact you within 2 business days.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-red-500" />
              <span className="text-gray-300">(513) 341-6067</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-red-500" />
              <span className="text-gray-300">info@stance-marketing.com</span>
            </div>
          </div>
        </motion.div>

        {/* Provider logos strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-4xl mx-auto mb-12"
        >
          <p className="text-center text-sm text-gray-500 uppercase tracking-widest mb-5">
            Providers you can represent
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {providerLogos.map((logo) => (
              <div
                key={logo.name}
                className="bg-white rounded-lg px-3 py-2 flex items-center justify-center h-12 w-28"
              >
                <img
                  src={logo.src}
                  alt={`${logo.name} logo`}
                  className="h-7 w-auto object-contain max-w-full"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          {isSubmitted ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black p-10 border-l-2 border-green-500 text-center"
            >
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-white mb-4">Application Received!</h3>
              <p className="text-gray-300 mb-6">
                Thank you for your interest in becoming a Stance Channel Partner. Our team will review your application
                and reach out to you within 2 business days to discuss the next steps.
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {error && <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 mb-6">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Partnership Type Selector */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wider">
                    Select Your Partnership Type
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {partnershipTypes.map((type) => {
                      const isSelected = formData.partnershipType === type.id
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, partnershipType: type.id, selectedProviders: PROVIDER_ELIGIBLE_TYPES.includes(type.id) ? prev.selectedProviders : "" }))}
                          className={`text-left p-4 border-2 rounded-lg transition-all duration-200 ${
                            isSelected
                              ? "border-green-500 bg-green-500/10"
                              : "border-gray-700 bg-black hover:border-gray-500"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected ? "border-green-500 bg-green-500" : "border-gray-600"
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <div
                                className={`font-semibold text-sm ${isSelected ? "text-green-400" : "text-white"}`}
                              >
                                {type.label}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{type.description}</div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Provider Selector */}
                {providersRequired && <fieldset>
                  <legend className="block text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wider">
                    Providers you want to represent <span className="text-red-400">*</span>
                  </legend>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {providerLogos.map((provider) => {
                      const selected = formData.selectedProviders.split(",").filter(Boolean).includes(provider.name)
                      return (
                        <label key={provider.name} className={`cursor-pointer rounded-lg border-2 p-2 transition-colors ${selected ? "border-green-500 bg-green-500/10" : "border-gray-700 bg-black hover:border-gray-500"}`}>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={selected}
                            onChange={() => setFormData((prev) => {
                              const providers = prev.selectedProviders.split(",").filter(Boolean)
                              const next = selected ? providers.filter((name) => name !== provider.name) : [...providers, provider.name]
                              return { ...prev, selectedProviders: next.join(",") }
                            })}
                          />
                          <span className="flex h-10 items-center justify-center gap-2 text-xs font-semibold text-white">
                            <img src={provider.src} alt={`${provider.name} logo`} className="h-6 w-auto max-w-[80px] object-contain" />
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>}

                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                        Full Name *
                      </label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="bg-black border-gray-800 focus:border-red-500 h-12"
                        disabled={isSubmitting}
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                        Email Address *
                      </label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="bg-black border-gray-800 focus:border-red-500 h-12"
                        disabled={isSubmitting}
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-1">
                        Company Name *
                      </label>
                      <Input
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        className="bg-black border-gray-800 focus:border-red-500 h-12"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
                        Phone Number
                      </label>
                      <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="bg-black border-gray-800 focus:border-red-500 h-12"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="website" className="block text-sm font-medium text-gray-300 mb-1">
                        Website
                      </label>
                      <Input
                        id="website"
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        className="bg-black border-gray-800 focus:border-red-500 h-12"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">
                        Tell us about your business
                      </label>
                      <Textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        className="bg-black border-gray-800 focus:border-red-500 min-h-[120px]"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Button
                    type="submit"
                    className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 h-auto rounded-none w-full md:w-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
