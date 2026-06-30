import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Archetype } from '../utils/pii';

export interface AuthUser {
  userId: string;
  username: string;
  passwordHash: string;
  displayName: string;
  archetype: Archetype;
  created_at: string;
  updated_at: string;
}

const SANDBOX_DIR = path.resolve(__dirname, '../../../sandbox');
const USERS_FILE = path.resolve(SANDBOX_DIR, 'users.json');

function hashPassword(password: string, username: string) {
  return crypto
    .createHmac('sha256', 'habit_horizon_secret')
    .update(`${username.toLowerCase()}:${password}`)
    .digest('hex');
}

function readUsers(): AuthUser[] {
  ensureDir();
  return readJson<AuthUser[]>(USERS_FILE, []);
}

function saveUsers(users: AuthUser[]): AuthUser[] {
  ensureDir();
  writeJson(USERS_FILE, users);
  return users;
}

export function findUserByUsername(username: string): AuthUser | null {
  const users = readUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export function getUserAccount(userId: string): AuthUser | null {
  const users = readUsers();
  return users.find(u => u.userId === userId) ?? null;
}

export function createUserAccount(username: string, password: string, displayName: string, archetype: Archetype): AuthUser {
  if (findUserByUsername(username)) {
    throw new Error('Username already taken');
  }

  const userId = `user_${Date.now()}`;
  const now = new Date().toISOString();
  const user: AuthUser = {
    userId,
    username,
    passwordHash: hashPassword(password, username),
    displayName: displayName.trim() || username,
    archetype,
    created_at: now,
    updated_at: now,
  };

  const users = readUsers();
  saveUsers([...users, user]);
  return user;
}

export function verifyUserCredentials(username: string, password: string): AuthUser | null {
  const user = findUserByUsername(username);
  if (!user) return null;
  return user.passwordHash === hashPassword(password, username) ? user : null;
}

export function updateUserProfile(userId: string, displayName: string, archetype: Archetype): AuthUser | null {
  const users = readUsers();
  const idx = users.findIndex(u => u.userId === userId);
  if (idx === -1) return null;
  users[idx] = {
    ...users[idx],
    displayName: displayName.trim() || users[idx].displayName,
    archetype,
    updated_at: new Date().toISOString(),
  };
  saveUsers(users);
  return users[idx];
}

export interface Habit {
  id: string;
  name: string;
  current_streak: number;
  last_completed_timestamp: string | null;
  completion_history: string[]; // YYYY-MM-DD
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  time?: string;
  day?: number;
  date?: string;
  archetype: string;
}

export interface Planning {
  daily: Task[];
  weekly: Task[];
  monthly: Task[];
}

export interface UserProfile {
  userId: string;
  userName: string;
  archetype: Archetype;
  updated_at: string;
}


function ensureDir() {
  if (!fs.existsSync(SANDBOX_DIR)) fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Profile ──────────────────────────────────────────────────────────────────

export function getProfile(userId: string): UserProfile | null {
  ensureDir();
  const p = path.join(SANDBOX_DIR, `profile_${userId}.json`);
  return readJson<UserProfile | null>(p, null);
}

export function saveProfile(userId: string, userName: string, archetype: Archetype): UserProfile {
  ensureDir();
  const profile: UserProfile = { userId, userName, archetype, updated_at: new Date().toISOString() };
  writeJson(path.join(SANDBOX_DIR, `profile_${userId}.json`), profile);
  return profile;
}

// ── Habits ────────────────────────────────────────────────────────────────────

const DEFAULT_HABITS: Record<Archetype, string[]> = {
  Student:      ['Morning study session', 'Review lecture notes', 'Exercise 30 min'],
  Professional: ['Morning planning', 'Deep work block', 'End-of-day review'],
  Entrepreneur: ['Read 15 min', 'Revenue check', 'Team standup'],
};

export function getHabits(userId: string, archetype: Archetype): Habit[] {
  ensureDir();
  const p = path.join(SANDBOX_DIR, `habits_${userId}.json`);
  if (!fs.existsSync(p)) {
    const defaults = DEFAULT_HABITS[archetype].map((name, i) => ({
      id: `h${i}`,
      name,
      current_streak: 0,
      last_completed_timestamp: null,
      completion_history: [],
    }));
    writeJson(p, defaults);
    return defaults;
  }
  return readJson<Habit[]>(p, []);
}

export function saveHabits(userId: string, habits: Habit[]): Habit[] {
  ensureDir();
  writeJson(path.join(SANDBOX_DIR, `habits_${userId}.json`), habits);
  return habits;
}

export function toggleHabit(userId: string, archetype: Archetype, habitId: string): Habit[] {
  const habits = getHabits(userId, archetype);
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const updated = habits.map(h => {
    if (h.id !== habitId) return h;
    const done = h.completion_history.includes(today);
    if (done) {
      // Uncheck
      return {
        ...h,
        completion_history: h.completion_history.filter(d => d !== today),
        current_streak: Math.max(0, h.current_streak - 1),
        last_completed_timestamp: null,
      };
    } else {
      // Check
      const wasYesterday = h.completion_history.includes(yesterday);
      const newStreak = (wasYesterday || h.current_streak === 0) ? h.current_streak + 1 : 1;
      return {
        ...h,
        completion_history: [...h.completion_history, today],
        current_streak: newStreak,
        last_completed_timestamp: new Date().toISOString(),
      };
    }
  });

  return saveHabits(userId, updated);
}

export function addHabit(userId: string, archetype: Archetype, name: string): Habit[] {
  const habits = getHabits(userId, archetype);
  const newHabit: Habit = {
    id: `h${Date.now()}`,
    name,
    current_streak: 0,
    last_completed_timestamp: null,
    completion_history: [],
  };
  return saveHabits(userId, [...habits, newHabit]);
}

export function deleteHabit(userId: string, archetype: Archetype, habitId: string): Habit[] {
  const habits = getHabits(userId, archetype);
  return saveHabits(userId, habits.filter(h => h.id !== habitId));
}

// ── Planning ──────────────────────────────────────────────────────────────────

const SEED_TASKS: Record<Archetype, Planning> = {
  Student: {
    daily: [
      { id: 'task-d-s1', title: 'Attend CS101 Lecture', done: false, archetype: 'Student', time: '09:00' },
      { id: 'task-d-s2', title: 'Study Group Meetup', done: false, archetype: 'Student', time: '14:00' },
    ],
    weekly: [
      { id: 'task-w-s1', title: 'Complete OS assignment', done: false, archetype: 'Student', day: 0 },
      { id: 'task-w-s2', title: 'Weekend retro & planning', done: false, archetype: 'Student', day: 5 },
    ],
    monthly: [
      { id: 'task-m-s1', title: 'Prepare for Mid-Term Exams', done: false, archetype: 'Student' },
      { id: 'task-m-s2', title: 'Apply for summer internships', done: false, archetype: 'Student' },
    ],
  },
  Professional: {
    daily: [
      { id: 'task-d-p1', title: 'Daily Standup Sync', done: false, archetype: 'Professional', time: '10:00' },
      { id: 'task-d-p2', title: 'Focus Block: Core Dev Work', done: false, archetype: 'Professional', time: '11:00' },
    ],
    weekly: [
      { id: 'task-w-p1', title: 'Deliver Sprint deliverables', done: false, archetype: 'Professional', day: 4 },
      { id: 'task-w-p2', title: 'Run team retrospective', done: false, archetype: 'Professional', day: 4 },
    ],
    monthly: [
      { id: 'task-m-p1', title: 'Q3 Product Roadmap Review', done: false, archetype: 'Professional' },
      { id: 'task-m-p2', title: 'Schedule professional development check-in', done: false, archetype: 'Professional' },
    ],
  },
  Entrepreneur: {
    daily: [
      { id: 'task-d-e1', title: 'Review Pitch Deck', done: false, archetype: 'Entrepreneur', time: '09:30' },
      { id: 'task-d-e2', title: 'Engineering Sprint Review', done: false, archetype: 'Entrepreneur', time: '11:00' },
    ],
    weekly: [
      { id: 'task-w-e1', title: 'Launch beta product release', done: false, archetype: 'Entrepreneur', day: 3 },
      { id: 'task-w-e2', title: 'Send weekly investor update', done: false, archetype: 'Entrepreneur', day: 4 },
    ],
    monthly: [
      { id: 'task-m-e1', title: 'Secure Seed Round Commitment', done: false, archetype: 'Entrepreneur' },
      { id: 'task-m-e2', title: 'Recruit and onboard core hires', done: false, archetype: 'Entrepreneur' },
    ],
  },
};

export function getPlanning(userId: string, archetype: Archetype): Planning {
  ensureDir();
  const p = path.join(SANDBOX_DIR, `planning_${userId}.json`);
  if (!fs.existsSync(p)) {
    const seed = SEED_TASKS[archetype];
    writeJson(p, seed);
    return seed;
  }
  return readJson<Planning>(p, { daily: [], weekly: [], monthly: [] });
}

export function savePlanning(userId: string, planning: Planning): Planning {
  ensureDir();
  writeJson(path.join(SANDBOX_DIR, `planning_${userId}.json`), planning);
  return planning;
}

export function addTask(userId: string, archetype: Archetype, scope: 'daily' | 'weekly' | 'monthly', task: Omit<Task, 'id'>): Planning {
  const planning = getPlanning(userId, archetype);
  const newTask: Task = { ...task, id: `t${Date.now()}` };
  planning[scope] = [...planning[scope], newTask];
  return savePlanning(userId, planning);
}

export function toggleTask(userId: string, archetype: Archetype, scope: 'daily' | 'weekly' | 'monthly', taskId: string): Planning {
  const planning = getPlanning(userId, archetype);
  planning[scope] = planning[scope].map(t => t.id === taskId ? { ...t, done: !t.done } : t);
  return savePlanning(userId, planning);
}

export function deleteTask(userId: string, archetype: Archetype, scope: 'daily' | 'weekly' | 'monthly', taskId: string): Planning {
  const planning = getPlanning(userId, archetype);
  planning[scope] = planning[scope].filter(t => t.id !== taskId);
  return savePlanning(userId, planning);
}
