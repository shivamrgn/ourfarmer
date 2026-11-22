# 🌾 FieldWise — Smarter Farming with AI

FieldWise is a modern agricultural intelligence platform designed for farmers to optimize crop yields, receive AI-driven crop recommendations, diagnose crop diseases, calculate precise fertilizer dosages, and track soil and weather insights.

---

## 🛠️ Technology Stack & Requirements

### 1. Languages
* **JavaScript (ES6+)**
* **HTML5**
* **Vanilla CSS3** (Custom design system, CSS variables, glassmorphism, responsive media queries)

### 2. Frameworks & Libraries
* **React 19** (`react`, `react-dom` `^19.2.8`)
* **Vite 8** (`vite` `^8.3.0`, `@vitejs/plugin-react` `^6.1.1`)
* **Firebase 12** (`firebase` `^12.19.0`) — Authentication & Cloud Firestore
* **Oxlint** (`oxlint` `^1.81.0`)

### 3. Built-in Web APIs
* **Web Crypto API**: Secure client-side SHA-256 password hashing.
* **Intersection Observer API**: Scroll-reveal animations.
* **Web Storage API (`localStorage`)**: Farmer authentication and demo session state.

### 4. System Requirements
* **Node.js**: `v18.0.0+` (recommended: `v20 LTS`)
* **npm**: `v9.0.0+`

---

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and insert your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project
   VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

3. **Run local dev server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

For detailed specifications, see [TECH_STACK.md](file:///Users/shivamkumar/FinalOne/TECH_STACK.md).
