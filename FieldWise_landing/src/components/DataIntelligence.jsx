import { useState, useEffect, useRef } from 'react'
import './DataIntelligence.css'

/* ══════════════════════════════════════════════════════════════
   ICONS & SVGs
══════════════════════════════════════════════════════════════ */

function SoilDataIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#fdf6ec" />
      <path d="M10 22 C14 20 18 24 22 22 C26 20 30 24 30 22" stroke="#c47c2b" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 28 C14 26 18 30 22 28 C26 26 30 30 30 28" stroke="#8b5a22" strokeWidth="1.75" strokeLinecap="round" opacity="0.6" />
      <circle cx="16" cy="14" r="3" fill="#c47c2b" opacity="0.3" />
      <path d="M20 22 L20 12 C20 9 23 8 25 10 C23 13 21 13 20 12Z" fill="#3a9c5f" />
    </svg>
  )
}

function WeatherDataIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#eff6ff" />
      <circle cx="26" cy="15" r="5" stroke="#2563eb" strokeWidth="1.75" />
      <path d="M27 25 C27 22 24.5 20 21.5 20 C19.5 20 17.8 21.2 17 22.8 C16.2 22.3 15.2 22 14.2 22 C12 22 10 24 10 26.2 C10 28.5 12 30 14.5 30 H27 C29 30 30.5 28.5 30.5 26.5 C30.5 25.2 29.8 24.1 28.7 23.5"
        stroke="#2563eb" strokeWidth="1.75" strokeLinejoin="round" fill="#ffffff" />
      <path d="M16 33 L15 36 M21 33 L20 36 M26 33 L25 36" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

function CropInfoIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#f0faf4" />
      <path d="M20 32 V10" stroke="#2d7a4a" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 12 C23 10 27 12 26 16 C23 16 21 14 20 12 Z" fill="#52b876" stroke="#2d7a4a" strokeWidth="1.25" />
      <path d="M20 18 C17 16 13 18 14 22 C17 22 19 20 20 18 Z" fill="#7dcf98" stroke="#2d7a4a" strokeWidth="1.25" />
      <path d="M20 24 C23 22 27 24 26 28 C23 28 21 26 20 24 Z" fill="#52b876" stroke="#2d7a4a" strokeWidth="1.25" />
    </svg>
  )
}

function PlantHealthIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#fef2f2" />
      {/* Scan frame */}
      <path d="M12 15 V12 H15 M25 12 H28 V15 M28 25 V28 H25 M15 28 H12 V25" stroke="#dc2626" strokeWidth="1.75" strokeLinecap="round" />
      {/* Leaf inside scan */}
      <path d="M20 26 C20 26 25 21 24 16 C19 15 16 20 16 20 Z" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.5" />
      <circle cx="21" cy="19" r="1.5" fill="#dc2626" />
    </svg>
  )
}

function CpuNeuralIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Outer Chip glow */}
      <rect x="10" y="10" width="28" height="28" rx="8" fill="#1a4a2e" stroke="#52b876" strokeWidth="2" />
      {/* Chip Pins */}
      <path d="M17 10 V6 M24 10 V6 M31 10 V6 M17 38 V42 M24 38 V42 M31 38 V42 M10 17 H6 M10 24 H6 M10 31 H6 M38 17 H42 M38 24 H42 M38 31 H42" 
        stroke="#7dcf98" strokeWidth="1.75" strokeLinecap="round" />
      {/* Inner Leaf + Neural Net */}
      <circle cx="24" cy="24" r="5" fill="#3a9c5f" />
      <circle cx="18" cy="18" r="2" fill="#7dcf98" />
      <circle cx="30" cy="18" r="2" fill="#7dcf98" />
      <circle cx="18" cy="30" r="2" fill="#7dcf98" />
      <circle cx="30" cy="30" r="2" fill="#7dcf98" />
      <path d="M20 20 L22 22 M28 20 L26 22 M20 28 L22 26 M28 28 L26 26" stroke="#b3e4c5" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════
   DATA DEFINITIONS
══════════════════════════════════════════════════════════════ */

const INPUT_STREAMS = [
  {
    id: 'soil',
    name: 'Soil Data',
    icon: <SoilDataIcon />,
    metric: 'pH 6.8 • Clay-Loam',
    detail: 'NPK profile, organic carbon & moisture',
    accent: 'earth',
    tag: 'Field Sensors & Lab',
  },
  {
    id: 'weather',
    name: 'Weather Data',
    icon: <WeatherDataIcon />,
    metric: '27°C • 68% Humidity',
    detail: 'Rainfall radar, frost alert & solar radiation',
    accent: 'blue',
    tag: 'Satellite & Forecast',
  },
  {
    id: 'crop',
    name: 'Crop Information',
    icon: <CropInfoIcon />,
    metric: 'Rabi Season • Sowing Phase',
    detail: 'Historical yield, crop type & field geometry',
    accent: 'green',
    tag: 'Farmer Inputs',
  },
  {
    id: 'health',
    name: 'Plant Health',
    icon: <PlantHealthIcon />,
    metric: 'Optical Scan • 94% Index',
    detail: 'Leaf chlorophyll, disease spots & foliage state',
    accent: 'red',
    tag: 'Camera & Vision',
  },
]

