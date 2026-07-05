import { useState, useEffect } from 'react';
import { BookOpen, Briefcase, Rocket, Terminal, LogOut, User } from 'lucide-react';
import HabitHorizonChat from './components/HabitHorizonChat';
import HabitEngine from './components/HabitEngine';
import HorizonPlanner from './components/HorizonPlanner';
import AITaskPlanner from './components/AITaskPlanner';
import { api } from './api';
import './index.css';

export type Archetype = 'Student' | 'Professional' | 'Entrepreneur';

type AuthMode = 'login' | 'signup';

export default function App() {
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype | null>(null);
  const [userName, setUserName]   = useState('');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [userId, setUserId]   = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedAuth = sessionStorage.getItem('ca_auth');
    if (storedAuth) {
      try {
        const auth = JSON.parse(storedAuth) as { userId: string; username: string; userName: string; archetype: Archetype };
        if (auth?.userId) {
          setUserId(auth.userId);
          setUsername(auth.username);
          setUserName(auth.userName);
          setArchetype(auth.archetype);
          setSelectedArchetype(auth.archetype);
          return;
        }
      } catch {
        sessionStorage.removeItem('ca_auth');
      }
    }

    const saved = sessionStorage.getItem('ca_profile');
    if (saved) {
      try {
        const { archetype: a, userName: n } = JSON.parse(saved);
        if (a) {
          setArchetype(a);
          setUserName(n || '');
          setSelectedArchetype(a);
          setUserId(sessionStorage.getItem('ca_user_id'));
        }
      } catch {
        sessionStorage.removeItem('ca_profile');
      }
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    api.getProfile(userId).then(p => {
      if (p?.archetype) {
        setArchetype(p.archetype);
        setUserName(p.userName || '');
        setSelectedArchetype(p.archetype);
        sessionStorage.setItem('ca_profile', JSON.stringify({ archetype: p.archetype, userName: p.userName || '' }));
      }
    }).catch(() => {
      // Backend offline — keep existing local auth/profile state
    });
  }, [userId]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-student', 'theme-professional', 'theme-entrepreneur');
    if (archetype === 'Student')      root.classList.add('theme-student');
    if (archetype === 'Professional') root.classList.add('theme-professional');
    if (archetype === 'Entrepreneur') root.classList.add('theme-entrepreneur');
  }, [archetype]);

  const handleAuthSuccess = (data: { userId: string; username: string; userName: string; archetype: Archetype }) => {
    setUserId(data.userId);
    setUsername(data.username);
    setUserName(data.userName);
    setArchetype(data.archetype);
    setSelectedArchetype(data.archetype);
    setAuthError('');
    sessionStorage.setItem('ca_auth', JSON.stringify(data));
    sessionStorage.setItem('ca_user_id', data.userId);
    sessionStorage.setItem('ca_profile', JSON.stringify({ archetype: data.archetype, userName: data.userName }));
  };

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setAuthError('Username and password are required.');
      return;
    }

    setAuthLoading(true);
    try {
      const data = await api.login(username.trim(), password);
      handleAuthSuccess({ userId: data.userId, username: data.username, userName: data.userName, archetype: data.archetype });
    } catch (err: any) {
      setAuthError(err?.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!displayName.trim() || !username.trim() || !password || !confirmPassword || !selectedArchetype) {
      setAuthError('All fields are required for sign up.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setAuthLoading(true);
    try {
      const data = await api.signup(username.trim(), password, displayName.trim(), selectedArchetype);
      handleAuthSuccess({ userId: data.userId, username: data.username, userName: data.userName, archetype: data.archetype });
    } catch (err: any) {
      setAuthError(err?.message || 'Sign up failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthSubmit = async () => {
    if (authMode === 'login') {
      await handleLogin();
    } else {
      await handleSignup();
    }
  };

  const handleLogout = async () => {
    if (userId) await api.resetProfile(userId).catch(() => {});
    sessionStorage.removeItem('ca_profile');
    sessionStorage.removeItem('ca_auth');
    sessionStorage.removeItem('ca_user_id');
    setArchetype(null);
    setUserName('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setSelectedArchetype(null);
    setUserId(null);
  };

  const handleArchetypeSwitch = async (a: Archetype) => {
    if (!userId) return;
    setArchetype(a);
    sessionStorage.setItem('ca_profile', JSON.stringify({ archetype: a, userName }));
    await api.saveProfile(userId, userName, a).catch(() => {});
  };

  const handleToggleAuthMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setAuthError('');
  };

  /* ── ONBOARDING ── */
  if (!archetype) return (
    <div className="onboarding-wrap animate-fade-up">
      <div className="onboarding-hero">
        <div className="pill" style={{ marginBottom: '1rem' }}><Terminal size={11} /> Habit Horizon</div>
        <h1>Your intelligent daily planner &amp; habit coach</h1>
        <p style={{ marginTop: '0.75rem' }}>Sign in or create an account to save your profile and role securely.</p>
      </div>
      <div className="auth-toggle">
        <button className={authMode === 'login' ? 'active' : ''} onClick={() => handleToggleAuthMode('login')}>Login</button>
        <button className={authMode === 'signup' ? 'active' : ''} onClick={() => handleToggleAuthMode('signup')}>Sign Up</button>
      </div>
      <div className={`auth-card ${authMode === 'login' ? 'login-card' : 'signup-card'}`}>
        {authMode === 'signup' && (
          <div className="auth-form-grid">
            <div className="form-group">
              <label>Display name</label>
              <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your full name" autoComplete="name" />
            </div>
            <div className="form-group">
              <label>Username</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Pick a username" autoComplete="new-username" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label>Confirm password</label>
              <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" />
            </div>
          </div>
        )}

        {authMode === 'login' && (
          <div className="auth-form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Username</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" autoComplete="username" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" />
            </div>
          </div>
        )}

        {authMode === 'signup' && (
          <>
            <div className="auth-subheading">Choose your role</div>
            <div className="archetype-grid">
              <div className={`card archetype-card student ${selectedArchetype === 'Student' ? 'selected' : ''}`} onClick={() => setSelectedArchetype('Student')}>
                <div className="icon-wrap" style={{ background: '#ede9fe' }}><BookOpen size={26} style={{ color: '#7c3aed' }} /></div>
                <h3>Student</h3>
                <p>Classes, assignments, study streaks, and exam deadlines — all in one view.</p>
              </div>
              <div className={`card archetype-card pro ${selectedArchetype === 'Professional' ? 'selected' : ''}`} onClick={() => setSelectedArchetype('Professional')}>
                <div className="icon-wrap" style={{ background: '#e0f2fe' }}><Briefcase size={26} style={{ color: '#0284c7' }} /></div>
                <h3>Professional</h3>
                <p>Deep work blocks, meetings, projects, and career habits — structured for focus.</p>
              </div>
              <div className={`card archetype-card founder ${selectedArchetype === 'Entrepreneur' ? 'selected' : ''}`} onClick={() => setSelectedArchetype('Entrepreneur')}>
                <div className="icon-wrap" style={{ background: '#ffedd5' }}><Rocket size={26} style={{ color: '#ea580c' }} /></div>
                <h3>Entrepreneur</h3>
                <p>Launch sprints, investor tasks, growth goals, and founder routines — built for momentum.</p>
              </div>
            </div>
          </>
        )}

        {authError && <div className="auth-error">{authError}</div>}
        <button className="btn-primary" onClick={handleAuthSubmit} disabled={authLoading} style={{ width: '100%', maxWidth: '420px', marginTop: '1rem' }}>
          {authLoading ? 'Working…' : authMode === 'login' ? 'Login' : 'Create account'}
        </button>
      </div>
    </div>
  );

  /* ── DASHBOARD ── */
  return (
    <div className="animate-fade-up" style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <nav className="navbar">
        <div className="navbar-brand"><Terminal size={20} />Habit Horizon</div>
        <div className="navbar-right">
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <User size={13} /> {userName}
          </span>
          <span className="role-badge">{archetype}</span>
          <select className="select" value={archetype} onChange={e => handleArchetypeSwitch(e.target.value as Archetype)}>
            <option value="Student">Student</option>
            <option value="Professional">Professional</option>
            <option value="Entrepreneur">Entrepreneur</option>
          </select>
          <button className="btn-ghost" onClick={handleLogout}><LogOut size={13} /> Sign out</button>
        </div>
      </nav>
      <div className="status-bar">
        <div className="status-dot"><span className="pulse-green" /> Horizon Router: Active</div>
        <div className="status-dot"><span className="pulse-green" /> Habit Tracker: Live</div>
        <div className="status-dot"><span className="pulse-green" /> Planner: Synced</div>
        <div className="status-dot"><span className="pulse-green" /> AI Planner: Ready</div>
      </div>
      <div className="dashboard">
        <div className="left-panel">
          <div className="flip-clock">
            <div className="flip-clock-date">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
            <div className="flip-clock-row">
              <div className="flip-card">
                <span>{now.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit' })}</span>
              </div>
              <div className="flip-separator">:</div>
              <div className="flip-card">
                <span>{now.toLocaleTimeString(undefined, { minute: '2-digit' })}</span>
              </div>
              <div className="flip-separator">:</div>
              <div className="flip-card">
                <span>{now.toLocaleTimeString(undefined, { second: '2-digit' })}</span>
              </div>
            </div>
            <div className="flip-clock-subtitle">Current Local Time</div>
          </div>
          <HabitHorizonChat archetype={archetype} userName={userName} userId={userId!} />
        </div>
        <div className="right-col">
          <HorizonPlanner archetype={archetype} userId={userId!} />
          <HabitEngine archetype={archetype} userId={userId!} />
          <AITaskPlanner archetype={archetype} userId={userId!} />
        </div>
      </div>
    </div>
  );
}
