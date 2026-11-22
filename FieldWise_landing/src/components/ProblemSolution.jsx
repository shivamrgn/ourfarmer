import { useEffect, useRef } from 'react'
import './ProblemSolution.css'

/* ── Problem data ── */
const PROBLEMS = [
  {
    id: 'crop-choice',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 40V20" stroke="#c47c2b" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M24 20C24 14 18 8 12 10C14 18 20 22 24 20Z" fill="#e8c07a" stroke="#c47c2b" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M24 28C24 22 30 16 36 18C34 26 28 30 24 28Z" fill="#e8c07a" stroke="#c47c2b" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="24" cy="42" r="3" fill="#c47c2b" opacity="0.3"/>
        <path d="M18 42h12" stroke="#c47c2b" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="14" cy="22" r="2" fill="#c47c2b" opacity="0.4"/>
        <circle cx="34" cy="24" r="2" fill="#c47c2b" opacity="0.4"/>
        <path d="M10 34 Q12 30 16 32" stroke="#c47c2b" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
      </svg>
    ),
    title: 'Choosing the Right Crop',
    pain: 'Farmers rely on habit and guesswork, often planting the wrong crop for their soil type, season, and local market conditions.',
    stat: '60% of crop failures',
    statSub: 'due to wrong variety selection',
  },
  {
    id: 'fertilizer',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="20" width="16" height="20" rx="3" fill="#e8c07a" stroke="#c47c2b" strokeWidth="1.5"/>
        <path d="M20 20V16C20 13.8 21.8 12 24 12C26.2 12 28 13.8 28 16V20" stroke="#c47c2b" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="24" cy="30" r="4" fill="#c47c2b" opacity="0.25"/>
        <path d="M21 30h6M24 27v6" stroke="#c47c2b" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 24 Q8 20 10 16" stroke="#c47c2b" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
        <path d="M36 24 Q40 20 38 16" stroke="#c47c2b" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
        <circle cx="10" cy="15" r="2" fill="#c47c2b" opacity="0.35"/>
        <circle cx="38" cy="15" r="2" fill="#c47c2b" opacity="0.35"/>
      </svg>
    ),
    title: 'Using the Right Fertilizer',
    pain: 'Over-fertilizing wastes money and harms the soil. Under-fertilizing stunts growth. Getting the balance right requires precise soil knowledge.',
    stat: '₹12,000 Cr wasted',
    statSub: 'annually on excess fertilizer in India',
  },
  {
    id: 'disease',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 34C14 34 12 22 20 16C26 12 34 14 36 20C38 26 34 34 28 36C22 38 16 36 14 34Z" fill="#e8c07a" stroke="#c47c2b" strokeWidth="1.5"/>
        <path d="M24 34V18" stroke="#c47c2b" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <circle cx="19" cy="24" r="2.5" fill="#c47c2b" opacity="0.35"/>
        <circle cx="29" cy="28" r="2" fill="#c47c2b" opacity="0.35"/>
        <circle cx="22" cy="30" r="1.5" fill="#c47c2b" opacity="0.25"/>
        <circle cx="31" cy="22" r="1.5" fill="#c47c2b" opacity="0.25"/>
        <circle cx="36" cy="10" r="5" fill="none" stroke="#c47c2b" strokeWidth="1.5"/>
        <path d="M34 10h4M36 8v4" stroke="#c47c2b" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M32 14L30 16" stroke="#c47c2b" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Detecting Plant Diseases Early',
    pain: 'By the time a disease is visible to the naked eye, it has often already spread across the field — causing major yield loss.',
    stat: '35% of crop yield',
    statSub: 'lost to undetected diseases annually',
  },
  {
    id: 'yield',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="30" width="8" height="10" rx="2" fill="#e8c07a" stroke="#c47c2b" strokeWidth="1.5"/>
        <rect x="20" y="22" width="8" height="18" rx="2" fill="#e8c07a" stroke="#c47c2b" strokeWidth="1.5"/>
        <rect x="32" y="14" width="8" height="26" rx="2" fill="#e8c07a" stroke="#c47c2b" strokeWidth="1.5"/>
        <path d="M10 26 L24 18 L36 10" stroke="#c47c2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3"/>
        <circle cx="10" cy="26" r="2.5" fill="#c47c2b"/>
        <circle cx="24" cy="18" r="2.5" fill="#c47c2b"/>
        <circle cx="36" cy="10" r="2.5" fill="#c47c2b"/>
        <path d="M8 42h32" stroke="#c47c2b" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
    title: 'Predicting Crop Yield',
    pain: 'Without accurate yield forecasts, farmers can\'t plan harvesting, storage, or selling — leading to financial losses and market mismatch.',
    stat: '4 in 5 farmers',
    statSub: 'have no reliable yield estimate before harvest',
  },
]

