import { useState, useEffect, useRef } from 'react'
import './FarmIntelligenceEngine.css'

/* ══════════════════════════════════════════════════════════════
   BESPOKE AGRICULTURAL VISUALS (No generic SaaS or robots)
   ══════════════════════════════════════════════════════════════ */

/**
 * 1. Botanical Soil Horizon & Crop Profile Visual
 */
function CropRecommendationVisual() {
  return (
    <svg viewBox="0 0 380 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="fie-svg-graphic" aria-hidden="true">
      <defs>
        <linearGradient id="cropSkyGrad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0faf4" stopOpacity="0.8"/>
          <stop stopColor="#faf8f3" stopOpacity="0.2"/>
        </linearGradient>
        <linearGradient id="topsoilGrad" x1="0" y1="100" x2="0" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6b4319" stopOpacity="0.25"/>
          <stop stopColor="#4a2f10" stopOpacity="0.45"/>
        </linearGradient>
      </defs>

      {/* Sky & atmosphere */}
      <rect x="0" y="0" width="380" height="100" rx="8" fill="url(#cropSkyGrad)"/>

      {/* Gentle sun & warm solar rays */}
      <circle cx="320" cy="36" r="16" fill="#f5e4c8"/>
      <circle cx="320" cy="36" r="24" stroke="#c47c2b" strokeWidth="1" strokeDasharray="3 3" opacity="0.4"/>
      <path d="M320 12v6M320 54v6M296 36h6M338 36h6" stroke="#c47c2b" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>

      {/* Soil Horizon Stratification */}
      <rect x="0" y="100" width="380" height="80" rx="0" fill="url(#topsoilGrad)"/>
      <path d="M0 100 Q95 97 190 100 T380 99" stroke="#8b5a22" strokeWidth="2" fill="none"/>
      <path d="M0 135 Q120 132 240 136 T380 134" stroke="#4a2f10" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"/>

      {/* Soil labels */}
      <text x="14" y="122" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="600" fill="#4a2f10" opacity="0.8">Topsoil Humus (0-15cm)</text>
      <text x="14" y="158" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="600" fill="#2c1a08" opacity="0.7">Alluvial Loam Zone (15-40cm)</text>

      {/* Root Network Deep Anchoring */}
      <g stroke="#8b5a22" strokeWidth="1.5" strokeLinecap="round" opacity="0.75">
        <path d="M190 100 Q188 125 186 150"/>
        <path d="M188 115 Q170 128 158 142"/>
        <path d="M188 125 Q205 138 218 152"/>
        <path d="M174 124 Q162 135 154 148"/>
        <path d="M200 132 Q214 145 224 160"/>
        <path d="M186 138 Q182 152 180 168"/>
      </g>

      {/* Main Wheat Stalk & Foliage */}
      <path d="M190 100 C190 70 190 40 190 26" stroke="#2d7a4a" strokeWidth="3" strokeLinecap="round"/>
      <path d="M190 70 C165 65 145 74 135 88 C155 86 180 78 190 70Z" fill="#3a9c5f" opacity="0.9"/>
      <path d="M190 55 C215 50 235 60 245 72 C225 72 202 65 190 55Z" fill="#52b876" opacity="0.9"/>
      <path d="M190 40 C172 32 154 40 148 52 C164 50 182 45 190 40Z" fill="#3a9c5f" opacity="0.85"/>

      {/* Golden Wheat Spikelets */}
      <g transform="translate(190, 24)">
        <ellipse cx="0" cy="0" rx="6" ry="14" fill="#c47c2b"/>
        <ellipse cx="-7" cy="8" rx="5" ry="10" fill="#c47c2b" transform="rotate(-20 -7 8)"/>
        <ellipse cx="7" cy="8" rx="5" ry="10" fill="#c47c2b" transform="rotate(20 7 8)"/>
        <ellipse cx="-6" cy="18" rx="4.5" ry="9" fill="#c47c2b" transform="rotate(-30 -6 18)"/>
        <ellipse cx="6" cy="18" rx="4.5" ry="9" fill="#c47c2b" transform="rotate(30 6 18)"/>
        <ellipse cx="0" cy="-12" rx="4" ry="8" fill="#d4944a"/>
        {/* Awns (whisker needles) */}
        <path d="M-6 0 L-18 -18M6 0 L18 -18M0 -14 L0 -30M-8 10 L-22 0M8 10 L22 0" stroke="#c47c2b" strokeWidth="1.2" strokeLinecap="round" opacity="0.75"/>
      </g>

      {/* Secondary companion wheat shoots */}
      <path d="M110 100 C110 82 115 65 120 54" stroke="#52b876" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="120" cy="50" rx="4" ry="9" fill="#c47c2b" opacity="0.85" transform="rotate(15 120 50)"/>
      <path d="M270 100 C270 80 262 65 258 56" stroke="#52b876" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="258" cy="52" rx="4" ry="9" fill="#c47c2b" opacity="0.85" transform="rotate(-15 258 52)"/>

      {/* Agronomic telemetry callouts */}
      <g transform="translate(245, 115)">
        <rect width="118" height="48" rx="6" fill="#ffffff" stroke="#b3e4c5" strokeWidth="1" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.06))"/>
        <circle cx="14" cy="18" r="4" fill="#3a9c5f"/>
        <text x="24" y="21" fontFamily="system-ui, sans-serif" fontSize="10" fontWeight="700" fill="#1a4a2e">Soil pH 6.8</text>
        <text x="14" y="38" fontFamily="system-ui, sans-serif" fontSize="9" fill="#6b6358">Nitrogen: 94 kg/ha</text>
      </g>
    </svg>
  )
}

