import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { errText, Pager, useList } from '../hooks.jsx';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const NEW_EX = { name: '', sets: 3, reps: 10, restSeconds: 60 };

export default function Workouts({ user }) {
  const canEdit = user.role !== 'MEMBER';
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState('');
  const list = useList('/workouts', { page, limit: 10, level });
  const [open, setOpen] = useState(null);

  const remove = async (id) => {
    if (!confirm('Excluir este treino?')) return;
    try {
      await api(`/workouts/${id}`, { method: 'DELETE' });
      list.reload();
    } catch (err) {
      alert(errText(err));
    }
  };

  return (
    <div className={canEdit ? 'grid' : ''}>
      <section className="card">
        <h2>
          Treinos {list.cache && <span className={`cache ${list.cache}`} title="Header X-Cache da API">cache: {list.cache}</span>}
        </h2>
        <div className="filters">
          <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
            <option value="">Todos os níveis</option>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <button className="small secondary" onClick={list.reload}>Recarregar</button>
        </div>
        {list.error && <p className="error">{list.error}</p>}
        {list.rows.map((w) => (
          <div key={w.id} className="workout">
            <div className="workout-head" onClick={() => setOpen(open === w.id ? null : w.id)}>
              <div>
                <strong>{w.title}</strong> <span className="badge">{w.level}</span>
                {w.memberId ? <span className="badge MEMBER">individual</span> : <span className="badge">modelo</span>}
                <div className="muted">{w.trainer?.name}{w.durationMin ? ` · ${w.durationMin} min` : ''}</div>
              </div>
              {canEdit && <button className="small danger" onClick={(e) => { e.stopPropagation(); remove(w.id); }}>Excluir</button>}
            </div>
            {open === w.id && (
              <div>
                {w.description && <p>{w.description}</p>}
                <table>
                  <thead><tr><th>Exercício</th><th>Séries</th><th>Reps</th><th>Descanso</th></tr></thead>
                  <tbody>
                    {(w.exercises ?? []).map((ex, i) => (
                      <tr key={i}><td>{ex.name}</td><td>{ex.sets}</td><td>{ex.reps}</td><td>{ex.restSeconds ?? '-'}s</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {!list.loading && list.rows.length === 0 && <p className="muted">Nenhum treino.</p>}
        <Pager meta={list.meta} page={page} setPage={setPage} />
      </section>
      {canEdit && <WorkoutForm onCreated={list.reload} />}
    </div>
  );
}

function WorkoutForm({ onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', level: 'BEGINNER', durationMin: 45, memberId: '' });
  const [exercises, setExercises] = useState([{ ...NEW_EX }]);
  const [members, setMembers] = useState([]);
  const [msg, setMsg] = useState({ ok: '', err: '' });

  useEffect(() => {
    api('/members', { query: { limit: 100 } }).then(({ data }) => setMembers(data.data)).catch(() => {});
  }, []);

  const setEx = (i, k, v) => setExercises(exercises.map((ex, j) => (j === i ? { ...ex, [k]: v } : ex)));

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ ok: '', err: '' });
    const body = {
      title: form.title,
      level: form.level,
      exercises: exercises.map((ex) => ({ name: ex.name, sets: Number(ex.sets), reps: Number(ex.reps), restSeconds: Number(ex.restSeconds) })),
    };
    if (form.description) body.description = form.description;
    if (form.durationMin) body.durationMin = Number(form.durationMin);
    if (form.memberId) body.memberId = form.memberId;
    try {
      await api('/workouts', { method: 'POST', body });
      setMsg({ ok: 'Treino criado (cache invalidado).', err: '' });
      setForm({ ...form, title: '', description: '' });
      setExercises([{ ...NEW_EX }]);
      onCreated();
    } catch (err) {
      setMsg({ ok: '', err: errText(err) });
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form className="card" onSubmit={submit}>
      <h2>Novo treino</h2>
      <label>Título<input value={form.title} onChange={set('title')} required /></label>
      <label>Descrição<textarea value={form.description} onChange={set('description')} rows={2} /></label>
      <div className="row">
        <label>Nível<select value={form.level} onChange={set('level')}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
        <label>Duração (min)<input type="number" min={5} max={300} value={form.durationMin} onChange={set('durationMin')} /></label>
      </div>
      <label>Membro
        <select value={form.memberId} onChange={set('memberId')}>
          <option value="">— Treino modelo (todos) —</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <h3>Exercícios</h3>
      {exercises.map((ex, i) => (
        <div className="row ex" key={i}>
          <input placeholder="Nome" value={ex.name} onChange={(e) => setEx(i, 'name', e.target.value)} required />
          <input type="number" title="Séries" min={1} max={20} value={ex.sets} onChange={(e) => setEx(i, 'sets', e.target.value)} />
          <input type="number" title="Repetições" min={1} max={100} value={ex.reps} onChange={(e) => setEx(i, 'reps', e.target.value)} />
          <input type="number" title="Descanso (s)" min={0} max={600} value={ex.restSeconds} onChange={(e) => setEx(i, 'restSeconds', e.target.value)} />
          {exercises.length > 1 && <button type="button" className="small secondary" onClick={() => setExercises(exercises.filter((_, j) => j !== i))}>×</button>}
        </div>
      ))}
      <button type="button" className="small secondary" onClick={() => setExercises([...exercises, { ...NEW_EX }])}>+ exercício</button>
      {msg.err && <p className="error">{msg.err}</p>}
      {msg.ok && <p className="ok">{msg.ok}</p>}
      <button>Criar treino</button>
    </form>
  );
}
