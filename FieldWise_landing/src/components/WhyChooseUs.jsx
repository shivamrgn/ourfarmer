import { useEffect, useRef } from 'react'
import './WhyChooseUs.css'

/* ══════════════════════════════════════════════════════════════
   ICONS FOR TRUST CARDS (Botanical & Clean)
══════════════════════════════════════════════════════════════ */

function AiPoweredIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="wcu-icon-svg">
      {/* Outer ambient glow */}
      <circle cx="32" cy="32" r="28" fill="#eaf7ee" />
      {/* Central Leaf Structure */}
      <path
        d="M32 46 C32 46 44 38 44 24 C44 16 36 16 32 20 C28 16 20 16 20 24 C20 38 32 46 32 46 Z"
        fill="#d2f0dd"
        stroke="#1a4a2e"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M32 46 V24" stroke="#1a4a2e" strokeWidth="2" strokeLinecap="round" />
      {/* Neural Leaf Nodes */}
      <circle cx="25" cy="27" r="3" fill="#2d7a4a" />
      <circle cx="39" cy="27" r="3" fill="#2d7a4a" />
      <circle cx="32" cy="19" r="3" fill="#1a4a2e" />
      {/* Circuit Interconnects */}
      <path d="M25 27 L32 32 L39 27" stroke="#3a9c5f" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M14 32 H17 M47 32 H50 M32 11 V14" stroke="#52b876" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

function DataDrivenIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="wcu-icon-svg">
      {/* Outer ambient glow */}
      <circle cx="32" cy="32" r="28" fill="#fdf4e7" />
      {/* Soil Strata & Measurement Layers */}
      <rect x="16" y="17" width="32" height="7" rx="3.5" fill="#f5e0c3" stroke="#c47c2b" strokeWidth="1.75" />
      <rect x="16" y="28" width="32" height="7" rx="3.5" fill="#e8cbb0" stroke="#8b5a22" strokeWidth="1.75" />
      <rect x="16" y="39" width="32" height="7" rx="3.5" fill="#d9b699" stroke="#6b4319" strokeWidth="1.75" />
      {/* Data Anchor Points */}
      <circle cx="23" cy="20.5" r="2" fill="#c47c2b" />
      <circle cx="32" cy="20.5" r="2" fill="#c47c2b" />
      <circle cx="41" cy="20.5" r="2" fill="#c47c2b" />
      {/* Precision Measurement Gauge */}
      <path d="M50 18 V46" stroke="#c47c2b" strokeWidth="1.75" strokeLinecap="round" strokeDasharray="3 3" />
      <circle cx="50" cy="31.5" r="2.5" fill="#c47c2b" />
    </svg>
  )
}

function FarmerFriendlyIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="wcu-icon-svg">
      {/* Outer ambient glow */}
      <circle cx="32" cy="32" r="28" fill="#eaf7ee" />
      {/* Caring Protective Shield */}
      <path
        d="M32 15 C41 15 46 19 46 27 C46 38 37 44 32 48 C27 44 18 38 18 27 C18 19 23 15 32 15 Z"
        fill="#ffffff"
        stroke="#1a4a2e"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Sprout & Leaf */}
      <path d="M32 36 V25" stroke="#2d7a4a" strokeWidth="2.25" strokeLinecap="round" />
      <path d="M32 25 C36 22 40 24 39 28 C36 28 34 26 32 25 Z" fill="#52b876" stroke="#2d7a4a" strokeWidth="1.25" />
      <path d="M32 29 C28 26 24 28 25 32 C28 32 30 30 32 29 Z" fill="#7dcf98" stroke="#2d7a4a" strokeWidth="1.25" />
      {/* Solid Foundation Line */}
      <path d="M26 40 C28 41.5 36 41.5 38 40" stroke="#1a4a2e" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function AllInOneIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="wcu-icon-svg">
      {/* Outer ambient glow */}
      <circle cx="32" cy="32" r="28" fill="#edf4ff" />
      {/* Central Hub */}
      <circle cx="32" cy="32" r="8" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
      <circle cx="32" cy="32" r="3" fill="#2563eb" />
      {/* Surrounding Connected Nodes */}
      <circle cx="19" cy="32" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="1.75" />
      <circle cx="45" cy="32" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="1.75" />
      <circle cx="32" cy="19" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="1.75" />
      <circle cx="32" cy="45" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="1.75" />
      {/* Interconnecting Spoke Channels */}
      <path d="M23 32 H24 M40 32 H41 M32 23 V24 M32 40 V41" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════
   TRUST PILLARS DATA
══════════════════════════════════════════════════════════════ */

const TRUST_CARDS = [
  {
    id: 'ai-powered',
    title: 'AI-Powered',
    desc: 'Machine learning helps turn agricultural data into useful insights.',
    Icon: AiPoweredIcon,
    theme: 'green',
  },
  {
    id: 'data-driven',
    title: 'Data-Driven',
    desc: 'Recommendations are based on farm and environmental information.',
    Icon: DataDrivenIcon,
    theme: 'amber',
  },
  {
    id: 'farmer-friendly',
    title: 'Farmer-Friendly',
    desc: 'Complex technology is presented in a simple and understandable way.',
    Icon: FarmerFriendlyIcon,
    theme: 'emerald',
  },
  {
    id: 'all-in-one',
    title: 'All-in-One',
    desc: 'Multiple farming intelligence tools are available in one ecosystem.',
    Icon: AllInOneIcon,
    theme: 'blue',
  },
]

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */

export default function WhyChooseUs() {
  const sectionRef = useRef(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const elements = sectionRef.current.querySelectorAll('.wcu-reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('wcu-reveal--in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      className="wcu-section"
      id="why-choose-us"
      aria-labelledby="wcu-heading"
      ref={sectionRef}
    >
      <div className="container">

        {/* Section Header */}
        <div className="wcu-header wcu-reveal">
          <span className="wcu-eyebrow">Platform Foundations</span>
          <h2 className="wcu-heading" id="wcu-heading">
            Why Farmers Choose Smarter Tools
          </h2>
          <p className="wcu-subtext">
            Built from the ground up to respect how farming actually works — grounded in practical utility,
            field realities, and straightforward advice.
          </p>
        </div>

        {/* 4 Trust Cards */}
        <div className="wcu-grid" role="list">
          {TRUST_CARDS.map(({ id, title, desc, Icon, theme }, i) => (
            <article
              key={id}
              className={`wcu-card wcu-card--${theme} wcu-reveal wcu-reveal--delay-${i}`}
              role="listitem"
              aria-label={title}
            >
              <div className="wcu-card__icon-box">
                <Icon />
              </div>
              <h3 className="wcu-card__title">{title}</h3>
              <p className="wcu-card__desc">{desc}</p>
              <div className={`wcu-card__accent-bar wcu-card__accent-bar--${theme}`} aria-hidden="true" />
            </article>
          ))}
        </div>

      </div>
    </section>
  )
}
