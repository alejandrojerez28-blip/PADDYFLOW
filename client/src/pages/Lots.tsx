import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

type LotStatus = 'OPEN' | 'SENT' | 'RECEIVED' | 'CLOSED';

interface Lot {
  id: string;
  code: string;
  status: LotStatus;
  notes: string | null;
  createdAt: string;
  totalInputKg: number;
  hasShipment: boolean;
  totalReceivedKg: number;
}

const inputStyle: React.CSSProperties = {
  padding: 8,
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 6,
  color: '#e2e8f0',
};

const btnStyle = (bg: string) => ({
  padding: '10px 20px',
  background: bg,
  color: '#fff',
  border: 'none' as const,
  borderRadius: 8,
  cursor: 'pointer' as const,
});

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('es-DO');
  } catch {
    return s;
  }
}

export default function Lots() {
  const { getAuthHeaders } = useAuth();
  const [searchParams] = useSearchParams();
  const [list, setList] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    status: LotStatus | '';
    dateFrom: string;
    dateTo: string;
    search: string;
  }>({
    status: (searchParams.get('status') as LotStatus) || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    search: searchParams.get('search') || '',
  });

  const fetchList = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.search.trim()) params.set('search', filters.search.trim());

    setLoading(true);
    fetch(`${API_URL}/lots?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Error al cargar'))))
      .then((data: Lot[]) => setList(data))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [getAuthHeaders, filters.status, filters.dateFrom, filters.dateTo, filters.search]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleCreate = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      const created = await res.json();
      window.location.href = `/lots/${created.id}`;
    } catch (e) {
      setError(String(e));
    }
  };

  if (loading && list.length === 0) {
    return <div style={{ padding: 24 }}>Cargando...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ marginBottom: 8 }}>Lotes</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Pesadas → Lote → Envío → Recepción granel
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Estado</span>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as LotStatus | '' }))}
            style={inputStyle}
          >
            <option value="">Todos</option>
            <option value="OPEN">OPEN</option>
            <option value="SENT">SENT</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Desde</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Hasta</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Buscar código</span>
          <input
            type="text"
            placeholder="Código..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            style={{ ...inputStyle, minWidth: 140 }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 24 }}>
        <button onClick={handleCreate} style={btnStyle('#10b981')}>
          Nuevo Lote
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #334155' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>Código</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Estado</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Creado</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Input (kg)</th>
            <th style={{ textAlign: 'center', padding: 8 }}>Enviado</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Recibido (kg)</th>
            <th style={{ textAlign: 'center', padding: 8 }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {list.map((lot) => (
            <tr key={lot.id} style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: 8 }}>{lot.code}</td>
              <td style={{ padding: 8 }}>{lot.status}</td>
              <td style={{ padding: 8 }}>{formatDate(lot.createdAt)}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{lot.totalInputKg.toLocaleString()}</td>
              <td style={{ padding: 8, textAlign: 'center' }}>{lot.hasShipment ? 'Sí' : '-'}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{lot.totalReceivedKg.toLocaleString()}</td>
              <td style={{ padding: 8, textAlign: 'center' }}>
                <Link
                  to={`/lots/${lot.id}`}
                  style={{
                    padding: '6px 12px',
                    background: '#0ea5e9',
                    color: '#fff',
                    borderRadius: 8,
                    textDecoration: 'none',
                  }}
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && !loading && <p style={{ color: '#94a3b8', marginTop: 16 }}>Sin lotes</p>}
      {error && <p style={{ color: '#ef4444', marginTop: 16 }}>{error}</p>}
    </div>
  );
}
