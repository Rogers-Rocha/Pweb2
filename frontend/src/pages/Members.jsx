import { useState } from 'react';
import { api } from '../api.js';
import { errText, Pager, useList } from '../hooks.jsx';

const PLANS = ['BASIC', 'STANDARD', 'PREMIUM'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
const EMPTY = { name: '', email: '', password: '', phone: '', birthDate: '', plan: 'BASIC' };

export default function Members() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const list = useList('/members', { page, limit: 10, search, status });
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState({ ok: '', err: '' });

  const create = async (e) => {
    e.preventDefault();
    setMsg({ ok: '', err: '' });
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
    try {
      await api('/members', { method: 'POST', body });
      setForm(EMPTY);
      setMsg({ ok: 'Membro cadastrado.', err: '' });
      list.reload();
    } catch (err) {
      setMsg({ ok: '', err: errText(err) });
    }
  };

  const patch = async (id, body) => {
    try {
      await api(`/members/${id}`, { method: 'PATCH', body });
      list.reload();
    } catch (err) {
      alert(errText(err));
    }
  };

  const checkin = async (memberId) => {
    try {
      await api('/checkins', { method: 'POST', body: { memberId } });
      alert('Check-in registrado.');
    } catch (err) {
      alert(errText(err));
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="grid">
      <section className="card">
        <h2>Membros</h2>
        <div className="filters">
          <input placeholder="Buscar nome ou e-mail" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Todos os status</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {list.error && <p className="error">{list.error}</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Plano</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.rows.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>
                    <select value={m.plan} onChange={(e) => patch(m.id, { plan: e.target.value })}>
                      {PLANS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={m.status} onChange={(e) => patch(m.id, { status: e.target.value })}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><button className="small" onClick={() => checkin(m.id)}>Check-in</button></td>
                </tr>
              ))}
              {!list.loading && list.rows.length === 0 && <tr><td colSpan="5" className="muted">Nenhum membro.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager meta={list.meta} page={page} setPage={setPage} />
      </section>

      <form className="card" onSubmit={create}>
        <h2>Novo membro</h2>
        <label>Nome<input value={form.name} onChange={set('name')} required minLength={2} /></label>
        <label>E-mail<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Senha inicial (mín. 10)<input type="password" value={form.password} onChange={set('password')} required minLength={10} /></label>
        <label>Telefone<input value={form.phone} onChange={set('phone')} placeholder="+55 89 99999-0000" /></label>
        <label>Nascimento<input type="date" value={form.birthDate} onChange={set('birthDate')} /></label>
        <label>Plano
          <select value={form.plan} onChange={set('plan')}>{PLANS.map((p) => <option key={p}>{p}</option>)}</select>
        </label>
        {msg.err && <p className="error">{msg.err}</p>}
        {msg.ok && <p className="ok">{msg.ok}</p>}
        <button>Cadastrar</button>
      </form>
    </div>
  );
}
