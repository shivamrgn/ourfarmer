import { useState, useEffect, useRef } from 'react'
import './MandiPriceIntelligence.css'

/* ══════════════════════════════════════════════════════════════
   SAMPLE / BENCHMARK DATASET
   (Clearly labeled as demo/sample benchmark data for the landing page)
   ══════════════════════════════════════════════════════════════ */
const SAMPLE_MANDI_DATA = [
  {
    id: 'tomato-vadodara',
    commodity: 'Tomato',
    emoji: '🍅',
    variety: 'Hybrid / Desi Red',
    mandi: 'Vadodara Mandi',
    state: 'Gujarat',
    date: '03 Oct 2026',
    minPrice: 1400,
    maxPrice: 2450,
    modalPrice: 1850,
    arrivalVolume: '480 Qtl',
    signal: 'Favorable Window',
    signalType: 'positive',
    sevenDayTrend: [
      { day: '27 Sep', price: 1620 },
      { day: '28 Sep', price: 1680 },
      { day: '29 Sep', price: 1710 },
      { day: '30 Sep', price: 1690 },
      { day: '01 Oct', price: 1760 },
      { day: '02 Oct', price: 1810 },
      { day: '03 Oct', price: 1850 },
    ],
    priceChange: '+14.2%',
    insight: 'Prices trending upward over last 7 days due to steady regional consumer demand.',
  },
  {
    id: 'wheat-khanna',
    commodity: 'Wheat',
    emoji: '🌾',
    variety: 'Sharbati / Lokwan',
    mandi: 'Khanna Mandi',
    state: 'Punjab',
    date: '03 Oct 2026',
    minPrice: 2320,
    maxPrice: 2580,
    modalPrice: 2440,
    arrivalVolume: '1,250 Qtl',
    signal: 'Stable Benchmark',
    signalType: 'neutral',
    sevenDayTrend: [
      { day: '27 Sep', price: 2390 },
      { day: '28 Sep', price: 2400 },
      { day: '29 Sep', price: 2415 },
      { day: '30 Sep', price: 2410 },
      { day: '01 Oct', price: 2425 },
      { day: '02 Oct', price: 2435 },
      { day: '03 Oct', price: 2440 },
    ],
    priceChange: '+2.1%',
    insight: 'Trading firmly above the Central MSP benchmark with stable daily mandi arrivals.',
  },
  {
    id: 'onion-lasalgaon',
    commodity: 'Onion',
    emoji: '🧅',
    variety: 'Red Medium',
    mandi: 'Lasalgaon Mandi',
    state: 'Maharashtra',
    date: '03 Oct 2026',
    minPrice: 1100,
    maxPrice: 2150,
    modalPrice: 1650,
    arrivalVolume: '2,800 Qtl',
    signal: 'High Volatility',
    signalType: 'alert',
    sevenDayTrend: [
      { day: '27 Sep', price: 1420 },
      { day: '28 Sep', price: 1490 },
      { day: '29 Sep', price: 1540 },
      { day: '30 Sep', price: 1510 },
      { day: '01 Oct', price: 1590 },
      { day: '02 Oct', price: 1620 },
      { day: '03 Oct', price: 1650 },
    ],
    priceChange: '+16.2%',
    insight: 'Arrival spread is wide; sorting and grading will capture modal-to-maximum premium rates.',
  },
  {
    id: 'cotton-rajkot',
    commodity: 'Cotton',
    emoji: '🌿',
    variety: 'Shankar-6 (Long Staple)',
    mandi: 'Rajkot Mandi',
    state: 'Gujarat',
    date: '03 Oct 2026',
    minPrice: 6800,
    maxPrice: 7650,
    modalPrice: 7250,
    arrivalVolume: '920 Qtl',
    signal: 'Firm Demand',
    signalType: 'positive',
    sevenDayTrend: [
      { day: '27 Sep', price: 7050 },
      { day: '28 Sep', price: 7100 },
      { day: '29 Sep', price: 7140 },
      { day: '30 Sep', price: 7120 },
      { day: '01 Oct', price: 7190 },
      { day: '02 Oct', price: 7220 },
      { day: '03 Oct', price: 7250 },
    ],
    priceChange: '+2.8%',
    insight: 'Good spinning-mill procurement inquiry; premium fetching up to ₹7,650/Qtl for low-moisture lots.',
  },
]