/**
 * 2. Precision Soil Nutrition & Fertilizer Balancer Visual
 */
function FertilizerRecommendationVisual() {
  return (
    <svg viewBox="0 0 380 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="fie-svg-graphic" aria-hidden="true">
      <rect width="380" height="180" rx="8" fill="#faf8f3"/>

      {/* Soil Bed Ground Line */}
      <rect x="0" y="140" width="380" height="40" fill="#fdf6ec"/>
      <path d="M0 140 H380" stroke="#d4c9b0" strokeWidth="1.5"/>

      {/* Balanced Agronomic Scale Beam */}
      <path d="M190 40 L190 120" stroke="#1a4a2e" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="190" cy="40" r="6" fill="#c47c2b"/>
      <path d="M160 120 H220" stroke="#1a4a2e" strokeWidth="3" strokeLinecap="round"/>

      {/* Balance arm horizontal beam */}
      <path d="M85 55 L295 55" stroke="#3a9c5f" strokeWidth="2.5" strokeLinecap="round"/>

      {/* Left Pan — Current Soil Deficit */}
      <path d="M85 55 L65 85M85 55 L105 85" stroke="#9e9480" strokeWidth="1.2"/>
      <path d="M55 85 Q85 100 115 85 Z" fill="#fdf6ec" stroke="#c47c2b" strokeWidth="1.5"/>
      <text x="85" y="78" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="8" fontWeight="700" fill="#8b5a22">SOIL DEFICIT</text>
      {/* Mineral deficiency particles */}
      <circle cx="75" cy="88" r="3" fill="#c47c2b" opacity="0.6"/>
      <circle cx="85" cy="91" r="3.5" fill="#8b5a22" opacity="0.7"/>
      <circle cx="95" cy="87" r="2.5" fill="#c47c2b" opacity="0.6"/>

      {/* Right Pan — Recommended Nutrition */}
      <path d="M295 55 L275 85M295 55 L315 85" stroke="#9e9480" strokeWidth="1.2"/>
      <path d="M265 85 Q295 100 325 85 Z" fill="#f0faf4" stroke="#2d7a4a" strokeWidth="1.5"/>
      <text x="295" y="78" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="8" fontWeight="700" fill="#1a4a2e">OPTIMAL NPK</text>
      {/* Nutrient formulation capsules */}
      <rect x="276" y="86" width="14" height="6" rx="3" fill="#2d7a4a"/>
      <rect x="293" y="88" width="14" height="6" rx="3" fill="#3a9c5f"/>
      <circle cx="312" cy="89" r="3" fill="#c47c2b"/>

      {/* Formulation Pills */}
      <g transform="translate(25, 105)">
        <rect width="90" height="28" rx="6" fill="white" stroke="#b3e4c5" strokeWidth="1"/>
        <text x="10" y="18" fontFamily="monospace" fontSize="11" fontWeight="700" fill="#1a4a2e">N: 105</text>
        <text x="54" y="18" fontFamily="system-ui, sans-serif" fontSize="8" fill="#6b6358">kg/ha</text>
      </g>

      <g transform="translate(145, 142)">
        <rect width="90" height="28" rx="6" fill="white" stroke="#f5e4c8" strokeWidth="1"/>
        <text x="10" y="18" fontFamily="monospace" fontSize="11" fontWeight="700" fill="#c47c2b">P: 48</text>
        <text x="48" y="18" fontFamily="system-ui, sans-serif" fontSize="8" fill="#6b6358">kg/ha</text>
      </g>

      <g transform="translate(265, 105)">
        <rect width="90" height="28" rx="6" fill="white" stroke="#b3e4c5" strokeWidth="1"/>
        <text x="10" y="18" fontFamily="monospace" fontSize="11" fontWeight="700" fill="#235e3a">K: 50</text>
        <text x="48" y="18" fontFamily="system-ui, sans-serif" fontSize="8" fill="#6b6358">kg/ha</text>
      </g>

      {/* Fertilizer dosing split bar */}
      <g transform="translate(40, 20)">
        <rect width="300" height="12" rx="6" fill="#e8e0d0"/>
        <rect width="150" height="12" rx="6" fill="#2d7a4a"/>
        <rect x="150" width="75" height="12" fill="#52b876"/>
        <rect x="225" width="75" height="12" rx="0 6 6 0" fill="#7dcf98"/>
        <text x="190" y="10" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="8" fontWeight="700" fill="#ffffff">
          50% Basal Sowing · 25% Tillering · 25% Heading Stage
        </text>
      </g>
    </svg>
  )
}

