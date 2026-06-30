import { useState, useEffect } from 'react';
import { Flame, Plus, Trash2, Trophy, Sparkles } from 'lucide-react';
import type { Archetype } from '../App';
import { api } from '../api';

interface Habit { id: string; name: string; current_streak: number; last_completed_timestamp: string | null; completion_history: string[]; }

const today = () => new Date().toISOString().split('T')[0];

export default function HabitEngine({ archetype, userId }: { archetype: Archetype; userId: string }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    api.getHabits(userId, archetype).then(setHabits).catch(() => {
      const saved = localStorage.getItem(`ca_habits_${archetype}`);
      if (saved) setHabits(JSON.parse(saved));
    });
  }, [userId, archetype]);

  const sync = (updated: Habit[]) => {
    setHabits(updated);
    localStorage.setItem(`ca_habits_${archetype}`, JSON.stringify(updated));
  };

  const toggle = async (id: string) => {
    try { sync(await api.toggleHabit(userId, archetype, id)); }
    catch {
      const t = today();
      const updated = habits.map(h => {
        if (h.id !== id) return h;
        const done = h.completion_history.includes(t);
        return { ...h, completion_history: done ? h.completion_history.filter(d => d !== t) : [...h.completion_history, t], current_streak: done ? Math.max(0, h.current_streak - 1) : h.current_streak + 1, last_completed_timestamp: done ? null : new Date().toISOString() };
      });
      sync(updated);
    }
  };

  const addHabit = async () => {
    if (!newName.trim()) return;
    try { sync(await api.addHabit(userId, archetype, newName.trim())); }
    catch {
      const h: Habit = { id: `h${Date.now()}`, name: newName.trim(), current_streak: 0, last_completed_timestamp: null, completion_history: [] };
      sync([...habits, h]);
    }
    setNewName('');
  };

  const deleteHabit = async (id: string) => {
    try { sync(await api.deleteHabit(userId, archetype, id)); }
    catch { sync(habits.filter(h => h.id !== id)); }
  };

  const todayDone = habits.filter(h => h.completion_history.includes(today())).length;
  const consistency = habits.length === 0 ? 0 : Math.round((todayDone / habits.length) * 100);

  return (
    <div className="card animate-fade-up" style={{ padding: '1.25rem' }}>
      <div className="section-header">
        <div>
          <div className="section-title"><Sparkles size={17} style={{ color: 'var(--primary)' }} />Habit Tracker</div>
          <div className="section-subtitle">Daily streaks &amp; consistency</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="consistency-ring">{consistency}%</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}><Trophy size={11} /> Today's score</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input className="input" placeholder="Add a new habit…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addHabit()} style={{ flex: 1 }} />
        <button className="btn-primary" onClick={addHabit}><Plus size={15} /> Add</button>
      </div>
      <div className="habit-list">
        {habits.length === 0 && <div className="empty-state">No habits yet — add one above!</div>}
        {habits.map(h => {
          const done = h.completion_history.includes(today());
          return (
            <div key={h.id} className="habit-row">
              <button className={`habit-check ${done ? 'done' : ''}`} onClick={() => toggle(h.id)}>
                {done && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
              <span className={`habit-name ${done ? 'done' : ''}`}>{h.name}</span>
              {h.current_streak > 0 && <span className="streak-badge"><Flame size={11} /> {h.current_streak}d</span>}
              <button className="task-del" onClick={() => deleteHabit(h.id)} title="Remove habit"><Trash2 size={13} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