/* ── Solution input nodes ── */
const INPUTS = [
  { id: 'soil',    emoji: '🪱', label: 'Soil Data',    color: '#8b5a22' },
  { id: 'weather', emoji: '⛅', label: 'Weather',      color: '#2563eb' },
  { id: 'crop',    emoji: '🌾', label: 'Crop Profile', color: '#3a9c5f' },
  { id: 'health',  emoji: '🍃', label: 'Plant Health', color: '#2d7a4a' },
  { id: 'market',  emoji: '📈', label: 'Market Data',  color: '#c47c2b' },
]

/* ── Solution outputs ── */
const OUTPUTS = [
  { id: 'rec',     emoji: '✅', label: 'Crop Recommendation',      color: '#3a9c5f' },
  { id: 'fert',    emoji: '🧪', label: 'Fertilizer Guidance',      color: '#2d7a4a' },
  { id: 'disease', emoji: '🔬', label: 'Disease Detection',        color: '#235e3a' },
  { id: 'yield',   emoji: '📊', label: 'Yield Prediction',         color: '#1a4a2e' },
]

/* ── Scroll-reveal hook ── */
function useReveal(ref) {
  useEffect(() => {
    if (!ref.current) return
    const items = ref.current.querySelectorAll('.ps-reveal')
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('ps-reveal--in'); observer.unobserve(e.target) }
      }),
      { threshold: 0.12 }
    )
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

