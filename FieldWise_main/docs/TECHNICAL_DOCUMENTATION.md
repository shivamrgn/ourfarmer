# FieldWise / Crops Wild — Technical Documentation & API Guide

> **Version:** 2.4.0  
> **Platform:** FieldWise Agricultural Intelligence Platform  
> **Target Audience:** Developers, Agronomists, Integrators, and System Operators  
> **Last Updated:** October 2026

---

## 1. System Overview & Architecture

FieldWise (Crops Wild) is an AI-powered agricultural intelligence platform designed to empower farmers with personalized agronomic decision support. The platform synthesizes real-time field telemetry, soil chemistry, satellite/meteorological baselines, and APMC wholesale mandi prices into actionable farm recommendations.

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (React 18 + Vite)                     │
│  ┌───────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ Farm Intelligence │  │ AI Vision Sensor │  │ Soil & Weather Dashboard │  │
│  └─────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘  │
│            │                     │                         │                │
│            ▼                     ▼                         ▼                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │           Axios Interceptor & Client-Side Resilient Engines            │  │
│  │  - JWT Auth Interceptor (/src/lib/api.ts)                             │  │
│  │  - Offline Gaussian Crop Predictor (/src/lib/predictorEngine.ts)      │  │
│  │  - Local Cache & Profile Store (LocalStorage / Context)              │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ HTTPS / REST (JWT Bearer)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BACKEND API LAYER (Node.js + Express)                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Express Router & Middleware (CORS, Express-Validator, JWT Auth)      │  │
│  ├─────────────────┬───────────────────┬─────────────────────────────────┤  │
│  │ /api/auth       │ /api/predict      │ /api/schemes                    │  │
│  │ (Auth & Tokens) │ (ML Crop Engine)  │ (Verified Ministry Programs)    │  │
│  ├─────────────────┴───────────────────┴─────────────────────────────────┤  │
│  │ /api/expert-support                 │ /api/health                     │  │
│  │ (KVKs & Kisan Call Center)          │ (Uptime & Heartbeat)            │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 DATA STORE (SQLite / Node Native SQLite)              │  │
│  │  - users (id, name, email, password_hash, created_at)                 │  │
│  │  - expert_inquiries (id, farmer_name, phone, problem, status, etc.)   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ External Telemetry & AI Services
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL CLOUD SERVICES                           │
│  - Google Gemini 1.5 Flash Vision (Plant leaf disease detection & pathology)│
│  - OpenWeatherMap API (Real-time temperature, humidity, wind & precipitation)│
│  - NASA POWER Agroclimatology (Solar radiation & historic rainfall)         │
│  - Agmarknet / data.gov.in (Wholesale APMC mandi modal rates & trends)      │
│  - Ministry of Agriculture & Farmers Welfare (Government Schemes Registry)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Dependencies

### Frontend (`/`)
- **Framework:** React 18 with TypeScript
- **Bundler & Dev Server:** Vite 5
- **Styling:** Tailwind CSS with custom Forest Green (`#0a2316`) and pure White design tokens
- **Component Primitives:** Radix UI / Shadcn UI primitives
- **Icons:** Lucide React (`lucide-react`)
- **Charts & Visualization:** Recharts & Canvas graphics
- **State Management:** React Context API (`AuthContext`, `WeatherContext`, `LocationContext`)
- **HTTP Client:** Axios with JWT request/response interceptors

### Backend (`/backend`)
- **Runtime:** Node.js (v18+ / v22+ compatible)
- **Web Framework:** Express 4.x
- **Database:** SQLite via native `node:sqlite` (`DatabaseSync`) with automatic fallback to `better-sqlite3`
- **Security:** `bcryptjs` (password salt rounds = 10), `jsonwebtoken` (HMAC-SHA256)
- **Validation:** `express-validator`

---

## 3. Core Agricultural AI & Intelligence Engines

### 3.1 Crop Recommendation Engine

#### Methodology
The Crop Recommendation engine implements a multivariate probabilistic matching algorithm evaluating the distance between user field telemetry and crop agronomic requirement vectors:

$$\text{Suitability Score} = 100 \times \left(1 - \sum_{i=1}^{n} w_i \cdot \left| \frac{x_i - \mu_i}{\sigma_i} \right|\right)$$

Where:
- $x_i$: Farmer's input value (Nitrogen, Phosphorus, Potassium, Temperature, Humidity, Rainfall, pH)
- $\mu_i$: Optimal baseline requirement for crop $i$
- $\sigma_i$: Permissible agronomic tolerance range
- $w_i$: Normalized feature importance weight ($\sum w_i = 1$)

#### Parameter Thresholds:
| Parameter | Permissible Range | Optimal Range (e.g. Wheat) | Unit |
| :--- | :--- | :--- | :--- |
| **Nitrogen (N)** | 0 – 300 | 100 – 140 | kg/ha |
| **Phosphorus (P)** | 0 – 200 | 50 – 75 | kg/ha |
| **Potassium (K)** | 0 – 300 | 40 – 60 | kg/ha |
| **pH** | 3.5 – 9.5 | 6.0 – 7.5 | logarithmic |
| **Temperature** | 5 – 45 | 18 – 25 | °C |
| **Humidity** | 10 – 100 | 50 – 70 | % |
| **Rainfall** | 0 – 1200 | 450 – 750 | mm/season |

