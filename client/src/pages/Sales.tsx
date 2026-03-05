import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

interface Doc {
  id: string;
  kind: string;
  internalNumber?: string | null;
  ncfOrEcfNumber?: string | null;
  currency: string;
  total: string;
  status: string;
  issueDate?: string | null;
}

export default function Sales() {
  const { getAuthHeaders } = useAuth();
  const [searchParams] = useSearchParams();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [tenant, setTenant] = useState<{ onboardingStatus: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<'proforma' | 'invoice' | null>(
    searchParams.get('new') === 'proforma' ? 'proforma' : searchParams.get('new') === 'invoice' ? 'invoice' : null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/sales/documents`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/tenants/me`, { headers: getAuthHeaders() }),
    ])
      .then(async ([r1, r2]) => {
        const d = r1.ok ? r1.json() : [];
        const t = r2.ok ? r2.json() : null;
        return [await d, await t];
      })
      .then(([d, t]) => {
        setDocs(Array.isArray(d) ? d : []);
        setTenant(t?.tenant ?? null);
      })
      .catch(() => setError('No autorizado'))
      .finally(() => setLoading(false));
  }, [getAuthHeaders]);

  const handleCreateProforma = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const items = [
      {
        itemName: (form.elements.namedItem('itemName') as HTMLInputElement).value,
        qty: parseFloat((form.elements.namedItem('qty') as HTMLInputElement).value),
        unitPrice: parseFloat((form.elements.namedItem('unitPrice') as HTMLInputElement).value),
        itbisRate: parseFloat((form.elements.namedItem('itbisRate') as HTMLInputElement).value) || 0,
      },
    ];

    setError(null);
    try {
      const res = await fetch(`${API_URL}/sales/proformas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ currency: 'DOP', items }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      const created = await res.json();
      setDocs((prev) => [created, ...prev]);
      setShowForm(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const items = [
      {
        itemName: (form.elements.namedItem('itemName') as HTMLInputElement).value,
        qty: parseFloat((form.elements.namedItem('qty') as HTMLInputElement).value),
        unitPrice: parseFloat((form.elements.namedItem('unitPrice') as HTMLInputElement).value),
        itbisRate: parseFloat((form.elements.namedItem('itbisRate') as HTMLInputElement).value) || 0,
      },
    ];

    setError(null);
    try {
      const res = await fetch(`${API_URL}/sales/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ currency: 'DOP', items }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      const created = await res.json();
      setDocs((prev) => [created, ...prev]);
      setShowForm(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await fetch(`${API_URL}/reports/documents/export?format=xlsx`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documentos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (error && !docs.length) return <div style={{ padding: 24, color: '#ef4444' }}>{error}</div>;

  const isFiscalReady = tenant?.onboardingStatus === 'FISCAL_READY';

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h1 style={{ marginBottom: 8 }}>Ventas</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Proformas y facturas fiscales
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowForm('proforma')}
          style={btnStyle('#10b981')}
        >
          Nueva Proforma
        </button>
        {isFiscalReady && (
          <button
            onClick={() => setShowForm('invoice')}
            style={btnStyle('#8b5cf6')}
          >
            Nueva factura fiscal
          </button>
        )}
        <button onClick={handleExportExcel} style={btnStyle('#334155')}>
          Exportar Excel
        </button>
      </div>

      {showForm === 'proforma' && (
        <div style={{ padding: 20, background: '#1e293b', borderRadius: 8, marginBottom: 24 }}>
          <h3>Nueva Proforma</h3>
          <form onSubmit={handleCreateProforma} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
            <input name="itemName" placeholder="Descripción" required style={inputStyle} />
            <input name="qty" type="number" step="0.01" placeholder="Cantidad" required style={inputStyle} />
            <input name="unitPrice" type="number" step="0.01" placeholder="Precio unit." required style={inputStyle} />
            <input name="itbisRate" type="number" step="0.01" placeholder="% ITBIS" defaultValue={0} style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={btnStyle('#10b981')}>Crear</button>
              <button type="button" onClick={() => setShowForm(null)} style={btnStyle('#64748b')}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {showForm === 'invoice' && (
        <div style={{ padding: 20, background: '#1e293b', borderRadius: 8, marginBottom: 24 }}>
          <h3>Nueva factura fiscal</h3>
          <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
            <input name="itemName" placeholder="Descripción" required style={inputStyle} />
            <input name="qty" type="number" step="0.01" placeholder="Cantidad" required style={inputStyle} />
            <input name="unitPrice" type="number" step="0.01" placeholder="Precio unit." required style={inputStyle} />
            <input name="itbisRate" type="number" step="0.01" placeholder="% ITBIS" defaultValue={18} style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={btnStyle('#8b5cf6')}>Crear</button>
              <button type="button" onClick={() => setShowForm(null)} style={btnStyle('#64748b')}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #334155' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>Fecha</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Tipo</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Número</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Total</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: 8 }}>{d.issueDate ?? '-'}</td>
              <td style={{ padding: 8 }}>{d.kind}</td>
              <td style={{ padding: 8 }}>{d.ncfOrEcfNumber ?? d.internalNumber ?? d.id.slice(0, 8)}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{d.currency} {d.total}</td>
              <td style={{ padding: 8 }}>{d.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {docs.length === 0 && <p style={{ color: '#94a3b8', marginTop: 16 }}>Sin documentos</p>}

      {error && <p style={{ color: '#ef4444', marginTop: 16 }}>{error}</p>}
    </div>
  );
}

const inputStyle = {
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
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
});