export default function ProblemSolution() {
  const sectionRef = useRef(null)
  useReveal(sectionRef)

  return (
    <section
      className="ps-section"
      id="problem-solution"
      aria-labelledby="ps-problem-heading"
      ref={sectionRef}
    >

      {/* ══════════════════════════════════════
          BLOCK 1 — PROBLEM
      ══════════════════════════════════════ */}
      <div className="ps-problem-block">
        <div className="container">

          {/* Section header */}
          <div className="ps-header ps-reveal">
            <span className="eyebrow">The Challenge</span>
            <h2 className="ps-heading" id="ps-problem-heading">
              Farming decisions shouldn't<br />be guesswork.
            </h2>
            <p className="ps-subtext">
              Every year, millions of farmers face the same critical decisions —
              often without the data or guidance they need.
            </p>
          </div>

          {/* Problem cards grid */}
          <div className="ps-problems-grid" role="list">
            {PROBLEMS.map((p, i) => (
              <article
                key={p.id}
                className={`ps-problem-card ps-reveal ps-reveal--delay-${i % 4}`}
                role="listitem"
                aria-label={p.title}
              >
                {/* Icon */}
                <div className="ps-problem-card__icon" aria-hidden="true">
                  {p.icon}
                </div>

                {/* Content */}
                <div className="ps-problem-card__body">
                  <h3 className="ps-problem-card__title">{p.title}</h3>
                  <p className="ps-problem-card__pain">{p.pain}</p>
                </div>

                {/* Stat callout */}
                <div className="ps-problem-card__stat">
                  <span className="ps-problem-card__stat-num">{p.stat}</span>
                  <span className="ps-problem-card__stat-sub">{p.statSub}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          BRIDGE / TRANSITION
      ══════════════════════════════════════ */}
      <div className="ps-bridge" aria-hidden="true">
        <div className="ps-bridge__line" />
        <div className="ps-bridge__pill">
          <span>There's a smarter way</span>
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <path d="M10 4v12M10 16l-4-4M10 16l4-4"
              stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="ps-bridge__line" />
      </div>

      {/* ══════════════════════════════════════
          BLOCK 2 — SOLUTION
      ══════════════════════════════════════ */}
      <div className="ps-solution-block">
        <div className="container">

          {/* Solution header */}
          <div className="ps-header ps-header--light ps-reveal">
            <span className="ps-solution-eyebrow">The Solution</span>
            <h2 className="ps-solution-heading">
              One intelligent ecosystem<br />for smarter farming.
            </h2>
            <p className="ps-solution-subtext">
              Crops Wild connects every data signal from your farm into a single AI
              engine that turns complexity into clear, actionable guidance.
            </p>
          </div>

          {/* Flow diagram */}
          <div className="ps-flow" role="img" aria-label="Platform data flow from inputs through AI to farming recommendations">

            {/* Left — Input nodes */}
            <div className="ps-flow__col ps-flow__col--inputs">
              <p className="ps-flow__col-label">Data Sources</p>
              {INPUTS.map((inp, i) => (
                <div
                  key={inp.id}
                  className={`ps-flow__node ps-flow__node--input ps-reveal ps-reveal--delay-${i}`}
                  style={{ '--node-color': inp.color }}
                >
                  <span className="ps-flow__node-emoji" aria-hidden="true">{inp.emoji}</span>
                  <span className="ps-flow__node-label">{inp.label}</span>
                </div>
              ))}
            </div>

            {/* Center arrows (left) */}
            <div className="ps-flow__arrows ps-flow__arrows--left" aria-hidden="true">
              {INPUTS.map((_, i) => (
                <div key={i} className="ps-flow__arrow-line">
                  <div className="ps-flow__arrow-track">
                    <div className="ps-flow__arrow-pulse" style={{ animationDelay: `${i * 0.18}s` }} />
                  </div>
                  <svg className="ps-flow__arrowhead" viewBox="0 0 10 10" width="10" height="10">
                    <path d="M2 5h6M6 2l4 3-4 3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
              ))}
            </div>

            {/* Center — AI Engine */}
            <div className="ps-flow__center ps-reveal">
              <div className="ps-flow__ai-ring ps-flow__ai-ring--outer" aria-hidden="true" />
              <div className="ps-flow__ai-ring ps-flow__ai-ring--mid"   aria-hidden="true" />
              <div className="ps-flow__ai-core">
                <span className="ps-flow__ai-icon" aria-hidden="true">🧠</span>
                <span className="ps-flow__ai-label">Crops Wild</span>
                <span className="ps-flow__ai-sublabel">Engine</span>
              </div>
            </div>

            {/* Center arrows (right) */}
            <div className="ps-flow__arrows ps-flow__arrows--right" aria-hidden="true">
              {OUTPUTS.map((_, i) => (
                <div key={i} className="ps-flow__arrow-line">
                  <svg className="ps-flow__arrowhead ps-flow__arrowhead--left" viewBox="0 0 10 10" width="10" height="10">
                    <path d="M8 5H2M4 2L0 5l4 3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                  <div className="ps-flow__arrow-track">
                    <div className="ps-flow__arrow-pulse ps-flow__arrow-pulse--right" style={{ animationDelay: `${i * 0.2}s` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Right — Output nodes */}
            <div className="ps-flow__col ps-flow__col--outputs">
              <p className="ps-flow__col-label">AI Outputs</p>
              {OUTPUTS.map((out, i) => (
                <div
                  key={out.id}
                  className={`ps-flow__node ps-flow__node--output ps-reveal ps-reveal--delay-${i}`}
                  style={{ '--node-color': out.color }}
                >
                  <span className="ps-flow__node-emoji" aria-hidden="true">{out.emoji}</span>
                  <span className="ps-flow__node-label">{out.label}</span>
                </div>
              ))}
            </div>

          </div>

          {/* Bottom tagline */}
          <p className="ps-flow__tagline ps-reveal">
            From raw farm data to precise, actionable recommendations —
            <strong> in seconds.</strong>
          </p>

        </div>
      </div>

    </section>
  )
}
