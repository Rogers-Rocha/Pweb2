import { useEffect, useState } from 'react';
import { api, session, formatDetails } from './api.js';
import Members from './pages/Members.jsx';
import Workouts from './pages/Workouts.jsx';
import Checkins from './pages/Checkins.jsx';
import Users from './pages/Users.jsx';
import MyProfile from './pages/MyProfile.jsx';

const TABS = {
  ADMIN: ['Membros', 'Treinos', 'Check-ins', 'Usuários'],
  TRAINER: ['Membros', 'Treinos', 'Check-ins'],
  MEMBER: ['Meu perfil', 'Treinos', 'Check-ins'],
};

export default function App() {
  const [user, setUser] = useState(session.user);
  const [tab, setTab] = useState(null);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('gym:logout', onLogout);
    return () => window.removeEventListener('gym:logout', onLogout);
  }, []);

  if (!user) return <Login onLogin={setUser} />;

  const tabs = TABS[user.role] ?? [];
  const current = tab && tabs.includes(tab) ? tab : tabs[0];

  return (
    <div className="layout">
      <header>
        <strong>🏋️ Gym</strong>
        <nav>
          {tabs.map((t) => (
            <button key={t} className={t === current ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        <div className="who">
          {user.name} <span className={`badge ${user.role}`}>{user.role}</span>
          <button className="link" onClick={() => { session.clear(); setUser(null); }}>Sair</button>
        </div>
      </header>
      <main>
        {current === 'Membros' && <Members user={user} />}
        {current === 'Treinos' && <Workouts user={user} />}
        {current === 'Check-ins' && <Checkins user={user} />}
        {current === 'Usuários' && <Users />}
        {current === 'Meu perfil' && <MyProfile />}
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api('/auth/login', { method: 'POST', body: { email, password } });
      session.save(data.accessToken, data.user);
      onLogin(data.user);
    } catch (err) {
      setError([err.message, formatDetails(err)].filter(Boolean).join(' — '));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1>🏋️ Gym</h1>
        <p className="muted">Gestão de academia</p>
        <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
