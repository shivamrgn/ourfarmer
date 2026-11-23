// FieldWise Landing Portal — Staging Build v1.0.1
import { useState, useEffect } from 'react'
import './index.css'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import ProblemSolution from './components/ProblemSolution'
import FarmIntelligenceEngine from './components/FarmIntelligenceEngine'
import HowItWorks from './components/HowItWorks'
import DashboardPreview from './components/DashboardPreview'
import RealWorldFarmData from './components/RealWorldFarmData'
import MandiPriceIntelligence from './components/MandiPriceIntelligence'
import DataIntelligence from './components/DataIntelligence'
import FarmerSupport from './components/FarmerSupport'
import ExpertAgriculturalSupport from './components/ExpertAgriculturalSupport'
import WhyChooseUs from './components/WhyChooseUs'
import FarmerJourney from './components/FarmerJourney'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'
import AuthModal from './components/AuthModal'
import Dashboard from './components/Dashboard'
import { logoutFarmer, readValidSession, clearSession, SESSION_TTL_MS, auth } from './firebase'

function App() {
  // Check if logout was requested via URL query param (e.g. from FieldWise_main)
  const isLogoutRequested =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('logout') === 'true'

  if (isLogoutRequested) {
    clearSession()
  }

  // Check if auth modal was requested via URL query param (e.g. redirect from FieldWise_main)
  const authQuery =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('auth')
      : null
  const shouldOpenAuth = authQuery === 'login' || authQuery === 'register' || authQuery === 'true'

  // Read session synchronously on first render — no flash, no flicker
  const [currentUser, setCurrentUser] = useState(() =>
    isLogoutRequested ? null : readValidSession()
  )
  const [view, setView] = useState('landing')
  const [authModalOpen, setAuthModalOpen] = useState(() => Boolean(shouldOpenAuth))
  const [authTab, setAuthTab] = useState(() => (authQuery === 'register' ? 'register' : 'login'))
  const [authErrorMessage, setAuthErrorMessage] = useState('')

  // ── Smooth scroll & URL cleanup on initial load ────────────────────────────
  useEffect(() => {
    if (window.location.search.includes('logout=true') || window.location.search.includes('auth=')) {
      const cleanUrl = window.location.pathname + window.location.hash
      window.history.replaceState({}, '', cleanUrl || '/')
    }

    if (window.location.hash) {
      const hashId = window.location.hash.replace('#', '')
      const el = document.getElementById(hashId)
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 200)
      }
    }
  }, [])

  // ── Auto-expire session after TTL ──────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return
    // How much time is left on the current session?
    const expiry = Number(localStorage.getItem('fieldwise_session_expiry') || 0)
    const remaining = expiry - Date.now()
    if (remaining <= 0) {
      // Stale or expired stamp from earlier test — renew for active presentation session
      localStorage.setItem('fieldwise_session_expiry', String(Date.now() + SESSION_TTL_MS))
      return
    }
    // Schedule forced logout exactly when the session expires
    const timer = setTimeout(() => {
      clearSession()
      setCurrentUser(null)
      setView('landing')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, remaining)
    return () => clearTimeout(timer)
  }, [currentUser])

  const handleOpenAuth = (tab = 'register') => {
    setAuthTab(tab)
    setAuthModalOpen(true)
  }

  const handleCloseAuth = () => {
    setAuthModalOpen(false)
  }

  // ── FIELDWISE_MAIN URL RESOLUTION ──────────────────────────────────────────
  // Check whether a target port is actively running and responding
  const checkUrlActive = async (url) => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 350)
      await fetch(url, { mode: 'no-cors', signal: controller.signal })
      clearTimeout(timer)
      return true
    } catch {
      return false
    }
  }

  const getTargetMainAppUrl = async () => {
    // 1. Explicit environment variable if configured
    const envUrl = import.meta.env.VITE_MAIN_APP_URL
    if (envUrl) {
      const isLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1')
      if (!isLocal || await checkUrlActive(envUrl)) {
        return envUrl
      }
    }

    // 2. Remote staging fallback based on current hostname
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname || ''
      if (hostname.includes('fieldwise-landing-staging.pages.dev') || hostname.includes('pages.dev')) {
        return 'https://fieldwise-main-staging.pages.dev'
      }
      if (hostname.includes('staging.fieldwise.agri')) {
        return 'https://staging-app.fieldwise.agri'
      }
    }

    // 3. Candidate ports for FieldWise_main: 5174 (standard) or 8080 (alternate)
    const candidates = ['http://localhost:5174', 'http://localhost:8080']
    for (const cand of candidates) {
      if (await checkUrlActive(cand)) {
        return cand
      }
    }

    // 4. Fallback to null if neither external server is responding
    return null
  }

  // ── Helper: Create a single-use handoff code with backend over POST body ───
  // The Firebase ID token is sent in the HTTPS POST body and NEVER appears in URLs,
  // browser history, analytics, or application logs.
  const createSecureHandoffCode = async () => {
    const firebaseUser = auth?.currentUser
    if (!firebaseUser) {
      throw new Error('Authentication session not found. Please log in again.')
    }

    const idToken = await firebaseUser.getIdToken(true)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    const res = await fetch(`${apiUrl}/api/auth/handoff/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.success || !data.handoffCode) {
      throw new Error(data.message || `Backend verification failed (HTTP ${res.status}).`)
    }

    return data.handoffCode
  }

  const handleAuthSuccess = async (userData) => {
    setCurrentUser(userData)
    setAuthModalOpen(false)
    setAuthErrorMessage('')

    // Check if FieldWise_main is running on port 5174 or 8080
    const activeMainUrl = await getTargetMainAppUrl()

    if (activeMainUrl) {
      // 1. Explicit Demo Flow
      if (userData?.isDemo) {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(userData))))
        window.location.href = `${activeMainUrl}?demoSession=${encoded}`
        return
      }

      // 2. Real Firebase User: Secure single-use handoff code
      try {
        const handoffCode = await createSecureHandoffCode()
        // Redirect using ONLY the single-use handoff code (ID token is NEVER in the URL)
        window.location.href = `${activeMainUrl}?handoffCode=${encodeURIComponent(handoffCode)}`
      } catch (err) {
        // FAIL CLOSED: Never fall back to ?session=<base64> for real Firebase users!
        console.error('[FieldWise Auth] Secure handoff failed:', err.message)
        setAuthErrorMessage(`Authentication verification failed: ${err.message}`)
      }
    } else {
      // FieldWise_main is not running — render the built-in FieldWise Dashboard immediately!
      setView('dashboard')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleLogout = () => {
    clearSession()        // clear TTL stamp + user data immediately (synchronous)
    setCurrentUser(null)
    setView('landing')
    setAuthErrorMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    logoutFarmer()        // sign out from Firebase in the background (fire-and-forget)
  }

  const handleGoToDashboard = async () => {
    const activeMainUrl = await getTargetMainAppUrl()
    if (activeMainUrl && currentUser) {
      // 1. Explicit Demo Flow
      if (currentUser.isDemo) {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(currentUser))))
        window.location.href = `${activeMainUrl}?demoSession=${encoded}`
        return
      }

      // 2. Real Firebase User: Secure single-use handoff code
      try {
        const handoffCode = await createSecureHandoffCode()
        window.location.href = `${activeMainUrl}?handoffCode=${encodeURIComponent(handoffCode)}`
        return
      } catch (err) {
        // FAIL CLOSED: Never fall back to ?session=<base64> for real Firebase users!
        console.error('[FieldWise Auth] Secure handoff failed on dashboard open:', err.message)
        setAuthErrorMessage(`Authentication verification failed: ${err.message}`)
        return
      }
    }
    setView('dashboard')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBackToLanding = () => {
    setView('landing')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      {authErrorMessage && (
        <div
          role="alert"
          style={{
            background: '#b91c1c',
            color: '#ffffff',
            padding: '12px 16px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 500,
            position: 'sticky',
            top: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}
        >
          <span>⚠️ {authErrorMessage}</span>
          <button
            type="button"
            onClick={() => setAuthErrorMessage('')}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.7)',
              color: '#ffffff',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {view === 'dashboard' && currentUser ? (
        <Dashboard
          user={currentUser}
          onLogout={handleLogout}
          onBackToLanding={handleBackToLanding}
        />
      ) : (
        <>
          <Navbar
            currentUser={currentUser}
            onOpenAuth={handleOpenAuth}
            onGoToDashboard={handleGoToDashboard}
          />
          <main>
            <Hero onOpenAuth={handleOpenAuth} />
            <ProblemSolution />
            <FarmIntelligenceEngine
              onOpenAuth={handleOpenAuth}
              currentUser={currentUser}
              onGoToDashboard={handleGoToDashboard}
            />
            <HowItWorks />
            <DashboardPreview />
            <RealWorldFarmData />
            <MandiPriceIntelligence />

            <DataIntelligence />
            <FarmerSupport onOpenAuth={handleOpenAuth} />
            <ExpertAgriculturalSupport />
            <WhyChooseUs />
            <FarmerJourney />
            <FinalCTA onOpenAuth={handleOpenAuth} />
          </main>
          <Footer />
        </>
      )}

      {/* Auth Modal with Login, Register, and Demo options */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={handleCloseAuth}
        onAuthSuccess={handleAuthSuccess}
        initialTab={authTab}
      />
    </>
  )
}

export default App
