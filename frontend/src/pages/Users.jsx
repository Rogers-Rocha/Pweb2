import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { errText } from '../hooks.jsx';

const EMPTY = { name: '', email: '', password: '', role: 'TRAINER' };

export default function Users() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState({ ok: '', err: '' });

  const load = () =>
    api('/users', { query: { limit: 100 } })
      .then(({ data }) => setRows(Array.isArray(data) ? data : data.data))
      .catch((err) => setError(errText(err)));

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ ok: '', err: '' });
    try {
      await api('/users', { method: 'POST', body: form });
      setForm(EMPTY);
      setMsg({ ok: 'Usuário criado.', err: '' });
      load();
    } catch (err) {
      setMsg({ ok: '', err: errText(err) });
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="grid">
      <section className="card">
        <h2>Usuários</h2>
        {error && <p className="error">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><span className={`badge ${u.role}`}>{u.role}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form className="card" onSubmit={submit}>
        <h2>Novo usuário da equipe</h2>
        <label>Nome<input value={form.name} onChange={set('name')} required minLength={2} /></label>
        <label>E-mail<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Senha (mín. 10)<input type="password" value={form.password} onChange={set('password')} required minLength={10} /></label>
        <label>Papel
          <select value={form.role} onChange={set('role')}><option>TRAINER</option><option>ADMIN</option></select>
        </label>
        {msg.err && <p className="error">{msg.err}</p>}
        {msg.ok && <p className="ok">{msg.ok}</p>}
        <button>Criar</button>
      </form>
    </div>
  );
}
