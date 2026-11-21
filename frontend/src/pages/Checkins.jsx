import { useState } from 'react';
import { api } from '../api.js';
import { errText, Pager, useList } from '../hooks.jsx';

export default function Checkins({ user }) {
  const isMember = user.role === 'MEMBER';
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const list = useList('/checkins', {
    page,
    limit: 15,
    from: from ? new Date(from + 'T00:00:00').toISOString() : '',
    to: to ? new Date(to + 'T23:59:59').toISOString() : '',
  });
  const [msg, setMsg] = useState({ ok: '', err: '' });

  const checkin = async () => {
    setMsg({ ok: '', err: '' });
    try {
      await api('/checkins', { method: 'POST', body: {} });
      setMsg({ ok: 'Check-in registrado!', err: '' });
      list.reload();
    } catch (err) {
      setMsg({ ok: '', err: errText(err) });
    }
  };

  return (
    <section className="card">
      <h2>Check-ins</h2>
      {isMember && (
        <div className="checkin-cta">
          <button onClick={checkin}>Fazer check-in agora</button>
          {msg.err && <p className="error">{msg.err}</p>}
          {msg.ok && <p className="ok">{msg.ok}</p>}
        </div>
      )}
      {!isMember && <p className="muted">Para registrar um check-in, use o botão na aba Membros.</p>}
      <div className="filters">
        <label>De<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label>
        <label>Até<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>
      </div>
      {list.error && <p className="error">{list.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Data/hora</th><th>Membro</th></tr></thead>
          <tbody>
            {list.rows.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.checkedInAt).toLocaleString('pt-BR')}</td>
                <td>{c.member?.user?.name ?? c.memberId}</td>
              </tr>
            ))}
            {!list.loading && list.rows.length === 0 && <tr><td colSpan="2" className="muted">Nenhum check-in.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager meta={list.meta} page={page} setPage={setPage} />
    </section>
  );
}
