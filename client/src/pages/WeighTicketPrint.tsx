import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAuthHeaders } from '../api/auth';

const API_URL = '/api';

interface WeighTicketDetail {
  id: string;
  ticketNumber: string | null;
  type: string;
  datetime: string;
  grossKg: string;
  tareKg: string;
  netKg: string;
  notes: string | null;
  supplierName?: string | null;
  driverName?: string | null;
  truckPlate?: string | null;
  tenant: {
    legalName?: string | null;
    tradeName?: string | null;
    name?: string | null;
  } | null;
}

export default function WeighTicketPrint() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<WeighTicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/weigh-tickets/${id}`, { headers: getAuthHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error('Pesada no encontrada');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#ef4444' }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Cargando...</div>;
  }

  const tenantName =
    data.tenant?.legalName || data.tenant?.tradeName || data.tenant?.name || 'Empresa';
  const ticketNum = data.ticketNumber || data.id.slice(0, 8);
  const dt = new Date(data.datetime);

  return (
    <div className="weigh-ticket-print" style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
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
          to="/weigh-tickets"
          style={{
            padding: '10px 20px',
            background: '#64748b',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          Volver a Pesadas
        </Link>
      </div>

      <div className="ticket-content">
        <h1 style={{ marginBottom: 8, fontSize: 24 }}>{tenantName}</h1>
        <p style={{ color: '#64748b', marginBottom: 24 }}>TICKET DE PESADA</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: 600, width: 140 }}>No. Ticket</td>
              <td style={{ padding: '8px 0' }}>{ticketNum}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: 600 }}>Fecha / Hora</td>
              <td style={{ padding: '8px 0' }}>
                {dt.toLocaleString('es-DO', { dateStyle: 'long', timeStyle: 'short' })}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: 600 }}>Tipo</td>
              <td style={{ padding: '8px 0' }}>{data.type}</td>
            </tr>
            {(data.supplierName || data.driverName || data.truckPlate) && (
              <>
                {data.supplierName && (
                  <tr>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>Proveedor</td>
                    <td style={{ padding: '8px 0' }}>{data.supplierName}</td>
                  </tr>
                )}
                {data.driverName && (
                  <tr>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>Chofer</td>
                    <td style={{ padding: '8px 0' }}>{data.driverName}</td>
                  </tr>
                )}
                {data.truckPlate && (
                  <tr>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>Camión</td>
                    <td style={{ padding: '8px 0' }}>{data.truckPlate}</td>
                  </tr>
                )}
              </>
            )}
            <tr>
              <td style={{ padding: '8px 0', fontWeight: 600 }}>Peso Bruto (kg)</td>
              <td style={{ padding: '8px 0' }}>{parseFloat(data.grossKg).toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: 600 }}>Peso Tara (kg)</td>
              <td style={{ padding: '8px 0' }}>{parseFloat(data.tareKg).toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: 600 }}>Peso Neto (kg)</td>
              <td style={{ padding: '8px 0', fontSize: 18, fontWeight: 700 }}>
                {parseFloat(data.netKg).toLocaleString()}
              </td>
            </tr>
            {data.notes && (
              <tr>
                <td style={{ padding: '8px 0', fontWeight: 600 }}>Observaciones</td>
                <td style={{ padding: '8px 0' }}>{data.notes}</td>
              </tr>
            )}
          </tbody>
        </table>

        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 32 }}>
          Documento generado por PaddyFlow
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          .weigh-ticket-print { padding: 0 !important; }
          .ticket-content { break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />
    </div>
  );
}