/**
 * 3. Botanical Foliar Leaf Pathogen & Diagnostic Scanner Visual
 */
function DiseaseDetectionVisual() {
  return (
    <svg viewBox="0 0 380 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="fie-svg-graphic" aria-hidden="true">
      <rect width="380" height="180" rx="8" fill="#faf8f3"/>

      {/* Healthy Leaf Contour */}
      <path d="M60 150 C50 120 70 60 140 35 C200 15 260 40 280 90 C295 130 250 160 190 165 C130 170 80 165 60 150 Z"
            fill="#d9f2e5" stroke="#3a9c5f" strokeWidth="2"/>

      {/* Main leaf central vein & lateral tributaries */}
      <path d="M60 150 C120 120 190 85 280 90" stroke="#2d7a4a" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M120 120 C100 105 90 90 92 80" stroke="#3a9c5f" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
      <path d="M150 105 C140 85 140 68 152 55" stroke="#3a9c5f" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
      <path d="M185 92 C190 70 205 55 225 45" stroke="#3a9c5f" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
      <path d="M160 110 C175 125 195 135 220 140" stroke="#3a9c5f" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
      <path d="M210 93 C230 110 245 120 265 125" stroke="#3a9c5f" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>

      {/* Pathogen foliar lesion spots */}
      <circle cx="165" cy="82" r="9" fill="#c47c2b" opacity="0.75"/>
      <circle cx="165" cy="82" r="5" fill="#8b5a22" opacity="0.9"/>
      <circle cx="145" cy="72" r="6" fill="#c47c2b" opacity="0.6"/>
      <circle cx="185" cy="78" r="5" fill="#c47c2b" opacity="0.55"/>
      <circle cx="178" cy="95" r="4" fill="#8b5a22" opacity="0.6"/>

      {/* Precision Diagnostic Optical Reticle (Agricultural Focus) */}
      <circle cx="165" cy="82" r="26" stroke="#1a4a2e" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
      <circle cx="165" cy="82" r="34" stroke="#3a9c5f" strokeWidth="1" strokeDasharray="2 4" fill="none" opacity="0.5"/>

      {/* Reticle corner brackets */}
      <path d="M138 55 H148 V65" stroke="#1a4a2e" strokeWidth="2" strokeLinecap="round"/>
      <path d="M192 55 H182 V65" stroke="#1a4a2e" strokeWidth="2" strokeLinecap="round"/>
      <path d="M138 109 H148 V99" stroke="#1a4a2e" strokeWidth="2" strokeLinecap="round"/>
      <path d="M192 109 H182 V99" stroke="#1a4a2e" strokeWidth="2" strokeLinecap="round"/>

      {/* Diagnostic telemetry result card */}
      <g transform="translate(230, 45)">
        <rect width="138" height="96" rx="8" fill="white" stroke="#b3e4c5" strokeWidth="1.5" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.06))"/>
        <rect x="10" y="10" width="6" height="6" rx="3" fill="#c47c2b"/>
        <text x="22" y="16" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="700" fill="#8b5a22" letterSpacing="0.05em">PATHOGEN DETECTED</text>

        <text x="10" y="36" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="700" fill="#0f2d18">Brown Leaf Rust</text>
        <text x="10" y="50" fontFamily="system-ui, sans-serif" fontSize="8.5" fill="#6b6358">Puccinia triticina (Foliar)</text>

        {/* Severity confidence meter */}
        <rect x="10" y="60" width="118" height="5" rx="2.5" fill="#f0faf4"/>
        <rect x="10" y="60" width="108" height="5" rx="2.5" fill="#3a9c5f"/>
        <text x="10" y="78" fontFamily="system-ui, sans-serif" fontSize="8.5" fontWeight="700" fill="#2d7a4a">94.8% Match · Stage 1 Onset</text>
        <text x="10" y="89" fontFamily="system-ui, sans-serif" fontSize="7.5" fill="#c47c2b" fontWeight="600">Action: Spray Bio-fungicide</text>
      </g>

      {/* Natural stem anchor */}
      <path d="M60 150 C40 162 25 170 10 174" stroke="#2d7a4a" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