const RECOMMENDATIONS = [
  {
    id: 'crop',
    category: 'Recommended Crop',
    title: 'Wheat (Sharbati HD-2967)',
    badge: '98% Suitability Match',
    badgeType: 'success',
    iconBg: '#f0faf4',
    iconColor: '#2d7a4a',
    summary: 'Optimal choice for your clay-loam soil and projected winter moisture window.',
    keyStats: [
      { label: 'Expected Yield', value: '22–25 q/acre' },
      { label: 'Sowing Window', value: 'Oct 20 – Nov 15' },
      { label: 'Water Need', value: '4 Irrigations' },
    ],
    actionNote: 'High drought resistance and premium market rate in nearby mandis.',
  },
  {
    id: 'fertilizer',
    category: 'Fertilizer Insight',
    title: 'Nitrogen requirement is moderate.',
    badge: 'Targeted Dosage',
    badgeType: 'warning',
    iconBg: '#fdf6ec',
    iconColor: '#c47c2b',
    summary: 'Soil analysis indicates adequate residual potassium; focus on balanced nitrogen application.',
    keyStats: [
      { label: 'Urea Dose', value: '45 kg / acre' },
      { label: 'Application Time', value: 'Tillering stage' },
      { label: 'Savings', value: '~₹850 / acre' },
    ],
    actionNote: 'Split into 2 equal doses to prevent leaching and maximize plant uptake.',
  },
  {
    id: 'disease',
    category: 'Crop Health',
    title: 'Potential disease detected.',
    badge: 'Early Alert',
    badgeType: 'danger',
    iconBg: '#fef2f2',
    iconColor: '#dc2626',
    summary: 'Early Leaf Spot (Cercospora) detected from leaf image analysis with 89% confidence.',
    keyStats: [
      { label: 'Affected Area', value: 'Lower foliage (~6%)' },
      { label: 'Severity', value: 'Stage 1 (Contained)' },
      { label: 'Urgency', value: 'Act within 48h' },
    ],
    actionNote: 'Spray Mancozeb 75% WP @ 2g/litre to halt spore spread before next rainfall.',
  },
]

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */

