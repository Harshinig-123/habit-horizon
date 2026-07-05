# Habit Horizon — Full-Stack Personal AI Planner

A complete full-stack AI habit & planning assistant with Express backend, React frontend, and 4 specialized agents.
**Powered by Groq (free) + Llama 3** — no paid API key needed.

---

## Project Structure

```
habit-horizon/
├── backend/                         ← Node + Express + TypeScript API server
│   ├── src/
│   │   ├── server.ts                ← Express entry point (port 5000)
│   │   ├── routes.ts                ← All 14 API route definitions
│   │   ├── habithorizon/
│   │   │   ├── habithorizon.controller.ts  ← Groq API proxy + PII redaction
│   │   │   └── habithorizon.service.ts     ← File-based data persistence
│   │   └── utils/
│   │       └── pii.ts               ← Server-side PII redaction + archetype detection
│   ├── .env.example                 ← Copy to .env and add GROQ_API_KEY
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                        ← React + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx                  ← Root component, onboarding, dashboard
│   │   ├── api.ts                   ← Unified backend API client
│   │   ├── index.css                ← Full design system (CSS vars, 3 themes)
│   │   └── components/
│   │       ├── HabitHorizonChat.tsx ← AI chat + privacy guard log
│   │       ├── HabitEngine.tsx      ← Habit tracker with streaks
│   │       ├── HorizonPlanner.tsx   ← Daily / Weekly / Monthly planner
│   │       └── AITaskPlanner.tsx    ← AI task-to-plan generator
│   ├── .env.example
│   └── package.json
│
├── sandbox/                         ← Per-user JSON data files (auto-created at runtime)
└── .agents/                         ← Agent architecture documentation
    ├── agents.md
    └── skills/
        ├── habit_engine.md
        ├── horizon_planner.md
        └── ai_task_planner.md
```

---

## Quick Setup (5 minutes)

### Step 1 — Get your FREE Groq API key
1. Go to https://console.groq.com
2. Sign up with Google or GitHub (free, no credit card)
3. Click **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_...`)

### Step 2 — Backend
```bash
cd backend
cp .env.example .env
```
Open `.env` and replace `gsk_your_groq_api_key_here` with your key:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=5000
FRONTEND_URL=http://localhost:5173
```
Then:
```bash
npm install
npm run dev
```
Backend starts on http://localhost:5000

### Step 3 — Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend starts on http://localhost:5173

### Step 4 — Open in browser
Navigate to **http://localhost:5173**

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Server health check |
| POST | `/api/auth/signup` | User sign up / account creation |
| POST | `/api/auth/login` | User login / authentication verification |
| GET | `/api/profile/:userId` | Load user profile |
| POST | `/api/profile` | Save/update profile |
| POST | `/api/profile/:userId/reset` | Reset profile |
| GET | `/api/habits/:userId` | Load habits |
| POST | `/api/habits/toggle` | Toggle habit done/undone |
| POST | `/api/habits/add` | Add new habit |
| POST | `/api/habits/delete` | Delete habit |
| GET | `/api/planning/:userId` | Load planning data |
| POST | `/api/planning/save` | Save full planning object |
| POST | `/api/planning/task/add` | Add task to scope |
| POST | `/api/planning/task/toggle` | Toggle task done/undone |
| POST | `/api/planning/task/delete` | Delete task |
| POST | `/api/chat` | AI chat (Groq proxy + server-side PII redaction) |
| POST | `/api/plan/generate` | AI plan generation via Groq |

---

## Requirements
- Node.js >= 18.0.0
- npm >= 8.0.0
- Free Groq API key (https://console.groq.com)

---

## Features
- **Role-based onboarding** — Student / Professional / Entrepreneur with themed UI
- **AI Chat** — Groq + Llama 3 assistant with conversation memory and server-side PII redaction
- **Habit Tracker** — daily checkboxes, streak counters, consistency score, file-based persistence
- **Horizon Planner** — daily task list, weekly 7-column grid, monthly calendar with dot indicators
- **AI Task Planner** — paste tasks → set deadline → AI generates structured plan → push to planner
- **Privacy Guard** — all messages PII-stripped on the server before reaching the AI model
- **Offline fallback** — frontend falls back to localStorage if backend is down

---

## Troubleshooting

### `Plan generation error: fetch failed` (on Windows/WSL)
If you run the backend on Windows and external API calls (such as Groq or Claude) fail with a generic `fetch failed` error while curl or browser requests succeed:
* This is typically caused by Node.js prioritizing IPv6 DNS records (AAAA) over IPv4 when there is no active IPv6 route to the internet.
* **Solution**: The backend entry point [server.ts](file:///c:/Users/sandh/OneDrive/Desktop/Projects/habit-horizon/backend/src/server.ts) programmatically addresses this by calling `dns.setDefaultResultOrder('ipv4first')` at startup. Ensure this import remains at the very top of your entry file.
