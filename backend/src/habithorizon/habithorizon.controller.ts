import { Request, Response } from 'express';
import { redactPII, detectArchetype, type Archetype } from '../utils/pii';
import * as service from './habithorizon.service';

// ── Groq API config ───────────────────────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile'; // updated replacement for decommissioned model

const SYSTEM_PROMPTS: Record<Archetype, string> = {
  Student:
    'You are a helpful Habit Horizon assistant for a student. Help with study plans, assignment management, exam prep, and healthy habits. Be encouraging and concise.',
  Professional:
    'You are a helpful Habit Horizon assistant for a working professional. Help with task prioritization, meeting prep, deep-work scheduling, and career habits. Be direct and efficient.',
  Entrepreneur:
    'You are a helpful Habit Horizon assistant for an entrepreneur. Help with sprint planning, investor readiness, team tasks, growth metrics, and founder well-being. Be energetic and action-oriented.',
};

async function callGroq(messages: { role: string; content: string }[], systemPrompt?: string, maxTokens: number = 2048): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured in .env');

  // Candidate models: prefer env var, then configured constant.
  const candidates = Array.from(new Set([
    process.env.GROQ_MODEL,
    GROQ_MODEL,
  ].filter(Boolean)));

  let lastErr: string | null = null;

  for (const model of candidates) {
    const body: any = {
      model,
      max_tokens: maxTokens,
      messages: systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages,
    };

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    if (res.ok) {
      try {
        const data = JSON.parse(text) as any;
        console.log(`Groq successful response using model ${model}`);
        return data.choices?.[0]?.message?.content ?? 'No response from model.';
      } catch (err: any) {
        throw new Error(`Groq response parse error for model ${model}: ${err.message || err}`);
      }
    }

    // Remember last error and only continue for model-related errors.
    lastErr = `model=${model} status=${res.status} body=${text}`;
    try {
      const parsed = JSON.parse(text);
      const code = parsed?.error?.code;
      if (code === 'model_decommissioned' || code === 'model_not_found') {
        console.warn(`Groq model ${model} unavailable: ${text}`);
        // try the next candidate
        continue;
      }
    } catch (e) {
      // ignore parse errors and fall through to throw below
    }

    throw new Error(`Groq API error for model ${model}: ${text}`);
  }

  throw new Error(`All Groq model attempts failed. Last error: ${lastErr}`);
}

// ── Profile ───────────────────────────────────────────────────────────────────

