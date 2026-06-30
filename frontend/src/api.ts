/**
 * API client — all calls go through the Express backend.
 * Falls back to localStorage if the backend is not running (offline mode).
 */

import type { Archetype } from './App';

const BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

const get  = <T>(path: string) => req<T>('GET', path);
const post = <T>(path: string, body: unknown) => req<T>('POST', path, body);

// ── Profile ───────────────────────────────────────────────────────────────────
export const api = {
  signup: (username: string, password: string, displayName: string, archetype: Archetype) =>
    post<any>('/auth/signup', { username, password, displayName, archetype }),
  login: (username: string, password: string) =>
    post<any>('/auth/login', { username, password }),
  getProfile: (userId: string) => get<any>(`/profile/${userId}`),
  saveProfile: (userId: string, userName: string, archetype: Archetype) =>
    post<any>('/profile', { userId, userName, archetype }),
  resetProfile: (userId: string) => post<any>(`/profile/${userId}/reset`, {}),

  // ── Habits ──────────────────────────────────────────────────────────────────
  getHabits: (userId: string, archetype: Archetype) =>
    get<any[]>(`/habits/${userId}?archetype=${archetype}`),
  toggleHabit: (userId: string, archetype: Archetype, habitId: string) =>
    post<any[]>('/habits/toggle', { userId, archetype, habitId }),
  addHabit: (userId: string, archetype: Archetype, name: string) =>
    post<any[]>('/habits/add', { userId, archetype, name }),
  deleteHabit: (userId: string, archetype: Archetype, habitId: string) =>
    post<any[]>('/habits/delete', { userId, archetype, habitId }),

  // ── Planning ─────────────────────────────────────────────────────────────────
  getPlanning: (userId: string, archetype: Archetype) =>
    get<any>(`/planning/${userId}?archetype=${archetype}`),
  savePlanning: (userId: string, archetype: Archetype, planning: any) =>
    post<any>('/planning/save', { userId, archetype, planning }),
  addTask: (userId: string, archetype: Archetype, scope: string, task: any) =>
    post<any>('/planning/task/add', { userId, archetype, scope, task }),
  toggleTask: (userId: string, archetype: Archetype, scope: string, taskId: string) =>
    post<any>('/planning/task/toggle', { userId, archetype, scope, taskId }),
  deleteTask: (userId: string, archetype: Archetype, scope: string, taskId: string) =>
    post<any>('/planning/task/delete', { userId, archetype, scope, taskId }),

  // ── AI Chat ──────────────────────────────────────────────────────────────────
  chat: (userId: string, archetype: Archetype, message: string, history: any[]) =>
    post<any>('/chat', { userId, archetype, message, history }),

  // ── AI Plan Generation ────────────────────────────────────────────────────────
  generatePlan: (archetype: Archetype, tasks: string, deadline: string, timeframe: string, localDate?: string, localTime?: string) =>
    post<{ plan: any[] }>('/plan/generate', { archetype, tasks, deadline, timeframe, localDate, localTime }),
};
