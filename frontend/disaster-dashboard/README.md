# DisasterSight — Automated Damage Assessment Dashboard

> Front-end for the UT Dallas UTDesign Capstone: **Automated Disaster Damage Assessment from Aerial Imagery**

Built with **React + TypeScript + Vite + MUI v5**, styled with a dark tactical/emergency-ops aesthetic.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. Open in browser
# http://localhost:5173
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Sidebar/         # Nav sidebar with mission badge
│   ├── Navbar/          # Top bar with status chips + clock
│   ├── EvaluationPanel/ # ← Main focus: metrics, confusion matrix, predictions
│   ├── MapView/         # Leaflet geo map (Sprint 2)
│   └── ChatBot/         # NL query interface (Sprint 2)
├── data/
│   └── mockData.ts      # Mock buildings, metrics, confusion matrix
├── pages/
│   └── Overview.tsx     # Dashboard home / mission summary
├── theme/
│   └── index.ts         # MUI dark tactical theme + COLORS
├── types/
│   └── index.ts         # TypeScript interfaces
├── App.tsx              # Router + layout shell
└── main.tsx             # Entry point
```

---

## 🗺️ Pages

| Route | Status | Description |
|---|---|---|
| `/` | ✅ Done | Mission overview + KPIs + system status |
| `/map` | 🔜 Sprint 2 | Leaflet map with damage overlays |
| `/evaluation` | ✅ Done | Confusion matrix, per-class metrics, sample predictions |
| `/chatbot` | 🔜 Sprint 2 | NL query bot (wire to VLM backend) |

---

## 📊 Evaluation Panel Features

- **4 KPI cards** — Accuracy, F1, Correct count, Misclassified count
- **Confusion Matrix** — Interactive heatmap, hover for details
- **Per-Class Metrics Table** — Precision / Recall / F1 per damage level
- **Sample Predictions Table** — Filter by correct / wrong, confidence coloring
- **Damage Distribution Bar** — FEMA label breakdown

---

## 🎨 Theme & Design

- **Font**: Space Mono (headings / data) + IBM Plex Sans (body)
- **Palette**: `#0a0c0f` bg · `#00d4ff` cyan accent · `#ff6b2b` orange · damage colors green/yellow/orange/red
- **Framework**: MUI v5 with full dark-mode overrides

---

## 🔌 Backend Integration Points

These are the spots where real backend data should be wired in:

```ts
// src/data/mockData.ts → replace with API calls
// e.g. GET /api/buildings, GET /api/metrics, GET /api/events

// src/components/ChatBot/ChatBot.tsx → getResponse()
// Replace mock responses with:  POST /api/chat  { query: string }

// src/components/MapView/MapView.tsx
// Load GeoJSON from: GET /api/geojson?event=harvey-2017
```

---

## 📦 Key Dependencies

| Package | Purpose |
|---|---|
| `@mui/material` v5 | UI component library |
| `@mui/icons-material` | Icon set |
| `react-router-dom` v6 | Client-side routing |
| `leaflet` + `react-leaflet` | Geospatial map (Sprint 2) |
| `chart.js` + `react-chartjs-2` | Charts (Sprint 2) |

---

## 🛠️ Development Commands

```bash
npm run dev      # Start dev server (hot reload)
npm run build    # TypeScript check + production build
npm run preview  # Preview production build
npm run lint     # ESLint check
```

---

## 📋 Sprint Roadmap

### Sprint 1 (Current) ✅
- [x] Project scaffold (Vite + React + TypeScript)
- [x] Dark tactical MUI theme
- [x] Sidebar navigation
- [x] Top navbar with status indicators
- [x] Overview page
- [x] Evaluation panel (confusion matrix, metrics, predictions table)
- [x] ChatBot UI shell
- [x] MapView placeholder
- [x] TypeScript types and mock data

### Sprint 2 🔜
- [ ] Leaflet map with GeoJSON building polygons
- [ ] Pre/post aerial imagery toggle
- [ ] Damage overlay color coding on map
- [ ] Address search / geocoding
- [ ] Wire ChatBot to VLM backend API
- [ ] Real API integration (replace mock data)

### Sprint 3 🔜
- [ ] FEMA data import pipeline
- [ ] Evaluation auto-refresh on new data
- [ ] Export reports (PDF / CSV)
- [ ] Cloud deployment (Azure / AWS)

---

## 👥 Team

UT Dallas UTDesign Capstone · Instructor: Dr. Semih Dinc
