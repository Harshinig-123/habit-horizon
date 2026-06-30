# Kaggle AI Agents Capstone: Habit Horizon Submission Writeup

## Project Title
**Habit Horizon — Privacy-First Multi-Agent Scheduler & Personal Assistant**

## Track
**Concierge Agents**

---

## 1. Problem Statement & Value Proposition
Planning applications and habit coaches often require users to share highly sensitive context, such as full names, personal email addresses, phone numbers, schedules, and daily routines. When integrated with cloud-based LLM APIs, this presents a significant data privacy vulnerability.

**Habit Horizon** solves this by establishing a **privacy-first, server-side guardrail** that sits between the client application and the LLM. It intercepts user inputs in real time, redacts PII (emails, phones, names), logs redaction audits, and proxies sanitized requests to high-speed Llama 3.3 models via Groq. The agent coordination maps natural language requests dynamically to distinct background managers—specifically, a file-backed **Horizon Planner** and a **Habit Engine**—while maintaining conversation history.

---

## 2. Agent Fleet Architecture & Roles
The application coordinates four specialized agents communicating via a REST API:

1. **HorizonRouter (Routing & Safeguard Agent):**
   - Serves as the primary entry point.
   - Detects user intent to determine whether a message is planning-related, habit-related, or general conversational.
   - Executes PII checks and routes requests to the correct background sub-service.
2. **HabitTracker (Habit Engine Agent):**
   - Manages daily streaks, consistency rates, completion logs, and habit listings.
   - Seeds role-appropriate tasks based on the user's active archetype.
3. **HorizonPlanner (Planning Agent):**
   - Coordinates calendar tasks across three scopes: Daily (timed slots), Weekly (day-column calendars), and Monthly (full calendar grid with activity dots).
4. **AITaskPlanner (Plan Generation Agent):**
   - Converts unstructured text task lists into actionable, prioritized plans using the LLM.
   - **Time-Aware Constraint Feature:** If the planning timeframe is 1 day and the target deadline is today, the planner dynamically queries the user's local system time and filters/schedules tasks only into remaining hours of the day, omitting past times.

---

## 3. Technology Stack & Data Storage
- **Frontend:** React, Vite, TypeScript, and Vanilla CSS with custom dynamic UI themes tailored to user archetypes (Student, Professional, Entrepreneur).
- **Backend:** Node.js, Express, TypeScript, and the Groq API (using the high-performance `llama-3.3-70b-versatile` model).
- **Data Persistence:**
  - **Server-Side Database:** Flat, file-based JSON storage in the `sandbox/` directory (`users.json`, `profile_{id}.json`, `habits_{id}.json`, and `planning_{id}.json`).
  - **Offline Caching:** Fallback client-side caching using `LocalStorage` handles session data if the backend server becomes temporarily unreachable.

---

## 4. Key Features & Visual Walkthrough
- **Privacy Guard Log Panel:** Side-by-side comparison illustrating exactly what was redacted (RAW message with original inputs vs SAFE message sent to the external API).
- **iOS-style Toggle Control:** Upgraded segmented control for seamless signup and login card animations.
- **Archetype-Themed UI:** The interface shifts theme colors (purple, blue, or orange) and seeds custom defaults depending on the user's profile role.
