import { useEffect, useRef } from 'react'
import './Hero.css'

/* ── Floating AI card data ── */
const AI_CARDS = {
  crop: {
    id: 'crop-health',
    label: 'Crop Health Index',
    value: '94%',
    sub: 'Excellent condition',
    dot: 'green',
    icon: '🌾',
    pos: 'top-left',
  },
  soil: {
    id: 'soil-info',
    label: 'Soil Moisture',
    rows: [
      { key: 'Moisture', val: '68%', bar: 68, color: '#3a9c5f' },
      { key: 'pH Level', val: '6.8', bar: 68, color: '#c47c2b' },
      { key: 'Nitrogen', val: 'Optimal', bar: 80, color: '#3a9c5f' },
    ],
    pos: 'bottom-left',
  },
  recommendation: {
    id: 'ai-rec',
    label: 'AI Recommendation',
    crop: 'Wheat — HD-2967',
    detail: 'Optimal planting window: Next 4 days',
    yield: '+23% yield potential',
    pos: 'top-right',
  },
  weather: {
    id: 'weather-card',
    label: 'Field Forecast',
    temp: '26°C',
    desc: 'Partly cloudy · 12 km/h NE wind',
    rain: '18% rain chance — low risk',
    pos: 'bottom-right',
  },
}

/* ── Trust badge data ── */
const TRUST_ITEMS = [
  { icon: '🤖', label: 'AI-powered insights' },
  { icon: '👨‍🌾', label: 'Farmer-focused' },
  { icon: '📊', label: 'Data-driven recommendations' },
]

/* ── Pulse dot ── */
function PulseDot({ color = 'green' }) {
  return (
    <span className={`hero-dot hero-dot--${color}`} aria-hidden="true" />
  )
}

/* ── Crop health floating card ── */
function CropHealthCard() {
  return (
    <div className="hero-float-card hero-float-card--crop" id="crop-health-card" aria-label="Crop Health Index">
      <div className="hero-float-card__header">
        <span className="hero-float-card__icon">🌾</span>
        <span className="hero-float-card__label">Crop Health Index</span>
        <PulseDot color="green" />
      </div>
      <div className="hero-float-card__big">94%</div>
      <div className="hero-float-card__progress">
        <div className="hero-float-card__progress-bar" style={{ width: '94%' }} />
      </div>
      <div className="hero-float-card__sub">Excellent condition</div>
    </div>
  )
}