export function getProfile(req: Request, res: Response) {
  const { userId } = req.params;
  const profile = service.getProfile(userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
}

export async function signup(req: Request, res: Response) {
  const { username, password, displayName, archetype } = req.body as { username: string; password: string; displayName: string; archetype: Archetype };
  if (!username || !password || !displayName || !archetype) {
    return res.status(400).json({ error: 'username, password, displayName, and archetype are required' });
  }

  try {
    const user = service.createUserAccount(username, password, displayName, archetype);
    service.saveProfile(user.userId, user.displayName, user.archetype);
    res.json({ userId: user.userId, username: user.username, userName: user.displayName, archetype: user.archetype });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Unable to create user' });
  }
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const user = service.verifyUserCredentials(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  service.saveProfile(user.userId, user.displayName, user.archetype);
  res.json({ userId: user.userId, username: user.username, userName: user.displayName, archetype: user.archetype });
}

export function saveProfile(req: Request, res: Response) {
  const { userId, userName, archetype } = req.body as { userId: string; userName: string; archetype: Archetype };
  if (!userId || !archetype) return res.status(400).json({ error: 'userId and archetype are required' });
  service.saveProfile(userId, userName || 'You', archetype);
  service.updateUserProfile(userId, userName || 'You', archetype);
  res.json({ userId, userName: userName || 'You', archetype });
}

export function resetProfile(req: Request, res: Response) {
  const { userId } = req.params;
  service.saveProfile(userId, '', 'Student');
  service.updateUserProfile(userId, '', 'Student');
  res.json({ success: true });
}

// ── Habits ────────────────────────────────────────────────────────────────────

export function getHabits(req: Request, res: Response) {
  const { userId } = req.params;
  const { archetype = 'Student' } = req.query as { archetype?: Archetype };
  res.json(service.getHabits(userId, archetype));
}

export function toggleHabit(req: Request, res: Response) {
  const { userId, archetype, habitId } = req.body as { userId: string; archetype: Archetype; habitId: string };
  if (!userId || !habitId) return res.status(400).json({ error: 'userId and habitId are required' });
  res.json(service.toggleHabit(userId, archetype, habitId));
}

export function addHabit(req: Request, res: Response) {
  const { userId, archetype, name } = req.body as { userId: string; archetype: Archetype; name: string };
  if (!userId || !name) return res.status(400).json({ error: 'userId and name are required' });
  res.json(service.addHabit(userId, archetype, name));
}

export function deleteHabit(req: Request, res: Response) {
  const { userId, archetype, habitId } = req.body as { userId: string; archetype: Archetype; habitId: string };
  if (!userId || !habitId) return res.status(400).json({ error: 'userId and habitId are required' });
  res.json(service.deleteHabit(userId, archetype, habitId));
}

// ── Planning ──────────────────────────────────────────────────────────────────

export function getPlanning(req: Request, res: Response) {
  const { userId } = req.params;
  const { archetype = 'Student' } = req.query as { archetype?: Archetype };
  res.json(service.getPlanning(userId, archetype));
}

export function addTask(req: Request, res: Response) {
  const { userId, archetype, scope, task } = req.body as { userId: string; archetype: Archetype; scope: 'daily' | 'weekly' | 'monthly'; task: any };
  if (!userId || !scope || !task) return res.status(400).json({ error: 'userId, scope, and task are required' });
  res.json(service.addTask(userId, archetype, scope, task));
}

export function toggleTask(req: Request, res: Response) {
  const { userId, archetype, scope, taskId } = req.body as { userId: string; archetype: Archetype; scope: 'daily' | 'weekly' | 'monthly'; taskId: string };
  if (!userId || !scope || !taskId) return res.status(400).json({ error: 'userId, scope, and taskId are required' });
  res.json(service.toggleTask(userId, archetype, scope, taskId));
}

export function deleteTask(req: Request, res: Response) {
  const { userId, archetype, scope, taskId } = req.body as { userId: string; archetype: Archetype; scope: 'daily' | 'weekly' | 'monthly'; taskId: string };
  if (!userId || !scope || !taskId) return res.status(400).json({ error: 'userId, scope, and taskId are required' });
  res.json(service.deleteTask(userId, archetype, scope, taskId));
}

export function savePlanning(req: Request, res: Response) {
  const { userId, archetype, planning } = req.body as { userId: string; archetype: Archetype; planning: service.Planning };
  if (!userId || !planning) return res.status(400).json({ error: 'userId and planning are required' });
  res.json(service.savePlanning(userId, planning));
}

// ── AI Chat (Groq proxy with server-side PII stripping) ───────────────────────

export async function chat(req: Request, res: Response) {
  const { userId, archetype, message, history = [] } = req.body as {
    userId: string;
    archetype: Archetype;
    message: string;
    history: { role: string; content: string }[];
  };

  if (!message) return res.status(400).json({ error: 'message is required' });

  // Strip PII server-side before it ever reaches the AI
  const { sanitized, redactedEntities } = redactPII(message);
  const detected = detectArchetype(message);

  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: sanitized },
  ];

  try {
    const reply = await callGroq(messages, SYSTEM_PROMPTS[archetype] || SYSTEM_PROMPTS.Professional);
    res.json({
      reply,
      sanitizedMessage: sanitized,
      redactedEntities,
      detectedArchetype: detected,
      routedTo: detectRoute(message),
    });
  } catch (err: any) {
    console.error('Groq API error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to reach Groq API. Check your GROQ_API_KEY in .env' });
  }
}

// ── AI Plan Generation (Groq) ─────────────────────────────────────────────────

