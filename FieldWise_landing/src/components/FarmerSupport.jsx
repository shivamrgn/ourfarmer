import { useEffect, useRef } from 'react'
import './FarmerSupport.css'

/* ══════════════════════════════════════════════════════════════
   REFINED SVG ICONS
   ══════════════════════════════════════════════════════════════ */

function SchemesIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="28" height="28">
      {/* Official Government Pillars & Roof */}
      <path d="M4 10L14 4L24 10H4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
      <path d="M7 11V20M11 11V20M17 11V20M21 11V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 21H25M2 24H26" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* Verified star / seal in pediment */}
      <circle cx="14" cy="7.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

function InsuranceIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="28" height="28">
      {/* Protective Shield */}
      <path
        d="M14 3.5L5 7.5V14C5 19.5 8.8 24.2 14 25.5C19.2 24.2 23 19.5 23 14V7.5L14 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Protected Leaf / Crop Inside */}
      <path
        d="M14 19V11C14 11 11 12 11 14.5C11 16.5 12.5 17.5 14 17.5C15.5 17.5 17 16.5 17 14.5C17 12 14 11 14 11Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.2"
      />
      {/* Umbrella arch canopy */}
      <path d="M9 11C9 8.2 11.2 6 14 6C16.8 6 19 8.2 19 11" stroke="currentColor" strokeWidth="1.3" strokeDasharray="1.5 1.5" />
    </svg>
  )
}

function SubsidiesIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="28" height="28">
      {/* Coins / Grant Subvention */}
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.1" />
      <path d="M11 7.5V14.5M8.5 9H13.5M8.5 11.5H12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Secondary Subsidized Machinery Gear / Coin */}
      <path d="M15 15.5C15 13.5 16.8 11.8 19 11.8C21.2 11.8 23 13.5 23 15.5C23 17.5 21.2 19.2 19 19.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 1.5" />
      <path d="M17 19.5L19 22L24 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProgramsIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="28" height="28">
      {/* Hands holding sapling / Extension Network */}
      <path
        d="M5 19C7 17 9 17 11 18.5L14 20.5L17 18.5C19 17 21 17 23 19"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Growing Sapling */}
      <path d="M14 20V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M14 10C14 7 10 7 10 10C12 10.5 13.5 11 14 10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M14 12C14 9.5 18 9.5 18 12C16 12.5 14.5 13 14 12Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="currentColor"
        fillOpacity="0.2"
      />
      {/* Community / Network Dots */}
      <circle cx="6" cy="7" r="1.5" fill="currentColor" opacity="0.6" />
      <circle cx="22" cy="7" r="1.5" fill="currentColor" opacity="0.6" />
      <circle cx="14" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════
   CARD DATA
   ══════════════════════════════════════════════════════════════ */
const SUPPORT_CARDS = [
  {
    id: 'schemes',
    title: 'Government Schemes',
    category: 'Welfare & Income',
    icon: <SchemesIcon />,
    accent: 'schemes',
    description: 'Discover Central and State welfare initiatives designed to support agricultural livelihoods.',
    examples: [
      'PM-KISAN income support directory',
      'National Mission on Sustainable Agriculture',
      'State-specific farmer welfare initiatives',
    ],
    footerTag: 'Central & State Portals',
    discoveryStatus: 'Personalized Matching',
  },
  {
    id: 'insurance',
    title: 'Crop Insurance',
    category: 'Risk Protection',
    icon: <InsuranceIcon />,
    accent: 'insurance',
    description: 'Navigate coverage programs that protect seasonal investments from adverse weather and pestilence.',
    examples: [
      'PMFBY crop notification schedules',
      'Weather-based crop insurance (RWBCIS)',
      'Localized claim intimation timelines',
    ],
    footerTag: 'PMFBY Framework',
    discoveryStatus: 'District Notifications',
  },
  {
    id: 'subsidies',
    title: 'Subsidies',
    category: 'Equipment & Inputs',
    icon: <SubsidiesIcon />,
    accent: 'subsidies',
    description: 'Identify capital grants for solar irrigation, farm mechanization, and precision infrastructure.',
    examples: [
      'PM-KUSUM solar pump subventions',
      'SMAM agricultural machinery grants',
      'Micro-irrigation & drip system subsidies',
    ],
    footerTag: 'DBT Direct Benefit',
    discoveryStatus: 'Category Eligibility',
  },
  {
    id: 'programs',
    title: 'Agricultural Support Programs',
    category: 'Institutions & Training',
    icon: <ProgramsIcon />,
    accent: 'programs',
    description: 'Connect with grassroots extension institutes, soil testing centers, and certified seed banks.',
    examples: [
      'Krishi Vigyan Kendra (KVK) training camps',
      'Soil Health Card testing schedules',
      'Certified seed distribution campaigns',
    ],
    footerTag: 'ICAR & KVK Network',
    discoveryStatus: 'Local Center Discovery',
  },
]

