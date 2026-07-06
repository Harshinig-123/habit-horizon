import { useState } from 'react';
import { Wand2, Plus, CalendarCheck, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Archetype } from '../App';
import { api } from '../api';

interface PlannedTask { day: string; date?: string; time?: string; task: string; priority: 'high' | 'medium' | 'low'; scope: 'daily' | 'weekly' | 'monthly'; }

const PC = {
  high:   { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  medium: { bg: '#fff7ed', color: '#ea580c', border: '#fdba74' },
  low:    { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
};

async function callGroqForPlan(
  archetype: Archetype,
  tasks: string,
  deadline: string,
  timeframe: string,
  apiKey: string,
  localDate?: string,
  localTime?: string
): Promise<PlannedTask[]> {
  let planningTimeRules = '';
  if (timeframe === '1 day' && deadline && localDate && localTime) {
    if (deadline === localDate) {
      planningTimeRules = `\nSince the timeframe is "1 day" and the deadline is today (${deadline}), you MUST only schedule tasks for the remaining time of the day starting from the present time: ${localTime}. Do not schedule tasks in the past.`;
    }
  }
  const prompt = `You are a smart personal planner for a ${archetype}.\nTasks:\n${tasks}\nDeadline: ${deadline || 'not specified'}\nTimeframe: ${timeframe}\nReturn ONLY a valid JSON array (no markdown, no explanation):\n[{"day":"Monday","time":"09:00","task":"...","priority":"high","scope":"daily"}]\npriority must be high/medium/low, scope must be daily/weekly/monthly.${planningTimeRules}`;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  const data = await res.json() as any;
  const text = data.choices?.[0]?.message?.content ?? '[]';
  const clean = text.replace(/```json|```/g, '').trim();
  const match = clean.match(/\[[\s\S]*\]/);
  return JSON.parse(match ? match[0] : clean);
}

export default function AITaskPlanner({ archetype, userId }: { archetype: Archetype; userId: string }) {
  const [taskInput, setTaskInput]   = useState('');
  const [deadline, setDeadline]     = useState('');
  const [timeframe, setTimeframe]   = useState<'1 day' | '1 week' | '1 month'>('1 week');
  const [loading, setLoading]       = useState(false);
  const [plan, setPlan]             = useState<PlannedTask[] | null>(null);
  const [pushed, setPushed]         = useState(false);
  const [expanded, setExpanded]     = useState(true);
  const [error, setError]           = useState('');

  const generate = async () => {
    if (!taskInput.trim()) return;
    setLoading(true); setError(''); setPlan(null); setPushed(false);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const localDate = `${year}-${month}-${date}`;
    const localTime = `${hours}:${minutes}`;

    try {
      // Primary: backend (Groq key stays on server)
      const { plan: p } = await api.generatePlan(archetype, taskInput, deadline, timeframe, localDate, localTime);
      setPlan(p);
    } catch {
      // Fallback: call Groq directly from browser
      const storedKey = localStorage.getItem('ca_groq_key') || '';
      if (storedKey) {
        try {
          const p = await callGroqForPlan(archetype, taskInput, deadline, timeframe, storedKey, localDate, localTime);
          setPlan(p);
        } catch {
          setError('Could not generate plan. Check that the backend is running and GROQ_API_KEY is set in .env');
        }
      } else {
        setError('Backend is not running. Start it with `npm run dev` in the backend folder.');
      }
    } finally { setLoading(false); }
  };

  const pushToPlanner = async () => {
    if (!plan) return;

    const DAY_MAP: Record<string, number> = {
      monday: 0, mon: 0,
      tuesday: 1, tue: 1,
      wednesday: 2, wed: 2,
      thursday: 3, thu: 3,
      friday: 4, fri: 4,
      saturday: 5, sat: 5,
      sunday: 6, sun: 6
    };

    for (const p of plan) {
      const task: any = {
        title: `${p.task}${p.time ? ` (${p.time})` : ''}`,
        done: false,
        archetype,
        ...(p.time ? { time: p.time } : {})
      };

      if (p.scope === 'weekly' && p.day) {
        const dayLower = String(p.day).toLowerCase();
        task.day = DAY_MAP[dayLower] !== undefined ? DAY_MAP[dayLower] : 0;
      } else if (p.scope === 'monthly') {
        const dateVal = p.date || p.day;
        if (dateVal) task.date = dateVal;
      }

      try {
        await api.addTask(userId, archetype, p.scope, task);
      } catch {
        const key = `ca_planning_${archetype}`;
        const saved = localStorage.getItem(key);
        const planning = saved ? JSON.parse(saved) : { daily: [], weekly: [], monthly: [] };
        planning[p.scope] = [...(planning[p.scope] || []), { id: `ai_${Date.now()}_${Math.random().toString(36).slice(2)}`, ...task }];
        localStorage.setItem(key, JSON.stringify(planning));
      }
    }
    setPushed(true);
    window.dispatchEvent(new CustomEvent('ca_planning_updated'));
  };

  const PLACEHOLDERS: Record<Archetype, string> = {
    Student:      'e.g.\nFinish OS assignment\nStudy for ML exam\nRead 2 chapters of distributed systems',
    Professional: 'e.g.\nPrepare Q3 report\nSchedule 1:1s with team\nReview and merge PRs',
    Entrepreneur: 'e.g.\nDraft investor deck\nShip landing page v2\nHire backend developer',
  };

  return (
    <div className="card animate-fade-up">
      {/* Collapsible header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div className="section-title" style={{ fontSize: '1.05rem' }}>
          <Wand2 size={17} style={{ color: 'var(--primary)' }} /> AI Task Planner
          <span className="pill" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>Groq · Llama 3</span>
        </div>
        {expanded ? <ChevronUp size={17} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={17} style={{ color: 'var(--text-muted)' }} />}
      </div>

      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '-0.5rem' }}>
            Paste your task list → set a deadline → get a full AI plan → push it straight into your planner.
          </p>

          {/* Task input */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
              Your tasks (one per line)
            </label>
            <textarea className="input" rows={4} placeholder={PLACEHOLDERS[archetype]}
              value={taskInput} onChange={e => setTaskInput(e.target.value)} />
          </div>

          {/* Deadline + timeframe */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Deadline (optional)</label>
              <input type="date" className="input" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Plan over</label>
              <select className="select input" value={timeframe} onChange={e => setTimeframe(e.target.value as any)} style={{ width: '100%' }}>
                <option value="1 day">1 Day</option>
                <option value="1 week">1 Week</option>
                <option value="1 month">1 Month</option>
              </select>
            </div>
          </div>

          <button className="btn-primary" onClick={generate} disabled={loading || !taskInput.trim()} style={{ alignSelf: 'flex-start' }}>
            {loading
              ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Generating plan…</>
              : <><Wand2 size={15} /> Generate Plan</>}
          </button>

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.83rem' }}>
              {error}
            </div>
          )}

          {/* Generated plan */}
          {plan && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>
                  ✨ Your {timeframe} Plan — {plan.length} tasks
                </span>
                {!pushed
                  ? <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '7px 14px' }} onClick={pushToPlanner}><Plus size={13} /> Push to Planner</button>
                  : <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--success)', fontSize: '0.82rem', fontWeight: 600 }}><CalendarCheck size={14} /> Added to Planner!</span>
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '320px', overflowY: 'auto' }}>
                {plan.map((p, i) => {
                  const pc = PC[p.priority] ?? PC.medium;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', background: pc.bg, border: `1px solid ${pc.border}`, borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                      <div style={{ minWidth: 70 }}>
                        <div style={{ fontWeight: 700, color: pc.color, fontSize: '0.7rem' }}>{p.day}</div>
                        {p.time && <div style={{ color: pc.color, opacity: 0.7, fontSize: '0.68rem' }}>{p.time}</div>}
                      </div>
                      <div style={{ flex: 1, color: '#1f2937' }}>{p.task}</div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: pc.border, color: pc.color, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {p.priority}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
