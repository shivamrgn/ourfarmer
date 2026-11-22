import { useState, useEffect } from 'react'
import { registerFarmer, loginFarmer, forgotPassword, signInWithGoogle, linkGoogleAccount, SESSION_TTL_MS } from '../firebase'
import './AuthModal.css'

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialTab = 'register' }) {
  const [activeTab, setActiveTab]             = useState(initialTab)
  const [isForgot, setIsForgot]               = useState(false)
  // directResetMode is no longer used: Firebase handles password reset via email link.
  // Kept as false-only state to avoid breaking the JSX references below.
  const [directResetMode] = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [successMsg, setSuccessMsg]           = useState('')
  const [flipping, setFlipping]               = useState(false)

  // Account linking state for existing accounts
  const [linkingState, setLinkingState]       = useState(null)
  const [linkPassword, setLinkPassword]       = useState('')

  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [address,     setAddress]     = useState('')
  const [contactNo,   setContactNo]   = useState('')
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [locationDetected, setLocationDetected]   = useState(false)

  useEffect(() => {
    setActiveTab(initialTab)
    setIsForgot(false)
    setError('')
    setSuccessMsg('')
    setNewPassword('')
    setLocationDetected(false)
    setLinkingState(null)
    setLinkPassword('')
  }, [initialTab, isOpen])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && isOpen) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Switch tab with a 360° flip: swap content at invisible midpoint (180°)
  const switchTab = (tab) => {
    if ((tab === activeTab && !isForgot) || flipping) return
    setFlipping(true)
    setError('')
    setSuccessMsg('')
    setLinkingState(null)
    setLinkPassword('')
    setTimeout(() => {
      setIsForgot(false)
      setActiveTab(tab)
    }, 280)
    setTimeout(() => setFlipping(false), 560)
  }

  // Open Forgot Password view with 360° flip
  const openForgotMode = () => {
    if (flipping) return
    setFlipping(true)
    setError('')
    setSuccessMsg('')
    setNewPassword('')
    setLinkingState(null)
    setLinkPassword('')
    setTimeout(() => setIsForgot(true), 280)
    setTimeout(() => setFlipping(false), 560)
  }

  // Back to login view with 360° flip
  const backToLogin = () => {
    if (flipping) return
    setFlipping(true)
    setError('')
    setSuccessMsg('')
    setNewPassword('')
    setLinkingState(null)
    setLinkPassword('')
    setTimeout(() => {
      setIsForgot(false)
      setActiveTab('login')
    }, 280)
    setTimeout(() => setFlipping(false), 560)
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      const user = await signInWithGoogle()
      onAuthSuccess(user)
    } catch (err) {
      if (err.code === 'auth/account-exists-with-different-credential') {
        setLinkingState({
          email: err.email || email,
          pendingCredential: err.pendingCredential
        })
        setError(err.message)
      } else {
        setError(err.message?.replace('Firebase: ', '') || 'Google Sign-In failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLinkSubmit = async (e) => {
    e.preventDefault()
    if (!linkPassword) {
      setError('Please enter your password')
      return
    }
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      const user = await linkGoogleAccount({
        email: linkingState.email,
        password: linkPassword,
        pendingCredential: linkingState.pendingCredential
      })
      setLinkingState(null)
      setLinkPassword('')
      onAuthSuccess(user)
    } catch (err) {
      setError(err.message?.replace('Firebase: ', '') || 'Account linking failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDemo = () => {
    const demo = {
      uid: 'demo_farmer_guest',
      displayName: 'Demo Farmer',
      email: 'demo@fieldwise.agri',
      address: 'Vadodara, Gujarat (Demo Farm)',
      contact_no: '+91 9128660000',
      isDemo: true,
      role: 'Guest Farmer'
    }
    const expiry = Date.now() + SESSION_TTL_MS
    localStorage.setItem('fieldwise_active_user',    JSON.stringify(demo))
    localStorage.setItem('fieldwise_session_expiry', String(expiry))
    onAuthSuccess(demo)
  }

  const handleDetectLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    setError('')
    setDetectingLocation(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          let detectedPlace = ''
          let detectedState = ''

          // 1. Try BigDataCloud reverse geocode API (free, client-side, CORS enabled)
          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            )
            if (res.ok) {
              const data = await res.json()
              detectedPlace = data.city || data.locality || (data.localityInfo?.administrative?.[2]?.name) || ''
              detectedState = data.principalSubdivision || ''
            }
          } catch (e) {
            console.warn('BigDataCloud reverse geocode failed:', e)
          }

          // 2. Nominatim fallback if needed
          if (!detectedPlace && !detectedState) {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
              )
              if (res.ok) {
                const data = await res.json()
                const addr = data.address || {}
                detectedPlace = addr.city || addr.town || addr.county || addr.district || addr.suburb || ''
                detectedState = addr.state || ''
              }
            } catch (e) {
              console.warn('Nominatim reverse geocode failed:', e)
            }
          }

          const resolvedAddress = [detectedPlace, detectedState].filter(Boolean).join(', ') ||
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`

          setAddress(resolvedAddress)
          setLocationDetected(true)
        } catch (err) {
          setError('Failed to resolve live address. Please type your location manually.')
        } finally {
          setDetectingLocation(false)
        }
      },
      (geoErr) => {
        setDetectingLocation(false)
        if (geoErr.code === 1) {
          setError('Location permission denied. Please allow location access in your browser or type manually.')
        } else {
          setError('Could not detect live location. Please type your location manually.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      if (activeTab === 'register') {
        if (!name.trim())        throw new Error('Please enter your full name')
        if (!email.trim())       throw new Error('Please enter your email')
        if (password.length < 6) throw new Error('Password must be at least 6 characters')
        if (!contactNo.trim())   throw new Error('Please provide your 10-digit phone number')
        
        const cleanPhone = contactNo.replace(/\D/g, '').trim()
        if (cleanPhone.length !== 10) {
          throw new Error('Phone number must be exactly 10 digits (numbers only)')
        }

        const user = await registerFarmer({
          name: name.trim(), email: email.trim(),
          password, address: address.trim() || 'Vadodara, Gujarat',
          contact_no: cleanPhone
        })
        onAuthSuccess(user)
      } else {
        if (!email.trim()) throw new Error('Please enter your email')
        if (!password)     throw new Error('Please enter your password')
        const user = await loginFarmer({ email: email.trim(), password })
        onAuthSuccess(user)
      }
    } catch (err) {
      setError(err?.message?.replace('Firebase: ', '') || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    try {
      if (!email.trim()) throw new Error('Please enter your email address')

      const res = await forgotPassword(email.trim())
      setSuccessMsg(res.message || 'Password reset link sent! Check your inbox.')
    } catch (err) {
      setError(err?.message?.replace('Firebase: ', '') || 'Could not process request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="am-overlay" role="dialog" aria-modal="true" aria-labelledby="am-title">
      <div className="am-backdrop" onClick={onClose} />

      <div className="am-card">
        {/* Close */}
        <button className="am-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Brand */}
        <div className="am-brand">
          <span>🌾</span>
          <span>Field<strong>Wise</strong></span>
        </div>

        {/* Header / Tabs */}
        {!isForgot ? (
          <div className="am-tabs" role="tablist">
            {['register', 'login'].map(tab => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`am-tab ${activeTab === tab ? 'am-tab--on' : ''}`}
                onClick={() => switchTab(tab)}
              >
                {tab === 'register' ? 'Register' : 'Login'}
              </button>
            ))}
          </div>
        ) : (
          <div className="am-forgot-banner">
            <button type="button" className="am-back-btn" onClick={backToLogin}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Back to Login</span>
            </button>
            <span className="am-forgot-tag">Reset Password</span>
          </div>
        )}

        {/* Success */}
        {successMsg && (
          <div className="am-success" role="status">
            <span>✅</span> {successMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="am-error" role="alert">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Google Sign-In (Only on normal login/register views) */}
        {!isForgot && !linkingState && (
          <>
            <div className="am-social-wrap">
              <button
                type="button"
                className="am-google-btn"
                onClick={handleGoogleSignIn}
                disabled={loading}
                id="auth-google-btn"
              >
                <svg className="am-google-icon" width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
            <div className="am-sep"><span>or continue with email</span></div>
          </>
        )}

        {/* Account Linking Prompt (When Google email already registered via password) */}
        {linkingState ? (
          <div className="am-linking-card">
            <div className="am-linking-header">
              <span className="am-linking-icon">🔐</span>
              <div>
                <h4 className="am-linking-title">Link Existing Account</h4>
                <p className="am-linking-subtitle">
                  An account for <strong>{linkingState.email}</strong> was registered with email and password.
                  Enter your password to link Google Sign-In and preserve your existing farm data.
                </p>
              </div>
            </div>
            <form onSubmit={handleLinkSubmit} className="am-form">
              <div className="am-field">
                <label htmlFor="am-linkpass">Account Password</label>
                <input
                  id="am-linkpass"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={linkPassword}
                  onChange={e => setLinkPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="am-submit" disabled={loading} id="auth-link-submit-btn">
                {loading ? <span className="am-spin" /> : 'Link Google & Continue'}
              </button>
              <button
                type="button"
                className="am-cancel-link-btn"
                onClick={() => {
                  setLinkingState(null)
                  setLinkPassword('')
                  setError('')
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        ) : (
          /* Form — wrapped in flip container */
          <div className={`am-flip-wrap ${flipping ? 'am-flipping' : ''}`}>
          {isForgot ? (
            <form onSubmit={handleForgotSubmit} className="am-form">
              <div className="am-forgot-intro">
                <p>
                  {directResetMode
                    ? 'Enter your new password below to secure your Crops Wild account.'
                    : 'Enter your registered email address. We will verify your account and provide a reset link.'}
                </p>
              </div>

              <div className="am-field">
                <label htmlFor="am-femail">Registered Email</label>
                <input
                  id="am-femail"
                  type="email"
                  required
                  placeholder="farmer@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading || directResetMode}
                />
              </div>

              {directResetMode && (
                <div className="am-field">
                  <label htmlFor="am-newpass">
                    New Password <span className="am-hint">(min 6 chars)</span>
                  </label>
                  <input
                    id="am-newpass"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <button type="submit" className="am-submit" disabled={loading} id="auth-reset-btn">
                {loading ? (
                  <span className="am-spin" />
                ) : directResetMode ? (
                  'Update Password'
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="am-form">
              {activeTab === 'register' ? (
                <>
                  <div className="am-field">
                    <label htmlFor="am-name">Full Name</label>
                    <input id="am-name" type="text" required placeholder="Ramesh Patel"
                      value={name} onChange={e => setName(e.target.value)} />
                  </div>

                  <div className="am-row">
                    <div className="am-field">
                      <label htmlFor="am-email">Email</label>
                      <input id="am-email" type="email" required placeholder="farmer@example.com"
                        value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div className="am-field">
                      <label htmlFor="am-phone">
                        Phone <span className="am-hint">(10 digits)</span>
                      </label>
                      <input
                        id="am-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        placeholder="10-digit mobile number"
                        value={contactNo}
                        onChange={e => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
                          setContactNo(digitsOnly)
                        }}
                      />
                    </div>
                  </div>

                  <div className="am-field">
                    <div className="am-label-row">
                      <label htmlFor="am-address">Location / Village</label>
                      <button
                        type="button"
                        className="am-location-btn"
                        onClick={handleDetectLocation}
                        disabled={detectingLocation}
                        title="Detect your current live location automatically"
                      >
                        {detectingLocation ? (
                          <>
                            <span className="am-spin-sm" /> Detecting...
                          </>
                        ) : (
                          <>
                            📍 Detect Live Location
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      id="am-address"
                      type="text"
                      placeholder="e.g. Vadodara, Gujarat"
                      value={address}
                      onChange={e => {
                        setAddress(e.target.value)
                        setLocationDetected(false)
                      }}
                    />
                    {locationDetected && (
                      <span className="am-detected-hint">
                        ✓ Live location detected: {address}
                      </span>
                    )}
                  </div>

                  <div className="am-field">
                    <label htmlFor="am-pass">Password <span className="am-hint">(min 6 chars)</span></label>
                    <input id="am-pass" type="password" required placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="am-field">
                    <label htmlFor="am-lemail">Email</label>
                    <input id="am-lemail" type="email" required placeholder="farmer@example.com"
                      value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="am-field">
                    <div className="am-label-row">
                      <label htmlFor="am-lpass">Password</label>
                      <button
                        type="button"
                        className="am-forgot-trigger"
                        onClick={openForgotMode}
                        id="auth-forgot-trigger"
                      >
                        Forgot?
                      </button>
                    </div>
                    <input id="am-lpass" type="password" required placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                </>
              )}

              <button type="submit" className="am-submit" disabled={loading} id="auth-submit-btn">
                {loading
                  ? <span className="am-spin" />
                  : activeTab === 'register' ? 'Create Account' : 'Log In'
                }
              </button>
            </form>
          )}
        </div>
        )}

        {/* Divider + Demo (only on login/register view when not linking) */}
        {!isForgot && !linkingState && (
          <>
            <div className="am-sep"><span>or</span></div>

            <button type="button" className="am-demo" onClick={handleDemo} id="auth-demo-action">
              🌾 Try Demo
            </button>

            <p className="am-note">No sign-up needed · Explore with sample data</p>
          </>
        )}
      </div>
    </div>
  )
}

