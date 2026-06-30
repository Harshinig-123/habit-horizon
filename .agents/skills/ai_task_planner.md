---
name: ai_task_planner
description: Converts a free-form task list into a structured, prioritized plan using Claude.
---

# AI Task Planner Skill

## Instructions
1. Accept a raw list of tasks (one per line or comma-separated).
2. Accept a deadline (optional) and timeframe (1 day / 1 week / 1 month).
3. Call `POST /api/plan/generate` with the task list, deadline, timeframe, and archetype.
4. Backend calls Claude API with a structured prompt and returns a JSON plan array.
5. Render the plan with priority color coding: high=red, medium=orange, low=green.
6. On "Push to Planner", call `POST /api/planning/task/add` for each task.

## Output format
```json
[
  { "day": "Monday", "time": "09:00", "task": "Review pitch deck", "priority": "high", "scope": "daily" },
  { "day": "Wednesday", "time": "14:00", "task": "Send investor update", "priority": "medium", "scope": "weekly" }
]
```

## Priority levels
- **high** — urgent, blocks other tasks
- **medium** — important but flexible
- **low** — nice to have, can be deferred
