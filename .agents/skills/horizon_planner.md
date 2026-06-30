---
name: horizon_planner
description: Multi-horizon planner with daily list, weekly grid, and monthly calendar.
---

# Horizon Planner Skill

## Instructions
1. Categorize tasks into three scopes: daily, weekly, monthly.
2. Daily: task list with optional time slot.
3. Weekly: 7-column Mon–Sun grid, tasks assigned to day index (0=Mon..6=Sun).
4. Monthly: calendar grid, tasks assigned to YYYY-MM-DD date strings.

## Archetype tailoring
- **Student:** Class schedules, assignment deadlines, exam prep, study blocks
- **Professional:** Meetings, sprints, deliverables, deep-work blocks, 1:1s
- **Entrepreneur:** Product sprints, investor updates, growth milestones, hiring tasks

## API Endpoints
- `GET  /api/planning/:userId?archetype=Student` — load planning data
- `POST /api/planning/save` — overwrite entire planning object
- `POST /api/planning/task/add` — add single task to a scope
- `POST /api/planning/task/toggle` — toggle task done/undone
- `POST /api/planning/task/delete` — remove task

## Storage
`sandbox/planning_{userId}.json` — one file per user
