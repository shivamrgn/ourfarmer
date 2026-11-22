import { useState, useEffect, useRef } from 'react'
import './ExpertAgriculturalSupport.css'

/* ══════════════════════════════════════════════════════════════
   VERIFIED AGRICULTURAL CENTRES (ICAR Accredited KVK Directory)
   No synthetic phone numbers or fictional consultants.
   Uses verified national toll-free MoA&FW numbers & official campus addresses.
   ══════════════════════════════════════════════════════════════ */
const VERIFIED_KVK_CENTRES = [
  {
    id: 'vadodara',
    district: 'Vadodara',
    state: 'Gujarat',
    name: 'Krishi Vigyan Kendra, Vadodara',
    hostInstitute: 'Anand Agricultural University (AAU)',
    address: 'Mangalbharti, Sankheda, Vadodara District, Gujarat - 391125',
    verifiedHelpline: '1800-180-1551',
    helplineType: 'National Kisan Call Centre (Toll-Free, Gujarati / Hindi / English)',
    expertise: [
      'Soil Testing & NPK Health',
      'Cotton & Wheat Disease Diagnosis',
      'Micro-Irrigation & Drip Advisory',
      'Certified Seed Distribution',
    ],
    officialPortal: 'https://kvk.icar.gov.in',
    mapLink: 'https://maps.google.com/?q=Krishi+Vigyan+Kendra+Mangalbharti+Sankheda+Vadodara',
  },
  {
    id: 'pune',
    district: 'Pune',
    state: 'Maharashtra',
    name: 'Krishi Vigyan Kendra, Baramati',
    hostInstitute: 'Agricultural Development Trust / ICAR-ATARI',
    address: 'Malegaon Khurd, Baramati, Pune District, Maharashtra - 413115',
    verifiedHelpline: '1800-180-1551',
    helplineType: 'National Kisan Call Centre (Toll-Free, Marathi / Hindi / English)',
    expertise: [
      'Horticulture & Sugarcane Agronomy',
      'Integrated Pest Management (IPM)',
      'Tissue Culture & Polyhouse Farming',
      'Water Budgeting & Climate Resilient Seeds',
    ],
    officialPortal: 'https://kvk.icar.gov.in',
    mapLink: 'https://maps.google.com/?q=Krishi+Vigyan+Kendra+Baramati+Pune',
  },
  {
    id: 'ludhiana',
    district: 'Ludhiana',
    state: 'Punjab',
    name: 'Krishi Vigyan Kendra, Ludhiana',
    hostInstitute: 'Punjab Agricultural University (PAU)',
    address: 'PAU Extension Centre, Samrala, Ludhiana District, Punjab - 141114',
    verifiedHelpline: '1800-180-1551',
    helplineType: 'National Kisan Call Centre (Toll-Free, Punjabi / Hindi / English)',
    expertise: [
      'Cereal Crop Protection & Rust Alerts',
      'Paddy Stubble Management Technology',
      'Soil Micronutrient Profiling',
      'Farm Machinery Demonstrations',
    ],
    officialPortal: 'https://kvk.icar.gov.in',
    mapLink: 'https://maps.google.com/?q=Krishi+Vigyan+Kendra+Samrala+Ludhiana',
  },
]

