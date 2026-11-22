import { useState, useEffect, useCallback } from 'react'
import './Navbar.css'

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Farm Intelligence', href: '#farm-intelligence' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Farm Data', href: '#real-world-data' },
  { label: 'About', href: '#why-choose-us' },
]


/* ── Inline SVG logo mark ── */
function LogoMark() {
  return (
    <svg
      width="36" height="36" viewBox="0 0 36 36"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="9" fill="#1a4a2e" />
      {/* Leaf shape */}
      <path
        d="M18 28C18 28 10 22 10 15C10 11.134 13.134 8 17 8C17.34 8 17.672 8.028 18 8.08C18.328 8.028 18.66 8 19 8C22.866 8 26 11.134 26 15C26 22 18 28 18 28Z"
        fill="#52b876"
      />
      {/* Center vein */}
      <path
        d="M18 28V14"
        stroke="#1a4a2e" strokeWidth="1.5" strokeLinecap="round"
      />
      {/* Left vein */}
      <path
        d="M18 20L14 17"
        stroke="#1a4a2e" strokeWidth="1" strokeLinecap="round" opacity="0.7"
      />
      {/* Right vein */}
      <path
        d="M18 17L22 14"
        stroke="#1a4a2e" strokeWidth="1" strokeLinecap="round" opacity="0.7"
      />
      {/* Soil arc */}
      <path
        d="M13 28H23"
        stroke="#c47c2b" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  )
}

/* ── Hamburger / Close icon ── */
function MenuIcon({ isOpen }) {
  return (
    <svg
      width="22" height="22" viewBox="0 0 22 22"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`nav-hamburger__icon ${isOpen ? 'nav-hamburger__icon--open' : ''}`}
    >
      <span className="nav-hamburger__bar nav-hamburger__bar--1" />
      <span className="nav-hamburger__bar nav-hamburger__bar--2" />
      <span className="nav-hamburger__bar nav-hamburger__bar--3" />
    </svg>
  )
}

export default function Navbar({ onOpenAuth, currentUser, onGoToDashboard }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeLink, setActiveLink] = useState('#home')

  /* ── Scroll listener ── */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  /* ── Lock body scroll when mobile menu is open ── */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  /* ── Close menu on resize to desktop ── */
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleNavClick = useCallback((href) => {
    setActiveLink(href)
    setMenuOpen(false)
  }, [])

  return (
    <>
      <header
        className={`kisan-nav ${scrolled ? 'kisan-nav--scrolled' : ''}`}
        role="banner"
      >
        <div className="container">
          <div className="kisan-nav__inner">

            {/* ── Logo ── */}
            <a href="#home" className="kisan-nav__logo" aria-label="Crops Wild — Go to homepage">
              <LogoMark />
              <span className="kisan-nav__logo-text">
                Crops<span className="kisan-nav__logo-accent">Wild</span>
              </span>
            </a>

            {/* ── Desktop Nav Links ── */}
            <nav className="kisan-nav__links" aria-label="Main navigation">
              {NAV_LINKS.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  className={`kisan-nav__link ${activeLink === href ? 'kisan-nav__link--active' : ''}`}
                  onClick={() => handleNavClick(href)}
                >
                  {label}
                </a>
              ))}
            </nav>

            {/* ── Desktop Actions ── */}
            <div className="kisan-nav__actions">
              {currentUser ? (
                <button
                  type="button"
                  onClick={onGoToDashboard}
                  className="btn btn-primary btn-sm kisan-nav__cta"
                  id="nav-dashboard-btn"
                >
                  🌾 Open Farm Engine
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenAuth && onOpenAuth('register')}
                  className="btn btn-primary btn-sm kisan-nav__cta"
                  id="nav-get-started-btn"
                >
                  Get Started
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>

            {/* ── Hamburger button (mobile) ── */}
            <button
              className={`kisan-nav__hamburger ${menuOpen ? 'kisan-nav__hamburger--open' : ''}`}
              onClick={() => setMenuOpen(prev => !prev)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <span className="kisan-nav__bar kisan-nav__bar--1" />
              <span className="kisan-nav__bar kisan-nav__bar--2" />
              <span className="kisan-nav__bar kisan-nav__bar--3" />
            </button>

          </div>
        </div>
      </header>

      {/* ── Mobile Menu Overlay ── */}
      <div
        id="mobile-menu"
        className={`kisan-mobile-menu ${menuOpen ? 'kisan-mobile-menu--open' : ''}`}
        aria-hidden={!menuOpen}
      >
        {/* Backdrop */}
        <div
          className="kisan-mobile-menu__backdrop"
          onClick={() => setMenuOpen(false)}
        />

        {/* Drawer */}
        <div className="kisan-mobile-menu__drawer">

          {/* Drawer header */}
          <div className="kisan-mobile-menu__header">
            <a href="#home" className="kisan-nav__logo" onClick={() => setMenuOpen(false)}>
              <LogoMark />
              <span className="kisan-nav__logo-text">
                Crops<span className="kisan-nav__logo-accent">Wild</span>
              </span>
            </a>
            <button
              className="kisan-mobile-menu__close"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Drawer nav */}
          <nav className="kisan-mobile-menu__nav" aria-label="Mobile navigation">
            {NAV_LINKS.map(({ label, href }, i) => (
              <a
                key={href}
                href={href}
                className={`kisan-mobile-menu__link ${activeLink === href ? 'kisan-mobile-menu__link--active' : ''}`}
                onClick={() => handleNavClick(href)}
                style={{ '--i': i }}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Drawer actions */}
          <div className="kisan-mobile-menu__actions">
            {currentUser ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setMenuOpen(false)
                  onGoToDashboard && onGoToDashboard()
                }}
              >
                🌾 Open Farm Engine
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setMenuOpen(false)
                  onOpenAuth && onOpenAuth('register')
                }}
              >
                Get Started
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Tagline */}
          <p className="kisan-mobile-menu__tagline">
            🌾 Smarter farming with AI
          </p>

        </div>
      </div>
    </>
  )
}
