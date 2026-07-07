import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Archetype } from '../utils/pii';
import { MongoClient, Db } from 'mongodb';

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

// ── MongoDB client connection ──────────────────────────────────────────────────
let mongoClient: MongoClient | null = null;
let db: Db | null = null;

async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (db) return db;

  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    db = mongoClient.db();
    console.log('Connected to MongoDB successfully');
    return db;
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    return null;
  }
}

function hashPassword(password: string, username: string) {
  return crypto
    .createHmac('sha256', 'habit_horizon_secret')
    .update(`${username.toLowerCase()}:${password}`)
    .digest('hex');
}

async function readUsers(): Promise<AuthUser[]> {
  const database = await getDb();
  if (database) {
    try {
      return await database.collection<AuthUser>('users').find({}).toArray();
    } catch (err) {
      console.error('Failed to read users from MongoDB:', err);
    }
  }
  ensureDir();
  return readJson<AuthUser[]>(USERS_FILE, []);
}

async function saveUsers(users: AuthUser[]): Promise<AuthUser[]> {
  const database = await getDb();
  if (database) {
    try {
      const col = database.collection<AuthUser>('users');
      // Upsert each user in the array
      for (const user of users) {
        await col.replaceOne({ userId: user.userId }, user, { upsert: true });
      }
      // Delete users that are no longer in the list
      const userIds = users.map(u => u.userId);
      await col.deleteMany({ userId: { $nin: userIds } });
      return users;
    } catch (err) {
      console.error('Failed to save users to MongoDB:', err);
    }
  }
  ensureDir();
  writeJson(USERS_FILE, users);
  return users;
}

