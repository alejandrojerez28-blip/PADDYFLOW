import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

interface SettlementLine {
  weighTicketId: string;
  netKg: string;
  pricePerKg: string;
  moisturePct: string | null;
  impurityPct: string | null;
  penaltyAmount: string;
  lineAmount: string;
}

interface SettlementPrint {
  id: string;
  supplierName: string | null;
  periodFrom: string;
  periodTo: string;
  status: string;
  totalNetKg: string;
  grossAmount: string;
  deductions: string;
  netPayable: string;
  lines: SettlementLine[];
}

export default function SupplierSettlementPrint() {
  const { id } = useParams<{ id: string }>();
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState<SettlementPrint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/supplier-settlements/${id}`, { headers: getAuthHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error('Liquidación no encontrada');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [id, getAuthHeaders]);

  const handlePrint = () => {
    window.print();
  };

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <Link to="/settlements" style={{ color: '#0ea5e9' }}>Volver</Link>
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Cargando...</div>;
  }

  return (
    <div className="settlement-print" style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', gap: 12 }} className="no-print">
        <button
          onClick={handlePrint}
          style={{
            padding: '10px 20px',
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Imprimir
        </button>
        <Link
          to={`/settlements/${id}`}
          style={{
            padding: '10px 20px',
            background: '#64748b',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          Volver
        </Link>
      </div>

      <div className="print-content">
        <h1 style={{ marginBottom: 8, fontSize: 22 }}>LIQUIDACIÓN A SUPLIDOR</h1>
        <p style={{ color: '#64748b', marginBottom: 24 }}>
          {data.supplierName ?? 'Proveedor'} · {data.periodFrom} a {data.periodTo} · {data.status}
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #334155' }}>
              <th style={{ textAlign: 'left', padding: 8 }}>Pesada</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Net Kg</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Precio/kg</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Penalidad</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {(data.lines ?? []).map((line, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #334155' }}>
                <td style={{ padding: 8 }}>{line.weighTicketId.slice(0, 8)}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(line.netKg).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(line.pricePerKg).toFixed(4)}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(line.penaltyAmount).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(line.lineAmount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginTop: 24, paddingTop: 16, borderTop: '2px solid #334155' }}>
          <div>
            <span style={{ color: '#94a3b8', marginRight: 8 }}>Bruto:</span>
            <strong>{parseFloat(data.grossAmount).toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8', marginRight: 8 }}>Deducciones:</span>
            <strong>{parseFloat(data.deductions).toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8', marginRight: 8 }}>Neto a pagar:</span>
            <strong style={{ color: '#10b981', fontSize: 18 }}>{parseFloat(data.netPayable).toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .settlement-print { padding: 0 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