#### Dual-Mode Execution:
1. **Server-Side API (`POST /api/predict`)**: Validated through Express and executed in Node.js.
2. **Client-Side Fallback (`predictorEngine.ts`)**: If the backend is offline or disconnected in low-connectivity rural zones, the client executes the exact same mathematical model directly in the browser with zero downtime.

---

### 3.2 Fertilizer Recommendation System

The fertilizer recommendation system calculates soil nutrient deficiencies against ICAR (Indian Council of Agricultural Research) standards:

1. **Deficit Calculation:**
   $$\Delta N = N_{\text{target}} - N_{\text{soil}}, \quad \Delta P = P_{\text{target}} - P_{\text{soil}}, \quad \Delta K = K_{\text{target}} - K_{\text{soil}}$$
2. **Commercial Fertilizer Allocation:**
   - **Urea (46% N):** $\text{Urea (kg)} = \frac{\Delta N}{0.46}$
   - **DAP (18% N, 46% P₂O₅):** Balances primary phosphorus deficit with residual nitrogen credit.
   - **MOP (60% K₂O):** $\text{MOP (kg)} = \frac{\Delta K}{0.60}$
3. **Application Stages:** Splits the recommendation into **Basal application** (during sowing) and **Top dressing** (vegetative and flowering stages).

---

### 3.3 Plant Disease Vision AI

The disease detection engine utilizes Google Gemini 1.5 Flash Multimodal Vision:
- **Image Input:** JPEG/PNG encoded images up to 10 MB.
- **Client Processing:** Automatically downscaled to optimal inference dimensions (max 1024px) to preserve rural mobile bandwidth.
- **System Prompting:** Agronomic pathology prompt demanding structured JSON containing:
  - `crop_name`: Verified plant species
  - `disease_name`: Identified pathogen or condition (e.g. *Early Blight*, *Powdery Mildew*)
  - `confidence_score`: 0.0 to 1.0 confidence rating
  - `symptoms`: Visual physiological manifestations
  - `biological_cause`: Fungal, bacterial, viral, or abiotic nutrient deficiency
  - `organic_treatment`: Neem oil, Trichoderma viride, bio-fungicides
  - `chemical_treatment`: Technical active ingredients (Mancozeb, Chlorothalonil, etc.) with dosage per liter
  - `preventive_measures`: Crop rotation, drip irrigation adjustments, spacing

---

### 3.4 Weather & Agro-Meteorological Intelligence

- **OpenWeatherMap Integration:** Delivers localized current ambient temperature, dew point, relative humidity, wind velocity, and barometric pressure.
- **Agro-Meteorological Advisory:** Translates weather telemetry into spray window safety advisories:
  - *High wind (>15 km/h):* High chemical drift hazard.
  - *Rain expected within 4 hours:* Foliar spray wash-off warning.
  - *Relative Humidity >85% + Temp >28°C:* High fungal spore incubation advisory.

---

### 3.5 Mandi Price Intelligence

- **Data Sourcing:** Daily modal, minimum, and maximum rates from APMC mandis across India (via Agmarknet format).
- **Price Trend Analysis:** Computes 7-day and 30-day moving price directions (Bullish, Bearish, Stable).
- **Distance-Weighted Nearby Mandis:** Recommends optimal mandis balancing transport costs against wholesale price premiums.

---

## 4. REST API Specification

### Base URL
```
http://localhost:3001
```
*(In production, configured via `process.env.VITE_API_URL`)*

---

### 4.1 System & Health

#### `GET /api/health`
Checks server uptime, database connectivity, and timestamp.

- **Access:** Public
- **Sample Request:**
  ```bash
  curl -X GET http://localhost:3001/api/health
  ```
- **Sample Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "CropPredict API is running 🌾",
    "timestamp": "2026-10-04T15:30:00.000Z"
  }
  ```

---

### 4.2 Authentication Endpoints

#### `POST /api/auth/register`
Registers a new user account with secure password hashing.

- **Access:** Public
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "name": "Ramesh Patel",
    "email": "ramesh@example.com",
    "password": "Password123"
  }
  ```
- **Validation Rules:**
  - `name`: String, 2 to 50 characters.
  - `email`: Valid normalized email format. Must be unique.
  - `password`: Minimum 8 characters, at least 1 uppercase letter, at least 1 number.
- **Sample Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Ramesh Patel",
      "email": "ramesh@example.com",
      "created_at": "2026-10-04T15:30:00.000Z"
    }
  }
  ```

---

#### `POST /api/auth/login`
Authenticates a user and returns a signed JSON Web Token (JWT).

- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "ramesh@example.com",
    "password": "Password123"
  }
  ```