export async function findUserByUsername(username: string): Promise<AuthUser | null> {
  const database = await getDb();
  if (database) {
    try {
      return await database.collection<AuthUser>('users').findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    } catch (err) {
      console.error('Failed to find user by username in MongoDB:', err);
    }
  }
  const users = await readUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export async function getUserAccount(userId: string): Promise<AuthUser | null> {
  const database = await getDb();
  if (database) {
    try {
      return await database.collection<AuthUser>('users').findOne({ userId });
    } catch (err) {
      console.error('Failed to get user account in MongoDB:', err);
    }
  }
  const users = await readUsers();
  return users.find(u => u.userId === userId) ?? null;
}

export async function createUserAccount(username: string, password: string, displayName: string, archetype: Archetype): Promise<AuthUser> {
  if (await findUserByUsername(username)) {
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

  const database = await getDb();
  if (database) {
    try {
      await database.collection<AuthUser>('users').insertOne(user);
      return user;
    } catch (err) {
      console.error('Failed to create user in MongoDB:', err);
    }
  }

  const users = await readUsers();
  await saveUsers([...users, user]);
  return user;
}

export async function verifyUserCredentials(username: string, password: string): Promise<AuthUser | null> {
  const user = await findUserByUsername(username);
  if (!user) return null;
  return user.passwordHash === hashPassword(password, username) ? user : null;
}

export async function updateUserProfile(userId: string, displayName: string, archetype: Archetype): Promise<AuthUser | null> {
  const database = await getDb();
  if (database) {
    try {
      const col = database.collection<AuthUser>('users');
      await col.updateOne(
        { userId },
        { $set: { displayName: displayName.trim(), archetype, updated_at: new Date().toISOString() } }
      );
      return await col.findOne({ userId });
    } catch (err) {
      console.error('Failed to update user profile in MongoDB:', err);
    }
  }
  const users = await readUsers();
  const idx = users.findIndex(u => u.userId === userId);
  if (idx === -1) return null;
  users[idx] = {
    ...users[idx],
    displayName: displayName.trim() || users[idx].displayName,
    archetype,
    updated_at: new Date().toISOString(),
  };
  await saveUsers(users);
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

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const database = await getDb();
  if (database) {
    try {
      return await database.collection<UserProfile>('profiles').findOne({ userId });
    } catch (err) {
      console.error('Failed to get profile from MongoDB:', err);
    }
  }
  ensureDir();
  const p = path.join(SANDBOX_DIR, `profile_${userId}.json`);
  return readJson<UserProfile | null>(p, null);
}

export async function saveProfile(userId: string, userName: string, archetype: Archetype): Promise<UserProfile> {
  const profile: UserProfile = { userId, userName, archetype, updated_at: new Date().toISOString() };
  const database = await getDb();
  if (database) {
    try {
      await database.collection<UserProfile>('profiles').replaceOne({ userId }, profile, { upsert: true });
      return profile;
    } catch (err) {
      console.error('Failed to save profile to MongoDB:', err);
    }
  }
  ensureDir();
  writeJson(path.join(SANDBOX_DIR, `profile_${userId}.json`), profile);
  return profile;
}

// ── Habits ────────────────────────────────────────────────────────────────────

const DEFAULT_HABITS: Record<Archetype, string[]> = {
  Student:      ['Morning study session', 'Review lecture notes', 'Exercise 30 min'],
  Professional: ['Morning planning', 'Deep work block', 'End-of-day review'],
  Entrepreneur: ['Read 15 min', 'Revenue check', 'Team standup'],
};

export async function getHabits(userId: string, archetype: Archetype): Promise<Habit[]> {
  const database = await getDb();
  if (database) {
    try {
      const doc = await database.collection<{ userId: string; habits: Habit[] }>('habits').findOne({ userId });
      if (doc && doc.habits) {
        return doc.habits;
      }
      const defaults = DEFAULT_HABITS[archetype].map((name, i) => ({
        id: `h${i}`,
        name,
        current_streak: 0,
        last_completed_timestamp: null,
        completion_history: [],
      }));
      await database.collection<{ userId: string; habits: Habit[] }>('habits').insertOne({ userId, habits: defaults });
      return defaults;
    } catch (err) {
      console.error('Failed to get habits from MongoDB:', err);
    }
  }

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

export async function saveHabits(userId: string, habits: Habit[]): Promise<Habit[]> {
  const database = await getDb();
  if (database) {
    try {
      await database.collection<{ userId: string; habits: Habit[] }>('habits').replaceOne(
        { userId },
        { userId, habits },
        { upsert: true }
      );
      return habits;
    } catch (err) {
      console.error('Failed to save habits to MongoDB:', err);
    }
  }
  ensureDir();
  writeJson(path.join(SANDBOX_DIR, `habits_${userId}.json`), habits);
  return habits;
}

export async function toggleHabit(userId: string, archetype: Archetype, habitId: string): Promise<Habit[]> {
  const habits = await getHabits(userId, archetype);
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

  return await saveHabits(userId, updated);
}

export async function addHabit(userId: string, archetype: Archetype, name: string): Promise<Habit[]> {
  const habits = await getHabits(userId, archetype);
  const newHabit: Habit = {
    id: `h${Date.now()}`,
    name,
    current_streak: 0,
    last_completed_timestamp: null,
    completion_history: [],
  };
  return await saveHabits(userId, [...habits, newHabit]);
}

export async function deleteHabit(userId: string, archetype: Archetype, habitId: string): Promise<Habit[]> {
  const habits = await getHabits(userId, archetype);
  return await saveHabits(userId, habits.filter(h => h.id !== habitId));
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

export async function getPlanning(userId: string, archetype: Archetype): Promise<Planning> {
  const database = await getDb();
  if (database) {
    try {
      const doc = await database.collection<{ userId: string; planning: Planning }>('planning').findOne({ userId });
      if (doc && doc.planning) {
        return doc.planning;
      }
      const seed = SEED_TASKS[archetype];
      await database.collection<{ userId: string; planning: Planning }>('planning').insertOne({ userId, planning: seed });
      return seed;
    } catch (err) {
      console.error('Failed to get planning from MongoDB:', err);
    }
  }

  ensureDir();
  const p = path.join(SANDBOX_DIR, `planning_${userId}.json`);
  if (!fs.existsSync(p)) {
    const seed = SEED_TASKS[archetype];
    writeJson(p, seed);
    return seed;
  }
  return readJson<Planning>(p, { daily: [], weekly: [], monthly: [] });
}

export async function savePlanning(userId: string, planning: Planning): Promise<Planning> {
  const database = await getDb();
  if (database) {
    try {
      await database.collection<{ userId: string; planning: Planning }>('planning').replaceOne(
        { userId },
        { userId, planning },
        { upsert: true }
      );
      return planning;
    } catch (err) {
      console.error('Failed to save planning to MongoDB:', err);
    }
  }

  ensureDir();
  writeJson(path.join(SANDBOX_DIR, `planning_${userId}.json`), planning);
  return planning;
}

export async function addTask(userId: string, archetype: Archetype, scope: 'daily' | 'weekly' | 'monthly', task: Omit<Task, 'id'>): Promise<Planning> {
  const planning = await getPlanning(userId, archetype);
  const newTask: Task = { ...task, id: `t${Date.now()}` };
  planning[scope] = [...planning[scope], newTask];
  return await savePlanning(userId, planning);
}

export async function toggleTask(userId: string, archetype: Archetype, scope: 'daily' | 'weekly' | 'monthly', taskId: string): Promise<Planning> {
  const planning = await getPlanning(userId, archetype);
  planning[scope] = planning[scope].map(t => t.id === taskId ? { ...t, done: !t.done } : t);
  return await savePlanning(userId, planning);
}

export async function deleteTask(userId: string, archetype: Archetype, scope: 'daily' | 'weekly' | 'monthly', taskId: string): Promise<Planning> {
  const planning = await getPlanning(userId, archetype);
  planning[scope] = planning[scope].filter(t => t.id !== taskId);
  return await savePlanning(userId, planning);
}
