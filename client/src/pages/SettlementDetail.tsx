import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

interface SettlementLine {
  id: string;
  weighTicketId: string;
  netKg: string;
  pricePerKg: string;
  moisturePct: string | null;
  impurityPct: string | null;
  penaltyAmount: string;
  lineAmount: string;
}

interface SettlementDetail {
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
  notes: string | null;
  lines: SettlementLine[];
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

export default function SettlementDetail() {
  const { id } = useParams<{ id: string }>();
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState<SettlementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/supplier-settlements/${id}`, { headers: getAuthHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error('No encontrada');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id, getAuthHeaders]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/supplier-settlements/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error');
      }
      fetchDetail();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleExportExcel = async () => {
    if (!id || !data) return;
    try {
      const params = new URLSearchParams({ format: 'xlsx', from: data.periodFrom, to: data.periodTo, supplierId: data.supplierId });
      const res = await fetch(`${API_URL}/reports/supplier-settlements/export?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liquidacion_${data.supplierName ?? 'suplidor'}_${data.periodFrom}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  };

  const handlePrint = () => {
    window.location.href = `/print/supplier-settlement/${id}`;
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (error || !data) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#ef4444' }}>{error ?? 'No encontrada'}</p>
        <Link to="/settlements" style={{ color: '#0ea5e9' }}>Volver a liquidaciones</Link>
      </div>
    );
  }

  const canApprove = data.status === 'DRAFT';
  const canPay = data.status === 'APPROVED';
  const canCancel = data.status === 'DRAFT' || data.status === 'APPROVED';

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Liquidación</h1>
          <p style={{ color: '#94a3b8' }}>
            {data.supplierName ?? '-'} · {data.periodFrom} a {data.periodTo} · <strong>{data.status}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handlePrint} style={btnStyle('#0ea5e9')}>
            Imprimir
          </button>
          <button onClick={handleExportExcel} style={btnStyle('#334155')}>
            Exportar Excel
          </button>
          {canApprove && (
            <button onClick={() => handleStatusChange('APPROVED')} style={btnStyle('#10b981')}>
              Aprobar
            </button>
          )}
          {canPay && (
            <button onClick={() => handleStatusChange('PAID')} style={btnStyle('#10b981')}>
              Marcar pagado
            </button>
          )}
          {canCancel && (
            <button onClick={() => handleStatusChange('CANCELED')} style={btnStyle('#ef4444')}>
              Cancelar
            </button>
          )}
          <Link to="/settlements" style={btnStyle('#64748b')}>
            Volver
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 16, background: '#1e293b', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Net Kg</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{parseFloat(data.totalNetKg).toLocaleString()}</div>
        </div>
        <div style={{ padding: 16, background: '#1e293b', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Bruto</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{parseFloat(data.grossAmount).toLocaleString()}</div>
        </div>
        <div style={{ padding: 16, background: '#1e293b', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Deducciones</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{parseFloat(data.deductions).toLocaleString()}</div>
        </div>
        <div style={{ padding: 16, background: '#1e293b', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Neto a pagar</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#10b981' }}>{parseFloat(data.netPayable).toLocaleString()}</div>
        </div>
      </div>

      <h3 style={{ marginBottom: 12 }}>Líneas (pesadas)</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #334155' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>Pesada</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Net Kg</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Precio/kg</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Humedad %</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Impurezas %</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Penalidad</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Monto</th>
          </tr>
        </thead>
        <tbody>
          {(data.lines ?? []).map((line) => (
            <tr key={line.id} style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: 8 }}>{line.weighTicketId.slice(0, 8)}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(line.netKg).toLocaleString()}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(line.pricePerKg).toFixed(4)}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{line.moisturePct ?? '-'}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{line.impurityPct ?? '-'}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(line.penaltyAmount).toLocaleString()}</td>
              <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{parseFloat(line.lineAmount).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p style={{ color: '#ef4444', marginTop: 16 }}>{error}</p>}
    </div>
  );
}