export default function MandiPriceIntelligence() {
  const [selectedId, setSelectedId] = useState('tomato-vadodara')
  const [activePoint, setActivePoint] = useState(null)
  const sectionRef = useRef(null)

  const activeData = SAMPLE_MANDI_DATA.find(d => d.id === selectedId) || SAMPLE_MANDI_DATA[0]

  useEffect(() => {
    if (!sectionRef.current) return
    const items = sectionRef.current.querySelectorAll('.mpi-reveal')
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('mpi-reveal--in')
            observer.unobserve(e.target)
          }
        })
      },
      { threshold: 0.1 }
    )
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Calculate SVG curve coordinates for 7-day trend
  const trend = activeData.sevenDayTrend
  const minVal = Math.min(...trend.map(t => t.price)) * 0.96
  const maxVal = Math.max(...trend.map(t => t.price)) * 1.04
  const width = 460
  const height = 160
  const padX = 24
  const padY = 20

  const points = trend.map((t, idx) => {
    const x = padX + (idx / (trend.length - 1)) * (width - 2 * padX)
    const y = height - padY - ((t.price - minVal) / (maxVal - minVal)) * (height - 2 * padY)
    return { ...t, x, y }
  })

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
  }, '')

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`

  return (
    <section
      className="mpi-section"
      id="mandi-prices"
      aria-labelledby="mpi-heading"
      ref={sectionRef}
    >
      <div className="container">

        {/* Section Header */}
        <div className="mpi-header mpi-reveal">
          <span className="mpi-eyebrow">
            <span className="mpi-eyebrow__dot" aria-hidden="true" />
            Market Transparency
          </span>
          <h2 className="mpi-heading" id="mpi-heading">
            Mandi Price Intelligence
          </h2>
          <p className="mpi-subtext">
            Discover how Crops Wild empowers farmers to track commodity price movements, eliminate middleman disparity, and pinpoint high-value selling opportunities.
          </p>
        </div>

        {/* Commodity Switcher Chips */}
        <div className="mpi-chips-wrap mpi-reveal" role="tablist" aria-label="Select commodity for market preview">
          {SAMPLE_MANDI_DATA.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === activeData.id}
              className={`mpi-chip ${item.id === activeData.id ? 'mpi-chip--active' : ''}`}
              onClick={() => {
                setSelectedId(item.id)
                setActivePoint(null)
              }}
            >
              <span>{item.emoji}</span>
              <span>{item.commodity}</span>
              <span style={{ opacity: 0.65, fontSize: '0.75rem' }}>({item.mandi.replace(' Mandi', '')})</span>
            </button>
          ))}
        </div>

        {/* Dashboard Preview Card */}
        <div className="mpi-dashboard-card mpi-reveal">

          {/* Window Topbar */}
          <div className="mpi-card-topbar">
            <div className="mpi-topbar-left">
              <div className="mpi-topbar-dots" aria-hidden="true">
                <span /><span /><span />
              </div>
              <span className="mpi-topbar-title">
                APMC Market Feed Preview
              </span>
            </div>

            {/* Prominent Sample Data Notice */}
            <div className="mpi-demo-badge" title="Displays representative data for demonstration; live feeds link through e-NAM / Agmarknet in your account">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2.5a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8zm-1 3.5h2v6H7V7z" />
              </svg>
              <span>Sample Benchmark Data (Demo Preview)</span>
            </div>
          </div>

          {/* Main Card Content */}
          <div className="mpi-card-inner">

            {/* Left: Commodity Info & Min/Max/Modal Triad */}
            <div className="mpi-detail-col">
              <div>
                <div className="mpi-commodity-header">
                  <div className="mpi-commodity-badge-row">
                    <span className="mpi-category-pill">{activeData.variety}</span>
                    <span className="mpi-date-tag">
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="2.5" width="10" height="9" rx="1.5" />
                        <path d="M4.5 1v2M9.5 1v2M2 5.5h10" />
                      </svg>
                      {activeData.date}
                    </span>
                  </div>

                  <h3 className="mpi-commodity-title">
                    <span>{activeData.emoji}</span>
                    <span>{activeData.commodity}</span>
                  </h3>

                  <div className="mpi-mandi-location">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M8 0a5.5 5.5 0 0 0-5.5 5.5c0 3.8 5.5 10.5 5.5 10.5s5.5-6.7 5.5-10.5A5.5 5.5 0 0 0 8 0zm0 7.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
                    </svg>
                    <span>{activeData.mandi} ({activeData.state})</span>
                  </div>
                </div>

                {/* Min - Max - Modal Price Grid */}
                <div className="mpi-price-grid" aria-label="Commodity price metrics">
                  {/* Min Price */}
                  <div className="mpi-price-box">
                    <span className="mpi-price-box__label">Min</span>
                    <span className="mpi-price-box__val">₹{activeData.minPrice.toLocaleString('en-IN')}</span>
                    <span className="mpi-price-box__unit">per quintal</span>
                  </div>

                  {/* Max Price */}
                  <div className="mpi-price-box">
                    <span className="mpi-price-box__label">Max</span>
                    <span className="mpi-price-box__val">₹{activeData.maxPrice.toLocaleString('en-IN')}</span>
                    <span className="mpi-price-box__unit">per quintal</span>
                  </div>

                  {/* Modal Price */}
                  <div className="mpi-price-box mpi-price-box--modal">
                    <span className="mpi-price-box__label">Modal</span>
                    <span className="mpi-price-box__val">₹{activeData.modalPrice.toLocaleString('en-IN')}</span>
                    <span className="mpi-price-box__unit">prevailing rate</span>
                  </div>
                </div>
              </div>

              {/* Secondary Market Signals */}
              <div className="mpi-meta-box">
                <div className="mpi-meta-item">
                  <span className="mpi-meta-label">Est. Daily Arrivals</span>
                  <span className="mpi-meta-val">{activeData.arrivalVolume}</span>
                </div>
                <div className="mpi-meta-item">
                  <span className="mpi-meta-label">Market Velocity</span>
                  <span className="mpi-meta-signal">
                    ✓ {activeData.signal}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Realistic Price Trend Visualization */}
            <div className="mpi-chart-col">
              <div className="mpi-chart-header">
                <div className="mpi-chart-title">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M2 13L6 8L10 11L14 4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 4H14V8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Price Trend (7-Day Trajectory)</span>
                </div>
                <div className="mpi-chart-legend">
                  <div className="mpi-legend-item">
                    <span className="mpi-legend-dot mpi-legend-dot--modal" />
                    <span>Modal Rate ({activeData.priceChange})</span>
                  </div>
                </div>
              </div>

              {/* SVG Curve Chart */}
              <div className="mpi-chart-svg-wrap">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="mpi-chart-svg"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="mpiGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines */}
                  <line x1={padX} y1={padY} x2={width - padX} y2={padY} stroke="#e2d9c8" strokeDasharray="3 3" opacity="0.7" />
                  <line x1={padX} y1={height / 2} x2={width - padX} y2={height / 2} stroke="#e2d9c8" strokeDasharray="3 3" opacity="0.7" />
                  <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#e2d9c8" opacity="0.7" />

                  {/* Area fill */}
                  <path d={areaD} fill="url(#mpiGradient)" />

                  {/* Trend line */}
                  <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Data points */}
                  {points.map((p, idx) => (
                    <g key={idx} onMouseEnter={() => setActivePoint(p)} onMouseLeave={() => setActivePoint(null)} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={activePoint?.day === p.day ? '6' : '4'}
                        fill="#ffffff"
                        stroke="#2563eb"
                        strokeWidth="2"
                      />
                    </g>
                  ))}
                </svg>

                {/* Tooltip for hovered point */}
                {activePoint && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${(activePoint.x / width) * 100}%`,
                      top: `${(activePoint.y / height) * 100}%`,
                      transform: 'translate(-50%, -125%)',
                      background: '#1e1a15',
                      color: '#ffffff',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
                    }}
                  >
                    {activePoint.day}: ₹{activePoint.price}/Qtl
                  </div>
                )}
              </div>

              {/* X-Axis labels */}
              <div className="mpi-chart-axis-x">
                {trend.map(t => (
                  <span key={t.day} className="mpi-axis-label">{t.day}</span>
                ))}
              </div>

              {/* Automated Trend Insight */}
              <div className="mpi-chart-insight">
                <span>{activeData.insight}</span>
                <span className="mpi-insight-pill">Benchmark Mode</span>
              </div>
            </div>

          </div>
        </div>

        {/* 3 Pillars: How Crops Wild Helps Farmers */}
        <div className="mpi-pillars-grid mpi-reveal">
          <div className="mpi-pillar-item">
            <div className="mpi-pillar-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="mpi-pillar-content">
              <h4>Real Price Transparency</h4>
              <p>Compare Min, Max, and Modal prices so you know the exact fair trade value before loading harvest onto transport.</p>
            </div>
          </div>

          <div className="mpi-pillar-item">
            <div className="mpi-pillar-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div className="mpi-pillar-content">
              <h4>Optimal Selling Windows</h4>
              <p>Visual 7-day trajectory helps you avoid dumping produce during arrival spikes when prices temporarily slump.</p>
            </div>
          </div>

          <div className="mpi-pillar-item">
            <div className="mpi-pillar-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="mpi-pillar-content">
              <h4>Inter-Mandi Arbitrage</h4>
              <p>Discover if neighboring mandis (e.g., Vadodara vs Surat or Anand) offer higher modal rates justifying the transport distance.</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
