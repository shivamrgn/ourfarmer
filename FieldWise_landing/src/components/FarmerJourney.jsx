import { useEffect, useRef } from 'react'
import './FarmerJourney.css'

/* ══════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════ */

function SoilIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className="fj-input-icon">
      <rect x="4" y="10" width="24" height="5" rx="2.5" fill="#e8cbb0" stroke="#c47c2b" strokeWidth="1.5" />
      <rect x="4" y="18" width="24" height="5" rx="2.5" fill="#d9b699" stroke="#8b5a22" strokeWidth="1.5" />
      <circle cx="10" cy="12.5" r="1.5" fill="#c47c2b" />
      <circle cx="16" cy="12.5" r="1.5" fill="#c47c2b" />
      <circle cx="22" cy="12.5" r="1.5" fill="#c47c2b" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className="fj-input-icon">
      <path d="M16 4C12.134 4 9 7.134 9 11C9 16.5 16 28 16 28C16 28 23 16.5 23 11C23 7.134 19.866 4 16 4Z"
        fill="#d9f2e5" stroke="#2d7a4a" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="16" cy="11" r="3" fill="#2d7a4a" />
    </svg>
  )
}

function CropIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className="fj-input-icon">
      <path d="M16 28V14" stroke="#1a4a2e" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 14C19 11 23 12 22 16C19 16 17 15 16 14Z" fill="#52b876" stroke="#2d7a4a" strokeWidth="1.25" />
      <path d="M16 18C13 15 9 16 10 20C13 20 15 19 16 18Z" fill="#7dcf98" stroke="#2d7a4a" strokeWidth="1.25" />
      <path d="M10 28H22" stroke="#c47c2b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function AIBrainIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="fj-ai-icon">
      <circle cx="32" cy="32" r="30" fill="#0f2d18" />
      <circle cx="32" cy="32" r="22" fill="#1a4a2e" />
      {/* Neural network lines */}
      <path d="M20 24L32 32L44 24M20 40L32 32M44 40L32 32"
        stroke="#52b876" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      {/* Nodes */}
      <circle cx="20" cy="24" r="3" fill="#3a9c5f" />
      <circle cx="44" cy="24" r="3" fill="#3a9c5f" />
      <circle cx="20" cy="40" r="3" fill="#3a9c5f" />
      <circle cx="44" cy="40" r="3" fill="#3a9c5f" />
      <circle cx="32" cy="32" r="5" fill="#52b876" />
      {/* Pulse ring */}
      <circle cx="32" cy="32" r="28" stroke="#52b876" strokeWidth="1" opacity="0.2" />
    </svg>
  )
}

function SuitabilityIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className="fj-output-icon">
      <circle cx="14" cy="14" r="13" fill="#d9f2e5" stroke="#2d7a4a" strokeWidth="1.5" />
      <path d="M8 14L12 18L20 10" stroke="#1a4a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FertilizerIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className="fj-output-icon">
      <circle cx="14" cy="14" r="13" fill="#fdf4e7" stroke="#c47c2b" strokeWidth="1.5" />
      <path d="M14 8V20M9 13H19" stroke="#c47c2b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function DiseaseIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className="fj-output-icon">
      <circle cx="14" cy="14" r="13" fill="#edf4ff" stroke="#2563eb" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="5" fill="none" stroke="#2563eb" strokeWidth="1.5" />
      <path d="M14 9V7M14 21V19M9 14H7M21 14H19"
        stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function YieldIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className="fj-output-icon">
      <circle cx="14" cy="14" r="13" fill="#eaf7ee" stroke="#3a9c5f" strokeWidth="1.5" />
      <path d="M8 19L12 14L16 16L20 10" stroke="#2d7a4a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════
   DATA
══════════════════════════════════════════════════════════ */

const INPUTS = [
  { id: 'soil', label: 'Soil information', detail: 'Type, moisture, pH, nitrogen levels', Icon: SoilIcon },
  { id: 'location', label: 'Location', detail: 'Region, climate zone, elevation', Icon: LocationIcon },
  { id: 'crop', label: 'Crop information', detail: 'Crop type, growth stage, area size', Icon: CropIcon },
]

