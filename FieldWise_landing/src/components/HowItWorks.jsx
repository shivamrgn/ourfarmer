import { useEffect, useRef } from 'react'
import './HowItWorks.css'

/* ══════════════════════════════════════════════════════════════
   STEP ILLUSTRATIONS — Clean, modern agricultural SVGs
   ══════════════════════════════════════════════════════════════ */

const StepIcons = {
  // Step 01: Create Your Farm Profile
  profile: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Farm boundary polygon */}
      <rect x="10" y="12" width="44" height="40" rx="8" fill="#f0faf4" stroke="#2d7a4a" strokeWidth="1.75" />
      {/* Location Pin */}
      <circle cx="24" cy="24" r="5" fill="#d9f2e5" stroke="#1a4a2e" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="2" fill="#1a4a2e" />
      <path d="M24 29L24 33" stroke="#1a4a2e" strokeWidth="1.5" strokeLinecap="round" />
      {/* Soil profile layers */}
      <path d="M12 40H52" stroke="#c47c2b" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6" />
      <path d="M12 46H52" stroke="#8b5a22" strokeWidth="1.5" opacity="0.4" />
      {/* Crop Seedling */}
      <path d="M40 38V24" stroke="#3a9c5f" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M40 30C40 26 46 25 47 28C45 30 42 30 40 30Z" fill="#52b876" stroke="#2d7a4a" strokeWidth="1" />
      <path d="M40 28C40 24 34 23 33 26C35 28 38 28 40 28Z" fill="#7dcf98" stroke="#2d7a4a" strokeWidth="1" />
      {/* One-Time Profile Checkmark Badge */}
      <circle cx="48" cy="14" r="6" fill="#1a4a2e" />
      <path d="M45.5 14L47.5 16L51 12.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Step 02: Connect Real-World Data
  realWorldData: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Satellite in orbit */}
      <rect x="22" y="10" width="8" height="6" rx="1.5" stroke="#2563eb" strokeWidth="1.5" fill="#eff6ff" />
      <path d="M15 13H22M30 13H37" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 10.5V15.5M36 10.5V15.5" stroke="#2563eb" strokeWidth="1" />
      {/* Orbital Beam down */}
      <path d="M26 16L18 36M26 16L34 36" stroke="#38bdf8" strokeWidth="1.25" strokeDasharray="2 2" opacity="0.7" />
      {/* Weather Cloud */}
      <path
        d="M38 34C38 31 40 29 43 29C44.5 29 45.8 29.8 46.5 31C47.2 30.4 48 30 49 30C51 30 52.5 31.5 52.5 33.5C52.5 35.5 51 37 49 37H38"
        stroke="#0284c7"
        strokeWidth="1.5"
        fill="#f0f9ff"
      />
      <path d="M42 39L41 42M46 39L45 42M50 39L49 42" stroke="#0284c7" strokeWidth="1.25" strokeLinecap="round" />
      {/* Mandi Price Graph on bottom */}
      <rect x="10" y="38" width="44" height="18" rx="4" fill="#ffffff" stroke="#c47c2b" strokeWidth="1.5" />
      <path d="M14 49L22 44L28 47L38 41L48 43" stroke="#d97706" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="48" cy="43" r="2" fill="#d97706" />
    </svg>
  ),

  // Step 03: AI Analysis
  ai: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Outer Chip Frame */}
      <rect x="14" y="14" width="36" height="36" rx="8" fill="#1a4a2e" stroke="#52b876" strokeWidth="2" />
      {/* Chip Pins */}
      <path d="M22 14V9M32 14V9M42 14V9M22 50V55M32 50V55M42 50V55M14 22H9M14 32H9M14 42H9M50 22H55M50 32H55M50 42H55"
        stroke="#7dcf98" strokeWidth="1.75" strokeLinecap="round" />
      {/* Central Neural Sprout */}
      <circle cx="32" cy="32" r="6" fill="#3a9c5f" />
      <circle cx="24" cy="24" r="2.5" fill="#7dcf98" />
      <circle cx="40" cy="24" r="2.5" fill="#7dcf98" />
      <circle cx="24" cy="40" r="2.5" fill="#7dcf98" />
      <circle cx="40" cy="40" r="2.5" fill="#7dcf98" />
      {/* Synapse connections */}
      <path d="M26 26L30 30M38 26L34 30M26 38L30 34M38 38L34 34" stroke="#b3e4c5" strokeWidth="1.5" strokeLinecap="round" />
      {/* Glowing Orbit ring */}
      <circle cx="32" cy="32" r="14" stroke="#7dcf98" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
    </svg>
  ),

  // Step 04: Get Actionable Insights
  insights: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Decision Card */}
      <rect x="10" y="12" width="44" height="42" rx="7" fill="#ffffff" stroke="#15803d" strokeWidth="1.75" />
      {/* Card Header Ribbon */}
      <path d="M10 19C10 15.134 13.134 12 17 12H47C50.866 12 54 15.134 54 19V22H10V19Z" fill="#15803d" />
      <circle cx="18" cy="17" r="2" fill="#ffffff" />
      <rect x="23" y="16" width="16" height="2.5" rx="1.25" fill="#ffffff" opacity="0.8" />
      {/* Action Checkmark Rows */}
      <circle cx="19" cy="29" r="3.5" fill="#dcfce7" stroke="#16a34a" strokeWidth="1" />
      <path d="M17.5 29L18.5 30L20.5 28" stroke="#15803d" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="26" y="27.5" width="22" height="3" rx="1.5" fill="#bbf7d0" />

      <circle cx="19" cy="37" r="3.5" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
      <path d="M17.5 37L18.5 38L20.5 36" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="26" y="35.5" width="18" height="3" rx="1.5" fill="#fde68a" />

      <circle cx="19" cy="45" r="3.5" fill="#eff6ff" stroke="#2563eb" strokeWidth="1" />
      <path d="M17.5 45L18.5 46L20.5 44" stroke="#1d4ed8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="26" y="43.5" width="20" height="3" rx="1.5" fill="#bfdbfe" />

      {/* Verified Seal */}
      <circle cx="48" cy="48" r="6" fill="#15803d" />
      <path d="M46 48L47.5 49.5L50.5 46.5" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

