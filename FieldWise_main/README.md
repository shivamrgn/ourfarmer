# 🌱 Smart AI FieldWise — Unified Agricultural Intelligence & Farm Management Platform

> A comprehensive, modern AI-powered agriculture platform combining Gaussian agronomic modeling, multimodal crop disease detection, live mandi prices, weather forecasts, equipment rentals, government schemes, and financial profit predictors.

---

## 🌟 Key Features

### 1. 🌾 Dual-Engine AI Crop & Yield Predictor
- **7-Factor Gaussian Agronomy Engine**: Evaluates Rainfall, Temperature, Relative Humidity, Soil Type, Nitrogen (N), Phosphorus (P), Potassium (K), and pH with continuous distance decay scoring.
- **ICAR Fertilizer Scheduling**: Tailored stage-by-stage chemical and organic nutrient application dosages (basal, tillering, panicle initiation).
- **Agro-Economic Profit Optimizer**: Location-specific profit modeling based on farm acreage, season (Kharif, Rabi, Zaid), previous crop rotation, and budget.
- **16-Crop Master Encyclopedia**: Detailed database of Indian staples, pulses, oilseeds, and cash crops.

### 2. 🔬 Plant Disease Detection (AI Vision & Pathology Engine)
- Image upload and camera snapshot capability.
- Powered by multimodal AI & ICAR agronomy pathology rules.
- Instant diagnosis with confidence %, severity rating, immediate actions, symptoms, and prevention tips.

### 3. ⛅ Live Weather & Agro-Advisories
- Real-time weather context (Temperature, Humidity, Wind speed, Precipitation risk).
- Automated risk alerts for pest infestation, frost, drought stress, and irrigation scheduling.

### 4. 📈 Mandi & APMC Live Prices
- Real-time commodity market prices across Indian Mandis (Wheat, Rice, Cotton, Tomato, Mustard, Onion, Soybean).
- Historical price trend charts with profit/loss analytics.

### 5. 🚜 Equipment Rental Marketplace
- Peer-to-peer and dealership rentals for tractors, combine harvesters, drone sprayers, and rotavators.
- Hourly/daily pricing with direct booking workflow.

### 6. 🏛️ Government Schemes & Subsidies Navigator
- Direct access and eligibility checking for PM-KISAN, PMFBY (Crop Insurance), Kisan Credit Card (KCC), and micro-irrigation subsidies.

### 7. 💬 Expert Consultation & 24/7 AI Agri-Bot
- Instant agronomy AI assistance and certified expert consultation booking.

### 8. ⚙️ Multi-Language Settings & Farm Profiling
- Supports multiple Indian regional languages (English, Hindi, Punjabi, Marathi, Telugu, Tamil, Gujarati).
- Farm data export in CSV/JSON/PDF.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/shivamrgn/MyFarmer
cd MyFarmer

# 2. Install dependencies
npm install

# 3. Start the Frontend Dev Server
npm run dev
```

Frontend runs at `http://localhost:8080/` (or `http://localhost:5173/`).

### (Optional) Start the Express + SQLite Backend

```bash
cd backend
npm install
npm run dev
```

Backend API runs at `http://localhost:3001/`.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Radix UI, Framer Motion, Recharts, Sonner
- **Backend API**: Node.js, Express, SQLite (`node:sqlite`), JWT Authentication, bcryptjs
- **AI & ML Engines**: Gaussian Range Agronomy Algorithm, Google Gemini 1.5 Flash (Vision & Multimodal), OpenWeather & OpenMeteo APIs

---

## 📄 License
MIT License
