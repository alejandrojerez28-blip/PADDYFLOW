import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

interface Supplier {
  id: string;
  name: string;
}

interface PreviewLine {
  weighTicketId: string;
  netKg: number;
  pricePerKg: number;
  moisturePct: number | null;
  impurityPct: number | null;
  penaltyAmount: number;
  lineAmount: number;
}

interface PreviewResponse {
  lines: PreviewLine[];
  totalNetKg: number;
  grossAmount: number;
  deductions: number;
  netPayable: number;
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

export default function SettlementsNew() {
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/suppliers?active=true`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSuppliers)
      .catch(() => {});
  }, [getAuthHeaders]);

  const handlePreview = () => {
    if (!supplierId || !periodFrom || !periodTo) {
      setError('Completa proveedor y periodo');
      return;
    }
    setLoading(true);
    setError(null);
    setPreview(null);
    fetch(`${API_URL}/supplier-settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ supplierId, periodFrom, periodTo }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error ?? 'Error')));
        return r.json();
      })
      .then((data) => {
        setPreview({
          lines: data.lines ?? [],
          totalNetKg: data.lines?.reduce((a: number, l: PreviewLine) => a + l.netKg, 0) ?? 0,
          grossAmount: data.lines?.reduce((a: number, l: PreviewLine) => a + l.netKg * l.pricePerKg, 0) ?? 0,
          deductions: data.lines?.reduce((a: number, l: PreviewLine) => a + l.penaltyAmount, 0) ?? 0,
          netPayable: data.lines?.reduce((a: number, l: PreviewLine) => a + l.lineAmount, 0) ?? 0,
        });
        if (data.id) {
          navigate(`/settlements/${data.id}`);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  const handleCreate = () => {
    if (!supplierId || !periodFrom || !periodTo) {
      setError('Completa proveedor y periodo');
      return;
    }
    setCreating(true);
    setError(null);
    fetch(`${API_URL}/supplier-settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ supplierId, periodFrom, periodTo }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error ?? 'Error')));
        return r.json();
      })
      .then((data) => navigate(`/settlements/${data.id}`))
      .catch((e) => setError(String(e)))
      .finally(() => setCreating(false));
  };

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginBottom: 8 }}>Nueva liquidación</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Selecciona proveedor y periodo para generar
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Proveedor *</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Seleccionar</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Desde *</span>
          <input
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Hasta *</span>
          <input
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button onClick={handleCreate} disabled={loading || creating || !supplierId || !periodFrom || !periodTo} style={btnStyle('#10b981')}>
          {creating ? 'Creando...' : 'Crear (DRAFT)'}
        </button>
        <button onClick={() => navigate('/settlements')} style={btnStyle('#64748b')}>
          Cancelar
        </button>
      </div>

      {error && <p style={{ color: '#ef4444', marginBottom: 16 }}>{error}</p>}

      {loading && <p>Cargando preview...</p>}
    </div>
  );
}
