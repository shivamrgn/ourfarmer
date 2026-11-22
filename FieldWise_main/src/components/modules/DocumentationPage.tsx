import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Sprout,
  Leaf,
  FlaskConical,
  ScanEye,
  ShieldCheck,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowRight,
  ChevronRight,
  Info,
  Phone,
  Wheat,
  Droplets,
  Sun,
  Calendar,
  MapPin,
  TrendingUp,
  Truck,
  Landmark,
  Headphones,
  Code2,
  Cpu,
  Database,
  Sparkles,
  ExternalLink,
  Layers,
  Check,
  UserCheck,
  Scale,
  Award,
  FileText,
  Thermometer,
} from "lucide-react";

interface DocumentationPageProps {
  onNavigate?: (module: string) => void;
}

type TabKey = "welcome" | "journey" | "features" | "results" | "basics" | "faqs" | "technical";

export const DocumentationPage: React.FC<DocumentationPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("welcome");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<string>("my-farm");

  // Navigation tabs configuration
  const tabs = [
    { id: "welcome" as TabKey, label: "Welcome & Purpose", icon: BookOpen },
    { id: "journey" as TabKey, label: "How FieldWise Works", icon: CheckCircle2 },
    { id: "features" as TabKey, label: "Using Features", icon: Sprout },
    { id: "results" as TabKey, label: "Understanding Results", icon: Scale },
    { id: "basics" as TabKey, label: "Farming Knowledge", icon: Leaf },
    { id: "faqs" as TabKey, label: "Frequently Asked Questions", icon: HelpCircle },
    { id: "technical" as TabKey, label: "Technical Reference", icon: Code2 },
  ];

  // Feature guides list for Section 3
  const featureGuides = [
    {
      id: "my-farm",
      title: "My Farm (Farmer Profile)",
      icon: MapPin,
      tag: "Foundation Step",
      color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800",
      description: "Store your plot location, land acreage, soil type, water source, and soil test numbers in one place.",
      navModule: "profile",
      whatItDoes: "Serves as your digital farm passbook. Once you enter your district, soil type, and soil test values here, all recommendation engines prefill automatically.",
      whyUse: "Eliminates repetitive data entry and ensures all calculations reflect your exact soil conditions.",
      infoNeeded: [
        "State and District name",
        "Farm Area in acres or hectares",
        "Soil Classification (Alluvial, Black, Red, Clayey, Loamy, Sandy)",
        "Irrigation Source (Canal, Tubewell, Rainfed, Drip, Sprinkler)",
        "Soil Test Values (Nitrogen, Phosphorus, Potassium in kg/ha, and soil pH)",
      ],
      steps: [
        "Click on 'My Farm' or 'Profile' from the dashboard sidebar.",
        "Enter your personal details (name, phone) and select your state and district from the dropdowns.",
        "Select your soil type and primary irrigation method.",
        "Enter your latest soil test numbers for N, P, K, and pH. If you do not have test numbers yet, standard regional defaults will guide you.",
        "Click 'Save Profile' to lock your data securely.",
      ],
      resultMeaning: "A visual soil health scorecard showing whether your soil is Acidic, Neutral, or Alkaline, and whether your N, P, K levels are Low, Optimal, or High.",
      mistakesToAvoid: [
        "Entering gross ancestral property area instead of the actual net cultivable plot area.",
        "Confusing parts-per-million (ppm) with kilograms-per-hectare (kg/ha) from your soil card.",
        "Forgetting to update the profile after applying major amendments like lime or gypsum.",
      ],
      limitations: "Calculations rely on the accuracy of the numbers you enter. It cannot detect hidden soil changes without physical laboratory testing.",
    },
    {
      id: "crop-rec",
      title: "Crop Recommendation Engine",
      icon: Sprout,
      tag: "Core Decision Tool",
      color: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800",
      description: "Discover which crops are agronomically best suited to your soil chemistry, climate, and sowing calendar.",
      navModule: "crop-recommendation",
      whatItDoes: "Analyzes 7 agronomic vectors (N, P, K, pH, temperature, humidity, rainfall) against 19+ crops to rank the most compatible planting choices.",
      whyUse: "Avoid planting crops that naturally struggle in your soil pH or climate, saving significant seed and labor expenses.",
      infoNeeded: [
        "State and District",
        "Sowing Month (e.g. June/July for Kharif, October/November for Rabi)",
        "Soil Type and Irrigation Status",
        "Soil Nitrogen (N), Phosphorus (P), Potassium (K), and pH",
      ],
      steps: [
        "Open 'Crop Recommendation' from the sidebar.",
        "Choose between Engine V2 (advanced calibrated recommendation) or Engine V1.",
        "Select your planned Sowing Month and verify that your soil parameters are prefilled from My Farm.",
        "Click 'Generate Recommendations'.",
        "Review your ranked crop cards, suitability percentages, and agronomic explanations.",
      ],
      resultMeaning: "Each crop receives a suitability score between 0% and 100%. Crops scoring 80%+ are well-matched to your soil. Scores below 60% indicate critical agronomic hurdles.",
      mistakesToAvoid: [
        "Choosing a sowing month that falls outside the normal seasonal planting window.",
        "Ignoring severe soil alerts (such as planting high-demand crops in extreme sodic pH > 8.5).",
        "Assuming that a high suitability score guarantees market profitability.",
      ],
      limitations: "Suitability indicates biological compatibility with your soil and climate. It does not forecast final market commodity prices, hail damage, or flood occurrences.",
    },
    {
      id: "fertilizer-rec",
      title: "Fertilizer Recommendation Calculator",
      icon: FlaskConical,
      tag: "Nutrient Management",
      color: "text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800",
      description: "Get balanced fertilizer dosages (Urea, DAP, MOP) tailored to your target crop and plot acreage.",
      navModule: "fertilizer-recommendation",
      whatItDoes: "Calculates the exact nutrient deficit between what your soil currently holds and what your target crop requires per acre, mapping the deficit to commercial fertilizers.",
      whyUse: "Eliminates wasteful over-application of expensive fertilizers, cuts cultivation costs, and protects long-term soil biology.",
      infoNeeded: [
        "Target Crop (e.g. Wheat, Rice, Cotton, Maize, Mustard)",
        "Plot Size in Acres",
        "Current Soil N, P, K values (from your Soil Health Card)",
      ],
      steps: [
        "Navigate to 'Fertilizer Recommendation'.",
        "Select the crop you are growing or planning to plant.",
        "Input your exact plot acreage.",
        "Check your current soil nutrient numbers and click 'Calculate Fertilizer Dosage'.",
        "Review the required quantities of Urea (46% N), DAP (18% N, 46% P₂O₅), and MOP (60% K₂O) in both kilograms and standard 50kg/45kg bags.",
      ],
      resultMeaning: "A clear prescription showing total fertilizer bags needed, alongside a split application schedule (Basal at sowing, Vegetative top-dress, and Flowering stage).",
      mistakesToAvoid: [
        "Applying all nitrogen (Urea) at sowing time instead of splitting it across crop growth stages.",
        "Neglecting organic farmyard manure (FYM), which is essential for micronutrient uptake.",
        "Over-applying Urea when yellowing is caused by waterlogging rather than nitrogen deficiency.",
      ],
      limitations: "Recommendations follow standard ICAR baselines. Saline/alkaline soils and micronutrient deficiencies (Zinc, Boron, Iron) require localized agronomist guidance.",
    },
    {
      id: "disease-detection",
      title: "Plant Leaf Disease Detection (Vision AI)",
      icon: ScanEye,
      tag: "AI Diagnostic",
      color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800",
      description: "Take or upload a clear photo of an infected leaf to receive instant identification, severity rating, and remedies.",
      navModule: "disease-detection",
      whatItDoes: "Applies Gemini Vision AI to inspect leaf lesions, rust spots, wilting, and discoloration, identifying common fungal, bacterial, and viral crop ailments.",
      whyUse: "Detects crop health threats early before infestations spread across entire fields, allowing prompt organic or chemical intervention.",
      infoNeeded: [
        "A clear, in-focus close-up photograph of the affected leaf in good daytime light.",
        "Crop name (Tomato, Potato, Wheat, Rice, Cotton, Maize, Apple, Grape, Chili, Citrus, etc., or Auto-Detect).",
      ],
      steps: [
        "Open 'Disease Detection' from the sidebar.",
        "Select your crop name or leave on Auto-Detect.",
        "Click to upload or drag-and-drop a leaf photo (or capture using your mobile camera).",
        "Click 'Analyze Crop Health' and wait a few moments.",
        "Review diagnosis, confidence rating, visual symptoms, organic remedies, and chemical treatment guidelines.",
      ],
      resultMeaning: "Provides the condition name (or 'Healthy'), confidence percentage (e.g. 92%), severity level, and specific biopesticide or fungicide active ingredients.",
      mistakesToAvoid: [
        "Uploading blurry, dark, or distant photographs taken from several meters away.",
        "Photographing completely dead, dried brown leaves where original pathogen symptoms are lost.",
        "Spraying potent chemicals without reading dilution ratios and safety waiting periods.",
      ],
      limitations: "This is a computer vision screening assistant, not a substitute for lab pathology. If damage is severe or uncertain, show sample leaves to your local KVK scientist.",
    },
    {
      id: "mandi-prices",
      title: "Mandi Price Intelligence",
      icon: TrendingUp,
      tag: "Market Timing",
      color: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
      description: "Track live APMC wholesale rates, modal prices, daily arrivals, and price direction across regional mandis.",
      navModule: "mandi",
      whatItDoes: "Aggregates commodity rate bulletins from wholesale markets, allowing you to compare prices across nearby districts.",
      whyUse: "Helps you decide which mandi offers the best return for your produce and whether market arrivals are trending up or down.",
      infoNeeded: ["Crop commodity name, state, and target district mandis."],
      steps: [
        "Click 'Mandi Prices' in the sidebar.",
        "Search or filter by your state, district, or crop name.",
        "Inspect Modal (average), Minimum, and Maximum prices per quintal.",
        "Check arrival volumes to gauge market demand.",
      ],
      resultMeaning: "Prices are quoted in Rupees per Quintal (100 kg). The Modal price represents the rate at which the largest volume of produce traded that day.",
      mistakesToAvoid: [
        "Assuming your harvest will fetch the maximum price without meeting moisture and cleaning quality standards.",
        "Travelling to distant mandis without factoring in transport and loading charges.",
      ],
      limitations: "Wholesale auction rates fluctuate daily based on spot quality, moisture content, and buyer arrivals at the physical market.",
    },
    {
      id: "equipment-rental",
      title: "Equipment Rental Marketplace",
      icon: Truck,
      tag: "Farm Mechanization",
      color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
      description: "Rent modern tractors, rotavators, harvesters, and sprayers from verified local equipment owners.",
      navModule: "equipment-rental",
      whatItDoes: "Provides a localized marketplace directory connecting farmers seeking machinery with local Custom Hiring Centres and owners.",
      whyUse: "Enables timely plowing, sowing, and harvesting without taking heavy loans to purchase expensive machines.",
      infoNeeded: ["Equipment type needed, required dates, and farm location."],
      steps: [
        "Select 'Equipment Rental' from the sidebar.",
        "Browse categories (Tractors, Harvesting, Tillage, Sowing, Spraying).",
        "View hourly or daily rental rates, owner ratings, and specifications.",
        "Contact the equipment provider directly to arrange field timing.",
      ],
      resultMeaning: "Direct access to mechanization providers with transparent rental pricing.",
      mistakesToAvoid: [
        "Waiting until peak harvest day to book machinery, when demand is highest.",
        "Not clarifying fuel, operator wage, and field transport inclusions beforehand.",
      ],
      limitations: "Rental agreements, machine availability, and payments are coordinated directly between you and the equipment owner.",
    },
    {
      id: "expert-support",
      title: "Expert Support & Kisan Helplines",
      icon: Headphones,
      tag: "Agronomist Advisory",
      color: "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800",
      description: "Connect with verified agricultural scientists, Krishi Vigyan Kendras (KVK), and official helplines.",
      navModule: "expert-support",
      whatItDoes: "Helps you prepare structured agronomic questions with attached photos and provides direct directory access to Indian government agricultural extension scientists.",
      whyUse: "Get specialized human verification for unusual pest attacks, water salinity problems, or crop insurance claims.",
      infoNeeded: ["Crop name, affected acreage, description of symptoms, and farm location."],
      steps: [
        "Open 'Expert Support' from the sidebar.",
        "Call the national toll-free Kisan Call Center at 1800-180-1551 (6 AM – 10 PM).",
        "Locate your district's Krishi Vigyan Kendra (KVK) address and contact officers.",
        "Use the inquiry preparation tool to record your problem details clearly before speaking with the scientist.",
      ],
      resultMeaning: "Access to accredited agricultural specialists who provide localized, certified advice.",
      mistakesToAvoid: [
        "Describing problems vaguely without mentioning soil type, seed variety, or planting date.",
        "Delaying consultation until pest infestation has passed the economic injury threshold.",
      ],
      limitations: "Scientist availability depends on regional KVK working hours. The Kisan Call Center operates 7 days a week.",
    },
    {
      id: "gov-schemes",
      title: "Government Schemes & Subsidies",
      icon: Landmark,
      tag: "Farmer Welfare",
      color: "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800",
      description: "Explore official Indian agricultural subsidies, credit programs, and crop insurance schemes.",
      navModule: "government-schemes",
      whatItDoes: "Maintains a verified directory of central and state farming programs, including PM-KISAN, PMFBY crop insurance, Kisan Credit Card (KCC), and solar pump schemes.",
      whyUse: "Ensures you do not miss financial assistance, insurance protection, or equipment subsidies you are legally entitled to.",
      infoNeeded: ["Landholding category (Marginal, Small, Medium, Large), State, and Aadhaar-linked bank details."],
      steps: [
        "Click 'Government Schemes' in the sidebar.",
        "Filter schemes by category (Financial Support, Insurance, Irrigation, Machinery).",
        "Read eligibility criteria and required documents.",
        "Use official application links to apply directly on government portals.",
      ],
      resultMeaning: "Clear, transparent breakdown of scheme benefits, installment timelines, and direct official portals.",
      mistakesToAvoid: [
        "Falling for unofficial agent fees; all central government scheme applications are free or low-cost at CSCs.",
        "Missing crop insurance enrollment cutoff dates for Kharif (typically July 31) and Rabi (December 31).",
      ],
      limitations: "FieldWise provides verified scheme guidance. Benefit disbursement is handled exclusively by government departments and banks.",
    },
  ];

  // Filter feature guides based on search query
  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) return featureGuides;
    const q = searchQuery.toLowerCase();
    return featureGuides.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.whatItDoes.toLowerCase().includes(q) ||
        f.infoNeeded.some((i) => i.toLowerCase().includes(q))
    );
  }, [searchQuery, featureGuides]);

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
                Farmer Help & Learning Centre
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                How to Use FieldWise on Your Farm
              </h1>
              <p className="text-sm text-emerald-100/90 leading-relaxed">
                Simple, practical guides to help you make confident decisions about crops, fertilizers, plant health, and mandi prices. Built for farmers across India.
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
                  onClick={() => onNavigate("profile")}
                  className="bg-emerald-500 hover:bg-emerald-400 text-[#0a2316] font-bold text-xs rounded-xl shadow-md gap-1.5"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  My Farm Profile
                </Button>
              )}
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="mt-6 pt-5 border-t border-emerald-800/40 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-emerald-300/80" />
              <Input
                type="text"
                placeholder="Search topics (e.g. soil pH, fertilizer, disease photo, mandi prices)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/10 border-emerald-500/30 text-white placeholder:text-emerald-200/50 rounded-xl text-xs h-10 focus-visible:ring-emerald-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs text-emerald-300 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── NAVIGATION TABS ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

        {/* ════════════════════════════════════════════════════════════════════
            TAB 1: WELCOME TO FIELDWISE
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "welcome" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      1. Welcome to FieldWise
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    FieldWise is an agricultural decision-support companion created specifically for Indian farmers. Farming is one of the most vital yet unpredictable occupations in the world. FieldWise exists to bring scientific agronomic insights, soil health analysis, pest detection, and market data directly into your hands in clear, practical language.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 space-y-2">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-800 dark:text-emerald-300">
                      <Sprout className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Why FieldWise Was Created</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Farmers often rely on guesswork or generic shopkeeper advice for seeds and chemicals. FieldWise connects your real soil numbers and weather to proven agronomic science so you invest in what actually works.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/70 dark:border-teal-900/40 space-y-2">
                    <div className="h-9 w-9 rounded-xl bg-teal-100 dark:bg-teal-900 flex items-center justify-center text-teal-800 dark:text-teal-300">
                      <Scale className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Farming Problems It Solves</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Preventing wrong crop selection, eliminating expensive fertilizer overuse, diagnosing crop diseases from phone photos before they spread, and helping you find the right mandi to sell your harvest.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 space-y-2">
                    <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-800 dark:text-blue-300">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Who Can Use FieldWise</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Smallholder farmers, progressive commercial growers, agricultural students, extension workers, and custom hiring operators managing crops across all major Indian states.
                    </p>
                  </div>
                </div>

                {/* Honest Boundaries: What FieldWise Can and Cannot Do */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      What FieldWise CAN Do
                    </div>
                    <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                      <li>Rank which crops are most compatible with your soil N-P-K, pH, and local weather.</li>
                      <li>Calculate exact bags of Urea, DAP, and MOP required for your specific acreage.</li>
                      <li>Screen leaf photos using AI vision to identify early signs of common fungal or bacterial blight.</li>
                      <li>Provide official toll-free numbers and locations for certified local agricultural scientists.</li>
                      <li>Save your farm profile so you never have to re-enter your soil card numbers each time.</li>
                    </ul>
                  </div>

                  <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 space-y-3">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      What FieldWise CANNOT Do
                    </div>
                    <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                      <li><strong>Cannot guarantee crop yield or financial profits:</strong> Weather, pests, seed quality, and market fluctuations always affect real outcomes.</li>
                      <li><strong>Cannot replace certified soil testing laboratories:</strong> The app relies on the soil numbers you enter; it cannot test physical dirt remotely.</li>
                      <li><strong>Cannot replace certified plant pathologists:</strong> Vision AI is a screening tool; severe or unusual outbreaks should be physically verified by your KVK.</li>
                      <li><strong>Cannot control market rates:</strong> Mandi prices reflect actual daily wholesale arrivals and spot demand.</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Ready to get started? Set up your farm profile to personalize all tools for your land.
                  </div>
                  {onNavigate && (
                    <Button
                      onClick={() => onNavigate("profile")}
                      className="bg-[#0a2316] hover:bg-[#133c27] text-white text-xs font-bold rounded-xl gap-1.5"
                    >
                      Set Up My Farm Profile
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2: HOW FIELDWISE WORKS (FARMER JOURNEY)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "journey" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      2. The Complete Farmer Journey
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    FieldWise is designed to follow your actual seasonal farming workflow. Here is how an ordinary farmer moves from setting up an account to taking confident field actions.
                  </p>
                </div>

                {/* 6 Step Progression */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      step: "Step 1",
                      title: "Create Your Account",
                      icon: UserCheck,
                      description: "Sign in with your email or Google account. Your farm records and past calculations stay securely attached to your personal account across any phone or computer.",
                    },
                    {
                      step: "Step 2",
                      title: "Set Up Your Farm",
                      icon: MapPin,
                      description: "Enter your state, district, plot acreage, and soil type in 'My Farm'. This basic information anchors every recommendation to your specific geographic region.",
                    },
                    {
                      step: "Step 3",
                      title: "Enter Soil Details",
                      icon: Leaf,
                      description: "Input your soil test figures for Nitrogen (N), Phosphorus (P), Potassium (K), and pH. If you do not have a test yet, regional standards provide an initial baseline.",
                    },
                    {
                      step: "Step 4",
                      title: "Use Advisory Tools",
                      icon: Sprout,
                      description: "Run the Crop Recommendation tool for upcoming sowing, calculate exact Urea/DAP/MOP bags for your crop, or upload leaf photos when plants show signs of disease.",
                    },
                    {
                      step: "Step 5",
                      title: "Understand Results",
                      icon: Scale,
                      description: "Review suitability percentages, soil constraint warnings (like acidity or alkalinity), and fertilizer split-schedules. Understand why each recommendation was made.",
                    },
                    {
                      step: "Step 6",
                      title: "Track, Review & Act",
                      icon: Award,
                      description: "Revisit your saved farm profile at any time. When you harvest, compare mandi rates in the market tracker to decide where and when to sell.",
                    },
                  ].map((s, idx) => {
                    const StepIcon = s.icon;
                    return (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl bg-[#f8faf9] dark:bg-gray-800/60 border border-gray-200/90 dark:border-gray-700 space-y-3 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#0a2316] text-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                            {s.step}
                          </span>
                          <StepIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{s.title}</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          {s.description}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    <strong>Seamless Prefill:</strong> When you update your numbers in <em>My Farm</em>, the Crop Recommendation and Fertilizer Recommendation modules automatically load those values. You never need to write down or memorize soil numbers.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3: USING FIELDWISE FEATURES
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "features" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      3. Practical Guides for Every Feature
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Select any feature below to view verified step-by-step instructions, required inputs, output explanations, and common pitfalls to avoid.
                  </p>
                </div>

                {/* Feature Selector Buttons */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {filteredFeatures.map((feat) => {
                    const FeatIcon = feat.icon;
                    const isSelected = selectedFeature === feat.id;
                    return (
                      <button
                        key={feat.id}
                        onClick={() => setSelectedFeature(feat.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                          isSelected
                            ? "bg-[#0a2316] text-white border-[#0a2316]"
                            : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-emerald-600"
                        }`}
                      >
                        <FeatIcon className={`h-4 w-4 ${isSelected ? "text-emerald-400" : "text-gray-500"}`} />
                        {feat.title.split(" (")[0]}
                      </button>
                    );
                  })}
                </div>

                {/* Active Feature Detail View */}
                {(() => {
                  const feat = featureGuides.find((f) => f.id === selectedFeature) || featureGuides[0];
                  const FeatIcon = feat.icon;
                  return (
                    <div className="space-y-6 border border-gray-200/90 dark:border-gray-800 rounded-2xl p-6 bg-[#fbfdfc] dark:bg-gray-900/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl border ${feat.color}`}>
                            <FeatIcon className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{feat.title}</h3>
                              <Badge variant="outline" className="text-[10px]">{feat.tag}</Badge>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{feat.description}</p>
                          </div>
                        </div>

                        {onNavigate && feat.navModule && (
                          <Button
                            onClick={() => onNavigate(feat.navModule)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shrink-0 gap-1.5"
                          >
                            Open {feat.title.split(" (")[0]}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Purpose & Why Use */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1.5">
                          <div className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Info className="h-3.5 w-3.5 text-emerald-600" />
                            What This Feature Does
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                            {feat.whatItDoes}
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1.5">
                          <div className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                            Why You Should Use It
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                            {feat.whyUse}
                          </p>
                        </div>
                      </div>

                      {/* What Info is Needed */}
                      <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
                        <div className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                          What Information You Need Ready
                        </div>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                          {feat.infoNeeded.map((info, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                              <span>{info}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Step-by-Step Instructions */}
                      <div className="p-5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-3">
                        <div className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                          Step-by-Step Instructions
                        </div>
                        <ol className="space-y-2.5">
                          {feat.steps.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 font-bold shrink-0 text-[11px]">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* What Results Mean */}
                      <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-1.5">
                        <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                          What Your Result Means
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                          {feat.resultMeaning}
                        </p>
                      </div>

                      {/* Common Mistakes & Limitations */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-2">
                          <div className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            Common Mistakes to Avoid
                          </div>
                          <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                            {feat.mistakesToAvoid.map((m, idx) => (
                              <li key={idx}>{m}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 rounded-xl bg-gray-100/60 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 space-y-2">
                          <div className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-gray-600" />
                            Important Limitations
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                            {feat.limitations}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 4: UNDERSTANDING YOUR RESULTS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "results" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      4. How to Interpret Recommendations & Scores
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    When you run an analysis on FieldWise, numbers and badges appear on your screen. Here is what each indicator actually means for your farming operations.
                  </p>
                </div>

                {/* Metric 1: Suitability Score */}
                <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 space-y-4 bg-white dark:bg-gray-900">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                      <Scale className="h-5 w-5 text-emerald-600" />
                      Crop Suitability Score (Percentage)
                    </h3>
                    <Badge variant="outline" className="text-[10px]">Agronomic Compatibility</Badge>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Suitability is a mathematical comparison between your soil chemistry (N-P-K, pH) and the biological requirements of that specific crop. It tells you how comfortable the crop will be in your soil.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
                      <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">85% to 99%: Highly Suitable</div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        Your soil pH and nutrient levels are in the optimal sweet spot for this crop. Minimal soil correction needed.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 space-y-1">
                      <div className="text-sm font-bold text-blue-800 dark:text-blue-300">70% to 84%: Moderately Suitable</div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        The crop grows well, but one factor (such as low nitrogen or slightly off-center pH) requires corrective fertilization.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-1">
                      <div className="text-sm font-bold text-amber-800 dark:text-amber-300">Below 60%: Not Recommended</div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        Severe soil mismatch (e.g. acidic soil pH &lt; 5.5 for a crop needing alkaline soil). Planting carries high biological risk.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                    <strong>Critical Rule:</strong> A 95% suitability score means biological compatibility with your soil. It does <em>not</em> guarantee that market prices will be high or that unseasonal rains won't occur.
                  </div>
                </div>

                {/* Metric 2: Soil pH Scale */}
                <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 space-y-4 bg-white dark:bg-gray-900">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-teal-600" />
                    Understanding Soil pH (Acidity vs. Alkalinity)
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    pH measures how sour (acidic) or sweet/salty (alkaline) your soil is on a scale from 0 to 14. If pH is too high or too low, fertilizer nutrients get locked in the dirt and plant roots cannot drink them.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 space-y-1.5">
                      <div className="font-bold text-amber-800 dark:text-amber-300">Acidic Soil (pH &lt; 6.0)</div>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        Common in high-rainfall states. Phosphorus gets tightly bound to iron and aluminum. Remedied by applying agricultural lime (calcium carbonate).
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1.5">
                      <div className="font-bold text-emerald-800 dark:text-emerald-300">Optimal Neutral Soil (pH 6.5 – 7.5)</div>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        The ideal range for wheat, cotton, pulses, and vegetables. Microbes thrive and fertilizers dissolve with maximum efficiency.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 space-y-1.5">
                      <div className="font-bold text-blue-800 dark:text-blue-300">Alkaline / Sodic Soil (pH &gt; 8.0)</div>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        Excess sodium or carbonates cause crusting and zinc/iron chlorosis. Remedied with gypsum application and heavy green manuring.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metric 3: Disease Vision Confidence */}
                <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl p-5 space-y-4 bg-white dark:bg-gray-900">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                    <ScanEye className="h-5 w-5 text-rose-600" />
                    Disease Detection Confidence & Severity Levels
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    When you submit a leaf photograph, the vision engine matches visible spots, concentric rings, and discoloration against certified plant pathology patterns.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 space-y-1">
                      <div className="font-bold text-gray-900 dark:text-white">Confidence Percentage (e.g. 92%)</div>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        Reflects how strongly visual symptoms match known pathogen signatures. Above 85% means clear visual hallmarks. Below 70% suggests taking a sharper photo in better sunlight.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 space-y-1">
                      <div className="font-bold text-gray-900 dark:text-white">Severity Level (Low, Medium, High)</div>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        Low indicates isolated spots where organic neem oil or bio-control can halt spread. High means extensive necrosis requiring immediate targeted treatment to protect yield.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 5: BASIC FARMING KNOWLEDGE
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "basics" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      5. Essential Agricultural Concepts for Every Farmer
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    FieldWise recommendations are grounded in established agronomic principles. Understanding these core concepts helps you make sense of your land and input choices.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Topic 1: Soil Testing */}
                  <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                      <Leaf className="h-4 w-4 text-emerald-600" />
                      How to Take a Soil Sample Correctly
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Do not take soil from one corner or near cattle sheds. Walk across your plot in a zig-zag pattern, scrape surface trash, dig 15 to 20 cm deep (plow depth) in a V-shape, and collect thin slices from 8-10 spots. Mix thoroughly, dry in shade, pack 500 grams, and send to your district Soil Testing Laboratory every 2 to 3 years.
                    </p>
                  </div>

                  {/* Topic 2: The Big 3: N-P-K */}
                  <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                      <FlaskConical className="h-4 w-4 text-teal-600" />
                      The Big Three: Nitrogen, Phosphorus, Potassium
                    </div>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
                      <li><strong>Nitrogen (N):</strong> Powers vegetative growth, tillering, and dark green leaves. Deficit causes yellowing of older leaves.</li>
                      <li><strong>Phosphorus (P):</strong> Drives deep root growth, early vigor, and flowering. Deficit causes purple leaf margins.</li>
                      <li><strong>Potassium (K):</strong> Regulates water use, strengthens stalks against lodging, and boosts disease resistance.</li>
                    </ul>
                  </div>

                  {/* Topic 3: Cropping Seasons in India */}
                  <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      Understanding the 3 Crop Seasons
                    </div>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
                      <li><strong>Kharif (Monsoon: June – October):</strong> Dependent on monsoon rains. Includes Rice, Cotton, Maize, Soybean, Groundnut.</li>
                      <li><strong>Rabi (Winter: October – April):</strong> Sown after rains retreat, requires cooler temperatures. Includes Wheat, Mustard, Gram/Chickpea.</li>
                      <li><strong>Zaid (Summer: March – June):</strong> Short window under irrigation. Includes Watermelon, Cucumber, Fodder, Moong.</li>
                    </ul>
                  </div>

                  {/* Topic 4: Local Agricultural Advice */}
                  <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                      <Headphones className="h-4 w-4 text-purple-600" />
                      Why Local KVK Scientists Matter
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Every district has unique microclimates, pest pressures, and groundwater quality. FieldWise works best as a primary digital filter, paired with on-the-ground verification from your local Krishi Vigyan Kendra (KVK) or state agricultural extension officer.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 6: FREQUENTLY ASKED QUESTIONS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "faqs" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      6. Frequently Asked Questions
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Clear, honest answers to common questions about using FieldWise on your farm.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      q: "Can I use FieldWise if I do not have a recent Soil Health Card?",
                      a: "Yes. When you select your state and district in 'My Farm', FieldWise loads verified regional soil baselines. However, for maximum accuracy and cost savings on fertilizer, getting a physical soil test done at your nearest government lab is strongly recommended.",
                    },
                    {
                      q: "Why might a crop recommendation score be low or unavailable?",
                      a: "Crops score low when one or more of your soil conditions are biologically unsuitable. For example, planting tea in alkaline black soil (pH > 8.0) or cotton in waterlogged acid soils will produce low suitability scores to protect you from crop failure.",
                    },
                    {
                      q: "Are the crop recommendations and fertilizer amounts guaranteed to give high yields?",
                      a: "No algorithm can guarantee biological outcomes. Recommendations are scientific decision-support tools based on ICAR agronomy and weather averages. Real yields depend on seed variety, timely irrigation, weed control, pest outbreaks, and unseasonal weather events.",
                    },
                    {
                      q: "What should I do if the plant disease detection is uncertain or gives a low confidence score?",
                      a: "If confidence is below 75%, take a new photo in bright, indirect morning light holding the camera steady 15 cm from the leaf. If still uncertain, take physical leaf specimens in a sealed polythene bag directly to your district Krishi Vigyan Kendra (KVK) scientist before spraying costly chemicals.",
                    },
                    {
                      q: "How do I update my farm details if I made a mistake or leased new land?",
                      a: "Simply open 'My Farm' from the sidebar, update your acreage, soil numbers, or district, and click 'Save Profile'. Your updated numbers will immediately take effect across all crop and fertilizer tools.",
                    },
                    {
                      q: "Does FieldWise charge any fees for government schemes or expert helpline numbers?",
                      a: "No. FieldWise provides verified public helpline contacts (Kisan Call Center 1800-180-1551) and official portal links completely free of charge. Never pay unverified agents for government subsidy applications.",
                    },
                    {
                      q: "Is my farm information kept private?",
                      a: "Yes. Your farm location, crop choices, and soil data are stored securely under your authenticated account and are used exclusively to calculate your personalized agronomic recommendations.",
                    },
                  ].map((faq, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-[#fbfdfc] dark:bg-gray-900/60 space-y-2"
                    >
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                        <HelpCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        {faq.q}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 pl-6 leading-relaxed">
                        {faq.a}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 7: TECHNICAL & ARCHITECTURE REFERENCE (PRESERVING DEV DOCS)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "technical" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      7. Technical Architecture & Developer Reference
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    For agricultural engineers, software developers, and research integrators looking for system architecture, machine learning model specifications, and API contracts.
                  </p>
                </div>

                {/* Developer Documentation Callout Card */}
                <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                    <Code2 className="h-5 w-5 text-emerald-700" />
                    Full Developer Specification Available in Codebase
                  </div>
                  <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                    Complete engineering blueprints, mathematical formulas, REST API specifications, curl request examples, and database DDL schemas are maintained permanently in the repository:
                  </p>
                  <code className="block bg-emerald-100 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 p-2.5 rounded-xl text-xs font-mono">
                    FieldWise_main/docs/TECHNICAL_DOCUMENTATION.md
                  </code>
                </div>

                {/* Architecture Highlights Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-[#f8faf9] dark:bg-gray-800/40 space-y-1.5">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Frontend Stack</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">React 18 + Vite + Tailwind</div>
                    <p className="text-[11px] text-gray-500">Fast responsive client with offline Gaussian resilience.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-[#f8faf9] dark:bg-gray-800/40 space-y-1.5">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">API Gateway</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">Node.js Express + SQLite</div>
                    <p className="text-[11px] text-gray-500">Stateless JWT authentication with native SQLite storage.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-[#f8faf9] dark:bg-gray-800/40 space-y-1.5">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Recommendation Engine</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">Calibrated ML + ICAR Rules</div>
                    <p className="text-[11px] text-gray-500">Multivariate distance metrics with soil pH penalty safeguards.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-[#f8faf9] dark:bg-gray-800/40 space-y-1.5">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Computer Vision</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">Gemini 2.5 Flash Vision</div>
                    <p className="text-[11px] text-gray-500">Multimodal botanical pathology inference with bio-control protocols.</p>
                  </div>
                </div>

                {/* API Quick Reference Table */}
                <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 font-bold text-xs text-gray-900 dark:text-white">
                    Core API Endpoints
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                    <div className="p-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800">GET</span>
                        <code className="font-mono text-gray-900 dark:text-white">/api/health</code>
                      </div>
                      <span className="text-gray-500">Service uptime & heartbeat</span>
                    </div>
                    <div className="p-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">POST</span>
                        <code className="font-mono text-gray-900 dark:text-white">/api/predict</code>
                      </div>
                      <span className="text-gray-500">V1 Soil & climate crop suitability inference</span>
                    </div>
                    <div className="p-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">POST</span>
                        <code className="font-mono text-gray-900 dark:text-white">/api/v2/predict</code>
                      </div>
                      <span className="text-gray-500">V2 Calibrated recommendation bridge with cloud persistence</span>
                    </div>
                    <div className="p-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800">GET</span>
                        <code className="font-mono text-gray-900 dark:text-white">/api/schemes</code>
                      </div>
                      <span className="text-gray-500">Verified government scheme registry</span>
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