export async function generatePlan(req: Request, res: Response) {
  const { archetype, tasks, deadline, timeframe, localDate, localTime } = req.body as {
    archetype: Archetype;
    tasks: string;
    deadline?: string;
    timeframe: string;
    localDate?: string;
    localTime?: string;
  };

  if (!tasks) return res.status(400).json({ error: 'tasks are required' });

  let planningTimeRules = '';
  let todayInfo = '';
  if (localDate) {
    const todayName = new Date(localDate).toLocaleDateString('en-US', { weekday: 'long' });
    todayInfo = `Today is ${todayName}, ${localDate}.`;
  }

  if (deadline && localDate) {
    const start = new Date(localDate);
    const end = new Date(deadline);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (timeframe === '1 day' && localTime && deadline === localDate) {
        planningTimeRules = `\n- Since the timeframe is "1 day" and the deadline is today (${deadline}), you MUST only schedule tasks for the remaining time of the day starting from the present time: ${localTime}. Do not schedule tasks in the past.`;
      } else if (timeframe === '1 week' && diffDays >= 0 && diffDays < 7) {
        const allowedDays: string[] = [];
        const current = new Date(start);
        while (current <= end) {
          allowedDays.push(current.toLocaleDateString('en-US', { weekday: 'long' }));
          current.setDate(current.getDate() + 1);
        }
        planningTimeRules = `\n- Since the timeframe is "1 week" but the optional deadline is set to ${deadline} (which is in ${diffDays} days, less than 1 week away), you MUST plan according to the deadline date. For "weekly" scope, you can ONLY use the following day names: ${allowedDays.join(', ')}. Do not schedule any tasks on Saturday, Sunday, or other days beyond the deadline.`;
      } else if (timeframe === '1 month' && diffDays >= 0 && diffDays < 30) {
        planningTimeRules = `\n- Since the timeframe is "1 month" but the optional deadline is set to ${deadline} (which is in ${diffDays} days, less than 1 month away), you MUST plan according to the deadline date and only schedule tasks to be completed on or before the deadline date (${deadline}). Do not schedule any tasks after the deadline date.`;
      }
    }
  }

  const prompt = `You are a smart personal planner. The user is a ${archetype}.

Their task list:
${tasks}

${todayInfo}
Deadline: ${deadline || 'not specified'}
Timeframe: ${timeframe}

Generate a structured, realistic plan. Return ONLY valid JSON (no markdown, no explanation, no extra text) as an array of objects.
Each object must follow this structure depending on its scope:
- For "daily" scope: { "scope": "daily", "time": "HH:MM", "task": "description", "priority": "high/medium/low" }
- For "weekly" scope: { "scope": "weekly", "day": "Monday/Tuesday/etc.", "task": "description", "priority": "high/medium/low" }
- For "monthly" scope: { "scope": "monthly", "date": "YYYY-MM-DD", "task": "description", "priority": "high/medium/low" }

Rules:
- "priority" must be exactly "high", "medium", or "low"
- "scope" must be exactly "daily", "weekly", or "monthly"
- Break big tasks into smaller actionable subtasks
- Tailor recommendations to a ${archetype}'s workflow${planningTimeRules}
- Return ONLY the JSON array, nothing else`;

  try {
    const raw = await callGroq([{ role: 'user', content: prompt }], undefined, 4096);
    const clean = raw.replace(/```json|```/g, '').trim();
    // Find the JSON array in the response in case model adds text
    const match = clean.match(/\[[\s\S]*\]/);
    const plan = JSON.parse(match ? match[0] : clean);
    res.json({ plan });
  } catch (err: any) {
    console.error('Plan generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate plan. Check your GROQ_API_KEY in .env' });
  }
}

// ── Route detection helper ────────────────────────────────────────────────────

function detectRoute(message: string): 'HabitTracker' | 'HorizonPlanner' | 'HorizonRouter' {
  if (/habit|streak|log|did i|workout|exercise/i.test(message)) return 'HabitTracker';
  if (/schedule|todo|task|plan|sprint|milestone|checklist|deadline/i.test(message)) return 'HorizonPlanner';
  return 'HorizonRouter';
}