/**
 * 4. Multi-Acre Field Contours & Holistic Farm Analysis Visual
 */
function FarmAnalysisVisual() {
  return (
    <svg viewBox="0 0 380 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="fie-svg-graphic" aria-hidden="true">
      <rect width="380" height="180" rx="8" fill="#faf8f3"/>

      {/* Field Topography & Land Contour Plots */}
      <g opacity="0.85">
        {/* Field Plot 1 (Wheat North Block) */}
        <polygon points="30,40 160,25 180,95 40,110" fill="#d9f2e5" stroke="#7dcf98" strokeWidth="1.5"/>
        {/* Cultivation rows */}
        <path d="M48,50 L165,37M52,65 L170,52M56,80 L174,67M60,95 L178,82" stroke="#52b876" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"/>

        {/* Field Plot 2 (Irrigated South Block) */}
        <polygon points="185,28 320,18 345,85 198,96" fill="#f0faf4" stroke="#3a9c5f" strokeWidth="1.5"/>
        <path d="M200,38 L325,28M205,53 L330,43M210,68 L335,58M215,83 L340,73" stroke="#3a9c5f" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"/>

        {/* Field Plot 3 (Soil Restoration Corridor) */}
        <polygon points="45,115 185,100 175,160 30,165" fill="#fdf6ec" stroke="#c47c2b" strokeWidth="1.5"/>
        <path d="M50,128 L178,113M55,142 L172,127M60,156 L168,141" stroke="#c47c2b" strokeWidth="1" strokeDasharray="4 2" opacity="0.5"/>
      </g>

      {/* Natural Canal / Water Buffer */}
      <path d="M175,15 C185,50 180,110 188,175" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      <text x="194" y="160" fontFamily="system-ui, sans-serif" fontSize="7" fontWeight="600" fill="#1e40af">Canal Irrigation</text>

      {/* Agro-Telemetry Radar Overlay Card */}
      <g transform="translate(205, 95)">
        <rect width="165" height="75" rx="8" fill="white" stroke="#b3e4c5" strokeWidth="1.5" filter="drop-shadow(0 3px 8px rgba(0,0,0,0.06))"/>
        {/* Health Score Ring */}
        <circle cx="34" cy="38" r="22" fill="#f0faf4" stroke="#d9f2e5" strokeWidth="2"/>
        <circle cx="34" cy="38" r="22" stroke="#2d7a4a" strokeWidth="3" strokeDasharray="138" strokeDashoffset="24" strokeLinecap="round"/>
        <text x="34" y="35" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="13" fontWeight="800" fill="#0f2d18">92</text>
        <text x="34" y="46" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="7" fontWeight="600" fill="#2d7a4a">/100</text>

        {/* Metrics readout */}
        <text x="68" y="24" fontFamily="system-ui, sans-serif" fontSize="10" fontWeight="700" fill="#0f2d18">Farm Health Index</text>
        <text x="68" y="40" fontFamily="system-ui, sans-serif" fontSize="8" fill="#6b6358">Moisture Retention: +18%</text>
        <text x="68" y="54" fontFamily="system-ui, sans-serif" fontSize="8" fill="#6b6358">Yield Outlook: +24 Qtl/acre</text>
        <text x="68" y="66" fontFamily="system-ui, sans-serif" fontSize="7.5" fontWeight="600" fill="#c47c2b">Optimal harvest window in 28d</text>
      </g>
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════
   CAPABILITY DATA DEFINITIONS
   Unified under the Crops Wild Agricultural Intelligence Core
   ══════════════════════════════════════════════════════════════ */
const CAPABILITIES = [
  {
    id: 'crop',
    number: '01',
    badge: 'Agronomic Soil Match',
    badgeType: 'green',
    title: 'Crop Recommendation',
    systemLink: 'Feeds into Multi-Season Rotation',
    description: 'Calculates the optimal crop cultivar for your specific land parcel by synthesizing soil NPK, pH equilibrium, historic rainfall, and seasonal thermal windows.',
    visual: <CropRecommendationVisual />,
    telemetryTag: 'Active Soil Reading',
    telemetryStat: 'NPK 94:42:43 · pH 6.8 · Loam',
    outputTitle: 'Target Recommendation',
    outputValue: 'Wheat (HD-2967 / GW-496 Variety)',
    outputSub: '96.4% match for winter Rabi cycle. Expected maturity: 118-125 days.',
    checklist: [
      'Soil nutrient & texture mapping',
      'Microclimate precipitation index',
      'Seasonal sowing window analysis',
      'Market demand & MSP alignment'
    ]
  },
  {
    id: 'fertilizer',
    number: '02',
    badge: 'Precision Nutrition',
    badgeType: 'amber',
    title: 'Fertilizer Recommendation',
    systemLink: 'Calibrated by Soil Baseline',
    description: 'Generates precision mineral and bio-fertilizer dosage schedules tailored to your crop growth stage, preventing chemical burn and cutting input waste.',
    visual: <FertilizerRecommendationVisual />,
    telemetryTag: 'Crop Stage Analysis',
    telemetryStat: 'Tillering Phase · 32 Days Post-Sow',
    outputTitle: 'Prescription Formula',
    outputValue: 'Urea 75kg + DAP 50kg + MOP 25kg (per 2 acres)',
    outputSub: 'Split application: 50% basal dose during sowing, 50% top-dress at 1st irrigation.',
    checklist: [
      'Balanced N-P-K nutrient dosage',
      'Growth stage split scheduling',
      'Organic carbon replenishment',
      'Soil salinity & acidification protection'
    ]
  },
  {
    id: 'disease',
    number: '03',
    badge: 'Pathology Vision',
    badgeType: 'blue',
    title: 'Plant Disease Detection',
    systemLink: 'Early Biological Alert',
    description: 'Diagnoses foliar infections, rusts, and fungal blights from a simple smartphone leaf photo within seconds, prescribing dual organic and bio-chemical remedies.',
    visual: <DiseaseDetectionVisual />,
    telemetryTag: 'Foliar Spectrum Scan',
    telemetryStat: '38+ Pathogen Neural Database',
    outputTitle: 'Pathology Diagnosis',
    outputValue: 'Brown Leaf Rust (Puccinia triticina) · 94.8% Match',
    outputSub: 'Stage 1 onset. Immediate biological spray: 5% Neem kernel extract (NSKE).',
    checklist: [
      'Instant smartphone leaf scanning',
      'Pathogen severity grading',
      'Immediate organic treatment protocols',
      'Critical 48-hour containment advice'
    ]
  },
  {
    id: 'analysis',
    number: '04',
    badge: 'Holistic Macro View',
    badgeType: 'emerald',
    title: 'Farm Analysis',
    systemLink: 'Ecosystem Synthesis',
    description: 'Integrates all land plots, moisture retention levels, crop health scores, and historical yields into one unified agricultural diagnostic profile.',
    visual: <FarmAnalysisVisual />,
    telemetryTag: 'Whole-Farm Telemetry',
    telemetryStat: '12.5 Acres · Alluvial Plain Zone',
    outputTitle: 'System Health Index',
    outputValue: '92 / 100 — Optimal Agronomic Equilibrium',
    outputSub: 'Water use efficiency increased by 18%. Projected yield: +24 Qtl per acre.',
    checklist: [
      'Multi-acre health & vitality index',
      'Soil moisture & drought resistance',
      'Seasonal revenue & yield forecasting',
      'Continuous cross-season memory'
    ]
  }
]

/* ══════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function FarmIntelligenceEngine({ onOpenAuth, currentUser, onGoToDashboard }) {
  const [selectedFilter, setSelectedFilter] = useState('all') // 'all' | 'crop' | 'fertilizer' | 'disease' | 'analysis'
  const sectionRef = useRef(null)

  // Smooth scroll & entrance reveal setup
  useEffect(() => {
    if (!sectionRef.current) return
    const el = sectionRef.current
    el.classList.add('fie-section--in')
    const items = el.querySelectorAll('.fie-reveal')
    items.forEach(item => item.classList.add('fie-reveal--in'))
  }, [])

  // Handle the central CTA click
  // The CTA should conceptually lead to:
  // Landing Page → Login/Register → Farmer Profile → Farm Intelligence Hub
  const handleExploreCTA = (e) => {
    e.preventDefault()
    if (currentUser && onGoToDashboard) {
      // User is already logged in, navigate straight to the Farm Intelligence Hub
      onGoToDashboard()
    } else if (onOpenAuth) {
      // Guide farmer to Login / Register modal, which sets up their profile and opens the Hub
      onOpenAuth('register')
    } else {
      const target = document.getElementById('dashboard')
      if (target) target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Filtered capabilities based on tab
  const displayedCapabilities = selectedFilter === 'all'
    ? CAPABILITIES
    : CAPABILITIES.filter(c => c.id === selectedFilter)

  return (
    <section
      className="fie-section fie-section--in"
      id="farm-intelligence"
      aria-labelledby="fie-main-heading"
      ref={sectionRef}
    >
      {/* Anchor aliases for backward compatibility with existing links (#ai-tools, #features) */}
      <span id="ai-tools" style={{ position: 'relative', top: '-80px', display: 'block', visibility: 'hidden' }} />
      <span id="features" style={{ position: 'relative', top: '-80px', display: 'block', visibility: 'hidden' }} />

      <div className="container">

        {/* ── Section Header ── */}
        <div className="fie-header fie-reveal">
          <div className="fie-badge-row">
            <span className="fie-core-tag">
              <span className="fie-core-tag__dot" />
              Crops Wild · Core Product
            </span>
            <span className="fie-eyebrow">Unified Agricultural Intelligence System</span>
          </div>

          <h2 className="fie-heading" id="fie-main-heading">
            Farm Intelligence <span className="fie-heading-accent">Engine</span>
          </h2>

          {/* Short description requested */}
          <p className="fie-description">
            Turn farm data and real-world agricultural information into actionable insights.
          </p>
        </div>

        {/* ── Unified System Architecture Ribbon ── */}
        <div className="fie-unified-banner fie-reveal fie-reveal--delay-1">
          <div className="fie-unified-info">
            <div className="fie-unified-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
            <div>
              <div className="fie-unified-title">One Unified Agricultural Intelligence Core</div>
              <div className="fie-unified-subtitle">
                Soil telemetry, weather forecasts, leaf vision, and multi-acre history work together as a single synchronized brain.
              </div>
            </div>
          </div>

          <div className="fie-unified-flow">
            <span className="fie-flow-pill">Field Data</span>
            <span className="fie-flow-arrow">➔</span>
            <span className="fie-flow-pill">Engine Synthesis</span>
            <span className="fie-flow-arrow">➔</span>
            <span className="fie-flow-pill" style={{ background: '#0f2d18', color: '#7dcf98', borderColor: '#1a4a2e' }}>
              Actionable Farm Advisory
            </span>
          </div>
        </div>

        {/* ── Interactive Capabilities Filter ── */}
        <div className="fie-tabs-nav fie-reveal fie-reveal--delay-2" role="tablist" aria-label="Engine Capabilities">
          <button
            className={`fie-tab-btn ${selectedFilter === 'all' ? 'fie-tab-btn--active' : ''}`}
            onClick={() => setSelectedFilter('all')}
            role="tab"
            aria-selected={selectedFilter === 'all'}
          >
            All 4 Engine Pillars
          </button>
          {CAPABILITIES.map(cap => (
            <button
              key={cap.id}
              className={`fie-tab-btn ${selectedFilter === cap.id ? 'fie-tab-btn--active' : ''}`}
              onClick={() => setSelectedFilter(cap.id)}
              role="tab"
              aria-selected={selectedFilter === cap.id}
            >
              <span className="fie-tab-btn__num">{cap.number}</span>
              {cap.title}
            </button>
          ))}
        </div>

        {/* ── Four Primary Capabilities Grid ── */}
        <div className={`fie-grid ${displayedCapabilities.length === 1 ? 'fie-grid--single' : ''}`} role="list">
          {displayedCapabilities.map((cap) => (
            <article
              key={cap.id}
              className={`fie-card fie-card--${cap.id} ${selectedFilter === cap.id ? 'fie-card--active' : ''}`}
              role="listitem"
              aria-label={`${cap.title} capability of Farm Intelligence Engine`}
            >
              <div>
                {/* Meta Badge Bar */}
                <div className="fie-card__meta">
                  <div className="fie-card__badge-wrap">
                    <span className={`fie-card__badge fie-card__badge--${cap.badgeType}`}>
                      {cap.badge}
                    </span>
                    <span className="fie-card__system-link">
                      <span style={{ color: '#3a9c5f' }}>●</span> {cap.systemLink}
                    </span>
                  </div>
                  <span className="fie-card__num">{cap.number}</span>
                </div>

                {/* Title & Core Agronomic Narrative */}
                <h3 className="fie-card__title">{cap.title}</h3>
                <p className="fie-card__desc">{cap.description}</p>

                {/* Agricultural Visual Graphic with Live Telemetry */}
                <div className="fie-card__visual">
                  <div className="fie-telemetry-strip">
                    <span className="fie-telemetry-tag">
                      <span style={{ color: '#2d7a4a' }}>🌾</span> {cap.telemetryTag}
                    </span>
                    <span className="fie-telemetry-stat">{cap.telemetryStat}</span>
                  </div>

                  <div className="fie-svg-wrap">
                    {cap.visual}
                  </div>
                </div>

                {/* Real-world Grounded Output Snippet */}
                <div className="fie-card__output">
                  <div className="fie-card__output-header">
                    <span>{cap.outputTitle}</span>
                    <span className="fie-output-badge">Verified Agronomic Model</span>
                  </div>
                  <div className="fie-card__output-val">{cap.outputValue}</div>
                  <div className="fie-card__output-sub">{cap.outputSub}</div>
                </div>

                {/* Key Capabilities Checklist */}
                <ul className="fie-card__checklist" aria-label={`Key features of ${cap.title}`}>
                  {cap.checklist.map(item => (
                    <li key={item} className="fie-card__check-item">
                      <span className="fie-check-icon" aria-hidden="true">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        {/* ── Return to All Pillars Option ── */}
        {selectedFilter !== 'all' && (
          <div className="fie-filter-reset-wrap">
            <button
              type="button"
              className="fie-filter-reset-btn"
              onClick={() => setSelectedFilter('all')}
            >
              <span>← View All 4 Engine Pillars</span>
            </button>
          </div>
        )}

        {/* ── Central Journey & Prominent CTA Box ── */}
        <div className="fie-cta-box fie-reveal">
          {/* Farmer Journey Conceptual Flow */}
          <div className="fie-journey">
            <div className="fie-journey__header">
              <span className="fie-journey__label">The Farmer Journey to Precision Agriculture</span>
            </div>

            <div className="fie-journey__track">
              {/* Step 1 */}
              <div className="fie-journey__step fie-journey__step--active">
                <div className="fie-journey__circle">1</div>
                <div className="fie-journey__name">Landing Page</div>
                <div className="fie-journey__sub">Discover Crops Wild Engine</div>
              </div>

              {/* Step 2 */}
              <div className="fie-journey__step">
                <div className="fie-journey__circle">2</div>
                <div className="fie-journey__name">Login / Register</div>
                <div className="fie-journey__sub">Instant Phone / Email Access</div>
              </div>

              {/* Step 3 */}
              <div className="fie-journey__step">
                <div className="fie-journey__circle">3</div>
                <div className="fie-journey__name">Farmer Profile</div>
                <div className="fie-journey__sub">Acreage, Location & Soil Baseline</div>
              </div>

              {/* Step 4 */}
              <div className="fie-journey__step fie-journey__step--final">
                <div className="fie-journey__circle">4</div>
                <div className="fie-journey__name">Farm Intelligence Hub</div>
                <div className="fie-journey__sub">Live Personalized Advisory & Tools</div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="fie-cta-content">
            <div className="fie-cta-text">
              <h3 className="fie-cta-heading">
                Ready to harness unified agricultural intelligence on your land?
              </h3>
              <p className="fie-cta-sub">
                Connect your farm soil, climate data, and crop observations to get verified recommendations for every acre.
              </p>
            </div>

            <div className="fie-cta-actions">
              {/* The Prominent CTA */}
              <a
                href="#farm-intelligence-hub"
                className="fie-btn-primary"
                id="cta-explore-farm-intelligence"
                onClick={handleExploreCTA}
              >
                <span>Explore Farm Intelligence</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>

              <button
                type="button"
                className="fie-btn-secondary"
                onClick={() => {
                  if (onOpenAuth) onOpenAuth('login')
                }}
              >
                Already registered? Sign In
              </button>
            </div>
          </div>
        </div>

        {/* ── Trust Footnote ── */}
        <div className="fie-trust-note fie-reveal">
          <span className="fie-trust-item">
            <span className="fie-trust-icon">🌱</span> Grounded in Indian agricultural datasets (ICAR, IMD, State Agricultural Universities)
          </span>
          <span>•</span>
          <span className="fie-trust-item">
            <span className="fie-trust-icon">🔒</span> Private & secure farmer data ownership
          </span>
          <span>•</span>
          <span className="fie-trust-item">
            <span className="fie-trust-icon">📍</span> Microclimate-specific to your district and agro-climatic zone
          </span>
        </div>

      </div>
    </section>
  )
}
