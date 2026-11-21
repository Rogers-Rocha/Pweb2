import { useCallback, useEffect, useState } from 'react';
import { api, formatDetails } from './api.js';

export const errText = (err) => [err.message, formatDetails(err)].filter(Boolean).join(' — ');

/** Carrega um recurso paginado ({ data, meta }) e recarrega quando a query muda. */
export function useList(path, query) {
  const key = JSON.stringify(query);
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: '', cache: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const { data, headers } = await api(path, { query: JSON.parse(key) });
      setState({ rows: data.data, meta: data.meta, loading: false, error: '', cache: headers.get('x-cache') });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: errText(err) }));
    }
  }, [path, key]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}

export function Pager({ meta, page, setPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="pager">
      <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
      <span>{page} / {meta.totalPages} ({meta.total})</span>
      <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>›</button>
    </div>
  );
}
