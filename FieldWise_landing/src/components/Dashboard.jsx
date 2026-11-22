import { useState } from 'react'
import './Dashboard.css'

export default function Dashboard({ user, onLogout, onBackToLanding }) {
  const [activeTab, setActiveTab] = useState('crop') // 'crop' | 'fertilizer' | 'disease' | 'yield' | 'market'

  // Crop recommendation form state
  const [cropInputs, setCropInputs] = useState({
    nitrogen: 90,
    phosphorus: 42,
    potassium: 43,
    temperature: 24,
    humidity: 62,
    ph: 6.5,
    rainfall: 140
  })
  const [cropResult, setCropResult] = useState({
    crop: 'Wheat (HD-2967 Variety)',
    confidence: '95.4%',
    suitability: 'High',
    waterNeed: 'Medium (350-450 mm)',
    growthPeriod: '115 - 125 Days',
    season: 'Rabi Season (Winter)',
    notes: 'Soil nitrogen and neutral pH are ideal for wheat tillering in western and central plains.'
  })

  // Fertilizer calculator state
  const [fertInputs, setFertInputs] = useState({
    crop: 'Wheat',
    soilType: 'Alluvial Loam',
    farmSize: 2 // acres
  })
  const [fertResult, setFertResult] = useState({
    urea: '75 kg (1.5 bags)',
    dap: '50 kg (1 bag)',
    mop: '25 kg (0.5 bag)',
    schedule: 'Apply 50% Urea + full DAP & MOP as basal dose during sowing. Top dress remaining Urea at 1st irrigation.'
  })

  // Disease diagnosis state
  const [selectedDiseaseSample, setSelectedDiseaseSample] = useState('rust')
  const diseaseDatabase = {
    rust: {
      crop: 'Wheat',
      disease: 'Brown Leaf Rust (Puccinia triticina)',
      severity: 'Moderate (28% leaf coverage)',
      organicTreatment: 'Spray 5% Neem seed kernel extract (NSKE) or bio-fungicide Trichoderma viride.',
      chemicalControl: 'Propiconazole 25% EC @ 1ml per liter of water during early detection.',
      statusColor: '#d97706'
    },
    blight: {
      crop: 'Tomato',
      disease: 'Early Blight (Alternaria solani)',
      severity: 'Low to Mild (15% spread)',
      organicTreatment: 'Copper oxychloride 50 WP spray or baking soda solution with horticultural oil.',
      chemicalControl: 'Mancozeb 75 WP @ 2g/L or Azoxystrobin 23 SC @ 1ml/L.',
      statusColor: '#ea580c'
    },
    healthy: {
      crop: 'Rice / Paddy',
      disease: 'No Disease Detected — Healthy Foliage',
      severity: '0% — Vigorous chlorophyll index',
      organicTreatment: 'Maintain regular vermicompost and microbial culture to preserve resistance.',
      chemicalControl: 'No chemical treatment needed. Continue balanced NPK irrigation.',
      statusColor: '#16a34a'
    }
  }

  // Yield calculator state
  const [yieldInputs, setYieldInputs] = useState({
    acres: 3,
    crop: 'Wheat',
    irrigation: 'Drip / Micro-irrigation'
  })

  const calculateYield = () => {
    const baseRates = { Wheat: 22, Rice: 26, Cotton: 12, Mustard: 10 }
    const multiplier = yieldInputs.irrigation === 'Drip / Micro-irrigation' ? 1.25 : 1.0
    const perAcre = (baseRates[yieldInputs.crop] || 20) * multiplier
    const totalQtl = Math.round(perAcre * yieldInputs.acres)
    const mandiPrices = { Wheat: 2420, Rice: 2250, Cotton: 7150, Mustard: 5650 }
    const totalRevenue = totalQtl * (mandiPrices[yieldInputs.crop] || 2400)
    return { totalQtl, totalRevenue }
  }

  const handlePresetSoil = (type) => {
    if (type === 'gujarat') {
      setCropInputs({ nitrogen: 105, phosphorus: 48, potassium: 50, temperature: 26, humidity: 55, ph: 7.1, rainfall: 110 })
    } else if (type === 'black') {
      setCropInputs({ nitrogen: 75, phosphorus: 38, potassium: 65, temperature: 28, humidity: 68, ph: 7.8, rainfall: 180 })
    } else {
      setCropInputs({ nitrogen: 60, phosphorus: 30, potassium: 35, temperature: 22, humidity: 50, ph: 6.2, rainfall: 90 })
    }
  }

  const runCropAI = () => {
    if (cropInputs.nitrogen > 80 && cropInputs.ph <= 7.3) {
      setCropResult({
        crop: 'Wheat (HD-2967 / GW-496)',
        confidence: '96.2%',
        suitability: 'Optimal',
        waterNeed: 'Medium (350-450 mm)',
        growthPeriod: '115 - 120 Days',
        season: 'Rabi Season (Winter)',
        notes: 'High nitrogen efficiency and balanced moisture ensure high tillering and grain weight.'
      })
    } else if (cropInputs.rainfall > 150) {
      setCropResult({
        crop: 'Cotton (Bt Hybrid Gujarat-6)',
        confidence: '93.8%',
        suitability: 'High',
        waterNeed: 'High (600-750 mm)',
        growthPeriod: '150 - 165 Days',
        season: 'Kharif / Post-Monsoon',
        notes: 'Well-suited for deep soil with good drainage and warm vegetative phase.'
      })
    } else {
      setCropResult({
        crop: 'Mustard (Pusa Bold / Gujarat Mustard 3)',
        confidence: '91.5%',
        suitability: 'Very Good',
        waterNeed: 'Low (200-300 mm)',
        growthPeriod: '105 - 115 Days',
        season: 'Rabi Season',
        notes: 'Low water requirement makes it drought resilient with high oil content potential.'
      })
    }
  }

  const handleLaunchMainApp = async () => {
    const candidates = ['http://localhost:5174', 'http://localhost:8080']
    for (const url of candidates) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 350)
        await fetch(url, { mode: 'no-cors', signal: controller.signal })
        clearTimeout(timer)
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(user || {}))))
        window.location.href = `${url}?session=${encoded}`
        return
      } catch {}
    }
    alert('Crops Wild Main App server is not running on port 5174 or 8080.\nTo run the full suite, start it with:\ncd FieldWise_main && npm run dev')
  }

  const currentYield = calculateYield()

  return (
    <div className="dashboard-layout">
      {/* ── Dashboard Navigation Bar ── */}
      <header className="dash-nav">
        <div className="dash-nav__container">
          <div className="dash-nav__brand">
            <button className="dash-nav__back" onClick={onBackToLanding} title="Return to Landing Page">
              ← Website
            </button>
            <div className="dash-nav__logo">
              <span className="dash-logo-icon">🌾</span>
              <span className="dash-logo-text">Crops<span className="dash-logo-accent">Wild</span></span>
              <span className="dash-badge">Core Engine</span>
            </div>
          </div>

          <div className="dash-nav__user-menu">
            <button
              type="button"
              className="dash-launch-pro-btn"
              onClick={handleLaunchMainApp}
              title="Launch full Crops Wild Pro multi-module suite"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #1b4332, #2d6a4f)',
                color: '#e8f5e9',
                border: '1px solid #40916c',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <span>🚀 Launch Crops Wild Pro</span>
            </button>

            <div className="dash-user-badge">
              <div className="dash-user-avatar">
                {user?.isDemo ? '🚜' : (user?.displayName?.charAt(0) || 'F')}
              </div>
              <div className="dash-user-meta">
                <span className="dash-user-name">
                  {user?.displayName || 'Farmer Partner'}
                  {user?.isDemo && <span className="dash-demo-tag">DEMO MODE</span>}
                </span>
                <span className="dash-user-loc">📍 {user?.address || 'Vadodara, Gujarat'}</span>
              </div>
            </div>

            <button type="button" className="dash-logout-btn" onClick={onLogout} id="dash-exit-btn">
              <span>Exit</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Demo Notice Banner (if in demo) ── */}
      {user?.isDemo && (
        <div className="dash-demo-alert">
          <div className="dash-demo-alert-content">
            <span className="dash-pulse-dot" />
            <span>
              <strong>You are in Crops Wild Demo Mode:</strong> Test all algorithms, recalculate crop recommendations, and test disease detection freely. Your data is not stored permanently.
            </span>
          </div>
        </div>
      )}

      {/* ── Main Dashboard Content ── */}
      <main className="dash-content">
        <div className="dash-container">

          {/* ── Top Status Cards Bar ── */}
          <section className="dash-stats-grid">
            <div className="dash-stat-card">
              <div className="dash-stat-header">
                <span className="dash-stat-icon">🌤️</span>
                <span className="dash-stat-label">Local Field Weather</span>
              </div>
              <div className="dash-stat-value">28°C · Pleasant</div>
              <div className="dash-stat-sub">Vadodara / Anand · Rain Risk 8% · Humidity 52%</div>
            </div>

            <div className="dash-stat-card">
              <div className="dash-stat-header">
                <span className="dash-stat-icon">🧪</span>
                <span className="dash-stat-label">Active Soil Health</span>
              </div>
              <div className="dash-stat-value">NPK 105:48:50</div>
              <div className="dash-stat-sub">pH 6.8 (Neutral) · Organic Carbon: 0.65%</div>
            </div>

            <div className="dash-stat-card">
              <div className="dash-stat-header">
                <span className="dash-stat-icon">🌱</span>
                <span className="dash-stat-label">Current Farm Season</span>
              </div>
              <div className="dash-stat-value">Rabi Sowing</div>
              <div className="dash-stat-sub">Peak Sowing Window: Next 10 days</div>
            </div>

            <div className="dash-stat-card">
              <div className="dash-stat-header">
                <span className="dash-stat-icon">📊</span>
                <span className="dash-stat-label">Mandi Reference</span>
              </div>
              <div className="dash-stat-value">Wheat: ₹2,420 / Qtl</div>
              <div className="dash-stat-sub">APMC Gujarat · +₹45 vs last week</div>
            </div>
          </section>

          {/* ── Interactive Tools Section ── */}
          <section className="dash-main-card">
            {/* Tab navigation */}
            <div className="dash-tabs" role="tablist">
              <button
                className={`dash-tab ${activeTab === 'crop' ? 'dash-tab--active' : ''}`}
                onClick={() => setActiveTab('crop')}
              >
                🌾 Crop Recommendation AI
              </button>
              <button
                className={`dash-tab ${activeTab === 'fertilizer' ? 'dash-tab--active' : ''}`}
                onClick={() => setActiveTab('fertilizer')}
              >
                🧪 Fertilizer Calculator
              </button>
              <button
                className={`dash-tab ${activeTab === 'disease' ? 'dash-tab--active' : ''}`}
                onClick={() => setActiveTab('disease')}
              >
                🔍 Plant Leaf Disease Lab
              </button>
              <button
                className={`dash-tab ${activeTab === 'yield' ? 'dash-tab--active' : ''}`}
                onClick={() => setActiveTab('yield')}
              >
                📈 Yield & Revenue Predictor
              </button>
              <button
                className={`dash-tab ${activeTab === 'market' ? 'dash-tab--active' : ''}`}
                onClick={() => setActiveTab('market')}
              >
                🏪 Live Mandi Rates
              </button>
            </div>

            {/* TAB 1: CROP RECOMMENDATION */}
            {activeTab === 'crop' && (
              <div className="dash-tab-body">
                <div className="dash-section-intro">
                  <h3>AI Crop Recommendation Engine</h3>
                  <p>Input your soil nutrient levels and environmental parameters to find the highest-yielding crop for your land.</p>
                </div>

                <div className="dash-soil-presets">
                  <span className="dash-presets-label">Quick Soil Presets:</span>
                  <button className="dash-preset-btn" onClick={() => handlePresetSoil('gujarat')}>
                    Alluvial Soil (Central Gujarat)
                  </button>
                  <button className="dash-preset-btn" onClick={() => handlePresetSoil('black')}>
                    Black Cotton Soil (Saurashtra)
                  </button>
                  <button className="dash-preset-btn" onClick={() => handlePresetSoil('sandy')}>
                    Sandy Loam (North Gujarat)
                  </button>
                </div>

                <div className="dash-two-col">
                  {/* Left: Input sliders */}
                  <div className="dash-form-panel">
                    <div className="dash-slider-group">
                      <div className="dash-slider-header">
                        <label>Nitrogen (N) - kg/ha</label>
                        <span className="dash-slider-val">{cropInputs.nitrogen} kg/ha</span>
                      </div>
                      <input
                        type="range" min="20" max="150"
                        value={cropInputs.nitrogen}
                        onChange={(e) => setCropInputs({ ...cropInputs, nitrogen: Number(e.target.value) })}
                      />
                    </div>

                    <div className="dash-slider-group">
                      <div className="dash-slider-header">
                        <label>Phosphorus (P) - kg/ha</label>
                        <span className="dash-slider-val">{cropInputs.phosphorus} kg/ha</span>
                      </div>
                      <input
                        type="range" min="10" max="90"
                        value={cropInputs.phosphorus}
                        onChange={(e) => setCropInputs({ ...cropInputs, phosphorus: Number(e.target.value) })}
                      />
                    </div>

                    <div className="dash-slider-group">
                      <div className="dash-slider-header">
                        <label>Potassium (K) - kg/ha</label>
                        <span className="dash-slider-val">{cropInputs.potassium} kg/ha</span>
                      </div>
                      <input
                        type="range" min="10" max="90"
                        value={cropInputs.potassium}
                        onChange={(e) => setCropInputs({ ...cropInputs, potassium: Number(e.target.value) })}
                      />
                    </div>

                    <div className="dash-slider-group">
                      <div className="dash-slider-header">
                        <label>Soil pH Level</label>
                        <span className="dash-slider-val">{cropInputs.ph}</span>
                      </div>
                      <input
                        type="range" min="5.0" max="9.0" step="0.1"
                        value={cropInputs.ph}
                        onChange={(e) => setCropInputs({ ...cropInputs, ph: Number(e.target.value) })}
                      />
                    </div>

                    <div className="dash-slider-group">
                      <div className="dash-slider-header">
                        <label>Expected Rainfall (mm)</label>
                        <span className="dash-slider-val">{cropInputs.rainfall} mm</span>
                      </div>
                      <input
                        type="range" min="40" max="300"
                        value={cropInputs.rainfall}
                        onChange={(e) => setCropInputs({ ...cropInputs, rainfall: Number(e.target.value) })}
                      />
                    </div>

                    <button className="dash-action-btn" onClick={runCropAI}>
                      ✨ Run AI Recommendation
                    </button>
                  </div>

                  {/* Right: AI Output Card */}
                  <div className="dash-output-card">
                    <div className="dash-output-badge">
                      <span className="dash-leaf">🌾</span> AI Confidence: {cropResult.confidence}
                    </div>
                    <h4 className="dash-output-title">{cropResult.crop}</h4>
                    <p className="dash-output-desc">{cropResult.notes}</p>

                    <div className="dash-output-metrics">
                      <div className="dash-metric-pill">
                        <span className="dash-metric-name">Suitability</span>
                        <strong className="dash-metric-val">{cropResult.suitability}</strong>
                      </div>
                      <div className="dash-metric-pill">
                        <span className="dash-metric-name">Water Requirement</span>
                        <strong className="dash-metric-val">{cropResult.waterNeed}</strong>
                      </div>
                      <div className="dash-metric-pill">
                        <span className="dash-metric-name">Growth Cycle</span>
                        <strong className="dash-metric-val">{cropResult.growthPeriod}</strong>
                      </div>
                      <div className="dash-metric-pill">
                        <span className="dash-metric-name">Target Season</span>
                        <strong className="dash-metric-val">{cropResult.season}</strong>
                      </div>
                    </div>

                    <div className="dash-tips-box">
                      <strong>💡 Farmer Advisory:</strong>
                      <span>Soil moisture is ideal. Treat seeds with Trichoderma before sowing to protect against root rot.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: FERTILIZER CALCULATOR */}
            {activeTab === 'fertilizer' && (
              <div className="dash-tab-body">
                <div className="dash-section-intro">
                  <h3>Targeted Fertilizer & Nutrient Optimizer</h3>
                  <p>Calculate exact fertilizer bags needed to prevent over-fertilization and save input costs.</p>
                </div>

                <div className="dash-two-col">
                  <div className="dash-form-panel">
                    <div className="dash-input-field">
                      <label>Selected Crop</label>
                      <select
                        value={fertInputs.crop}
                        onChange={(e) => setFertInputs({ ...fertInputs, crop: e.target.value })}
                      >
                        <option value="Wheat">Wheat</option>
                        <option value="Rice">Rice / Paddy</option>
                        <option value="Cotton">Cotton</option>
                        <option value="Mustard">Mustard</option>
                        <option value="Groundnut">Groundnut</option>
                      </select>
                    </div>

                    <div className="dash-input-field">
                      <label>Soil Type</label>
                      <select
                        value={fertInputs.soilType}
                        onChange={(e) => setFertInputs({ ...fertInputs, soilType: e.target.value })}
                      >
                        <option value="Alluvial Loam">Alluvial Loam</option>
                        <option value="Black Soil">Black Cotton Soil</option>
                        <option value="Sandy Loam">Sandy Loam</option>
                        <option value="Clay Loam">Clay Loam</option>
                      </select>
                    </div>

                    <div className="dash-input-field">
                      <label>Farm Area (in Acres)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={fertInputs.farmSize}
                        onChange={(e) => setFertInputs({ ...fertInputs, farmSize: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="dash-output-card">
                    <h4 className="dash-output-title">Recommended Dosages for {fertInputs.farmSize} Acres</h4>
                    <div className="dash-fert-grid">
                      <div className="dash-fert-item">
                        <span className="dash-fert-label">Urea (46% N)</span>
                        <span className="dash-fert-amount">{fertInputs.farmSize * 35} kg</span>
                        <span className="dash-fert-bags">~{((fertInputs.farmSize * 35) / 45).toFixed(1)} Bags (45kg)</span>
                      </div>
                      <div className="dash-fert-item">
                        <span className="dash-fert-label">DAP (18-46-0)</span>
                        <span className="dash-fert-amount">{fertInputs.farmSize * 25} kg</span>
                        <span className="dash-fert-bags">~{((fertInputs.farmSize * 25) / 50).toFixed(1)} Bags (50kg)</span>
                      </div>
                      <div className="dash-fert-item">
                        <span className="dash-fert-label">MOP (60% K2O)</span>
                        <span className="dash-fert-amount">{fertInputs.farmSize * 15} kg</span>
                        <span className="dash-fert-bags">~{((fertInputs.farmSize * 15) / 50).toFixed(1)} Bags (50kg)</span>
                      </div>
                    </div>
                    <div className="dash-schedule-card">
                      <strong>Application Schedule:</strong>
                      <p>{fertResult.schedule}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PLANT DISEASE LAB */}
            {activeTab === 'disease' && (
              <div className="dash-tab-body">
                <div className="dash-section-intro">
                  <h3>AI Plant Disease Diagnostic Lab</h3>
                  <p>Computer vision analysis to identify foliar pathogens, blights, and deficiencies.</p>
                </div>

                <div className="dash-sample-picker">
                  <span className="dash-picker-label">Select Sample Case to Analyze:</span>
                  <div className="dash-sample-buttons">
                    <button
                      className={`dash-sample-btn ${selectedDiseaseSample === 'rust' ? 'dash-sample-btn--active' : ''}`}
                      onClick={() => setSelectedDiseaseSample('rust')}
                    >
                      🌾 Wheat Leaf Rust
                    </button>
                    <button
                      className={`dash-sample-btn ${selectedDiseaseSample === 'blight' ? 'dash-sample-btn--active' : ''}`}
                      onClick={() => setSelectedDiseaseSample('blight')}
                    >
                      🍅 Tomato Early Blight
                    </button>
                    <button
                      className={`dash-sample-btn ${selectedDiseaseSample === 'healthy' ? 'dash-sample-btn--active' : ''}`}
                      onClick={() => setSelectedDiseaseSample('healthy')}
                    >
                      🌱 Healthy Paddy Foliage
                    </button>
                  </div>
                </div>

                <div className="dash-disease-display">
                  <div className="dash-disease-visual">
                    <div className="dash-scan-animation">
                      <div className="dash-scan-line" />
                    </div>
                    <div className="dash-leaf-preview">
                      {selectedDiseaseSample === 'rust' && '🌾 [Foliage Sample: Wheat Leaf with orange-brown pustules]'}
                      {selectedDiseaseSample === 'blight' && '🍅 [Foliage Sample: Tomato Leaf with concentric target rings]'}
                      {selectedDiseaseSample === 'healthy' && '🌱 [Foliage Sample: Pristine green Paddy Leaf tissue]'}
                    </div>
                    <div className="dash-visual-label">Real-time Vision Inspection</div>
                  </div>

                  <div className="dash-disease-details">
                    <div
                      className="dash-disease-status-tag"
                      style={{ color: diseaseDatabase[selectedDiseaseSample].statusColor }}
                    >
                      ● {diseaseDatabase[selectedDiseaseSample].disease}
                    </div>
                    <div className="dash-disease-metric">
                      <span>Crop:</span> <strong>{diseaseDatabase[selectedDiseaseSample].crop}</strong>
                    </div>
                    <div className="dash-disease-metric">
                      <span>Infection Severity:</span> <strong>{diseaseDatabase[selectedDiseaseSample].severity}</strong>
                    </div>

                    <div className="dash-remedy-box dash-remedy--organic">
                      <strong>🌿 Organic / Biological Control:</strong>
                      <p>{diseaseDatabase[selectedDiseaseSample].organicTreatment}</p>
                    </div>

                    <div className="dash-remedy-box dash-remedy--chemical">
                      <strong>🧪 Chemical / Fungicide Recommendation:</strong>
                      <p>{diseaseDatabase[selectedDiseaseSample].chemicalControl}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: YIELD & REVENUE */}
            {activeTab === 'yield' && (
              <div className="dash-tab-body">
                <div className="dash-section-intro">
                  <h3>Farm Yield & Revenue Forecaster</h3>
                  <p>Calculate anticipated output based on farm size, irrigation technique, and current APMC market benchmark rates.</p>
                </div>

                <div className="dash-two-col">
                  <div className="dash-form-panel">
                    <div className="dash-input-field">
                      <label>Farm Area (Acres)</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={yieldInputs.acres}
                        onChange={(e) => setYieldInputs({ ...yieldInputs, acres: Number(e.target.value) })}
                      />
                    </div>

                    <div className="dash-input-field">
                      <label>Target Crop</label>
                      <select
                        value={yieldInputs.crop}
                        onChange={(e) => setYieldInputs({ ...yieldInputs, crop: e.target.value })}
                      >
                        <option value="Wheat">Wheat (Rabi)</option>
                        <option value="Rice">Rice / Paddy (Kharif)</option>
                        <option value="Cotton">Cotton</option>
                        <option value="Mustard">Mustard</option>
                      </select>
                    </div>

                    <div className="dash-input-field">
                      <label>Irrigation System</label>
                      <select
                        value={yieldInputs.irrigation}
                        onChange={(e) => setYieldInputs({ ...yieldInputs, irrigation: e.target.value })}
                      >
                        <option value="Drip / Micro-irrigation">Drip / Micro-irrigation (+25% efficiency)</option>
                        <option value="Canal / Flood">Canal / Flood Irrigation (Standard)</option>
                      </select>
                    </div>
                  </div>

                  <div className="dash-output-card dash-yield-card">
                    <div className="dash-yield-metric-box">
                      <span className="dash-yield-sub">Estimated Total Production</span>
                      <h3 className="dash-yield-big">{currentYield.totalQtl} <span className="dash-unit">Quintals</span></h3>
                      <span className="dash-yield-helper">~{(currentYield.totalQtl / yieldInputs.acres).toFixed(1)} Quintals / Acre</span>
                    </div>

                    <div className="dash-yield-metric-box dash-yield-metric-box--money">
                      <span className="dash-yield-sub">Projected Market Value (Mandi APMC)</span>
                      <h3 className="dash-yield-big dash-yield-big--gold">₹{currentYield.totalRevenue.toLocaleString('en-IN')}</h3>
                      <span className="dash-yield-helper">Based on prevailing Gujarat mandi benchmark price</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: LIVE MANDI RATES */}
            {activeTab === 'market' && (
              <div className="dash-tab-body">
                <div className="dash-section-intro">
                  <h3>APMC Live Agricultural Commodity Prices</h3>
                  <p>Updated benchmark mandi prices across Gujarat & Western India grain exchanges.</p>
                </div>

                <div className="dash-mandi-table-wrap">
                  <table className="dash-mandi-table">
                    <thead>
                      <tr>
                        <th>Commodity</th>
                        <th>Market / Mandi</th>
                        <th>Variety</th>
                        <th>Min Price (₹/Qtl)</th>
                        <th>Modal Price (₹/Qtl)</th>
                        <th>Max Price (₹/Qtl)</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>🌾 Wheat</strong></td>
                        <td>Vadodara APMC</td>
                        <td>Lokwan / Mill</td>
                        <td>₹2,350</td>
                        <td><span className="dash-price-highlight">₹2,420</span></td>
                        <td>₹2,550</td>
                        <td><span className="dash-trend-up">▲ +₹30</span></td>
                      </tr>
                      <tr>
                        <td><strong>🌾 Wheat (Sharbati)</strong></td>
                        <td>Anand APMC</td>
                        <td>Premium</td>
                        <td>₹2,700</td>
                        <td><span className="dash-price-highlight">₹2,890</span></td>
                        <td>₹3,150</td>
                        <td><span className="dash-trend-up">▲ +₹50</span></td>
                      </tr>
                      <tr>
                        <td><strong>🟡 Mustard</strong></td>
                        <td>Patan APMC</td>
                        <td>Bold 42% Oil</td>
                        <td>₹5,400</td>
                        <td><span className="dash-price-highlight">₹5,680</span></td>
                        <td>₹5,820</td>
                        <td><span className="dash-trend-up">▲ +₹80</span></td>
                      </tr>
                      <tr>
                        <td><strong>☁️ Cotton (Kapas)</strong></td>
                        <td>Rajkot APMC</td>
                        <td>Shankar-6</td>
                        <td>₹6,800</td>
                        <td><span className="dash-price-highlight">₹7,150</span></td>
                        <td>₹7,400</td>
                        <td><span className="dash-trend-down">▼ -₹40</span></td>
                      </tr>
                      <tr>
                        <td><strong>🥜 Groundnut</strong></td>
                        <td>Gondal APMC</td>
                        <td>G-20 Pod</td>
                        <td>₹6,100</td>
                        <td><span className="dash-price-highlight">₹6,450</span></td>
                        <td>₹6,750</td>
                        <td><span className="dash-trend-up">▲ +₹65</span></td>
                      </tr>
                      <tr>
                        <td><strong>🍚 Paddy / Rice</strong></td>
                        <td>Ahmedabad APMC</td>
                        <td>Basmati / Sugandha</td>
                        <td>₹2,100</td>
                        <td><span className="dash-price-highlight">₹2,280</span></td>
                        <td>₹2,450</td>
                        <td><span className="dash-trend-neutral">● Stable</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  )
}