export default function ExpertAgriculturalSupport() {
  const [activeDistrict, setActiveDistrict] = useState('vadodara')
  const sectionRef = useRef(null)

  const activeCentre = VERIFIED_KVK_CENTRES.find(c => c.id === activeDistrict) || VERIFIED_KVK_CENTRES[0]

  useEffect(() => {
    if (!sectionRef.current) return
    const items = sectionRef.current.querySelectorAll('.eas-reveal')
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('eas-reveal--in')
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
      className="eas-section"
      id="expert-support"
      aria-labelledby="eas-heading"
      ref={sectionRef}
    >
      <div className="container">

        {/* Section Header */}
        <div className="eas-header eas-reveal">
          <span className="eas-eyebrow">
            <span>Institutional Extension Network</span>
          </span>
          <h2 className="eas-heading" id="eas-heading">
            EXPERT AGRICULTURAL SUPPORT
          </h2>
          <p className="eas-subtext">
            Crops Wild helps farmers connect directly with accredited government agricultural support centres, Krishi Vigyan Kendras (KVKs), and official state agronomy resources in their district.
          </p>
        </div>

        {/* User Flow: 4-Step Discovery Pipeline */}
        <div className="eas-flow-container eas-reveal">
          <div className="eas-flow-heading">
            <span>User Discovery Flow</span>
          </div>

          <div className="eas-flow-grid" role="list">
            {/* Step 1: Farmer Location */}
            <div className="eas-flow-card" role="listitem">
              <span className="eas-flow-card__step-num">Step 1</span>
              <h3 className="eas-flow-card__title">
                <span>📍</span>
                Farmer Location
              </h3>
              <p className="eas-flow-card__desc">
                Identify district, state, and geographic block to map nearest support infrastructure.
              </p>
            </div>

            {/* Connector */}
            <div className="eas-flow-separator" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Step 2: Nearby Agricultural Support */}
            <div className="eas-flow-card" role="listitem">
              <span className="eas-flow-card__step-num">Step 2</span>
              <h3 className="eas-flow-card__title">
                <span>🏢</span>
                Nearby Support
              </h3>
              <p className="eas-flow-card__desc">
                Discover ICAR Krishi Vigyan Kendras (KVKs) and Agricultural Technology centers.
              </p>
            </div>

            {/* Connector */}
            <div className="eas-flow-separator" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Step 3: Centre Information */}
            <div className="eas-flow-card" role="listitem">
              <span className="eas-flow-card__step-num">Step 3</span>
              <h3 className="eas-flow-card__title">
                <span>📋</span>
                Centre Info
              </h3>
              <p className="eas-flow-card__desc">
                Review available scientists, lab testing facilities, and localized advisory services.
              </p>
            </div>

            {/* Connector */}
            <div className="eas-flow-separator" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Step 4: Contact / Directions */}
            <div className="eas-flow-card eas-flow-card--active" role="listitem">
              <span className="eas-flow-card__step-num">Step 4</span>
              <h3 className="eas-flow-card__title">
                <span>🗺️</span>
                Contact / Directions
              </h3>
              <p className="eas-flow-card__desc">
                Access official toll-free government helplines, campus directions, and visit coordinates.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Pillars Grid: Nearby Support, Expertise, Contact, Directions */}
        <div className="eas-pillars-grid eas-reveal">
          {/* Pillar 1: Find Nearby Support */}
          <div className="eas-pillar-box">
            <div className="eas-pillar-top">
              <div className="eas-pillar-icon" aria-hidden="true">📍</div>
              <span className="eas-pillar-badge">Discovery</span>
            </div>
            <h3 className="eas-pillar-title">Find Nearby Support</h3>
            <p className="eas-pillar-desc">
              Locate official Krishi Vigyan Kendras (KVKs) and extension desks across 731+ districts in India based on your farm’s coordinates.
            </p>
          </div>

          {/* Pillar 2: Agricultural Expertise */}
          <div className="eas-pillar-box">
            <div className="eas-pillar-top">
              <div className="eas-pillar-icon" aria-hidden="true">👨‍🌾</div>
              <span className="eas-pillar-badge">Science</span>
            </div>
            <h3 className="eas-pillar-title">Agricultural Expertise</h3>
            <p className="eas-pillar-desc">
              Tap into verified agronomic disciplines: soil scientists, plant protection specialists, agronomists, and crop pathology experts.
            </p>
          </div>

          {/* Pillar 3: Official Contact */}
          <div className="eas-pillar-box">
            <div className="eas-pillar-top">
              <div className="eas-pillar-icon" aria-hidden="true">📞</div>
              <span className="eas-pillar-badge">Verified</span>
            </div>
            <h3 className="eas-pillar-title">Official Contact</h3>
            <p className="eas-pillar-desc">
              Direct connection with the Government of India Kisan Call Centre (Toll-Free 1800-180-1551) and official ICAR university helplines.
            </p>
          </div>

          {/* Pillar 4: Location / Directions */}
          <div className="eas-pillar-box">
            <div className="eas-pillar-top">
              <div className="eas-pillar-icon" aria-hidden="true">🗺️</div>
              <span className="eas-pillar-badge">Navigation</span>
            </div>
            <h3 className="eas-pillar-title">Location / Directions</h3>
            <p className="eas-pillar-desc">
              Accurate verified campus addresses, pin codes, and navigation routes for in-person consultations, seed pickup, and soil testing.
            </p>
          </div>
        </div>

        {/* Verified KVK Directory Explorer Preview */}
        <div className="eas-directory-wrap eas-reveal">
          <div className="eas-dir-header">
            <div className="eas-dir-header__left">
              <span className="eas-dir-title">Official Extension Centre Directory</span>
              <span className="eas-verified-tag">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
                ICAR Accredited
              </span>
            </div>

            <div className="eas-dir-tabs" role="tablist" aria-label="Select state district centre">
              {VERIFIED_KVK_CENTRES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={activeDistrict === c.id}
                  className={`eas-dir-tab ${activeDistrict === c.id ? 'eas-dir-tab--active' : ''}`}
                  onClick={() => setActiveDistrict(c.id)}
                >
                  {c.district} ({c.state})
                </button>
              ))}
            </div>
          </div>

          {/* Centre Details Body */}
          <div className="eas-centre-body">
            <div className="eas-centre-main">
              <h3>{activeCentre.name}</h3>
              <div className="eas-centre-institute">
                <span>🏛️</span>
                <span>Affiliated: {activeCentre.hostInstitute}</span>
              </div>

              <div className="eas-centre-address">
                <strong>Campus Address:</strong><br />
                {activeCentre.address}
              </div>

              <div>
                <strong style={{ fontSize: '0.75rem', color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  Available Centre Disciplines:
                </strong>
                <div className="eas-expertise-tags">
                  {activeCentre.expertise.map((exp, idx) => (
                    <span key={idx} className="eas-exp-tag">
                      ✓ {exp}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact & Directions Pane */}
            <div className="eas-centre-actions">
              <div className="eas-contact-block">
                <span className="eas-contact-label">Official National Helpline</span>
                <span className="eas-contact-number">{activeCentre.verifiedHelpline}</span>
                <span className="eas-contact-sub">{activeCentre.helplineType}</span>
              </div>

              <div className="eas-action-buttons">
                <a
                  href={activeCentre.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="eas-dir-btn eas-dir-btn--primary"
                  id={`eas-directions-${activeCentre.id}`}
                >
                  <span>🗺️</span>
                  <span>Get Directions</span>
                </a>
                <a
                  href={activeCentre.officialPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="eas-dir-btn eas-dir-btn--secondary"
                  id={`eas-portal-${activeCentre.id}`}
                >
                  <span>🏛️</span>
                  <span>ICAR Portal</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Verified Information Disclaimer Notice */}
        <div className="eas-notice eas-reveal">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="10" cy="10" r="9" />
            <path d="M10 6v5M10 14v.5" strokeLinecap="round" strokeWidth="2" />
          </svg>
          <p>
            <strong>Strict Data Authenticity:</strong> Crops Wild does not create fictional experts or fake phone numbers. All contact points connect to the official Government of India Kisan Call Centre (1800-180-1551) and verified ICAR Krishi Vigyan Kendra institution directories.
          </p>
        </div>

      </div>
    </section>
  )
}