- **Sample Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Ramesh Patel",
      "email": "ramesh@example.com"
    }
  }
  ```

---

#### `GET /api/auth/me`
Fetches the current authenticated user's profile.

- **Access:** Private (Requires JWT)
- **Headers:** `Authorization: Bearer <token>`
- **Sample Response (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "name": "Ramesh Patel",
      "email": "ramesh@example.com",
      "created_at": "2026-10-04T15:30:00.000Z"
    }
  }
  ```

---

### 4.3 AI Crop Prediction Endpoint

#### `POST /api/predict`
Calculates optimal crop suitability recommendations based on telemetry.

- **Access:** Private (Requires JWT)
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "nitrogen": 90,
    "phosphorus": 42,
    "potassium": 43,
    "temperature": 24.5,
    "humidity": 65,
    "ph": 6.8,
    "rainfall": 750,
    "soilType": "Loamy",
    "state": "Punjab"
  }
  ```
- **Sample Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 3,
    "state": "Punjab",
    "predictions": [
      {
        "cropName": "Wheat",
        "suitabilityScore": 94,
        "confidence": 0.94,
        "category": "Cereal",
        "expectedYield": "45-50 quintals/ha",
        "duration": "120-140 days",
        "agronomicAdvice": "Soil NPK and temperature are optimal for rabi sowing."
      },
      {
        "cropName": "Mustard",
        "suitabilityScore": 88,
        "confidence": 0.88,
        "category": "Oilseed",
        "expectedYield": "18-22 quintals/ha",
        "duration": "100-115 days",
        "agronomicAdvice": "Low water requirement crop well suited for the current season."
      }
    ]
  }
  ```

---

### 4.4 Government Schemes Endpoints

#### `GET /api/schemes`
Retrieves official verified central and state agricultural support schemes.

- **Query Parameters (Optional):**
  - `category`: Filter by scheme category (e.g. `Income Support`, `Crop Insurance`, `Subsidies`)
  - `state`: Filter by state (e.g. `Punjab`, `Gujarat`, `All India`)
  - `search`: Full-text search across title and benefits.

#### `GET /api/schemes/categories`
Lists all available scheme categories with counts.

#### `GET /api/schemes/:id`
Retrieves comprehensive details for a specific scheme (including eligibility criteria, required documents, and direct application URLs).

---

### 4.5 Expert Agricultural Support & Helplines

#### `GET /api/expert-support/organizations`
Returns verified national helplines, Kisan Call Center (1551) access details, and state extension networks.

#### `GET /api/expert-support/kvk`
Returns district-level Krishi Vigyan Kendras (KVKs) mapped to the farmer's state and district.

#### `POST /api/expert-support/inquire`
Submits a structured farm inquiry with crop symptoms for institutional review.

- **Request Body:**
  ```json
  {
    "farmer_name": "Ramesh Patel",
    "phone": "9876543210",
    "state": "Punjab",
    "district": "Ludhiana",
    "crop": "Wheat",
    "category": "Plant Disease",
    "problem_description": "Yellowish patches on leaves during tillering stage"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Inquiry recorded successfully. Case prepared for KVK / Kisan Call Center review.",
    "inquiry_id": 14
  }
  ```

---

## 5. Database Schema Reference

The platform utilizes a lightweight, high-performance SQLite database stored locally at `backend/data/croppredict.db`.

### 5.1 `users` Table
```sql
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE,
  password    TEXT    NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 `expert_inquiries` Table
```sql
CREATE TABLE IF NOT EXISTS expert_inquiries (
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
);
```

---

## 6. Environment Variables Configuration

### Backend Configuration (`/backend/.env`)
```bash
# Server Port
PORT=3001

# Allowed Frontend Origins (CORS)
FRONTEND_URL=http://localhost:5173,http://localhost:8080,http://localhost:8081

# JWT Signing Key
JWT_SECRET=croppredict_production_jwt_secret_key_2026
```

### Frontend Configuration (`/.env`)
```bash
# Backend API Base URL
VITE_API_URL=http://localhost:3001

# External APIs
VITE_GEMINI_API_KEY=AIzaSy...
VITE_OPENWEATHER_API_KEY=...
```

---

## 7. Developer Quickstart

### Prerequisites
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

### Running Locally

1. **Clone & Install Frontend:**
   ```bash
   cd FieldWise_main
   npm install
   ```

2. **Install & Start Backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   *The backend starts at `http://localhost:3001`.*

3. **Start Frontend Dev Server:**
   ```bash
   cd ..
   npm run dev
   ```
   *The frontend starts at `http://localhost:8080` (or `http://localhost:8081`).*

4. **Run Production Build:**
   ```bash
   npm run build
   ```

---

## 8. Resilience & Offline-First Design

1. **Auto-Recovery Interceptor:** If the backend service is temporarily offline, the frontend interceptor captures API requests and routes them to the embedded client-side Gaussian predictor and local database cache without displaying error screens to the farmer.
2. **Deterministic Fallbacks:** Real-world mandi and weather widgets display historical baselines if public APIs encounter rate limits or network drops.
3. **Session Persistence:** Authenticated credentials and farm profiles are persisted across browser sessions with safe fallback state reconciliation.

---
*FieldWise / Crops Wild Agricultural Intelligence Platform © 2026.*