/* ── Soil info floating card ── */
function SoilCard() {
  return (
    <div className="hero-float-card hero-float-card--soil" id="soil-card" aria-label="Soil Analysis">
      <div className="hero-float-card__header">
        <span className="hero-float-card__icon">🪱</span>
        <span className="hero-float-card__label">Soil Analysis</span>
      </div>
      {[
        { key: 'Moisture', val: '68%', w: 68, c: '#3a9c5f' },
        { key: 'pH Level', val: '6.8', w: 68, c: '#c47c2b' },
        { key: 'Nitrogen', val: 'Optimal', w: 80, c: '#3a9c5f' },
      ].map(({ key, val, w, c }) => (
        <div className="hero-float-card__row" key={key}>
          <div className="hero-float-card__row-meta">
            <span className="hero-float-card__row-key">{key}</span>
            <span className="hero-float-card__row-val" style={{ color: c }}>{val}</span>
          </div>
          <div className="hero-float-card__mini-bar">
            <div className="hero-float-card__mini-fill" style={{ width: `${w}%`, background: c }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── AI Recommendation card ── */
function RecommendationCard() {
  return (
    <div className="hero-float-card hero-float-card--rec" id="ai-rec-card" aria-label="AI Recommendation">
      <div className="hero-float-card__header">
        <span className="hero-float-card__badge">AI</span>
        <span className="hero-float-card__label">Recommendation</span>
      </div>
      <div className="hero-float-card__crop-name">Wheat — HD-2967</div>
      <div className="hero-float-card__detail">⏱ Optimal planting window: Next 4 days</div>
      <div className="hero-float-card__yield">
        <span className="hero-float-card__yield-arrow">↑</span>
        +23% yield potential
      </div>
    </div>
  )
}

/* ── Weather card ── */
function WeatherCard() {
  return (
    <div className="hero-float-card hero-float-card--weather" id="weather-card" aria-label="Field Forecast">
      <div className="hero-float-card__weather-top">
        <span className="hero-float-card__weather-icon">⛅</span>
        <div>
          <div className="hero-float-card__temp">26°C</div>
          <div className="hero-float-card__weather-desc">Partly cloudy · 12 km/h NE</div>
        </div>
      </div>
      <div className="hero-float-card__rain">
        <span>🌧</span> 18% rain chance — low risk
      </div>
    </div>
  )
}

/* ── Main Hero Section ── */
export default function Hero({ onOpenAuth }) {
  const sectionRef = useRef(null)

  /* Scroll-reveal on mount */
  useEffect(() => {
    const items = sectionRef.current?.querySelectorAll('.hero-reveal')
    if (!items?.length) return
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('hero-reveal--in'); observer.unobserve(e.target) }
      }),
      { threshold: 0.15 }
    )
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      className="hero-section"
      id="home"
      aria-label="Hero — Crops Wild farming platform"
      ref={sectionRef}
    >
      {/* Dot-pattern background layer */}
      <div className="hero-bg-dots" aria-hidden="true" />

      <div className="container">
        <div className="hero-inner">

          {/* ══════════════════════════════════
              LEFT — Text content
          ══════════════════════════════════ */}
          <div className="hero-content">

            {/* Eyebrow */}
            <div className="hero-reveal hero-reveal--delay-0">
              <span className="hero-eyebrow">
                <span className="hero-eyebrow__dot" aria-hidden="true" />
                Powered by Artificial Intelligence
              </span>
            </div>

            {/* Headline */}
            <h1 className="hero-headline hero-reveal hero-reveal--delay-1">
              Smarter Farming Starts With{' '}
              <span className="hero-headline__highlight">
                Better Decisions.
              </span>
            </h1>

            {/* Sub-copy */}
            <p className="hero-subtext hero-reveal hero-reveal--delay-2">
              AI-powered crop recommendations, fertilizer guidance, plant
              disease detection and farming insights — all in one simple platform.
            </p>

            {/* CTA row */}
            <div className="hero-cta-row hero-reveal hero-reveal--delay-3">
              <button
                type="button"
                className="btn btn-primary btn-lg hero-cta-primary"
                id="hero-cta-primary"
                onClick={() => onOpenAuth && onOpenAuth('register')}
                style={{ cursor: 'pointer', border: 'none' }}
              >
                Start Farming Smarter
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M4 9H14M14 9L9.5 4.5M14 9L9.5 13.5"
                    stroke="currentColor" strokeWidth="1.75"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              </button>
              <a
                href="#farm-intelligence"
                className="btn btn-secondary btn-lg hero-cta-secondary"
                id="hero-cta-secondary"
                onClick={(e) => {
                  e.preventDefault()
                  const target = document.getElementById('farm-intelligence') || document.getElementById('ai-tools')
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth' })
                    window.history.pushState(null, '', '#farm-intelligence')
                  }
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 6.5L12 9L7 11.5V6.5Z" fill="currentColor"/>
                </svg>
                Explore Farm Engine
              </a>

            </div>

            {/* Trust indicators */}
            <div className="hero-trust hero-reveal hero-reveal--delay-4">
              {TRUST_ITEMS.map(({ icon, label }) => (
                <div className="hero-trust__item" key={label}>
                  <span className="hero-trust__icon" aria-hidden="true">{icon}</span>
                  <span className="hero-trust__label">{label}</span>
                </div>
              ))}
            </div>

          </div>

          {/* ══════════════════════════════════
              RIGHT — Visual with floating cards
          ══════════════════════════════════ */}
          <div className="hero-visual hero-reveal hero-reveal--delay-1">

            {/* Main image */}
            <div className="hero-image-wrap">
              <img
                src="/hero-farm.jpg"
                alt="Indian farmer inspecting wheat crops in a golden field at sunrise"
                className="hero-image"
                width="720"
                height="540"
                loading="eager"
                fetchPriority="high"
              />
              {/* Subtle inner vignette */}
              <div className="hero-image-overlay" aria-hidden="true" />
            </div>

            {/* ── Floating AI data cards ── */}
            <div className="hero-cards" aria-label="Live farm data indicators">
              <CropHealthCard />
              <SoilCard />
              <RecommendationCard />
              <WeatherCard />
            </div>

            {/* Decorative circle ring */}
            <div className="hero-ring hero-ring--outer" aria-hidden="true" />
            <div className="hero-ring hero-ring--inner" aria-hidden="true" />

          </div>
        </div>
      </div>

      {/* Bottom fade-out gradient */}
      <div className="hero-fade-bottom" aria-hidden="true" />
    </section>
  )
}