export default function DataIntelligence() {
  const sectionRef = useRef(null)
  const [activeInput, setActiveInput] = useState(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const elements = sectionRef.current.querySelectorAll('.di-reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('di-reveal--visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      className="di-section"
      id="intelligence-pipeline"
      aria-labelledby="di-main-heading"
      ref={sectionRef}
    >
      <div className="container">

        {/* Section Header */}
        <div className="di-header di-reveal">
          <span className="eyebrow">Connected Intelligence</span>
          <h2 className="di-heading" id="di-main-heading">
            From raw data to useful decisions.
          </h2>
          <p className="di-subtext">
            Farming data is only valuable when it answers the question: <em>"What should I do right now?"</em>{' '}
            Here is how Crops Wild synthesizes complex environmental signals into clear, field-ready guidance.
          </p>
        </div>

        {/* ── INTELLIGENCE PIPELINE DIAGRAM ── */}
        <div className="di-pipeline di-reveal">

          {/* 1. INPUT NODES (Stage 1) */}
          <div className="di-stage di-stage--inputs">
            <div className="di-stage__badge">
              <span className="di-pulse-dot" aria-hidden="true" />
              Stage 1: Multi-Source Farm Data
            </div>

            <div className="di-inputs-grid" role="list">
              {INPUT_STREAMS.map((item) => (
                <div
                  key={item.id}
                  className={`di-input-card di-input-card--${item.accent} ${
                    activeInput === item.id ? 'is-active' : ''
                  }`}
                  role="listitem"
                  onMouseEnter={() => setActiveInput(item.id)}
                  onMouseLeave={() => setActiveInput(null)}
                >
                  <div className="di-input-card__top">
                    <div className="di-input-card__icon">{item.icon}</div>
                    <span className="di-input-card__tag">{item.tag}</span>
                  </div>
                  <h3 className="di-input-card__name">{item.name}</h3>
                  <div className="di-input-card__metric">{item.metric}</div>
                  <p className="di-input-card__detail">{item.detail}</p>

                  <div className="di-input-card__indicator" aria-hidden="true">
                    <span className="di-stream-line" />
                    <span className="di-stream-dot" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. CONNECTOR TO ENGINE */}
          <div className="di-flow-connector" aria-hidden="true">
            <div className="di-flow-line">
              <div className="di-flow-pulse" />
            </div>
            <div className="di-flow-arrow">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M12 4V20M12 20L6 14M12 20L18 14" stroke="#3a9c5f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* 3. AI PROCESSING HUB (Stage 2) */}
          <div className="di-stage di-stage--engine">
            <div className="di-engine-core">
              <div className="di-engine-core__glow" aria-hidden="true" />
              <div className="di-engine-core__content">
                <div className="di-engine-core__icon">
                  <CpuNeuralIcon />
                </div>
                <div className="di-engine-core__text">
                  <span className="di-engine-core__tag">Stage 2 • Processing Core</span>
                  <h3 className="di-engine-core__title">AI Analysis Engine</h3>
                  <p className="di-engine-core__desc">
                    Machine learning agronomic models correlate soil nutrients, weather forecasts,
                    and leaf imagery against regional agricultural benchmarks.
                  </p>
                </div>
                <div className="di-engine-core__specs">
                  <div className="di-spec-item">
                    <span className="di-spec-val">10,000+</span>
                    <span className="di-spec-lbl">Field Datasets</span>
                  </div>
                  <div className="di-spec-divider" />
                  <div className="di-spec-item">
                    <span className="di-spec-val">&lt; 2.5 sec</span>
                    <span className="di-spec-lbl">Inference Speed</span>
                  </div>
                  <div className="di-spec-divider" />
                  <div className="di-spec-item">
                    <span className="di-spec-val">Local</span>
                    <span className="di-spec-lbl">Climate Calibrated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. CONNECTOR TO INSIGHTS */}
          <div className="di-flow-connector" aria-hidden="true">
            <div className="di-flow-line">
              <div className="di-flow-pulse di-flow-pulse--fast" />
            </div>
            <div className="di-flow-arrow">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M12 4V20M12 20L6 14M12 20L18 14" stroke="#3a9c5f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* 5. PERSONALIZED INSIGHTS BRIDGE (Stage 3) */}
          <div className="di-stage di-stage--output-bridge">
            <div className="di-insights-banner">
              <div className="di-insights-banner__badge">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Stage 3: Generated Output
              </div>
              <h3 className="di-insights-banner__title">Personalized Farming Insights</h3>
              <p className="di-insights-banner__desc">
                Tailored recommendations delivered in plain language, formatted for immediate decision-making on your farm.
              </p>
            </div>
          </div>

        </div>

        {/* ── THREE EXAMPLE RECOMMENDATION CARDS ── */}
        <div className="di-recommendations-wrapper di-reveal">
          <div className="di-recommendations-header">
            <h3 className="di-rec-section-title">Example Actionable Insights</h3>
            <span className="di-rec-section-sub">Generated live from the connected pipeline above</span>
          </div>

          <div className="di-recommendations-grid" role="list">
            {RECOMMENDATIONS.map((rec) => (
              <article
                key={rec.id}
                className={`di-rec-card di-rec-card--${rec.badgeType}`}
                role="listitem"
                aria-label={`${rec.category}: ${rec.title}`}
              >
                {/* Header */}
                <div className="di-rec-card__header">
                  <div className="di-rec-card__meta">
                    <span className="di-rec-card__category">{rec.category}</span>
                    <span className={`di-rec-card__badge di-rec-card__badge--${rec.badgeType}`}>
                      {rec.badge}
                    </span>
                  </div>
                  <h4 className="di-rec-card__title">{rec.title}</h4>
                  <p className="di-rec-card__summary">{rec.summary}</p>
                </div>

                {/* Key stats row */}
                <div className="di-rec-card__stats">
                  {rec.keyStats.map((stat) => (
                    <div key={stat.label} className="di-stat-box">
                      <span className="di-stat-label">{stat.label}</span>
                      <span className="di-stat-value">{stat.value}</span>
                    </div>
                  ))}
                </div>

                {/* Practical Action Note */}
                <div className="di-rec-card__footer">
                  <div className="di-action-box">
                    <span className="di-action-badge">Field Action</span>
                    <p className="di-action-text">{rec.actionNote}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Farmer-friendly assurance footer */}
          <div className="di-assurance-strip">
            <div className="di-assurance-item">
              <span className="di-check-icon">✓</span>
              <span>No complex jargon — straightforward field advice</span>
            </div>
            <div className="di-assurance-item">
              <span className="di-check-icon">✓</span>
              <span>Accounts for regional weather variances</span>
            </div>
            <div className="di-assurance-item">
              <span className="di-check-icon">✓</span>
              <span>Designed to protect your yield and reduce input costs</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
