import { useEffect, useRef, useState } from 'react'
import './DashboardPreview.css'

/* ──────────────────────────────────────────
   REALISTIC FARM DATA
────────────────────────────────────────── */
const FARM = {
  name: 'Shivam Farm',
  location: ' Patna, Bihar',
  hectares: 12,
  farmer: 'Shivam Singh',
  crop: 'Wheat HD-2967',
  sowDate: '15 Nov 2025',
  stage: 'Tillering',
  stageProgress: 58,
  healthScore: 87,
  cropHealth: 91,
  weather: { temp: 28, condition: 'Partly Cloudy', humidity: 62, wind: 14, rain: '10%' },
  soil: { ph: 6.8, moisture: 42, n: 78, p: 54, k: 61 },
  yield: { expected: 4.2, lastYear: 3.8, unit: 't/ha' },
  disease: { status: 'clear', lastScan: '2 hours ago', scans: 14 },
}

const RECOMMENDATIONS = [
  { id: 'r1', priority: 'high', icon: '💧', title: 'Irrigation recommended', desc: 'Soil moisture at 42% — irrigate within 48 hours to maintain optimal growth.' },
  { id: 'r2', priority: 'medium', icon: '🧪', title: 'Nitrogen top-dressing', desc: 'Apply 30 kg/ha urea at tillering stage for maximum grain filling.' },
  { id: 'r3', priority: 'low', icon: '🌡️', title: 'Temperature watch', desc: 'Night temps expected to drop below 8°C this weekend. Monitor for frost stress.' },
]

const ALERTS = [
  { id: 'a1', type: 'info', icon: '🌧️', msg: 'Rain expected in 3 days (8mm forecast)', time: '1 hr ago' },
  { id: 'a2', type: 'success', icon: '✅', msg: 'Disease scan completed — no threats detected', time: '2 hrs ago' },
  { id: 'a3', type: 'warning', icon: '⚠️', msg: 'Soil moisture declining — check irrigation', time: '5 hrs ago' },
]

/* ── Nav items ── */
const NAV = [
  {
    id: 'overview', label: 'Overview', icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16"><rect x="2" y="2" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="11" y="2" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="2" y="11" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="11" y="11" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" /></svg>
    )
  },
  {
    id: 'crops', label: 'My Crops', icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M10 17V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M10 12C10 9 6 7 4 9C6 11 9 12 10 12Z" fill="currentColor" opacity="0.6" /><path d="M10 10C10 7 14 5 16 7C14 9 11 10 10 10Z" fill="currentColor" opacity="0.6" /></svg>
    )
  },
  {
    id: 'soil', label: 'Soil Analysis', icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M3 14 Q10 10 17 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="10" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M3 17H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" /></svg>
    )
  },
  {
    id: 'disease', label: 'Disease Scan', icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16"><circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
    )
  },
  {
    id: 'yield', label: 'Yield Forecast', icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M3 14 L7 10 L11 12 L17 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 17H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" /></svg>
    )
  },
]

/* ══════════════════════════════════════════════════════════════
   SHARED HELPERS
══════════════════════════════════════════════════════════════ */
function ScoreRing({ score, size = 72, strokeWidth = 6, color = '#3a9c5f' }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8f5ee" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  )
}

