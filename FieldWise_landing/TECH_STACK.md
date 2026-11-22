# 🌾 FieldWise — Tech Stack & Project Requirements

A concise summary of all languages, frameworks, libraries, browser APIs, and system requirements used in the **FieldWise** project.

---

## 1. Programming Languages
* **JavaScript (ES6+)**: Core application logic, React components, state management, asynchronous Firebase operations, and Web Crypto APIs.
* **HTML5**: Semantic document layout, modal dialogs, accessible inputs, and SVG vector graphics.
* **CSS3 (Vanilla)**: Custom design system using CSS variables (colors, typography, spacing, glassmorphism), CSS Grid, Flexbox, smooth keyframe animations (360° flip), and mobile responsive media queries.

---

## 2. Frontend Framework & Core Libraries
| Library / Package | Version | Purpose |
| :--- | :--- | :--- |
| **React** | `^19.2.8` | Component-based user interface architecture & lifecycle hooks (`useState`, `useEffect`, `useRef`, `useCallback`). |
| **React DOM** | `^19.2.8` | DOM rendering and reconciliation engine. |

---

## 3. Build Tools & Developer Utilities
| Tool / Package | Version | Purpose |
| :--- | :--- | :--- |
| **Vite** | `^8.3.0` | Ultra-fast development server, HMR (Hot Module Replacement), and production bundling engine. |
| **@vitejs/plugin-react** | `^6.1.1` | Vite plugin for React JSX transformation and Fast Refresh. |
| **Oxlint** | `^1.81.0` | High-performance JavaScript/JSX linter for code quality. |

---

## 4. Backend & Cloud Infrastructure
| Service / SDK | Version | Purpose |
| :--- | :--- | :--- |
| **Firebase SDK** | `^12.19.0` | Modular client SDK connecting to Google Cloud Firebase services. |
| **Firebase Auth** | *Modular* | User registration, credential verification, and automated password reset emails. |
| **Cloud Firestore** | *Modular* | Cloud NoSQL database storing farmer profiles (`farmers` collection) with credentials, contact details, farm locations, and crop history. |

---

## 5. Native Web APIs (Zero External Dependencies)
* **Web Crypto API (`window.crypto.subtle`)**: Client-side SHA-256 cryptographic password hashing before saving or verifying credentials in Firestore.
* **Intersection Observer API**: Viewport-based triggers for smooth scroll reveal animations across sections.
* **Web Storage API (`localStorage`)**: Persisting active user and demo sessions (`fieldwise_active_user`).
* **HTML5 History & Hash Routing**: Smooth scrolling to section anchors (`#ai-tools`, `#dashboard`, `#smart-tools`, `#how-it-works`, `#why-choose-us`).

---

## 6. System & Runtime Requirements
* **Node.js**: `v18.0.0` or higher (`v20 LTS` recommended).
* **Package Manager**: `npm` `v9.0.0+` (or `pnpm` / `yarn`).
* **Browser Compatibility**: Any modern browser supporting ES modules and Web Crypto (Chrome 80+, Safari 14+, Firefox 78+, Edge 80+).

---

## 7. Environment Variables Configuration (`.env`)
Create a `.env` file in the root directory with your Firebase project credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 8. Available Scripts
* **`npm install`**: Installs all required project dependencies.
* **`npm run dev`**: Starts the local development server (default port `5173` or `5174`).
* **`npm run build`**: Compiles and bundles production-ready assets into the `dist/` directory.
* **`npm run preview`**: Previews the built production app locally.
* **`npm run lint`**: Runs Oxlint to inspect code for syntax and style issues.
