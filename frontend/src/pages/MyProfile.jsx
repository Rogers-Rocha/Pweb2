import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { errText } from '../hooks.jsx';

export default function MyProfile() {
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/members/me').then(({ data }) => setMe(data)).catch((err) => setError(errText(err)));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!me) return <p className="muted">Carregando…</p>;

  return (
    <section className="card narrow">
      <h2>Meu perfil</h2>
      <dl>
        <dt>Nome</dt><dd>{me.name}</dd>
        <dt>E-mail</dt><dd>{me.email}</dd>
        <dt>Telefone</dt><dd>{me.phone ?? '-'}</dd>
        <dt>Nascimento</dt><dd>{me.birthDate ? new Date(me.birthDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</dd>
        <dt>Plano</dt><dd><span className="badge">{me.plan}</span></dd>
        <dt>Status</dt><dd><span className="badge">{me.status}</span></dd>
        <dt>Membro desde</dt><dd>{new Date(me.createdAt).toLocaleDateString('pt-BR')}</dd>
      </dl>
    </section>
  );
}
