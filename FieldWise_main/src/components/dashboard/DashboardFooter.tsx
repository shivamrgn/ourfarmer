import {
  Sprout,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Instagram,
  Youtube
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardFooterProps {
  onNavigateModule?: (module: string) => void;
}

function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const DashboardFooter = ({ onNavigateModule }: DashboardFooterProps) => {
  const navigate = useNavigate();

  const handleNav = (module: string) => {
    if (onNavigateModule) {
      onNavigateModule(module);
    } else {
      navigate(`/?module=${module}`);
    }
  };

  return (
    <footer
      className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white mt-auto select-none transition-colors"
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">

          {/* ── Brand Section ── */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-xs border border-emerald-500/30">
                <Sprout className="h-5 w-5 text-white" />
              </div>
              <div className="text-xl font-bold tracking-tight">
                <span className="text-gray-900 dark:text-white">Crops</span>
                <span className="text-emerald-600 dark:text-emerald-400">Wild</span>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed max-w-xs">
              AI-powered tools for smarter farming.
            </p>

            {/* Social Icons */}
            <div className="flex items-center space-x-2.5 pt-1">
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                aria-label="X (Twitter)"
                className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <XIcon className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Linkedin className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Instagram className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Youtube className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* ── PRODUCT ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Product
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <li>
                <button
                  onClick={() => handleNav("crop-recommendation")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  Crop Recommendation
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("fertilizer-recommendation")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  Fertilizer Recommendation
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("disease-detection")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  Disease Detection
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("farm-intelligence")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  Yield Prediction
                </button>
              </li>
            </ul>
          </div>

          {/* ── RESOURCES ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Resources
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <li>
                <button
                  onClick={() => handleNav("weather")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  Weather Intelligence
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("farm-intelligence")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  Satellite Insights
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("mandi")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  Mandi Prices
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("soil-environment")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  Environmental Data
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("government-schemes")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  Government Schemes
                </button>
              </li>
            </ul>
          </div>

          {/* ── COMPANY & CONTACT ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Company
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <li>
                <button
                  onClick={() => handleNav("help")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  About
                </button>
              </li>
              <li>
                <a
                  href="/privacy"
                  onClick={(e) => { e.preventDefault(); navigate("/privacy"); }}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline transition-colors block"
                >
                  Privacy
                </a>
              </li>
              <li>
                <button
                  onClick={() => handleNav("documentation")}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors"
                >
                  Documentation
                </button>
              </li>
              <li>
                <a
                  href="/terms"
                  onClick={(e) => { e.preventDefault(); navigate("/terms"); }}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline transition-colors block"
                >
                  Terms
                </a>
              </li>
            </ul>

            {/* Direct contact items matching the user's design */}
            <div className="pt-2 space-y-1.5 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Vadodara, Gujarat, India</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <a href="tel:+912866XXXXXX" className="hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                  +91 2866-XXXXXX
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <a href="mailto:shivamk61381@gmail.com" className="hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                  shivamk61381@gmail.com
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default DashboardFooter;