function MiniBar({ pct, color }) {
  return (
    <div className="db-mini-bar">
      <div className="db-mini-bar__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function DBadge({ type = 'green', children }) {
  return <span className={`db-badge db-badge--${type}`}>{children}</span>
}

/* ══════════════════════════════════════════════════════════════
   VIEW: OVERVIEW
══════════════════════════════════════════════════════════════ */
function OverviewView() {
  return (
    <div className="db-grid">
      {/* Farm Health */}
      <div className="db-card db-card--health">
        <div className="db-card__label">Farm Health Score</div>
        <div className="db-health-ring">
          <ScoreRing score={87} size={72} strokeWidth={6} color="#3a9c5f" />
          <div className="db-health-ring__center">
            <span className="db-health-ring__num">87</span>
            <span className="db-health-ring__max">/100</span>
          </div>
        </div>
        <div className="db-health-status">
          <DBadge type="green">Good</DBadge>
          <span className="db-health-delta">▲ +4 vs last week</span>
        </div>
      </div>

      {/* Weather */}
      <div className="db-card db-card--weather">
        <div className="db-card__label">Today's Weather</div>
        <div className="db-weather__top">
          <span className="db-weather__icon">⛅</span>
          <div>
            <div className="db-weather__temp">28°C</div>
            <div className="db-weather__cond">Partly Cloudy</div>
          </div>
        </div>
        <div className="db-weather__stats">
          {[['💧', '62%', 'Humidity'], ['🌬️', '14 km/h', 'Wind'], ['🌧️', '10%', 'Rain risk']].map(([icon, val, lbl]) => (
            <div className="db-weather__stat" key={lbl}>
              <span className="db-weather__stat-icon">{icon}</span>
              <span>{val}</span>
              <span className="db-weather__stat-label">{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Soil Health */}
      <div className="db-card db-card--soil">
        <div className="db-card__label">Soil Health</div>
        <div className="db-soil__ph">
          <span className="db-soil__ph-label">pH</span>
          <span className="db-soil__ph-val">6.8</span>
          <DBadge type="green">Optimal</DBadge>
        </div>
        <div className="db-soil__rows">
          {[
            { label: 'Moisture', val: '42%', pct: 42, c: '#2563eb' },
            { label: 'Nitrogen (N)', val: 'High', pct: 78, c: '#3a9c5f' },
            { label: 'Phosphorus (P)', val: 'Med', pct: 54, c: '#c47c2b' },
            { label: 'Potassium (K)', val: 'Med', pct: 61, c: '#8b5a22' },
          ].map(r => (
            <div className="db-soil__row" key={r.label}>
              <span className="db-soil__row-label">{r.label}</span>
              <MiniBar pct={r.pct} color={r.c} />
              <span className="db-soil__row-val" style={{ color: r.c }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="db-card db-card--recs">
        <div className="db-card__label">
          AI Recommendations
          <DBadge type="green">3 new</DBadge>
        </div>
        <div className="db-recs__list">
          {RECOMMENDATIONS.map(r => (
            <div className={`db-rec db-rec--${r.priority}`} key={r.id}>
              <span className="db-rec__icon">{r.icon}</span>
              <div className="db-rec__body">
                <div className="db-rec__top">
                  <span className="db-rec__title">{r.title}</span>
                  <DBadge type={r.priority === 'high' ? 'red' : r.priority === 'medium' ? 'amber' : 'slate'}>{r.priority}</DBadge>
                </div>
                <p className="db-rec__desc">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disease Status */}
      <div className="db-card db-card--disease">
        <div className="db-card__label">Disease Status</div>
        <div className="db-disease__status">
          <div className="db-disease__icon-wrap">
            <span className="db-disease__icon">🍃</span>
            <span className="db-disease__ring" />
          </div>
          <div className="db-disease__clear">No Disease Detected</div>
          <DBadge type="green">All Clear</DBadge>
        </div>
        <div className="db-disease__meta">
          <div className="db-disease__meta-row"><span>Last scan</span><strong>2 hours ago</strong></div>
          <div className="db-disease__meta-row"><span>Total scans</span><strong>14 this season</strong></div>
        </div>
      </div>

      {/* Current Crop */}
      <div className="db-card db-card--crop">
        <div className="db-card__label">Current Crop</div>
        <div className="db-crop__name">🌾 Wheat HD-2967</div>
        <div className="db-crop__sown">Sown: 15 Nov 2024</div>
        <div className="db-crop__stage-label">Growth Stage: <DBadge type="amber">Tillering</DBadge></div>
        <div className="db-crop__progress-wrap">
          <div className="db-crop__progress">
            <div className="db-crop__progress-fill" style={{ width: '58%' }} />
            <div className="db-crop__progress-dot" style={{ left: '58%' }} />
          </div>
          <div className="db-crop__progress-labels"><span>Germination</span><span>Harvest</span></div>
        </div>
      </div>

      {/* Crop Health */}
      <div className="db-card db-card--crop-health">
        <div className="db-card__label">Crop Health</div>
        <div className="db-health-ring db-health-ring--sm">
          <ScoreRing score={91} size={58} strokeWidth={5} color="#52b876" />
          <div className="db-health-ring__center db-health-ring__center--sm">
            <span className="db-health-ring__num db-health-ring__num--sm">91</span>
          </div>
        </div>
        <p className="db-crop-health__note">Excellent canopy cover. Uniform growth.</p>
        <div className="db-crop-health__trend">
          {[72, 78, 80, 82, 85, 88, 91].map((v, i) => (
            <div key={i} className="db-sparkbar" style={{ height: `${v * 0.32}px`, opacity: i === 6 ? 1 : 0.5 + i * 0.07 }} />
          ))}
        </div>
      </div>

      {/* Expected Yield */}
      <div className="db-card db-card--yield">
        <div className="db-card__label">Expected Yield</div>
        <div className="db-yield__num">4.2<span className="db-yield__unit">t/ha</span></div>
        <div className="db-yield__compare">
          {[['This year', '--current', 4.2], ['Last year', '--last', 3.8]].map(([lbl, cls, val]) => (
            <div className="db-yield__bar-row" key={lbl}>
              <span>{lbl}</span>
              <div className="db-yield__bar-track">
                <div className={`db-yield__bar-fill db-yield__bar-fill${cls}`} style={{ width: `${(val / 5) * 100}%` }} />
              </div>
              <span className="db-yield__bar-val">{val}t</span>
            </div>
          ))}
        </div>
        <DBadge type="green">▲ +10.5% vs last year</DBadge>
      </div>

      {/* Alerts */}
      <div className="db-card db-card--alerts">
        <div className="db-card__label">Recent Alerts</div>
        <div className="db-alerts__list">
          {ALERTS.map(a => (
            <div className={`db-alert db-alert--${a.type}`} key={a.id}>
              <span className="db-alert__icon">{a.icon}</span>
              <span className="db-alert__msg">{a.msg}</span>
              <span className="db-alert__time">{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VIEW: MY CROPS
══════════════════════════════════════════════════════════════ */
const MY_CROPS = [
  { id: 'c1', name: 'Wheat HD-2967', area: '8 ha', stage: 'Tillering', health: 91, status: 'green', sowDate: '15 Nov 2024', harvest: 'Apr 2025', progress: 58, icon: '🌾' },
  { id: 'c2', name: 'Mustard PM-30', area: '3 ha', stage: 'Flowering', health: 84, status: 'green', sowDate: '20 Oct 2024', harvest: 'Mar 2025', progress: 72, icon: '🌼' },
  { id: 'c3', name: 'Chickpea GNG-1', area: '1 ha', stage: 'Seedling', health: 76, status: 'amber', sowDate: '1 Dec 2024', harvest: 'May 2025', progress: 22, icon: '🫘' },
]

function CropsView() {
  return (
    <div className="db-view-pad">
      <div className="db-view-header">
        <div>
          <div className="db-view-title">My Crops</div>
          <div className="db-view-sub">3 active crops · 12 hectares total</div>
        </div>
        <button className="db-btn-primary">+ Add Crop</button>
      </div>

      <div className="db-crops-grid">
        {MY_CROPS.map(c => (
          <div className="db-card db-crop-card" key={c.id}>
            <div className="db-crop-card__top">
              <span className="db-crop-card__icon">{c.icon}</span>
              <div>
                <div className="db-crop-card__name">{c.name}</div>
                <div className="db-crop-card__area">{c.area}</div>
              </div>
              <DBadge type={c.status}>{c.stage}</DBadge>
            </div>

            <div className="db-crop-card__health-row">
              <span className="db-crop-card__health-label">Crop health</span>
              <span className="db-crop-card__health-val" style={{ color: c.health >= 85 ? '#3a9c5f' : '#c47c2b' }}>{c.health}%</span>
            </div>
            <div className="db-crop__progress" style={{ marginBottom: '0.625rem' }}>
              <div className="db-crop__progress-fill" style={{ width: `${c.progress}%` }} />
              <div className="db-crop__progress-dot" style={{ left: `${c.progress}%` }} />
            </div>

            <div className="db-crop-card__dates">
              <div className="db-crop-card__date"><span>Sown</span><strong>{c.sowDate}</strong></div>
              <div className="db-crop-card__date"><span>Harvest</span><strong>{c.harvest}</strong></div>
            </div>
          </div>
        ))}
      </div>

      {/* Season summary strip */}
      <div className="db-card db-season-strip">
        <div className="db-card__label">Season Overview — Rabi 2024–25</div>
        <div className="db-season-stats">
          {[['Total Area', '12 ha'], ['Crops', '3 active'], ['Avg Health', '84%'], ['Next Harvest', 'Mar 2025']].map(([k, v]) => (
            <div className="db-season-stat" key={k}>
              <div className="db-season-stat__val">{v}</div>
              <div className="db-season-stat__key">{k}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VIEW: SOIL ANALYSIS
══════════════════════════════════════════════════════════════ */
function SoilView() {
  const metrics = [
    { label: 'Nitrogen (N)', val: 78, unit: 'kg/ha', status: 'High', statusType: 'green', optimal: '60–80', color: '#3a9c5f', desc: 'Sufficient for current growth stage.' },
    { label: 'Phosphorus (P)', val: 54, unit: 'kg/ha', status: 'Medium', statusType: 'amber', optimal: '60–80', color: '#c47c2b', desc: 'Consider P top-dressing before heading.' },
    { label: 'Potassium (K)', val: 61, unit: 'kg/ha', status: 'Medium', statusType: 'amber', optimal: '70–90', color: '#8b5a22', desc: 'Slightly below optimal. Monitor root health.' },
    { label: 'Organic Matter', val: 62, unit: '%', status: 'Good', statusType: 'green', optimal: '55–70', color: '#52b876', desc: 'Good organic content for soil structure.' },
    { label: 'Moisture', val: 42, unit: '%', status: 'Low', statusType: 'red', optimal: '55–70', color: '#2563eb', desc: 'Irrigation recommended within 48 hours.' },
    { label: 'EC (Salinity)', val: 30, unit: 'dS/m', status: 'Normal', statusType: 'green', optimal: '20–40', color: '#3a9c5f', desc: 'Salinity within safe range for wheat.' },
  ]

  return (
    <div className="db-view-pad">
      <div className="db-view-header">
        <div>
          <div className="db-view-title">Soil Analysis</div>
          <div className="db-view-sub">Last tested: 2 days ago · Field A (Wheat block)</div>
        </div>
        <button className="db-btn-outline">📤 Update Test</button>
      </div>

      {/* pH + Texture hero */}
      <div className="db-soil-hero">
        <div className="db-card db-soil-ph-card">
          <div className="db-card__label">Soil pH</div>
          <div className="db-soil-ph-big">6.8</div>
          <DBadge type="green">Slightly Acidic — Optimal</DBadge>
          <div className="db-ph-scale">
            <div className="db-ph-scale__track">
              <div className="db-ph-scale__fill" style={{ left: `${((6.8 - 4) / 10) * 100}%` }} />
            </div>
            <div className="db-ph-scale__labels"><span>4</span><span>7</span><span>14</span></div>
          </div>
        </div>
        <div className="db-card db-soil-texture-card">
          <div className="db-card__label">Soil Texture</div>
          <div className="db-soil-texture__name">Sandy Loam</div>
          <div className="db-soil-texture__bars">
            {[['Sand', '45%', 45, '#c47c2b'], ['Silt', '35%', 35, '#8b5a22'], ['Clay', '20%', 20, '#3a9c5f']].map(([l, v, p, c]) => (
              <div className="db-soil-texture__row" key={l}>
                <span>{l}</span>
                <div className="db-mini-bar" style={{ flex: 1 }}><div className="db-mini-bar__fill" style={{ width: `${p}%`, background: c }} /></div>
                <span style={{ color: c, fontWeight: 700, fontSize: '0.6rem' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nutrient metrics */}
      <div className="db-soil-metrics">
        {metrics.map(m => (
          <div className="db-card db-soil-metric-card" key={m.label}>
            <div className="db-soil-metric__top">
              <span className="db-soil-metric__label">{m.label}</span>
              <DBadge type={m.statusType}>{m.status}</DBadge>
            </div>
            <div className="db-soil-metric__val">{m.val}<span className="db-soil-metric__unit">{m.unit}</span></div>
            <div className="db-mini-bar" style={{ marginBottom: '4px' }}><div className="db-mini-bar__fill" style={{ width: `${m.val}%`, background: m.color }} /></div>
            <div className="db-soil-metric__optimal">Optimal: {m.optimal} {m.unit}</div>
            <div className="db-soil-metric__desc">{m.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VIEW: DISEASE SCAN
══════════════════════════════════════════════════════════════ */
const SCAN_HISTORY = [
  { id: 's1', date: 'Today, 7:30 AM', crop: 'Wheat', leaf: 'Lower canopy', result: 'No disease', status: 'clear', confidence: 98 },
  { id: 's2', date: 'Yesterday, 4:00 PM', crop: 'Wheat', leaf: 'Mid canopy', result: 'No disease', status: 'clear', confidence: 96 },
  { id: 's3', date: '1 Jan, 10:00 AM', crop: 'Mustard', leaf: 'Upper leaves', result: 'Early Blight (trace)', status: 'watch', confidence: 72 },
  { id: 's4', date: '29 Dec, 8:00 AM', crop: 'Wheat', leaf: 'Lower canopy', result: 'No disease', status: 'clear', confidence: 99 },
]

function DiseaseView() {
  return (
    <div className="db-view-pad">
      <div className="db-view-header">
        <div>
          <div className="db-view-title">Disease Scan</div>
          <div className="db-view-sub">AI-powered leaf image analysis · 14 scans this season</div>
        </div>
        <button className="db-btn-primary">📷 New Scan</button>
      </div>

      <div className="db-disease-top">
        {/* Status card */}
        <div className="db-card db-disease-status-card">
          <div className="db-disease-status-card__circle">
            <span className="db-disease-icon-lg">🍃</span>
            <div className="db-disease-pulse-ring" />
          </div>
          <div className="db-disease-status-card__label">Overall Status</div>
          <div className="db-disease-status-card__val">All Clear</div>
          <DBadge type="green">No Active Threats</DBadge>
          <div className="db-disease-status-card__meta">
            <div><span>Last scan</span><strong>2 hrs ago</strong></div>
            <div><span>Season scans</span><strong>14</strong></div>
          </div>
        </div>

        {/* Upload prompt */}
        <div className="db-card db-disease-upload-card">
          <div className="db-card__label">Quick Scan</div>
          <div className="db-disease-upload">
            <span className="db-disease-upload__icon">📷</span>
            <div className="db-disease-upload__text">Upload a leaf image</div>
            <div className="db-disease-upload__sub">JPG, PNG · Max 10 MB</div>
            <button className="db-btn-primary db-btn-sm">Choose Image</button>
          </div>
          <div className="db-disease-upload__tips">
            <div className="db-card__label" style={{ marginBottom: '0.375rem' }}>Tips for best results</div>
            {['Clear, well-lit photo of the leaf', 'Include both healthy and affected areas', 'Avoid shadows on the leaf surface'].map(t => (
              <div className="db-disease-tip" key={t}>
                <span style={{ color: '#3a9c5f' }}>✓</span> {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scan history */}
      <div className="db-card">
        <div className="db-card__label">Scan History</div>
        <div className="db-scan-history">
          <div className="db-scan-header">
            {['Date & Time', 'Crop', 'Sample Area', 'Result', 'Confidence', 'Status'].map(h => (
              <span key={h}>{h}</span>
            ))}
          </div>
          {SCAN_HISTORY.map(s => (
            <div className="db-scan-row" key={s.id}>
              <span className="db-scan-date">{s.date}</span>
              <span>{s.crop}</span>
              <span>{s.leaf}</span>
              <span style={{ fontWeight: 600, color: s.status === 'clear' ? '#235e3a' : '#854d0e' }}>{s.result}</span>
              <span>
                <div className="db-mini-bar" style={{ width: 60 }}>
                  <div className="db-mini-bar__fill" style={{ width: `${s.confidence}%`, background: s.status === 'clear' ? '#3a9c5f' : '#c47c2b' }} />
                </div>
                <span style={{ fontSize: '0.55rem', color: '#9e9480' }}>{s.confidence}%</span>
              </span>
              <DBadge type={s.status === 'clear' ? 'green' : 'amber'}>{s.status === 'clear' ? 'Clear' : 'Watch'}</DBadge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VIEW: YIELD FORECAST
══════════════════════════════════════════════════════════════ */
const MONTHLY_YIELD = [
  { month: 'Nov', growth: 5, label: 'Germination' },
  { month: 'Dec', growth: 18, label: 'Establishment' },
  { month: 'Jan', growth: 42, label: 'Tillering' },
  { month: 'Feb', growth: 68, label: 'Jointing' },
  { month: 'Mar', growth: 85, label: 'Heading' },
  { month: 'Apr', growth: 100, label: 'Harvest', projected: true },
]

function YieldView() {
  return (
    <div className="db-view-pad">
      <div className="db-view-header">
        <div>
          <div className="db-view-title">Yield Forecast</div>
          <div className="db-view-sub">AI-powered prediction · Wheat HD-2967 · Rabi 2024–25</div>
        </div>
        <DBadge type="green">92% Confidence</DBadge>
      </div>

      {/* KPI row */}
      <div className="db-yield-kpis">
        {[
          { label: 'Expected Yield', val: '4.2 t/ha', sub: '+10.5% vs last year', type: 'green' },
          { label: 'Last Year', val: '3.8 t/ha', sub: 'Rabi 2023–24', type: 'slate' },
          { label: 'District Avg', val: '3.5 t/ha', sub: 'Ludhiana average', type: 'slate' },
          { label: 'Potential Max', val: '5.0 t/ha', sub: 'Ideal conditions', type: 'amber' },
        ].map(k => (
          <div className="db-card db-yield-kpi" key={k.label}>
            <div className="db-card__label">{k.label}</div>
            <div className="db-yield-kpi__val">{k.val}</div>
            <DBadge type={k.type}>{k.sub}</DBadge>
          </div>
        ))}
      </div>

      {/* Growth stage bar chart */}
      <div className="db-card db-yield-chart-card">
        <div className="db-card__label">Growth Progress & Projected Yield Accumulation</div>
        <div className="db-yield-chart">
          {MONTHLY_YIELD.map((m, i) => (
            <div className="db-yield-col" key={m.month}>
              <div className="db-yield-bar-wrap">
                <div
                  className={`db-yield-bar ${m.projected ? 'db-yield-bar--projected' : ''}`}
                  style={{ height: `${m.growth}%` }}
                >
                  <span className="db-yield-bar__tip">{m.growth}%</span>
                </div>
              </div>
              <div className="db-yield-chart__month">{m.month}</div>
              <div className="db-yield-chart__stage">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="db-card">
        <div className="db-card__label">Yield Influencing Factors</div>
        <div className="db-yield-factors">
          {[
            { label: 'Soil Fertility', score: 78, impact: 'positive', icon: '🪱' },
            { label: 'Weather Suitability', score: 82, impact: 'positive', icon: '⛅' },
            { label: 'Crop Variety Match', score: 91, impact: 'positive', icon: '🌾' },
            { label: 'Water Availability', score: 52, impact: 'risk', icon: '💧' },
            { label: 'Pest/Disease Risk', score: 12, impact: 'low-risk', icon: '🔬' },
          ].map(f => (
            <div className="db-yield-factor" key={f.label}>
              <span className="db-yield-factor__icon">{f.icon}</span>
              <span className="db-yield-factor__label">{f.label}</span>
              <div className="db-mini-bar" style={{ flex: 1 }}>
                <div className="db-mini-bar__fill" style={{
                  width: `${f.score}%`,
                  background: f.impact === 'positive' ? '#3a9c5f' : f.impact === 'risk' ? '#c47c2b' : '#b3e4c5'
                }} />
              </div>
              <span className="db-yield-factor__score" style={{
                color: f.impact === 'positive' ? '#3a9c5f' : f.impact === 'risk' ? '#c47c2b' : '#9e9480'
              }}>{f.score}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD ROOT — with tab state
══════════════════════════════════════════════════════════════ */
function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  const views = {
    overview: <OverviewView />,
    crops: <CropsView />,
    soil: <SoilView />,
    disease: <DiseaseView />,
    yield: <YieldView />,
  }

  return (
    <div className="db-root">
      {/* Sidebar */}
      <aside className="db-sidebar">
        <div className="db-sidebar__brand">
          <span className="db-sidebar__logo">🌾</span>
          <span className="db-sidebar__name">CropsWild</span>
        </div>

        <nav className="db-sidebar__nav">
          {NAV.map(item => (
            <button
              key={item.id}
              className={`db-nav-item ${activeTab === item.id ? 'db-nav-item--active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
              aria-label={item.label}
            >
              <span className="db-nav-item__icon">{item.icon}</span>
              <span className="db-nav-item__label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="db-sidebar__farm-tag">
          <span className="db-farm-dot" />
          <span className="db-farm-label">{FARM.name}</span>
        </div>
      </aside>

      {/* Main */}
      <div className="db-main">
        {/* Header */}
        <header className="db-header">
          <div className="db-header__left">
            <h1 className="db-header__greeting">Good morning, Shivam 👋</h1>
            <p className="db-header__meta">{FARM.name} · {FARM.hectares} ha · {FARM.location}</p>
          </div>
          <div className="db-header__right">
            <div className="db-header__chip"><span className="db-header__chip-dot" />Live data</div>
            <div className="db-header__avatar">S</div>
          </div>
        </header>

        {/* View content — key forces re-mount animation */}
        <div className="db-view-area" key={activeTab}>
          {views[activeTab]}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION WRAPPER
══════════════════════════════════════════════════════════════ */
export default function DashboardPreview() {
  const sectionRef = useRef(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const items = sectionRef.current.querySelectorAll('.dp-reveal')
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('dp-reveal--in'); observer.unobserve(e.target) }
      }),
      { threshold: 0.08 }
    )
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section className="dp-section" id="dashboard" aria-labelledby="dp-heading" ref={sectionRef}>
      <div className="container">
        <div className="dp-header dp-reveal">
          <span className="eyebrow">Dashboard Preview</span>
          <h2 className="dp-heading" id="dp-heading">
            Everything your farm needs,<br />in one view.
          </h2>
          <p className="dp-subtext">
            Turn complex agricultural data into simple, actionable insights —
            all from a single, clean dashboard.
          </p>
        </div>

        <div className="dp-frame-wrap dp-reveal dp-reveal--scale">
          <div className="dp-glow" aria-hidden="true" />
          <div className="dp-browser">
            <div className="dp-browser__chrome">
              <div className="dp-browser__dots">
                <span className="dp-dot dp-dot--red" />
                <span className="dp-dot dp-dot--amber" />
                <span className="dp-dot dp-dot--green" />
              </div>
              <div className="dp-browser__url">
                <span className="dp-browser__lock">🔒</span>
                <span>cropswild.in</span>
              </div>
              <div className="dp-browser__actions"><span /><span /></div>
            </div>
            <div className="dp-browser__content">
              <Dashboard />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
