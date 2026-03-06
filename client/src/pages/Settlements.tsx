import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

interface Settlement {
  id: string;
  supplierId: string;
  supplierName: string | null;
  periodFrom: string;
  periodTo: string;
  status: string;
  totalNetKg: string;
  grossAmount: string;
  deductions: string;
  netPayable: string;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
}

const btnStyle = (bg: string) => ({
  padding: '10px 20px',
  background: bg,
  color: '#fff',
  border: 'none' as const,
  borderRadius: 8,
  cursor: 'pointer' as const,
  textDecoration: 'none' as const,
});

export default function Settlements() {
  const { getAuthHeaders } = useAuth();
  const [list, setList] = useState<Settlement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    supplierId: '',
    status: '',
    periodFrom: '',
    periodTo: '',
  });

  const fetchList = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.supplierId) params.set('supplierId', filters.supplierId);
    if (filters.status) params.set('status', filters.status);
    if (filters.periodFrom) params.set('periodFrom', filters.periodFrom);
    if (filters.periodTo) params.set('periodTo', filters.periodTo);

    fetch(`${API_URL}/supplier-settlements?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setList)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [getAuthHeaders, filters]);

  useEffect(() => {
    fetch(`${API_URL}/suppliers?active=true`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSuppliers)
      .catch(() => {});
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const statusColor: Record<string, string> = {
    DRAFT: '#94a3b8',
    APPROVED: '#0ea5e9',
    PAID: '#10b981',
    CANCELED: '#ef4444',
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ marginBottom: 8 }}>Liquidaciones a suplidores</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Agrupar pesadas por periodo y calcular pago
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Proveedor</span>
          <select
            value={filters.supplierId}
            onChange={(e) => setFilters((f) => ({ ...f, supplierId: e.target.value }))}
            style={{
              padding: 8,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#e2e8f0',
            }}
          >
            <option value="">Todos</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Estado</span>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            style={{
              padding: 8,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#e2e8f0',
            }}
          >
            <option value="">Todos</option>
            <option value="DRAFT">Borrador</option>
            <option value="APPROVED">Aprobado</option>
            <option value="PAID">Pagado</option>
            <option value="CANCELED">Cancelado</option>
          </select>
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Desde</span>
          <input
            type="date"
            value={filters.periodFrom}
            onChange={(e) => setFilters((f) => ({ ...f, periodFrom: e.target.value }))}
            style={{
              padding: 8,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#e2e8f0',
            }}
          />
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Hasta</span>
          <input
            type="date"
            value={filters.periodTo}
            onChange={(e) => setFilters((f) => ({ ...f, periodTo: e.target.value }))}
            style={{
              padding: 8,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#e2e8f0',
            }}
          />
        </label>
        <Link to="/settlements/new" style={btnStyle('#10b981')}>
          Nueva liquidación
        </Link>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <th style={{ textAlign: 'left', padding: 8 }}>Proveedor</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Periodo</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Estado</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Net Kg</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Bruto</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Deducciones</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Neto a pagar</th>
              <th style={{ textAlign: 'center', padding: 8 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #334155' }}>
                <td style={{ padding: 8 }}>{row.supplierName ?? '-'}</td>
                <td style={{ padding: 8 }}>{row.periodFrom} a {row.periodTo}</td>
                <td style={{ padding: 8 }}>
                  <span style={{ color: statusColor[row.status] ?? '#94a3b8' }}>{row.status}</span>
                </td>
                <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(row.totalNetKg).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(row.grossAmount).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(row.deductions).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{parseFloat(row.netPayable).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  <Link to={`/settlements/${row.id}`} style={{ ...btnStyle('#0ea5e9'), padding: '6px 12px', display: 'inline-block' }}>
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {list.length === 0 && !loading && <p style={{ color: '#94a3b8', marginTop: 16 }}>Sin liquidaciones</p>}
      {error && <p style={{ color: '#ef4444', marginTop: 16 }}>{error}</p>}
    </div>
  );
}