export default function FarmerSupport({ onOpenAuth }) {
  const sectionRef = useRef(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const items = sectionRef.current.querySelectorAll('.fs-reveal')
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('fs-reveal--in')
            observer.unobserve(e.target)
          }
        })
      },
      { threshold: 0.1 }
    )
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      className="fs-section"
      id="farmer-support"
      aria-labelledby="fs-heading"
      ref={sectionRef}
    >
      <div className="container">

        {/* Section Header */}
        <div className="fs-header fs-reveal">
          <span className="fs-eyebrow">
            <span>Institutional Assistance</span>
            <span className="fs-eyebrow__badge">Discovery Hub</span>
          </span>
          <h2 className="fs-heading" id="fs-heading">
            FARMER SUPPORT, BEYOND AI
          </h2>
          <p className="fs-subtext">
            Artificial intelligence is just the start. Crops Wild helps farmers navigate the vast landscape of government agricultural programs, institutional subsidies, and financial safeguards tailored to their operational profile.
          </p>
        </div>

        {/* Personalized Discovery Concept Workflow Banner */}
        <div className="fs-discovery-flow fs-reveal">
          <div className="fs-flow-caption">
            <span>Personalized Discovery Concept</span>
          </div>

          <div className="fs-flow-steps">
            {/* Step 1: Farmer Profile */}
            <div className="fs-flow-step">
              <span className="fs-step-tag">Step 1</span>
              <h3 className="fs-step-title">
                <span>👤</span>
                Farmer Profile
              </h3>
              <p className="fs-step-desc">
                Operational land holding size (Small, Marginal, or Large) and ownership classification.
              </p>
            </div>

            {/* Connector 1 */}
            <div className="fs-flow-arrow" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Step 2: Location + Crop + Farm Info */}
            <div className="fs-flow-step">
              <span className="fs-step-tag">Step 2</span>
              <h3 className="fs-step-title">
                <span>📍</span>
                Location + Crop + Farm Info
              </h3>
              <p className="fs-step-desc">
                State & District jurisdiction, current seasonal crops, and irrigation setup (Drip/Solar/Borewell).
              </p>
            </div>

            {/* Connector 2 */}
            <div className="fs-flow-arrow" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Step 3: Relevant Schemes */}
            <div className="fs-flow-step fs-flow-step--target">
              <span className="fs-step-tag">Step 3</span>
              <h3 className="fs-step-title">
                <span>🎯</span>
                Relevant Schemes
              </h3>
              <p className="fs-step-desc">
                Curated government programs, open application windows, and direct links to official ministry portals.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Feature Cards Grid */}
        <div className="fs-grid" role="list">
          {SUPPORT_CARDS.map((card, i) => (
            <article
              key={card.id}
              className={`fs-card fs-card--${card.accent} fs-reveal`}
              style={{ transitionDelay: `${0.05 * i}s` }}
              role="listitem"
              aria-label={card.title}
            >
              <div className="fs-card__top">
                <div className="fs-card__icon-wrap" aria-hidden="true">
                  {card.icon}
                </div>
                <span className="fs-card__category">{card.category}</span>
              </div>

              <h3 className="fs-card__title">{card.title}</h3>
              <p className="fs-card__desc">{card.description}</p>

              <ul className="fs-card__schemes-list" aria-label={`Examples of ${card.title}`}>
                {card.examples.map((ex, idx) => (
                  <li key={idx}>
                    <span className="fs-card__bullet" aria-hidden="true" />
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>

              <div className="fs-card__footer">
                <span className="fs-card__badge">{card.footerTag}</span>
                {card.id === 'programs' ? (
                  <a href="#expert-support" className="fs-card__status-dot" style={{ textDecoration: 'none', cursor: 'pointer' }} title="Explore KVK Directory & Agricultural Support">
                    <span className="fs-card__dot" aria-hidden="true" />
                    KVK Directory ↓
                  </a>
                ) : (
                  <span className="fs-card__status-dot">
                    <span className="fs-card__dot" aria-hidden="true" />
                    {card.discoveryStatus}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* CTA & Transparent Disclaimer */}
        <div className="fs-action-wrap fs-reveal">
          <button
            type="button"
            className="fs-cta-btn"
            id="explore-farmer-support-btn"
            onClick={() => onOpenAuth && onOpenAuth('register')}
          >
            <span>Explore Farmer Support</span>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3.75 9H14.25M14.25 9L9.75 4.5M14.25 9L9.75 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Mandatory Disclaimer */}
          <div className="fs-disclaimer">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2.5a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8zm-1 3.5h2v6H7V7z" />
            </svg>
            <span>
              <strong>Demo Preview Only:</strong> Scheme rules, eligibility criteria, and disbursement approvals are governed solely by verified official government departments and portals. Crops Wild provides guided discovery and does not guarantee eligibility or sanction.
            </span>
          </div>
        </div>

      </div>
    </section>
  )
}