/* ══════════════════════════════════════════════════════════════
   CROPS WILD USER JOURNEY STEPS
   ══════════════════════════════════════════════════════════════ */
const STEPS = [
  {
    id: 'step-01',
    num: '01',
    title: 'Create Your Farm Profile',
    desc: 'Location, farm information, crops and available soil information.',
    note: 'One-Time Setup',
    icon: StepIcons.profile,
    tags: ['Location', 'Farm Info', 'Crops', 'Soil Data'],
    color: 'green',
  },
  {
    id: 'step-02',
    num: '02',
    title: 'Connect Real-World Data',
    desc: 'Weather, environmental, satellite and market information.',
    note: 'Auto-Synced Telemetry',
    icon: StepIcons.realWorldData,
    tags: ['Weather', 'Environmental', 'Satellite', 'Mandi Prices'],
    color: 'blue',
  },
  {
    id: 'step-03',
    num: '03',
    title: 'AI Analysis',
    desc: 'Crop, fertilizer, disease and farm analysis models.',
    note: 'Agronomic Models',
    icon: StepIcons.ai,
    tags: ['Crop Match', 'Fertilizer Plan', 'Disease Scan', 'Yield Model'],
    color: 'amber',
  },
  {
    id: 'step-04',
    num: '04',
    title: 'Get Actionable Insights',
    desc: 'Recommendations, market information, schemes and agricultural support.',
    note: 'Decisions & Support',
    icon: StepIcons.insights,
    tags: ['Recommendations', 'Mandi Insights', 'Govt Schemes', 'KVK Support'],
    color: 'sage',
  },
]

