import { useEffect, useRef } from 'react'
import './RealWorldFarmData.css'

/* ══════════════════════════════════════════════════════════════
   REFINED SVG ICONS (Vector line-art with thematic accents)
   ══════════════════════════════════════════════════════════════ */

function WeatherIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="rwfd-icon-svg">
      {/* Sun */}
      <circle cx="18" cy="9" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 1" />
      <path d="M18 3V4.5M18 13.5V15M24 9H22.5M13.5 9H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Cloud */}
      <path
        d="M8.5 20.5C6.567 20.5 5 18.933 5 17C5 15.228 6.316 13.766 8.038 13.535C8.544 11.516 10.373 10 12.57 10C14.49 10 16.128 11.15 16.828 12.788C17.34 12.44 17.95 12.25 18.6 12.25C20.478 12.25 22 13.772 22 15.65C22 17.528 20.478 19.05 18.6 19.05H8.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.12"
      />
      {/* Rain drops */}
      <path d="M9 22.5L8 24.5M13 22.5L12 24.5M17 22.5L16 24.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SatelliteIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="rwfd-icon-svg">
      {/* Satellite body */}
      <rect x="11" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.15" />
      {/* Solar Wings */}
      <path d="M11 12H5M5 9.5V14.5M17 12H23M23 9.5V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Solar cell grids */}
      <path d="M8 9.5V14.5M20 9.5V14.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      {/* Antenna */}
      <path d="M14 15V18M13 18H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Ground scan waves */}
      <path d="M10 21C12.5 22.5 15.5 22.5 18 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.5 1.5" />
      <path d="M7 24C11 26 17 26 21 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

function MandiIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="rwfd-icon-svg">
      {/* Rupee & Price Tag Frame */}
      <rect x="4" y="4" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.08" />
      {/* Rupee Symbol */}
      <path d="M9 9H16M9 12H15M9 9V14C11 14 13.5 14 13.5 12C13.5 10.5 12 9.5 10 9.5M11.5 13.5L15.5 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Trend Arrow / Bar indicator */}
      <path d="M17 19V15M20 19V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 11L18.5 8.5L21 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EnvironmentalIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="rwfd-icon-svg">
      {/* Sun / Solar Radiation */}
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.15" />
      <path d="M10 3.5V5M4 10H5.5M10 15V16.5M14.5 5.5L13.5 6.5M5.5 5.5L6.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {/* Meteorological sensor / Airflow waves */}
      <path d="M16 11C18.2 11 20 12.8 20 15C20 17.2 18.2 19 16 19M16 15H23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 21C9 21 10.5 22.5 10.5 24M10.5 21H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Environmental droplet */}
      <path d="M21 7.5C21 7.5 23 9.5 23 11C23 12.1 22.1 13 21 13C19.9 13 19 12.1 19 11C19 9.5 21 7.5 21 7.5Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function KnowledgeIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="rwfd-icon-svg">
      {/* Open Book */}
      <path
        d="M14 21.5C12 20 9 20 5 20.5V6.5C9 6 12 6 14 7.5M14 21.5C16 20 19 20 23 20.5V6.5C19 6 16 6 14 7.5M14 21.5V7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Agronomic seedling sprout bookmark */}
      <path d="M14 7.5V3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14 4.5C15.5 3 17.5 3.5 17 5.5C15.5 5.5 14.5 4.5 14 4.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1" />
      {/* Advisory verified badge tick */}
      <path d="M8 12.5L10 14.5L12 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════
   FEATURE CARDS DATA SPECIFICATION
   (Explicitly communicates capability with zero fake live values)
   ══════════════════════════════════════════════════════════════ */