const OUTPUTS = [
  { id: 'suitability', label: 'Crop suitability', detail: 'Best-fit crops for your soil & climate', Icon: SuitabilityIcon, theme: 'green' },
  { id: 'fertilizer', label: 'Fertilizer recommendation', detail: 'Nutrient plan based on soil analysis', Icon: FertilizerIcon, theme: 'amber' },
  { id: 'disease', label: 'Disease analysis', detail: 'Risk assessment for common crop issues', Icon: DiseaseIcon, theme: 'blue' },
  { id: 'yield', label: 'Yield prediction', detail: 'Expected output range for the season', Icon: YieldIcon, theme: 'emerald' },
]

/* ══════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════ */

export default function FarmerJourney() {
  const sectionRef = useRef(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const els = sectionRef.current.querySelectorAll('.fj-reveal')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('fj-reveal--in'); io.unobserve(e.target) }
      }),
      { threshold: 0.1 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section
      className="fj-section"
      id="farmer-journey"
      aria-labelledby="fj-heading"
      ref={sectionRef}
    >
      <div className="container">

        {/* ── Section Header ── */}
        <div className="fj-header fj-reveal">
          <span className="fj-eyebrow">Platform in Action</span>
          <h2 className="fj-heading" id="fj-heading">
            See How It Works for a Farmer
          </h2>
          <p className="fj-subtext">
            A walkthrough of the end-to-end experience — from entering farm data
            to receiving AI-generated guidance.
          </p>
        </div>

        {/* ── Demo Badge + Farmer Profile ── */}
        <div className="fj-profile-wrap fj-reveal fj-reveal--delay-1">
          <div className="fj-demo-badge" role="note" aria-label="This is a fictional demo scenario">
            <span className="fj-demo-badge__dot" aria-hidden="true" />
            Demo scenario — fictional farmer profile
          </div>
          <div className="fj-profile">
            <div className="fj-profile__avatar" aria-hidden="true">
              <span>S</span>
            </div>
            <div className="fj-profile__info">
              <p className="fj-profile__name">Shivam</p>
              <p className="fj-profile__meta">Growing <strong>Wheat</strong> · Uttar Pradesh</p>
            </div>
            <div className="fj-profile__tag">Demo farmer</div>
          </div>
        </div>

        {/* ── Journey ── */}
        <div className="fj-journey" aria-label="Input to output journey">

          {/* STEP 1 — Inputs */}
          <div className="fj-step fj-reveal fj-reveal--delay-2">
            <div className="fj-step__label">
              <span className="fj-step__num">1</span>
              Farmer enters
            </div>
            <ul className="fj-input-list" role="list">
              {INPUTS.map(({ id, label, detail, Icon }) => (
                <li key={id} className="fj-input-item">
                  <div className="fj-input-icon-box">
                    <Icon />
                  </div>
                  <div>
                    <p className="fj-input-item__label">{label}</p>
                    <p className="fj-input-item__detail">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Arrow → */}
          <div className="fj-arrow fj-reveal fj-reveal--delay-3" aria-hidden="true">
            <div className="fj-arrow__line" />
            <div className="fj-arrow__center">
              <AIBrainIcon />
              <span className="fj-arrow__label">AI analysis</span>
            </div>
            <div className="fj-arrow__line" />
          </div>

          {/* STEP 2 — Outputs */}
          <div className="fj-step fj-reveal fj-reveal--delay-4">
            <div className="fj-step__label">
              <span className="fj-step__num">2</span>
              Platform provides
            </div>
            <ul className="fj-output-list" role="list">
              {OUTPUTS.map(({ id, label, detail, Icon, theme }) => (
                <li key={id} className={`fj-output-item fj-output-item--${theme}`}>
                  <Icon />
                  <div>
                    <p className="fj-output-item__label">{label}</p>
                    <p className="fj-output-item__detail">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

        </div>
        {/* end .fj-journey */}

      </div>
    </section>
  )
}
