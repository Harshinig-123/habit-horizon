import { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Clock, CheckCircle2, Circle } from 'lucide-react';
import type { Archetype } from '../App';
import { api } from '../api';

type Scope = 'daily' | 'weekly' | 'monthly';

interface Task {
  id: string;
  title: string;
  done: boolean;
  time?: string;
  day?: number;    // 0=Mon..6=Sun for weekly
  date?: string;   // YYYY-MM-DD for monthly
  archetype: string;
}

interface Planning { daily: Task[]; weekly: Task[]; monthly: Task[]; }

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekStart() {
  const now = new Date();
  const d = now.getDay(); // 0=Sun
  const diff = (d === 0 ? -6 : 1 - d);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon;
}

function getMonthCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = firstDay;
  const cells: { date: Date | null; current: boolean }[] = [];
  const prevMonth = new Date(year, month, 0);
  for (let i = prevDays - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, prevMonth.getDate() - i), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), current: true });
  }
  while (cells.length % 7 !== 0) {
    const extra = cells.length - (daysInMonth + prevDays) + 1;
    cells.push({ date: new Date(year, month + 1, extra), current: false });
  }
  return cells;
}

export default function HorizonPlanner({ archetype, userId }: { archetype: Archetype; userId: string }) {
  const [tab, setTab] = useState<Scope>('daily');
  const [planning, setPlanning] = useState<Planning>({ daily: [], weekly: [], monthly: [] });
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  // removed unused newDay state;
  const [addingWeekDay, setAddingWeekDay] = useState<number | null>(null);
  const [addingWeekTitle, setAddingWeekTitle] = useState('');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addingMonthTitle, setAddingMonthTitle] = useState('');

  const key = `ca_planning_${archetype}`; // localStorage fallback key

  useEffect(() => {
    const loadPlanning = () => {
      api.getPlanning(userId, archetype).then(setPlanning).catch(() => {
        const saved = localStorage.getItem(key);
        if (saved) setPlanning(JSON.parse(saved));
        else setPlanning({ daily: [], weekly: [], monthly: [] });
      });
    };

    loadPlanning();

    window.addEventListener('ca_planning_updated', loadPlanning);
    return () => window.removeEventListener('ca_planning_updated', loadPlanning);
  }, [userId, archetype]);

  const save = (p: Planning) => {
    setPlanning(p);
    localStorage.setItem(key, JSON.stringify(p));
    api.savePlanning(userId, archetype, p).catch(() => {});
  };

  const toggleTask = (id: string, scope: Scope) => {
    save({ ...planning, [scope]: planning[scope].map(t => t.id === id ? { ...t, done: !t.done } : t) });
  };
  const deleteTask = (id: string, scope: Scope) => {
    save({ ...planning, [scope]: planning[scope].filter(t => t.id !== id) });
  };

  /* ── Daily add ── */
  const addDaily = () => {
    if (!newTitle.trim()) return;
    const t: Task = { id: `t${Date.now()}`, title: newTitle.trim(), done: false, archetype, ...(newTime ? { time: newTime } : {}) };
    save({ ...planning, daily: [...planning.daily, t] });
    setNewTitle(''); setNewTime('');
  };

  /* ── Weekly add ── */
  const addWeekly = (dayIdx: number) => {
    if (!addingWeekTitle.trim()) return;
    const t: Task = { id: `t${Date.now()}`, title: addingWeekTitle.trim(), done: false, archetype, day: dayIdx };
    save({ ...planning, weekly: [...planning.weekly, t] });
    setAddingWeekTitle(''); setAddingWeekDay(null);
  };

  /* ── Monthly add ── */
  const addMonthly = (dateStr: string) => {
    if (!addingMonthTitle.trim()) return;
    const t: Task = { id: `t${Date.now()}`, title: addingMonthTitle.trim(), done: false, archetype, date: dateStr };
    save({ ...planning, monthly: [...planning.monthly, t] });
    setAddingMonthTitle(''); setSelectedDate(null);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  const calCells = getMonthCalendar(calYear, calMonth);

  return (
    <div className="card animate-fade-up" style={{ padding: '1.25rem' }}>
      <div className="section-header">
        <div>
          <div className="section-title">
            <Calendar size={17} style={{ color: 'var(--primary)' }} />
            Horizon Planner
          </div>
          <div className="section-subtitle">{archetype} mode</div>
        </div>
      </div>

      <div className="tabs">
        {(['daily','weekly','monthly'] as Scope[]).map(s => (
          <button key={s} className={`tab ${tab === s ? 'active' : ''}`} onClick={() => setTab(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* ── DAILY VIEW ── */}
      {tab === 'daily' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input className="input" placeholder="Add a task…" value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDaily()}
              style={{ flex: 2, minWidth: 120 }} />
            <input className="input" placeholder="Time e.g. 09:00" value={newTime}
              onChange={e => setNewTime(e.target.value)}
              style={{ flex: 1, minWidth: 100 }} />
            <button className="btn-primary" onClick={addDaily}><Plus size={14} /> Add</button>
          </div>
          <div className="task-list">
            {planning.daily.length === 0 && <div className="empty-state">No tasks yet — add one above!</div>}
            {planning.daily.map(t => (
              <div key={t.id} className="task-row">
                <button className={`task-check ${t.done ? 'done' : ''}`} onClick={() => toggleTask(t.id, 'daily')}>
                  {t.done ? <CheckCircle2 size={12} color="#fff" /> : <Circle size={12} color="var(--text-muted)" />}
                </button>
                <span className={`task-title ${t.done ? 'done' : ''}`}>{t.title}</span>
                {t.time && <span className="task-time"><Clock size={11} />{t.time}</span>}
                <button className="task-del" onClick={() => deleteTask(t.id, 'daily')}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── WEEKLY VIEW ── */}
      {tab === 'weekly' && (
        <div>
          <div className="week-grid">
            {WEEK_DAYS.map((label, dayIdx) => {
              const d = new Date(weekStart);
              d.setDate(weekStart.getDate() + dayIdx);
              const dStr = d.toISOString().split('T')[0];
              const isToday = dStr === todayStr;
              const dayTasks = planning.weekly.filter(t => t.day === dayIdx);
              return (
                <div key={dayIdx} className="week-col">
                  <div className="week-day-label" style={isToday ? { color: 'var(--primary)' } : {}}>
                    {label}<br />
                    <span style={{ fontWeight: 400, fontSize: '0.62rem' }}>{d.getDate()}</span>
                  </div>
                  {dayTasks.map(t => (
                    <div key={t.id} className={`week-task-chip ${t.done ? 'done' : ''}`}
                      onClick={() => toggleTask(t.id, 'weekly')}
                      title={t.title}>
                      {t.title}
                      <span
                        style={{ float: 'right', cursor: 'pointer', marginLeft: 4 }}
                        onClick={e => { e.stopPropagation(); deleteTask(t.id, 'weekly'); }}>×</span>
                    </div>
                  ))}
                  {addingWeekDay === dayIdx ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <input className="input" style={{ fontSize: '0.7rem', padding: '4px 6px' }}
                        placeholder="Task…" autoFocus
                        value={addingWeekTitle}
                        onChange={e => setAddingWeekTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addWeekly(dayIdx); if (e.key === 'Escape') setAddingWeekDay(null); }} />
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <button className="btn-primary" style={{ fontSize: '0.65rem', padding: '3px 7px' }} onClick={() => addWeekly(dayIdx)}>Add</button>
                        <button className="btn-ghost" style={{ fontSize: '0.65rem', padding: '3px 7px' }} onClick={() => setAddingWeekDay(null)}>×</button>
                      </div>
                    </div>
                  ) : (
                    <button className="week-add-btn" onClick={() => { setAddingWeekDay(dayIdx); setAddingWeekTitle(''); }}>+ add</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MONTHLY VIEW ── */}
      {tab === 'monthly' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <button className="btn-ghost" onClick={() => {
              const d = new Date(calYear, calMonth - 1, 1);
              setCalMonth(d.getMonth()); setCalYear(d.getFullYear());
            }}>←</button>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-heading)' }}>
              {new Date(calYear, calMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button className="btn-ghost" onClick={() => {
              const d = new Date(calYear, calMonth + 1, 1);
              setCalMonth(d.getMonth()); setCalYear(d.getFullYear());
            }}>→</button>
          </div>
          <div className="month-day-labels">
            {MONTH_LABELS.map(l => <div key={l} className="month-day-label">{l}</div>)}
          </div>
          <div className="month-grid">
            {calCells.map((cell, i) => {
              if (!cell.date) return <div key={i} className="month-cell other-month" />;
              const ds = cell.date.toISOString().split('T')[0];
              const isToday = ds === todayStr;
              const cellTasks = planning.monthly.filter(t => t.date === ds);
              return (
                <div key={i} className={`month-cell ${!cell.current ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => setSelectedDate(ds === selectedDate ? null : ds)}
                  style={{ cursor: 'pointer' }}>
                  <div className="month-day-num">{cell.date.getDate()}</div>
                  <div>
                    {cellTasks.slice(0, 2).map(t => (
                      <span key={t.id} className="month-dot" title={t.title} />
                    ))}
                    {cellTasks.length > 2 && <span style={{ fontSize: '0.6rem', color: 'var(--primary)' }}>+{cellTasks.length - 2}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected date detail */}
          {selectedDate && (
            <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div className="task-list" style={{ marginBottom: '0.5rem' }}>
                {planning.monthly.filter(t => t.date === selectedDate).map(t => (
                  <div key={t.id} className="task-row" style={{ padding: '5px 8px' }}>
                    <button className={`task-check ${t.done ? 'done' : ''}`} onClick={() => toggleTask(t.id, 'monthly')}>
                      {t.done ? <CheckCircle2 size={11} color="#fff" /> : <Circle size={11} color="var(--text-muted)" />}
                    </button>
                    <span className={`task-title ${t.done ? 'done' : ''}`} style={{ fontSize: '0.82rem' }}>{t.title}</span>
                    <button className="task-del" onClick={() => deleteTask(t.id, 'monthly')}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input className="input" placeholder="Add task for this day…"
                  value={addingMonthTitle}
                  onChange={e => setAddingMonthTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addMonthly(selectedDate)}
                  style={{ flex: 1, fontSize: '0.82rem', padding: '7px 10px' }} />
                <button className="btn-primary" style={{ padding: '7px 12px', fontSize: '0.8rem' }} onClick={() => addMonthly(selectedDate)}>
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