export default function HowItWorks() {
  const sectionRef = useRef(null)
  const lineRef    = useRef(null)

  /* Scroll reveal */
  useEffect(() => {
    if (!sectionRef.current) return
    const items = sectionRef.current.querySelectorAll('.hiw-reveal')
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('hiw-reveal--in')
          observer.unobserve(e.target)
        }
      }),
      { threshold: 0.1 }
    )
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  /* Animate the connecting line on scroll */
  useEffect(() => {
    if (!lineRef.current) return
    const el = lineRef.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.classList.add('hiw-track--animate')
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      className="hiw-section"
      id="how-it-works"
      aria-labelledby="hiw-heading"
      ref={sectionRef}
    >
      {/* Subtle top wave */}
      <div className="hiw-wave-top" aria-hidden="true">
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="none">
          <path d="M0 0 Q360 60 720 30 Q1080 0 1440 40 L1440 0 Z" fill="var(--color-cream,#faf8f3)"/>
        </svg>
      </div>

      <div className="container">

        {/* Section header */}
        <div className="hiw-header hiw-reveal">
          <span className="hiw-eyebrow">
            <span className="hiw-eyebrow__line" aria-hidden="true" />
            Crops Wild User Journey
          </span>
          <h2 className="hiw-heading" id="hiw-heading">
            From Your Farm Profile to Actionable Intelligence.
          </h2>
          <p className="hiw-subtext">
            A connected 4-step pipeline designed so farmers never have to repeatedly enter the same data. Your profile automatically personalizes all real-world data feeds, AI models, and agricultural support.
          </p>
        </div>

        {/* Profile Persistence Value Banner */}
        <div className="hiw-persistence-banner hiw-reveal">
          <div className="hiw-persistence-badge">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
            <span>Single Profile Setup</span>
          </div>
          <p className="hiw-persistence-text">
            <strong>Zero Repetitive Data Entry:</strong> You create your farm profile once. Crops Wild securely saves your location, land size, crops, and soil characteristics, using them continuously to tailor weather forecasts, AI diagnoses, mandi benchmarks, and relevant government schemes.
          </p>
        </div>

        {/* ── DESKTOP CONNECTED 4-STEP TIMELINE ── */}
        <div className="hiw-timeline" role="list" aria-label="Crops Wild 4-step user journey">

          {/* Connecting track line behind the step nodes */}
          <div className="hiw-track-wrap" aria-hidden="true">
            <div className="hiw-track" ref={lineRef}>
              <div className="hiw-track__fill" />
            </div>
            {/* Animated traveling dot */}
            <div className="hiw-track__dot" aria-hidden="true" />
          </div>

          {/* Step cards */}
          {STEPS.map((step, i) => (
            <article
              key={step.id}
              className={`hiw-step hiw-reveal hiw-reveal--delay-${i}`}
              role="listitem"
              aria-label={`Step ${step.num}: ${step.title}`}
            >
              {/* Number badge + connector */}
              <div className="hiw-step__badge-wrap">
                <div className={`hiw-step__badge hiw-step__badge--${step.color}`}>
                  <span className="hiw-step__num">{step.num}</span>
                </div>
              </div>

              {/* Card body */}
              <div className={`hiw-step__card hiw-step__card--${step.color}`}>
                {/* Note Badge */}
                <span className={`hiw-step__note-badge hiw-step__note-badge--${step.color}`}>
                  {step.note}
                </span>

                {/* Illustration */}
                <div className="hiw-step__icon" aria-hidden="true">
                  {step.icon}
                </div>

                {/* Text */}
                <h3 className="hiw-step__title">{step.title}</h3>
                <p className="hiw-step__desc">{step.desc}</p>

                {/* Tag pills */}
                <div className="hiw-step__tags">
                  {step.tags.map(t => (
                    <span key={t} className={`hiw-tag hiw-tag--${step.color}`}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Arrow between steps (not on last) */}
              {i < STEPS.length - 1 && (
                <div className="hiw-step__arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                    <path
                      d="M5 12h14M14 7l5 5-5 5"
                      stroke="var(--color-green-400,#52b876)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </article>
          ))}

        </div>

        {/* CTA below timeline */}
        <div className="hiw-cta hiw-reveal">
          <a href="#farm-intelligence" className="btn btn-primary btn-lg" id="hiw-cta-btn">
            Explore Farm Intelligence
            <svg viewBox="0 0 18 18" fill="none" width="16" height="16" aria-hidden="true">
              <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <p className="hiw-cta__note">Set up your profile once · Instant personalized intelligence</p>
        </div>

      </div>
    </section>
  )
}
