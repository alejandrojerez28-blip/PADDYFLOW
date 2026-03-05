import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

interface YieldRow {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  inputKg: number;
  receivedKg: number;
  yieldPct: number | null;
  lossKg: number;
  splitComplete: boolean;
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

export default function YieldReport() {
  const { getAuthHeaders } = useAuth();
  const [list, setList] = useState<YieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });

  const fetchReport = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('from', filters.dateFrom);
    if (filters.dateTo) params.set('to', filters.dateTo);
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/reports/yield?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Error al cargar'))))
      .then((data: YieldRow[]) => setList(data))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [getAuthHeaders, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ format: 'xlsx' });
      if (filters.dateFrom) params.set('from', filters.dateFrom);
      if (filters.dateTo) params.set('to', filters.dateTo);
      const res = await fetch(`${API_URL}/reports/yield/export?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yield_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ marginBottom: 8 }}>Reporte de Rendimiento</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Yield y liquidación por lote
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
        <button onClick={fetchReport} style={btnStyle('#64748b')}>Filtrar</button>
        <button onClick={handleExport} style={btnStyle('#0ea5e9')}>Exportar Excel</button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#7f1d1d', borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {loading && list.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Cargando...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <th style={{ textAlign: 'left', padding: 8 }}>Lote</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Estado</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Fecha</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Input (kg)</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Recibido (kg)</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Yield %</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Merma (kg)</th>
              <th style={{ textAlign: 'center', padding: 8 }}>Split</th>
              <th style={{ textAlign: 'center', padding: 8 }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #334155' }}>
                <td style={{ padding: 8 }}>{row.code}</td>
                <td style={{ padding: 8 }}>{row.status}</td>
                <td style={{ padding: 8 }}>{formatDate(row.createdAt)}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{row.inputKg.toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{row.receivedKg.toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{row.yieldPct != null ? row.yieldPct.toFixed(1) + '%' : '-'}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{row.lossKg.toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    background: row.splitComplete ? '#065f46' : '#7f1d1d',
                    color: '#fff',
                  }}>
                    {row.splitComplete ? 'Sí' : 'No'}
                  </span>
                </td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  <Link to={`/lots/${row.id}`} style={{ color: '#0ea5e9' }}>Ver detalle</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {list.length === 0 && !loading && <p style={{ color: '#94a3b8' }}>Sin lotes en el rango.</p>}
    </div>
  );
}
