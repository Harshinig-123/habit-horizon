# Habit Horizon — Agent Fleet Architecture

## Overview
Habit Horizon is a multi-agent personal assistant with four specialized agents.
All agents communicate via REST API through the Express backend. PII is stripped
server-side before any message reaches the AI model.

---

## Agent 1: HorizonRouter (AI Chat Agent)
**File:** `backend/src/habithorizon/habithorizon.controller.ts` → `chat()`
**Route:** `POST /api/chat`

- **Role:** Primary AI entry point. Routes user messages to Claude API after stripping PII.
- **System prompts:** Role-aware per archetype (Student / Professional / Entrepreneur)
- **PII Redaction:** Strips emails, phone numbers, and names server-side before forwarding to Claude
- **Routing detection:** Identifies whether the message is habit-related, planning-related, or general
- **Archetype detection:** Keyword-scoring to auto-detect user archetype from message content
- **Fallback:** Frontend falls back to direct Claude API call if backend is unreachable

**Input:**
```json
{ "userId": "user_123", "archetype": "Student", "message": "...", "history": [] }
```
**Output:**
```json
{ "reply": "...", "sanitizedMessage": "...", "redactedEntities": [], "routedTo": "HorizonRouter" }
```

---

## Agent 2: HabitTracker (Habit Engine Agent)
**File:** `backend/src/habithorizon/habithorizon.service.ts`
**Routes:** `GET /api/habits/:userId`, `POST /api/habits/toggle`, `POST /api/habits/add`, `POST /api/habits/delete`

- **Role:** Manages recurring daily habits, streak counters, and completion history.
- **Persistence:** Per-user JSON files in `sandbox/habits_{userId}.json`
- **Streak logic:** Increments on consecutive-day completion, resets on miss
- **Seeding:** Auto-seeds role-appropriate default habits on first load

**Data model:**
```json
{
  "id": "h1",
  "name": "Morning study session",
  "current_streak": 5,
  "last_completed_timestamp": "2026-06-20T09:00:00Z",
  "completion_history": ["2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20"]
}
```

---

## Agent 3: HorizonPlanner (Planning Agent)
**File:** `backend/src/habithorizon/habithorizon.service.ts`
**Routes:** `GET /api/planning/:userId`, `POST /api/planning/save`, `POST /api/planning/task/add`, `POST /api/planning/task/toggle`, `POST /api/planning/task/delete`

- **Role:** Manages three planning horizons — Daily, Weekly, Monthly.
- **Daily view:** Task list with optional time slots.
- **Weekly view:** 7-column calendar grid (Mon–Sun), tasks pinned to day columns.
- **Monthly view:** Full calendar grid with dot indicators per day, click-to-expand.
- **Persistence:** Per-user JSON files in `sandbox/planning_{userId}.json`
- **Seeding:** Auto-seeds archetype-appropriate tasks on first load.

**Data model:**
```json
{
  "daily":   [{ "id": "t1", "title": "Standup", "done": false, "time": "10:00", "archetype": "Professional" }],
  "weekly":  [{ "id": "t2", "title": "Sprint review", "done": false, "day": 4, "archetype": "Professional" }],
  "monthly": [{ "id": "t3", "title": "Q3 roadmap", "done": false, "date": "2026-06-30", "archetype": "Professional" }]
}
```

---

## Agent 4: AITaskPlanner (Plan Generation Agent)
**File:** `backend/src/habithorizon/habithorizon.controller.ts` → `generatePlan()`
**Route:** `POST /api/plan/generate`

- **Role:** Converts a free-form task list into a structured, prioritized plan using Claude.
- **Input:** Raw task list text + deadline + timeframe (1 day / 1 week / 1 month)
- **Output:** JSON array of planned tasks with day, time, priority, and scope
- **Push to Planner:** Frontend calls `POST /api/planning/task/add` for each task

**Flow:**
1. User pastes task list → selects deadline + timeframe
2. Backend builds a structured prompt and calls Claude API
3. Claude returns JSON plan array
4. Frontend renders plan with priority color-coding (red/orange/green)
5. User clicks "Push to Planner" → tasks injected into HorizonPlanner

---

## PII Redaction Pipeline
**File:** `backend/src/utils/pii.ts`

All user messages pass through `redactPII()` before reaching Claude:
- Emails → `[REDACTED_EMAIL]`
- Phone numbers → `[REDACTED_PHONE]`
- Names (from introductions like "my name is ...") → `[REDACTED_NAME]`

The original + sanitized pair is returned to the frontend for display in the Privacy Guard Log panel.

---

## Data Flow Diagram

```
Browser
  │
  ├── POST /api/chat        → pii.ts → Claude API → reply
  ├── POST /api/plan/generate → Claude API → JSON plan
  ├── GET  /api/habits/:id  → sandbox/habits_{id}.json
  ├── POST /api/habits/*    → sandbox/habits_{id}.json
  ├── GET  /api/planning/:id → sandbox/planning_{id}.json
  └── POST /api/planning/*  → sandbox/planning_{id}.json
```
