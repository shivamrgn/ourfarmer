import './Footer.css'

/* ── Inline SVG social icons ─────────────────────────────── */

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="footer-social__icon">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="footer-social__icon">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="footer-social__icon">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="footer-social__icon">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

/* ── Logo mark (reused from Navbar) ─────────────────────────── */
function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect width="36" height="36" rx="9" fill="#235e3a" />
      <path
        d="M18 28C18 28 10 22 10 15C10 11.134 13.134 8 17 8C17.34 8 17.672 8.028 18 8.08C18.328 8.028 18.66 8 19 8C22.866 8 26 11.134 26 15C26 22 18 28 18 28Z"
        fill="#52b876"
      />
      <path d="M18 28V14" stroke="#1a4a2e" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 20L14 17" stroke="#1a4a2e" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <path d="M18 17L22 14" stroke="#1a4a2e" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <path d="M13 28H23" stroke="#c47c2b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/* ── Data ────────────────────────────────────────────────────── */

const PRODUCT_LINKS = [
  { label: 'Crop Recommendation', href: '#features' },
  { label: 'Fertilizer Recommendation', href: '#features' },
  { label: 'Disease Detection', href: '#features' },
  { label: 'Yield Prediction', href: '#features' },
]

const RESOURCE_LINKS = [
  { label: 'Weather Intelligence', href: '#real-world-data' },
  { label: 'Satellite Insights', href: '#real-world-data' },
  { label: 'Mandi Prices', href: '#real-world-data' },
  { label: 'Environmental Data', href: '#real-world-data' },
  { label: 'Government Schemes', href: '#farmer-support' },
]

const SOCIAL = [
  { label: 'Twitter / X', Icon: TwitterIcon, href: '#' },
  { label: 'LinkedIn', Icon: LinkedInIcon, href: '#' },
  { label: 'Instagram', Icon: InstagramIcon, href: '#' },
  { label: 'YouTube', Icon: YouTubeIcon, href: '#' },
]

/* ── Component ───────────────────────────────────────────────── */

export default function Footer() {
  return (
    <footer className="kf-footer" role="contentinfo">
      <div className="container">

        {/* ── Main grid ── */}
        <div className="kf-grid">

          {/* Column 1 — Brand */}
          <div className="kf-col kf-col--brand">
            <a href="#home" className="kf-logo" aria-label="Crops Wild — home">
              <LogoMark />
              <span className="kf-logo__text">
                Crops<span className="kf-logo__accent">Wild</span>
              </span>
            </a>
            <p className="kf-desc">
              AI-powered tools for smarter farming.
            </p>
            {/* Social icons */}
            <div className="kf-social" role="list" aria-label="Social media links">
              {SOCIAL.map(({ label, Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  className="footer-social__btn"
                  aria-label={label}
                  role="listitem"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Column 2 — Product */}
          <div className="kf-col">
            <h3 className="footer__heading">Product</h3>
            <nav aria-label="Product links">
              {PRODUCT_LINKS.map(({ label, href }) => (
                <a key={label} href={href} className="footer__link">{label}</a>
              ))}
            </nav>
          </div>

          {/* Column 3 — Resources */}
          <div className="kf-col">
            <h3 className="footer__heading">Resources</h3>
            <nav aria-label="Resource links">
              {RESOURCE_LINKS.map(({ label, href }) => (
                <a key={label} href={href} className="footer__link">{label}</a>
              ))}
            </nav>
          </div>

          {/* Column 4 — Company */}
          <div className="kf-col">
            <h3 className="footer__heading">Company</h3>
            <nav aria-label="Company links">
              <a href="#about" className="footer__link">About</a>
              <a href="#privacy" className="footer__link">Privacy</a>
              <a href="#terms" className="footer__link">Terms</a>
            </nav>

            <address className="kf-address">
              <span className="kf-address__line">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="kf-address__icon">
                  <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6C3.5 9.5 8 14.5 8 14.5C8 14.5 12.5 9.5 12.5 6C12.5 3.515 10.485 1.5 8 1.5ZM8 8C7.172 8 6.5 7.328 6.5 6.5C6.5 5.672 7.172 5 8 5C8.828 5 9.5 5.672 9.5 6.5C9.5 7.328 8.828 8 8 8Z" fill="currentColor" opacity="0.6" />
                </svg>
                Vadodara, Gujarat, India
              </span>
              <a href="tel:+912866" className="kf-address__line kf-address__link">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="kf-address__icon">
                  <path d="M13.5 10.5L11.5 10C11.5 10 10.5 11 10 11C8 11 5 8 5 6C5 5.5 6 4.5 6 4.5L5.5 2.5C5.5 2.5 4 2 3.5 2.5C2.5 3.5 2 5 3.5 8C5 11 8 13.5 10.5 13.5C12 13.5 13 13 14 12C14.5 11.5 13.5 10.5 13.5 10.5Z" fill="currentColor" opacity="0.6" />
                </svg>
                +91 2866-XXXXXX
              </a>
              <a href="mailto:shivamk61381@gmail.com" className="kf-address__line kf-address__link">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="kf-address__icon">
                  <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.25" />
                  <path d="M2 5.5L8 9.5L14 5.5" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.25" strokeLinecap="round" />
                </svg>
                shivamk61381@gmail.com
              </a>
            </address>
          </div>

        </div>

        {/* ── Divider ── */}
        <hr className="footer__divider" />

        {/* ── Bottom bar ── */}
        <div className="footer__bottom">
          <p>© 2026 CropsWild. All rights reserved.</p>
          <p className="kf-bottom__right">
            Built for Indian farmers 🌾
          </p>
        </div>

      </div>
    </footer>
  )
}
