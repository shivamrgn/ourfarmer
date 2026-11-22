import { useEffect, useRef } from 'react'
import './FinalCTA.css'

/* ── Decorative SVG landscape silhouette ────────────────────── */
function LandscapeSVG() {
  return (
    <svg
      className="fcta-landscape"
      viewBox="0 0 1440 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax slice"
    >
      {/* Far hills */}
      <path
        d="M0 160 C180 100 320 140 480 120 C640 100 720 80 900 110 C1080 140 1200 90 1440 130 L1440 220 L0 220 Z"
        fill="rgba(15, 45, 24, 0.55)"
      />
      {/* Mid hills */}
      <path
        d="M0 180 C120 150 260 170 400 160 C540 150 620 130 800 155 C980 180 1100 145 1280 165 C1360 172 1400 175 1440 170 L1440 220 L0 220 Z"
        fill="rgba(10, 31, 15, 0.75)"
      />
      {/* Wheat stalks row */}
      {[60,140,220,300,380,460,540,620,700,780,860,940,1020,1100,1180,1260,1340,1420].map((x, i) => (
        <g key={i} transform={`translate(${x}, 165)`} opacity={0.5 + (i % 3) * 0.15}>
          {/* Stalk */}
          <line x1="0" y1="0" x2="0" y2="35" stroke="rgba(196,124,43,0.5)" strokeWidth="1.5" strokeLinecap="round" />
          {/* Ear top */}
          <ellipse cx="0" cy="-6" rx="3" ry="9" fill="rgba(196,124,43,0.35)" />
          {/* Side grain left */}
          <ellipse cx="-4" cy="-1" rx="2.5" ry="5" fill="rgba(196,124,43,0.25)" transform="rotate(-15)" />
          {/* Side grain right */}
          <ellipse cx="4" cy="-1" rx="2.5" ry="5" fill="rgba(196,124,43,0.25)" transform="rotate(15)" />
        </g>
      ))}
      {/* Ground floor */}
      <rect x="0" y="196" width="1440" height="24" fill="rgba(10, 31, 15, 0.9)" />
    </svg>
  )
}

/* ── Arrow icon ─────────────────────────────────────────────── */
function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 9H14M14 9L9.5 4.5M14 9L9.5 13.5"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Play icon ──────────────────────────────────────────────── */
function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 6.5L12 9L7.5 11.5V6.5Z" fill="currentColor" />
    </svg>
  )
}

/* ── Trust marks (no invented stats) ───────────────────────── */
const TRUST_MARKS = [
  { icon: '🌱', text: 'Crop guidance' },
  { icon: '🧪', text: 'Soil analysis' },
  { icon: '🌦', text: 'Weather-aware' },
  { icon: '📊', text: 'Data-driven' },
]

/* ── Component ──────────────────────────────────────────────── */
export default function FinalCTA({ onOpenAuth }) {
  const sectionRef = useRef(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const els = sectionRef.current.querySelectorAll('.fcta-reveal')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('fcta-reveal--in'); io.unobserve(e.target) }
      }),
      { threshold: 0.15 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section
      className="fcta-section"
      id="get-started"
      aria-labelledby="fcta-heading"
      ref={sectionRef}
    >
      {/* ── Layered backgrounds ── */}
      <div className="fcta-bg" aria-hidden="true">
        <div className="fcta-bg__radial fcta-bg__radial--top" />
        <div className="fcta-bg__radial fcta-bg__radial--bottom" />
        <div className="fcta-bg__dots" />
        <div className="fcta-bg__horizon" />
      </div>

      {/* ── Content ── */}
      <div className="container fcta-inner">

        {/* Eyebrow */}
        <div className="fcta-reveal fcta-reveal--delay-0">
          <span className="fcta-eyebrow">
            <span className="fcta-eyebrow__dot" aria-hidden="true" />
            Powered by Agricultural Intelligence
          </span>
        </div>

        {/* Heading */}
        <h2
          className="fcta-heading fcta-reveal fcta-reveal--delay-1"
          id="fcta-heading"
        >
          Your farm.{' '}
          <span className="fcta-heading__line">Your data.</span>{' '}
          <span className="fcta-heading__highlight">Smarter decisions.</span>
        </h2>

        {/* Sub-copy */}
        <p className="fcta-subtext fcta-reveal fcta-reveal--delay-2">
          Bring your farming information together and get practical
          AI-powered insights.
        </p>

        {/* CTA buttons */}
        <div className="fcta-actions fcta-reveal fcta-reveal--delay-3">
          <button
            type="button"
            className="fcta-btn fcta-btn--primary"
            id="fcta-primary-btn"
            onClick={() => onOpenAuth && onOpenAuth('register')}
          >
            Start Your Farming Journey
            <ArrowIcon />
          </button>
          <a
            href="#farm-intelligence"
            className="fcta-btn fcta-btn--secondary"
            id="fcta-secondary-btn"
            onClick={(e) => {
              e.preventDefault()
              const target = document.getElementById('farm-intelligence') || document.getElementById('ai-tools')
              if (target) {
                target.scrollIntoView({ behavior: 'smooth' })
                window.history.pushState(null, '', '#farm-intelligence')
              }
            }}
          >
            <PlayIcon />
            Explore Farm Engine
          </a>

        </div>

        {/* Trust marks */}
        <div className="fcta-trust fcta-reveal fcta-reveal--delay-4" aria-label="Platform capabilities">
          {TRUST_MARKS.map(({ icon, text }) => (
            <div className="fcta-trust__item" key={text}>
              <span className="fcta-trust__icon" aria-hidden="true">{icon}</span>
              <span className="fcta-trust__text">{text}</span>
            </div>
          ))}
        </div>

      </div>

      {/* ── Landscape silhouette ── */}
      <LandscapeSVG />
    </section>
  )
}
