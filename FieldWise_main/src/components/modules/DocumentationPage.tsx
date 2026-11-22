import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Code2,
  Cpu,
  Database,
  Terminal,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Server,
  CloudSun,
  Sprout,
  ScanEye,
  Layers,
  FlaskConical,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface DocumentationPageProps {
  onNavigate?: (module: string) => void;
}

export const DocumentationPage = ({ onNavigate }: DocumentationPageProps) => {
  const [activeTab, setActiveTab] = useState<"overview" | "api" | "models" | "schema" | "setup">("overview");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] dark:bg-gray-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── TOP HERO BANNER (Forest Green + Microdot) ── */}
        <div
          className="relative overflow-hidden rounded-2xl border border-emerald-900/40 p-6 sm:p-8 shadow-lg text-white"
          style={{
            backgroundColor: "#0a2316",
            backgroundImage: "radial-gradient(rgba(16, 185, 129, 0.15) 1.2px, transparent 1.2px)",
            backgroundSize: "20px 20px",
          }}
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <BookOpen className="h-3.5 w-3.5" />
                Crops Wild Core Reference
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Detailed Technical Documentation & API Guides
              </h1>
              <p className="text-sm text-emerald-100/80 leading-relaxed">
                Comprehensive engineering documentation, mathematical model specifications, REST API reference, and database schemas powering the Crops Wild agricultural intelligence platform.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {onNavigate && (
                <Button
                  onClick={() => onNavigate("home")}
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold rounded-xl"
                >
                  Back to Dashboard
                </Button>
              )}
              {onNavigate && (
                <Button
                  onClick={() => onNavigate("help")}
                  className="bg-emerald-500 hover:bg-emerald-400 text-[#0a2316] font-bold text-xs rounded-xl shadow-md gap-1.5"
                >
                  Help Center
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Quick Stats Pill Bar */}
          <div className="mt-6 pt-5 border-t border-emerald-800/40 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-[11px] text-emerald-300 uppercase tracking-wider font-semibold">Platform Version</div>
              <div className="text-base font-bold text-white mt-0.5">v2.4.0 Production</div>
            </div>
            <div>
              <div className="text-[11px] text-emerald-300 uppercase tracking-wider font-semibold">Inference Model</div>
              <div className="text-base font-bold text-white mt-0.5">Gaussian + Gemini 1.5</div>
            </div>
            <div>
              <div className="text-[11px] text-emerald-300 uppercase tracking-wider font-semibold">API Runtime</div>
              <div className="text-base font-bold text-white mt-0.5">Express + SQLite</div>
            </div>
            <div>
              <div className="text-[11px] text-emerald-300 uppercase tracking-wider font-semibold">Data Sourcing</div>
              <div className="text-base font-bold text-white mt-0.5">ICAR & Agmarknet</div>
            </div>
          </div>
        </div>

        {/* ── NAVIGATION TABS ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-800">
          {[
            { id: "overview", label: "Architecture & Overview", icon: Server },
            { id: "api", label: "REST API Reference", icon: Code2 },
            { id: "models", label: "AI & ML Engines", icon: Cpu },
            { id: "schema", label: "Database & Models", icon: Database },
            { id: "setup", label: "Developer Setup & Config", icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-[#0a2316] text-white shadow-sm"
                    : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200/80 dark:border-gray-800 hover:border-emerald-600/50"
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? "text-emerald-400" : "text-gray-500"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: ARCHITECTURE & OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      1. System Architecture & Component Interaction
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Crops Wild follows a high-resiliency decoupled architecture designed for agricultural environments where internet connectivity may be intermittent. The client executes local offline Gaussian heuristics when network boundaries fail, and connects to the Node.js API when online.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-[#f8faf9] dark:bg-gray-800/60 border border-gray-200/90 dark:border-gray-700 space-y-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                      <Sprout className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Client Layer</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      React 18 + Vite frontend delivering sub-100ms UI feedback, canvas charts, interactive map layers, and offline state replication via LocalStorage.
                    </p>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
                      Vite + Tailwind CSS
                    </Badge>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#f8faf9] dark:bg-gray-800/60 border border-gray-200/90 dark:border-gray-700 space-y-3">
                    <div className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
                      <Server className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">API Backend</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Express 4.x application enforcing JWT bearer tokens, express-validator input safety, and SQLite connection caching.
                    </p>
                    <Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-800 border-teal-200">
                      Express + SQLite
                    </Badge>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#f8faf9] dark:bg-gray-800/60 border border-gray-200/90 dark:border-gray-700 space-y-3">
                    <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-700 dark:text-purple-400">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">External Intelligence</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Google Gemini 1.5 Flash Vision for botanical pathology, OpenWeatherMap for live alerts, and Agmarknet for APMC mandi rates.
                    </p>
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-800 border-purple-200">
                      Gemini Vision + Agmarknet
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    <strong>Resilience Guarantee:</strong> All modules are bound to client-side fallback engines (<code className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1 rounded">/src/lib/predictorEngine.ts</code>). If the central server is temporarily unreachable, crop recommendations and fertilizer calculations continue uninterrupted without error alerts.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 2: REST API REFERENCE ── */}
        {activeTab === "api" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      2. REST API Specification & Local Development Samples
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    API endpoints reside at configured <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">VITE_API_URL</code> (default local development: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">http://localhost:3001/api</code>). Protected routes require the <code className="font-mono text-xs">Authorization: Bearer &lt;token&gt;</code> header.
                  </p>
                </div>

                {/* API Endpoints List */}
                <div className="space-y-4">

                  {/* Endpoint 1: Health */}
                  <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          GET
                        </span>
                        <code className="text-sm font-bold text-gray-900 dark:text-white">/api/health</code>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-gray-500">Public</Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Returns heartbeat confirmation and ISO timestamp.
                    </p>
                    <div className="relative bg-gray-900 text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                      <button
                        onClick={() => copyCode("curl -X GET http://localhost:3001/api/health", "health")}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                        title="Copy command"
                      >
                        {copiedIndex === "health" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <pre>curl -X GET http://localhost:3001/api/health</pre>
                    </div>
                  </div>

                  {/* Endpoint 2: Auth Register */}
                  <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          POST
                        </span>
                        <code className="text-sm font-bold text-gray-900 dark:text-white">/api/auth/register</code>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-gray-500">Public</Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Creates a new user profile with bcrypt password hashing (10 salt rounds) and returns a signed JWT token.
                    </p>
                    <div className="relative bg-gray-900 text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                      <button
                        onClick={() => copyCode(`curl -X POST http://localhost:3001/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Ramesh Patel", "email": "ramesh@farm.in", "password": "Password123"}'`, "register")}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                        title="Copy command"
                      >
                        {copiedIndex === "register" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <pre>{`curl -X POST http://localhost:3001/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Ramesh Patel", "email": "ramesh@farm.in", "password": "Password123"}'`}</pre>
                    </div>
                  </div>

                  {/* Endpoint 3: Auth Login */}
                  <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          POST
                        </span>
                        <code className="text-sm font-bold text-gray-900 dark:text-white">/api/auth/login</code>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-gray-500">Public</Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Validates user credentials against SQLite records and returns token payload.
                    </p>
                    <div className="relative bg-gray-900 text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                      <button
                        onClick={() => copyCode(`curl -X POST http://localhost:3001/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "ramesh@farm.in", "password": "Password123"}'`, "login")}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                        title="Copy command"
                      >
                        {copiedIndex === "login" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <pre>{`curl -X POST http://localhost:3001/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "ramesh@farm.in", "password": "Password123"}'`}</pre>
                    </div>
                  </div>

                  {/* Endpoint 4: Predict */}
                  <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          POST
                        </span>
                        <code className="text-sm font-bold text-gray-900 dark:text-white">/api/predict</code>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">JWT Protected</Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Runs the multivariate Gaussian crop suitability algorithm given N-P-K, pH, temperature, humidity, rainfall, and soil type.
                    </p>
                    <div className="relative bg-gray-900 text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                      <button
                        onClick={() => copyCode(`curl -X POST http://localhost:3001/api/predict \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \\
  -d '{
    "nitrogen": 85,
    "phosphorus": 52,
    "potassium": 60,
    "ph": 6.8,
    "temperature": 24,
    "humidity": 65,
    "rainfall": 600,
    "soilType": "Loamy",
    "state": "Punjab"
  }'`, "predict")}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                        title="Copy command"
                      >
                        {copiedIndex === "predict" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <pre>{`curl -X POST http://localhost:3001/api/predict \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \\
  -d '{
    "nitrogen": 85,
    "phosphorus": 52,
    "potassium": 60,
    "ph": 6.8,
    "temperature": 24,
    "humidity": 65,
    "rainfall": 600,
    "soilType": "Loamy",
    "state": "Punjab"
  }'`}</pre>
                    </div>
                  </div>

                  {/* Endpoint 5: Schemes */}
                  <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          GET
                        </span>
                        <code className="text-sm font-bold text-gray-900 dark:text-white">/api/schemes</code>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-gray-500">Public</Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Returns verified Indian agricultural schemes (PM-KISAN, PMFBY, KCC, SMAM) with eligibility requirements and direct application URLs.
                    </p>
                  </div>

                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 3: AI & ML ENGINES ── */}
        {activeTab === "models" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      3. Agronomic Algorithms & Mathematical Baselines
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Crops Wild combines deterministic ICAR agricultural heuristics with probabilistic modeling and multimodal neural vision.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Model 1: Crop Suitability */}
                  <div className="p-5 rounded-2xl bg-[#f8faf9] dark:bg-gray-800/60 border border-gray-200/90 dark:border-gray-700 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Sprout className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-gray-900 dark:text-white text-base">Crop Suitability Distance Metric</h3>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      For each crop candidate $C$, the suitability score $S(C)$ is calculated as the normalized weighted Euclidean distance across 7 soil and climate vectors:
                    </p>
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 font-mono text-xs text-gray-800 dark:text-gray-200">
                      S(C) = 100 - [ w_N * |N - N_opt|/N_scale + w_P * |P - P_opt|/P_scale + w_K * |K - K_opt|/K_scale + w_pH * |pH - pH_opt|/pH_scale + w_T * |T - T_opt|/T_scale + w_H * |H - H_opt|/H_scale + w_R * |R - R_opt|/R_scale ]
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <div>• Weights: w_N = 0.18, w_P = 0.14, w_K = 0.14, w_pH = 0.18, w_T = 0.14, w_H = 0.10, w_R = 0.12</div>
                      <div>• Threshold: Crops scoring 60% or higher are categorized as suitable; highest score ranked top.</div>
                    </div>
                  </div>

                  {/* Model 2: Fertilizer Dosage Formulation */}
                  <div className="p-5 rounded-2xl bg-[#f8faf9] dark:bg-gray-800/60 border border-gray-200/90 dark:border-gray-700 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <FlaskConical className="h-5 w-5 text-teal-600" />
                      <h3 className="font-bold text-gray-900 dark:text-white text-base">ICAR Fertilizer Allocation Matrix</h3>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Determines nutrient shortfall ($\Delta N, \Delta P, \Delta K$) against standard requirement baselines per acre, and maps the deficit to commercial fertilizers:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="font-bold text-emerald-800 dark:text-emerald-300">Urea (46% N)</div>
                        <div className="font-mono text-gray-600 dark:text-gray-400 mt-1">Urea_kg = Deficit_N / 0.46</div>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="font-bold text-emerald-800 dark:text-emerald-300">DAP (18% N, 46% P₂O₅)</div>
                        <div className="font-mono text-gray-600 dark:text-gray-400 mt-1">DAP_kg = Deficit_P / 0.46</div>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="font-bold text-emerald-800 dark:text-emerald-300">MOP (60% K₂O)</div>
                        <div className="font-mono text-gray-600 dark:text-gray-400 mt-1">MOP_kg = Deficit_K / 0.60</div>
                      </div>
                    </div>
                  </div>

                  {/* Model 3: Plant Pathology Vision AI */}
                  <div className="p-5 rounded-2xl bg-[#f8faf9] dark:bg-gray-800/60 border border-gray-200/90 dark:border-gray-700 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <ScanEye className="h-5 w-5 text-rose-600" />
                      <h3 className="font-bold text-gray-900 dark:text-white text-base">Google Gemini Multimodal Vision AI</h3>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Utilizes Gemini 1.5 Flash Vision for micro-lesion analysis, fungal rust identification, and viral chlorosis detection. Output delivers certified organic bio-control protocols alongside technical chemical fungicide active ingredients.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 4: DATABASE & SCHEMA ── */}
        {activeTab === "schema" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      4. SQLite Database Architecture & Schema
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Database tables reside in <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">backend/data/croppredict.db</code> using native <code className="font-mono text-xs">node:sqlite</code> with zero external C++ build tooling required.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Table 1: users */}
                  <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">Table: <code className="text-emerald-700 dark:text-emerald-400 font-mono">users</code></h3>
                      <Badge variant="outline" className="text-[10px]">Authentication</Badge>
                    </div>
                    <div className="bg-gray-900 text-emerald-300 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                      <pre>{`CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE,
  password    TEXT    NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);`}</pre>
                    </div>
                  </div>

                  {/* Table 2: expert_inquiries */}
                  <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">Table: <code className="text-emerald-700 dark:text-emerald-400 font-mono">expert_inquiries</code></h3>
                      <Badge variant="outline" className="text-[10px]">Farmer Inquiries</Badge>
                    </div>
                    <div className="bg-gray-900 text-emerald-300 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                      <pre>{`CREATE TABLE IF NOT EXISTS expert_inquiries (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  farmer_name         TEXT,
  phone               TEXT,
  state               TEXT,
  district            TEXT,
  crop                TEXT,
  category            TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  image_url           TEXT,
  status              TEXT DEFAULT 'prepared',
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);`}</pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 5: DEVELOPER SETUP & CONFIG ── */}
        {activeTab === "setup" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      5. Developer Setup & Environment Variables
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Standard steps to run Crops Wild locally or deploy in production.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-[#f8faf9] dark:bg-gray-800/60 border border-gray-200/90 dark:border-gray-700 space-y-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Backend Environment Template (<code className="font-mono text-xs">backend/.env.example</code>)</h3>
                    <div className="bg-gray-900 text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                      <pre>{`PORT=3001
JWT_SECRET=<generate-random-256bit-secret-with-openssl>
FRONTEND_URL=http://localhost:5173,http://localhost:5174,http://localhost:8080`}</pre>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#f8faf9] dark:bg-gray-800/60 border border-gray-200/90 dark:border-gray-700 space-y-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Frontend Environment (<code className="font-mono text-xs">.env</code>)</h3>
                    <div className="bg-gray-900 text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                      <pre>{`VITE_API_URL=http://localhost:3001
VITE_GEMINI_API_KEY=AIzaSy...
VITE_OPENWEATHER_API_KEY=...`}</pre>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#f8faf9] dark:bg-gray-800/60 border border-gray-200/90 dark:border-gray-700 space-y-3">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Quick Commands</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Run Frontend</div>
                        <code className="text-xs font-mono text-emerald-700 dark:text-emerald-400 mt-1 block">npm run dev</code>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Run Backend</div>
                        <code className="text-xs font-mono text-emerald-700 dark:text-emerald-400 mt-1 block">cd backend && npm start</code>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Build Production Bundle</div>
                        <code className="text-xs font-mono text-emerald-700 dark:text-emerald-400 mt-1 block">npm run build</code>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Offline Fallback Engine</div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">Built-in zero latency</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
};

export default DocumentationPage;