const FARM_DATA_CARDS = [
  {
    id: 'weather-intelligence',
    title: 'Weather Intelligence',
    description: 'Live temperature, humidity, rainfall and forecast.',
    icon: <WeatherIcon />,
    accent: 'blue',
    tag: 'Meteorology',
    indicators: [
      'Precipitation probability',
      'Hourly temperature & humidity',
      '7-day localized forecast',
    ],
    source: 'Open-Meteo & IMD',
    capability: 'Real-Time Ready',
  },
  {
    id: 'satellite-insights',
    title: 'Satellite Insights',
    description: 'Vegetation and field-condition indicators.',
    icon: <SatelliteIcon />,
    accent: 'emerald',
    tag: 'Earth Observation',
    indicators: [
      'NDVI vegetation index',
      'Canopy moisture & stress',
      'Multi-spectral field scans',
    ],
    source: 'Sentinel-2 & Landsat',
    capability: 'Orbital Telemetry',
  },
  {
    id: 'mandi-prices',
    title: 'Mandi Prices',
    description: 'Latest available agricultural market prices.',
    icon: <MandiIcon />,
    accent: 'amber',
    tag: 'Market Feeds',
    indicators: [
      'Daily APMC commodity rates',
      'Arrival volume metrics',
      'Modal price benchmarks',
    ],
    source: 'Agmarknet & e-NAM',
    capability: 'Market Telemetry',
  },
  {
    id: 'environmental-data',
    title: 'Environmental Data',
    description: 'Meteorological and solar/environmental information.',
    icon: <EnvironmentalIcon />,
    accent: 'teal',
    tag: 'Solar & Climate',
    indicators: [
      'Solar irradiance & UV index',
      'Evapotranspiration (ET₀)',
      'Dew point & atmospheric pressure',
    ],
    source: 'Agro-Climate Models',
    capability: 'Atmospheric Feeds',
  },
  {
    id: 'agricultural-knowledge',
    title: 'Agricultural Knowledge',
    description: 'Trusted agricultural information and advisories.',
    icon: <KnowledgeIcon />,
    accent: 'sage',
    tag: 'Agronomy',
    indicators: [
      'Certified extension advisories',
      'Pest & disease protocols',
      'Seasonal crop calendars',
    ],
    source: 'ICAR & University Labs',
    capability: 'Research Network',
  },
]

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function RealWorldFarmData() {
  const sectionRef = useRef(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const items = sectionRef.current.querySelectorAll('.rwfd-reveal')
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('rwfd-reveal--in')
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
      className="rwfd-section"
      id="real-world-data"
      aria-labelledby="rwfd-heading"
      ref={sectionRef}
    >
      {/* Anchor for backward compatibility with old #smart-tools links */}
      <span id="smart-tools" style={{ position: 'absolute', top: '-80px', visibility: 'hidden' }} aria-hidden="true" />

      <div className="container">

        {/* Section Header */}
        <div className="rwfd-header rwfd-reveal">
          <span className="rwfd-eyebrow">
            <span className="rwfd-eyebrow__pulse" aria-hidden="true" />
            Live Data Integration
          </span>
          <h2 className="rwfd-heading" id="rwfd-heading">
            REAL-WORLD FARM DATA
          </h2>
          <p className="rwfd-subtext">
            Connect your farm with live environmental, satellite and market information.
          </p>
        </div>

        {/* 5-Card Compact Grid */}
        <div className="rwfd-grid" role="list">
          {FARM_DATA_CARDS.map((card, i) => (
            <article
              key={card.id}
              className={`rwfd-card rwfd-card--${card.accent} rwfd-reveal rwfd-reveal--delay-${i}`}
              role="listitem"
              aria-label={card.title}
            >
              {/* Top: Icon + Category Tag */}
              <div className="rwfd-card__top">
                <div className="rwfd-card__icon-wrap" aria-hidden="true">
                  {card.icon}
                </div>
                <span className="rwfd-card__tag">{card.tag}</span>
              </div>

              {/* Title & Prompt Description */}
              <h3 className="rwfd-card__title">{card.title}</h3>
              <p className="rwfd-card__desc">{card.description}</p>

              {/* Capabilities & Indicators (communicating real features without synthetic values) */}
              <ul className="rwfd-card__indicators" aria-label={`${card.title} features`}>
                {card.indicators.map((indicator, idx) => (
                  <li key={idx}>
                    <span className="rwfd-card__bullet" aria-hidden="true" />
                    <span>{indicator}</span>
                  </li>
                ))}
              </ul>

              {/* Status / Source Footer */}
              <div className="rwfd-card__status">
                <span className="rwfd-card__source">{card.source}</span>
                {card.id === 'mandi-prices' ? (
                  <a href="#mandi-prices" className="rwfd-card__badge rwfd-card__badge--link" title="View Mandi Price Intelligence">
                    <span className="rwfd-card__badge-dot" aria-hidden="true" />
                    {card.capability} ↓
                  </a>
                ) : (
                  <span className="rwfd-card__badge">
                    <span className="rwfd-card__badge-dot" aria-hidden="true" />
                    {card.capability}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Transparent Capability Footnote */}
        <div className="rwfd-notice rwfd-reveal rwfd-reveal--delay-4">
          <svg className="rwfd-notice__icon" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 6V11M10 14V14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="rwfd-notice__text">
            <strong>Authentic Telemetry:</strong> All data capabilities connect directly to official government mandis, meteorological sensors, and open satellite APIs. Live readings activate upon location configuration with no simulated figures.
          </p>
        </div>

      </div>
    </section>
  )
}
