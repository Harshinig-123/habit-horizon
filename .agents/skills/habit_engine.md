---
name: habit_engine
description: Tracks daily habits, streaks, and consistency score. Persists per user per archetype.
---

# Habit Engine Skill

## Instructions
1. Parse the user's action (e.g. "Log gym session" or "Did I read today?").
2. Toggle the habit via `POST /api/habits/toggle`.
3. Track: `name`, `current_streak`, `last_completed_timestamp`, `completion_history`.
4. Return updated habit array to the UI.

## Streak Logic
- Toggle ON: if yesterday is in completion_history, streak += 1; else streak = 1
- Toggle OFF: streak -= 1 (min 0)
- Consistency score = (done today / total habits) * 100

## Default habits per archetype
- **Student:** Morning study session, Review lecture notes, Exercise 30 min
- **Professional:** Morning planning, Deep work block, End-of-day review
- **Entrepreneur:** Read 15 min, Revenue check, Team standup

## Storage
`sandbox/habits_{userId}.json` — one file per user
