import { useState, useRef, useEffect } from 'react';
import { Send, Terminal, User, Shield, ShieldCheck, RefreshCw, Bot } from 'lucide-react';
import type { Archetype } from '../App';
import { api } from '../api';

interface Msg { id: string; role: 'user' | 'assistant'; text: string; }
interface PiiLog { ts: string; original: string; sanitized: string; entities: { type: string; value: string }[]; }

const WELCOME: Record<Archetype, string> = {
  Student: "Hey! I'm your study coach on Habit Horizon. Tell me what's on your plate — exams, assignments, or habits — and I'll help you tackle it.",
  Professional: "Hi! I'm your work companion on Habit Horizon. Share today's priorities or anything you're trying to get done and I'll help you structure it.",
  Entrepreneur: "Hey! I'm your founder coach on Habit Horizon. Drop your tasks, goals, or blockers and I'll help you move fast.",
};

const SYSTEM_PROMPTS: Record<Archetype, string> = {
  Student: 'You are a helpful Habit Horizon assistant for a student. Help with study plans, assignments, exam prep, and habits. Be encouraging and concise.',
  Professional: 'You are a helpful Habit Horizon assistant for a working professional. Help with task prioritization, meetings, deep-work, and career habits. Be direct and efficient.',
  Entrepreneur: 'You are a helpful Habit Horizon assistant for an entrepreneur. Help with sprints, investor tasks, growth metrics, and founder habits. Be energetic and action-oriented.',
};

const CHIPS: Record<Archetype, string[]> = {
  Student:      ['Plan my study session', 'Help with exam prep', 'Set weekly goals', 'Review my habits'],
  Professional: ['Plan my workday', 'Prioritize my tasks', 'Deep work schedule', 'Weekly review'],
  Entrepreneur: ['Plan my sprint', 'Investor pitch prep', 'Team task breakdown', 'Focus on growth'],
};

async function callGroqDirect(messages: { role: string; content: string }[], archetype: Archetype, apiKey: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [{ role: 'system', content: SYSTEM_PROMPTS[archetype] }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content ?? 'No response.';
}

export default function HabitHorizonChat({ archetype, userName, userId }: { archetype: Archetype; userName: string; userId: string }) {
  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [piiLogs, setPiiLogs] = useState<PiiLog[]>([]);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([{ id: 'welcome', role: 'assistant', text: WELCOME[archetype] }]);
    setHistory([]); setPiiLogs([]);
  }, [archetype]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = async (text?: string) => {
    const raw = (text ?? input).trim();
    if (!raw) return;
    setInput('');
    const userMsg: Msg = { id: `u${Date.now()}`, role: 'user', text: raw };
    setMsgs(prev => [...prev, userMsg]);
    setLoading(true);
    const newHistory = [...history, { role: 'user', content: raw }];
    setHistory(newHistory);

    try {
      // Primary: call backend (handles PII stripping server-side)
      const data = await api.chat(userId, archetype, raw, history);
      if (data.redactedEntities?.length > 0) {
        setPiiLogs(prev => [{ ts: new Date().toLocaleTimeString(), original: raw, sanitized: data.sanitizedMessage, entities: data.redactedEntities }, ...prev]);
      }
      const asstMsg: Msg = { id: `a${Date.now()}`, role: 'assistant', text: data.reply };
      setMsgs(prev => [...prev, asstMsg]);
      setHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      // Fallback: call Groq directly from browser if backend is down
      const storedKey = localStorage.getItem('ca_groq_key') || '';
      if (storedKey) {
        try {
          const reply = await callGroqDirect(newHistory, archetype, storedKey);
          setMsgs(prev => [...prev, { id: `a${Date.now()}`, role: 'assistant', text: reply }]);
          setHistory(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch {
          setMsgs(prev => [...prev, { id: `err${Date.now()}`, role: 'assistant', text: '❌ Could not reach backend or Groq. Check that the backend is running and GROQ_API_KEY is set in .env' }]);
        }
      } else {
        setMsgs(prev => [...prev, { id: `err${Date.now()}`, role: 'assistant', text: '⚠️ Backend is not running. Start it with `npm run dev` in the backend folder.' }]);
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="chat-wrap">
      <div className="card chat-panel">
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '0.9rem' }}>
            <Bot size={16} style={{ color: 'var(--primary)' }} /> Habit Horizon AI <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>powered by Groq · Llama 3</span>
          </div>
          <button className="btn-ghost" onClick={() => { setMsgs([{ id: 'welcome', role: 'assistant', text: WELCOME[archetype] }]); setHistory([]); }}>
            <RefreshCw size={12} /> Reset
          </button>
        </div>
        <div className="chat-messages">
          {msgs.map(m => (
            <div key={m.id} className={`bubble ${m.role}`}>
              <div className="bubble-label">
                {m.role === 'user' ? <><User size={10} /> {userName || 'You'}</> : <><Terminal size={10} /> Horizon AI</>}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          ))}
          {loading && <div className="bubble assistant" style={{ fontStyle: 'italic', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '8px' }}><span className="spinner" /> Thinking…</div>}
          <div ref={endRef} />
        </div>
        <div className="quick-chips">
          {CHIPS[archetype].map(c => <span key={c} className="chip" onClick={() => send(c)}>{c}</span>)}
        </div>
        <div className="chat-input-row">
          <input className="input" placeholder="Ask Habit Horizon anything…" value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && send()} disabled={loading} />
          <button className="btn-primary" onClick={() => send()} disabled={loading || !input.trim()}><Send size={15} /></button>
        </div>
      </div>

      {/* PII Guard Log */}
      <div className="card pii-panel">
        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
          <div className="section-title" style={{ fontSize: '0.9rem', color: 'var(--danger)' }}><Shield size={15} /> Privacy Guard Log</div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PII stripped server-side before AI sees it</span>
        </div>
        {piiLogs.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.25rem' }}>
            <ShieldCheck size={22} style={{ margin: '0 auto 6px', display: 'block', opacity: 0.35 }} />
            Send a message with your name, email, or phone number to see redaction in action.
          </div>
        ) : (
          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {piiLogs.map((l, i) => (
              <div key={i} className="pii-log-entry">
                <div style={{ marginBottom: '4px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{l.ts}</div>
                <div><span style={{ color: 'var(--danger)', fontWeight: 700 }}>RAW: </span>{l.original}</div>
                <div style={{ marginTop: '3px' }}><span style={{ color: 'var(--success)', fontWeight: 700 }}>SAFE: </span>{l.sanitized}</div>
                <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {l.entities.map((e, j) => <span key={j} className="pill" style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>{e.type}: {e.value}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
