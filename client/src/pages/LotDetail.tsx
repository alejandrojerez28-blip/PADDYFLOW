import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

type TabType = 'inputs' | 'shipment' | 'receipts' | 'yield';

interface LotDetail {
  id: string;
  code: string;
  status: string;
  notes: string | null;
  createdAt?: string;
  inputs: Array<{
    id: string;
    weighTicketId: string;
    netKg: string;
    datetime: string;
    type: string;
    supplierName: string | null;
  }>;
  shipments: Array<{
    id: string;
    processorId: string;
    processorName: string;
    shipDate: string | null;
    driverId: string | null;
    driverName: string | null;
    truckId: string | null;
    truckPlate: string | null;
    shippedKg: string | null;
    status: string;
    notes: string | null;
  }>;
  receipts: Array<{
    id: string;
    receiptDate: string;
    superSacksCount: number;
    totalKg: string;
    notes: string | null;
  }>;
  totalInputKg: number;
  totalShippedKg: number;
  totalReceivedKg: number;
}

interface Processor {
  id: string;
  name: string;
}
interface Driver {
  id: string;
  name: string;
}
interface Truck {
  id: string;
  plate: string;
}
interface AvailableTicket {
  id: string;
  ticketNumber: string | null;
  datetime: string;
  type: string;
  netKg: string;
  supplierName: string | null;
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

function formatDatetime(s: string): string {
  try {
    return new Date(s).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return s;
  }
}

export default function LotDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { getAuthHeaders } = useAuth();
  const [lot, setLot] = useState<LotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabType>('inputs');
  const [addInputModal, setAddInputModal] = useState(false);
  const [availableTickets, setAvailableTickets] = useState<AvailableTicket[]>([]);
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [shipmentForm, setShipmentForm] = useState(false);
  const [receiptForm, setReceiptForm] = useState(false);
  const [editingShipment, setEditingShipment] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<string | null>(null);
  const [splitModalReceipt, setSplitModalReceipt] = useState<{ id: string; totalKg: string } | null>(null);
  const [splitItems, setSplitItems] = useState<Array<{ id: string; name: string; category: string }>>([]);
  const [splitData, setSplitData] = useState<Record<string, number>>({});
  const [splitLoading, setSplitLoading] = useState(false);
  const [yieldData, setYieldData] = useState<{
    inputKg: number;
    receivedKg: number;
    shippedKg: number;
    yieldPct: number | null;
    lossKg: number;
    receipts: Array<{ id: string; receiptDate: string; totalKg: number; superSacksCount: number; splitSumKg: number; pendingKg: number }>;
    breakdownByCategory: { finishedKg: number; subproductKg: number; otherKg: number };
    breakdownByItem: Array<{ itemId: string; itemName: string; category: string; qtyKg: number }>;
    flags: { isSplitComplete: boolean; missingSplitKg: number };
  } | null>(null);
  const [yieldLoading, setYieldLoading] = useState(false);

  const fetchLot = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/lots/${id}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Lote no encontrado'))))
      .then(setLot)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id, getAuthHeaders]);

  useEffect(() => {
    fetchLot();
  }, [fetchLot]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && ['inputs', 'shipment', 'receipts', 'yield'].includes(t)) setTab(t as TabType);
  }, [searchParams]);

  const fetchYield = useCallback(() => {
    if (!id) return;
    setYieldLoading(true);
    fetch(`${API_URL}/lots/${id}/yield`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setYieldData(data);
        else setYieldData(null);
      })
      .catch(() => setYieldData(null))
      .finally(() => setYieldLoading(false));
  }, [id, getAuthHeaders]);

  useEffect(() => {
    if (tab === 'yield' && id) fetchYield();
  }, [tab, id, fetchYield]);

  useEffect(() => {
    fetch(`${API_URL}/processors?active=true`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setProcessors)
      .catch(() => {});
    fetch(`${API_URL}/drivers?active=true`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setDrivers)
      .catch(() => {});
    fetch(`${API_URL}/trucks?active=true`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setTrucks)
      .catch(() => {});
  }, [getAuthHeaders]);

  const openAddInputModal = () => {
    setAddInputModal(true);
    if (id) {
      fetch(`${API_URL}/lots/${id}/available-weigh-tickets`, { headers: getAuthHeaders() })
        .then((r) => (r.ok ? r.json() : []))
        .then(setAvailableTickets)
        .catch(() => setAvailableTickets([]));
    }
  };

  const handleAddInput = async (weighTicketId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/lots/${id}/inputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ weighTicketId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      setAddInputModal(false);
      fetchLot();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleRemoveInput = async (inputId: string) => {
    if (!confirm('¿Quitar esta pesada del lote?')) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/lots/${id}/inputs/${inputId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error');
      fetchLot();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreateShipment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      processorId: (form.elements.namedItem('processorId') as HTMLSelectElement).value,
      shipDate: (form.elements.namedItem('shipDate') as HTMLInputElement).value || null,
      driverId: (form.elements.namedItem('driverId') as HTMLSelectElement).value || null,
      truckId: (form.elements.namedItem('truckId') as HTMLSelectElement).value || null,
      shippedKg: parseFloat((form.elements.namedItem('shippedKg') as HTMLInputElement).value) || null,
      status: (form.elements.namedItem('status') as HTMLSelectElement).value,
      notes: (form.elements.namedItem('notes') as HTMLInputElement).value || null,
    };
    setError(null);
    try {
      const res = await fetch(`${API_URL}/lots/${id}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      setShipmentForm(false);
      fetchLot();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleUpdateShipment = async (e: React.FormEvent<HTMLFormElement>, shipmentId: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      processorId: (form.elements.namedItem('processorId') as HTMLSelectElement).value,
      shipDate: (form.elements.namedItem('shipDate') as HTMLInputElement).value || null,
      driverId: (form.elements.namedItem('driverId') as HTMLSelectElement).value || null,
      truckId: (form.elements.namedItem('truckId') as HTMLSelectElement).value || null,
      shippedKg: parseFloat((form.elements.namedItem('shippedKg') as HTMLInputElement).value) || null,
      status: (form.elements.namedItem('status') as HTMLSelectElement).value,
      notes: (form.elements.namedItem('notes') as HTMLInputElement).value || null,
    };
    setError(null);
    try {
      const res = await fetch(`${API_URL}/lots/${id}/shipments/${shipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      setEditingShipment(null);
      fetchLot();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreateReceipt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      receiptDate: (form.elements.namedItem('receiptDate') as HTMLInputElement).value,
      superSacksCount: parseInt((form.elements.namedItem('superSacksCount') as HTMLInputElement).value, 10) || 0,
      totalKg: parseFloat((form.elements.namedItem('totalKg') as HTMLInputElement).value),
      notes: (form.elements.namedItem('notes') as HTMLInputElement).value || null,
    };
    setError(null);
    try {
      const res = await fetch(`${API_URL}/lots/${id}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      setReceiptForm(false);
      fetchLot();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleUpdateReceipt = async (e: React.FormEvent<HTMLFormElement>, receiptId: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      receiptDate: (form.elements.namedItem('receiptDate') as HTMLInputElement).value,
      superSacksCount: parseInt((form.elements.namedItem('superSacksCount') as HTMLInputElement).value, 10) || 0,
      totalKg: parseFloat((form.elements.namedItem('totalKg') as HTMLInputElement).value),
      notes: (form.elements.namedItem('notes') as HTMLInputElement).value || null,
    };
    setError(null);
    try {
      const res = await fetch(`${API_URL}/lots/${id}/receipts/${receiptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      setEditingReceipt(null);
      fetchLot();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    if (!confirm('¿Eliminar esta recepción?')) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/lots/${id}/receipts/${receiptId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error');
      fetchLot();
    } catch (e) {
      setError(String(e));
    }
  };

  const openSplitModal = (r: { id: string; totalKg: string }) => {
    setSplitModalReceipt(r);
    setSplitData({});
    setSplitLoading(true);
    Promise.all([
      fetch(`${API_URL}/items?active=true&category=FINISHED`, { headers: getAuthHeaders() }).then((x) => (x.ok ? x.json() : [])),
      fetch(`${API_URL}/items?active=true&category=SUBPRODUCT`, { headers: getAuthHeaders() }).then((x) => (x.ok ? x.json() : [])),
      fetch(`${API_URL}/bulk-receipts/${r.id}/splits`, { headers: getAuthHeaders() }).then((x) => (x.ok ? x.json() : { splits: [] })),
    ])
      .then(([fin, sub, splitsData]) => {
        const allItems = [...(fin || []), ...(sub || [])];
        setSplitItems(allItems);
        const data: Record<string, number> = {};
        for (const s of splitsData.splits || []) {
          data[s.itemId] = s.qtyKg;
        }
        setSplitData(data);
      })
      .catch(() => setSplitItems([]))
      .finally(() => setSplitLoading(false));
  };

  const handleSaveSplit = async () => {
    if (!splitModalReceipt) return;
    const splits = Object.entries(splitData)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qtyKg]) => ({ itemId, qtyKg }));
    if (splits.length === 0) {
      setError('Debe asignar al menos un item con cantidad > 0');
      return;
    }
    const totalKg = parseFloat(splitModalReceipt.totalKg);
    const sum = splits.reduce((a, s) => a + s.qtyKg, 0);
    if (sum > totalKg) {
      setError(`La suma (${sum}) no puede superar el total (${totalKg})`);
      return;
    }
    setError(null);
    setSplitLoading(true);
    try {
      const res = await fetch(`${API_URL}/bulk-receipts/${splitModalReceipt.id}/splits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ splits }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      setSplitModalReceipt(null);
      fetchLot();
      fetchYield();
    } catch (e) {
      setError(String(e));
    } finally {
      setSplitLoading(false);
    }
  };

  const handleExportYield = async () => {
    try {
      const from = lot?.createdAt ? new Date(lot.createdAt).toISOString().slice(0, 10) : '';
      const to = lot?.createdAt ? new Date(lot.createdAt).toISOString().slice(0, 10) : '';
      const params = new URLSearchParams({ format: 'xlsx' });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`${API_URL}/reports/yield/export?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yield_${lot?.code ?? id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  };

  if (loading && !lot) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (error && !lot) return <div style={{ padding: 24, color: '#ef4444' }}>{error}</div>;
  if (!lot) return null;

  const tabs: TabType[] = ['inputs', 'shipment', 'receipts', 'yield'];

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <Link to="/lots" style={{ color: '#0ea5e9', marginBottom: 8, display: 'inline-block' }}>← Volver a Lotes</Link>
        <h1 style={{ marginBottom: 8 }}>Lote {lot.code}</h1>
        <p style={{ color: '#94a3b8', marginBottom: 16 }}>Estado: {lot.status}</p>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ padding: 12, background: '#1e293b', borderRadius: 8, minWidth: 120 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Input (kg)</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{lot.totalInputKg.toLocaleString()}</div>
          </div>
          <div style={{ padding: 12, background: '#1e293b', borderRadius: 8, minWidth: 120 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Enviado (kg)</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{lot.totalShippedKg.toLocaleString()}</div>
          </div>
          <div style={{ padding: 12, background: '#1e293b', borderRadius: 8, minWidth: 120 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Recibido (kg)</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{lot.totalReceivedKg.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...btnStyle(tab === t ? '#0ea5e9' : '#334155'),
              padding: '8px 16px',
            }}
          >
            {t === 'inputs' ? 'Entradas' : t === 'shipment' ? 'Envío' : t === 'receipts' ? 'Recepción' : 'Rendimiento'}
          </button>
        ))}
      </div>

      {tab === 'inputs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Pesadas asociadas</h3>
            <button onClick={openAddInputModal} style={btnStyle('#10b981')}>
              Agregar pesadas
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>Fecha</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Tipo</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Proveedor</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Net (kg)</th>
                <th style={{ textAlign: 'center', padding: 8 }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {lot.inputs.map((inp) => (
                <tr key={inp.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: 8 }}>{formatDatetime(inp.datetime)}</td>
                  <td style={{ padding: 8 }}>{inp.type}</td>
                  <td style={{ padding: 8 }}>{inp.supplierName ?? '-'}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(inp.netKg).toLocaleString()}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <button onClick={() => handleRemoveInput(inp.id)} style={{ ...btnStyle('#ef4444'), padding: '6px 12px' }}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lot.inputs.length === 0 && <p style={{ color: '#94a3b8' }}>Sin pesadas. Agrega pesadas para comenzar.</p>}
        </div>
      )}

      {tab === 'shipment' && (
        <div>
          <h3 style={{ marginBottom: 16 }}>Envíos a procesador</h3>
          {lot.shipments.length === 0 && !shipmentForm && (
            <button onClick={() => setShipmentForm(true)} style={btnStyle('#10b981')}>
              Crear envío
            </button>
          )}
          {shipmentForm && (
            <div style={{ padding: 20, background: '#1e293b', borderRadius: 8, marginBottom: 24, maxWidth: 400 }}>
              <h4>Nuevo envío</h4>
              <form onSubmit={handleCreateShipment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Procesador *</span>
                  <select name="processorId" required style={inputStyle}>
                    <option value="">Seleccionar</option>
                    {processors.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Fecha envío</span>
                  <input name="shipDate" type="datetime-local" style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Chofer</span>
                  <select name="driverId" style={inputStyle}>
                    <option value="">Ninguno</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Camión</span>
                  <select name="truckId" style={inputStyle}>
                    <option value="">Ninguno</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>{t.plate}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Kg enviados</span>
                  <input name="shippedKg" type="number" step="0.001" style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Estado</span>
                  <select name="status" style={inputStyle} defaultValue="CREATED">
                    <option value="CREATED">CREATED</option>
                    <option value="IN_TRANSIT">IN_TRANSIT</option>
                    <option value="DELIVERED">DELIVERED</option>
                  </select>
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Notas</span>
                  <input name="notes" style={inputStyle} />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={btnStyle('#10b981')}>Crear</button>
                  <button type="button" onClick={() => setShipmentForm(false)} style={btnStyle('#64748b')}>Cancelar</button>
                </div>
              </form>
            </div>
          )}
          {lot.shipments.map((sh) => (
            <div key={sh.id} style={{ padding: 20, background: '#1e293b', borderRadius: 8, marginBottom: 16 }}>
              {editingShipment === sh.id ? (
                <form onSubmit={(e) => handleUpdateShipment(e, sh.id)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Procesador *</span>
                    <select name="processorId" required style={inputStyle} defaultValue={sh.processorId}>
                      {processors.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Fecha envío</span>
                    <input name="shipDate" type="datetime-local" style={inputStyle} defaultValue={sh.shipDate ? sh.shipDate.slice(0, 16) : ''} />
                  </label>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Chofer</span>
                    <select name="driverId" style={inputStyle} defaultValue={sh.driverId ?? ''}>
                      <option value="">Ninguno</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Camión</span>
                    <select name="truckId" style={inputStyle} defaultValue={sh.truckId ?? ''}>
                      <option value="">Ninguno</option>
                      {trucks.map((t) => (
                        <option key={t.id} value={t.id}>{t.plate}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Kg enviados</span>
                    <input name="shippedKg" type="number" step="0.001" style={inputStyle} defaultValue={sh.shippedKg ?? ''} />
                  </label>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Estado</span>
                    <select name="status" style={inputStyle} defaultValue={sh.status}>
                      <option value="CREATED">CREATED</option>
                      <option value="IN_TRANSIT">IN_TRANSIT</option>
                      <option value="DELIVERED">DELIVERED</option>
                    </select>
                  </label>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Notas</span>
                    <input name="notes" style={inputStyle} defaultValue={sh.notes ?? ''} />
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" style={btnStyle('#10b981')}>Guardar</button>
                    <button type="button" onClick={() => setEditingShipment(null)} style={btnStyle('#64748b')}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <p><strong>Procesador:</strong> {sh.processorName}</p>
                  <p><strong>Fecha:</strong> {sh.shipDate ? formatDatetime(sh.shipDate) : '-'}</p>
                  <p><strong>Chofer:</strong> {sh.driverName ?? '-'} | <strong>Camión:</strong> {sh.truckPlate ?? '-'}</p>
                  <p><strong>Kg enviados:</strong> {sh.shippedKg ? parseFloat(sh.shippedKg).toLocaleString() : '-'}</p>
                  <p><strong>Estado:</strong> {sh.status}</p>
                  <button onClick={() => setEditingShipment(sh.id)} style={{ ...btnStyle('#64748b'), padding: '6px 12px', marginTop: 8 }}>
                    Editar
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'receipts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Recepción granel (super sacos)</h3>
            {!receiptForm && (
              <button onClick={() => setReceiptForm(true)} style={btnStyle('#10b981')}>
                Agregar recepción
              </button>
            )}
          </div>
          {receiptForm && (
            <div style={{ padding: 20, background: '#1e293b', borderRadius: 8, marginBottom: 24, maxWidth: 400 }}>
              <h4>Nueva recepción</h4>
              <form onSubmit={handleCreateReceipt} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Fecha *</span>
                  <input name="receiptDate" type="datetime-local" required style={inputStyle} defaultValue={new Date().toISOString().slice(0, 16)} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Super sacos</span>
                  <input name="superSacksCount" type="number" min={0} style={inputStyle} defaultValue={0} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Total kg *</span>
                  <input name="totalKg" type="number" step="0.001" min={0} required style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Notas</span>
                  <input name="notes" style={inputStyle} />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={btnStyle('#10b981')}>Crear</button>
                  <button type="button" onClick={() => setReceiptForm(false)} style={btnStyle('#64748b')}>Cancelar</button>
                </div>
              </form>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>Fecha</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Super sacos</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Total kg</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Notas</th>
                <th style={{ textAlign: 'center', padding: 8 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lot.receipts.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #334155' }}>
                  {editingReceipt === r.id ? (
                    <td colSpan={5} style={{ padding: 16 }}>
                      <form onSubmit={(e) => handleUpdateReceipt(e, r.id)} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
                        <label>
                          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Fecha *</span>
                          <input name="receiptDate" type="datetime-local" required style={inputStyle} defaultValue={new Date(r.receiptDate).toISOString().slice(0, 16)} />
                        </label>
                        <label>
                          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Super sacos</span>
                          <input name="superSacksCount" type="number" min={0} style={inputStyle} defaultValue={r.superSacksCount} />
                        </label>
                        <label>
                          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Total kg *</span>
                          <input name="totalKg" type="number" step="0.001" min={0} required style={inputStyle} defaultValue={parseFloat(r.totalKg)} />
                        </label>
                        <label>
                          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Notas</span>
                          <input name="notes" style={inputStyle} defaultValue={r.notes ?? ''} />
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="submit" style={btnStyle('#10b981')}>Guardar</button>
                          <button type="button" onClick={() => setEditingReceipt(null)} style={btnStyle('#64748b')}>Cancelar</button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: 8 }}>{formatDatetime(r.receiptDate)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{r.superSacksCount}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(r.totalKg).toLocaleString()}</td>
                      <td style={{ padding: 8 }}>{r.notes ?? '-'}</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        <button onClick={() => openSplitModal(r)} style={{ ...btnStyle('#0ea5e9'), padding: '6px 12px', marginRight: 4 }}>Distribuir</button>
                        <button onClick={() => setEditingReceipt(r.id)} style={{ ...btnStyle('#64748b'), padding: '6px 12px', marginRight: 4 }}>Editar</button>
                        <button onClick={() => handleDeleteReceipt(r.id)} style={{ ...btnStyle('#ef4444'), padding: '6px 12px' }}>Eliminar</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {lot.receipts.length === 0 && !receiptForm && <p style={{ color: '#94a3b8' }}>Sin recepciones registradas.</p>}
        </div>
      )}

      {tab === 'yield' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Rendimiento / Liquidación</h3>
            <button onClick={handleExportYield} style={btnStyle('#0ea5e9')}>Exportar Excel</button>
          </div>
          {yieldLoading ? (
            <p style={{ color: '#94a3b8' }}>Cargando...</p>
          ) : yieldData ? (
            <>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <div style={{ padding: 16, background: '#1e293b', borderRadius: 8, minWidth: 120 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Input (kg)</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{yieldData.inputKg.toLocaleString()}</div>
                </div>
                <div style={{ padding: 16, background: '#1e293b', borderRadius: 8, minWidth: 120 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Recibido (kg)</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{yieldData.receivedKg.toLocaleString()}</div>
                </div>
                <div style={{ padding: 16, background: '#1e293b', borderRadius: 8, minWidth: 120 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Yield %</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{yieldData.yieldPct != null ? yieldData.yieldPct.toFixed(1) + '%' : '-'}</div>
                </div>
                <div style={{ padding: 16, background: '#1e293b', borderRadius: 8, minWidth: 120 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Merma (kg)</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{yieldData.lossKg.toLocaleString()}</div>
                </div>
                <div style={{ padding: 16, background: '#1e293b', borderRadius: 8, minWidth: 140 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Distribución</div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    background: yieldData.flags.isSplitComplete ? '#065f46' : '#7f1d1d',
                    color: '#fff',
                  }}>
                    {yieldData.flags.isSplitComplete ? 'Completa' : 'Incompleta'}
                  </span>
                  {!yieldData.flags.isSplitComplete && yieldData.flags.missingSplitKg > 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Faltan {yieldData.flags.missingSplitKg.toLocaleString()} kg</div>
                  )}
                </div>
              </div>

              {yieldData.breakdownByItem.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ marginBottom: 12 }}>Distribución por item</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #334155' }}>
                        <th style={{ textAlign: 'left', padding: 8 }}>Item</th>
                        <th style={{ textAlign: 'left', padding: 8 }}>Categoría</th>
                        <th style={{ textAlign: 'right', padding: 8 }}>Cantidad (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yieldData.breakdownByItem.map((b) => (
                        <tr key={b.itemId} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: 8 }}>{b.itemName}</td>
                          <td style={{ padding: 8 }}>{b.category}</td>
                          <td style={{ padding: 8, textAlign: 'right' }}>{b.qtyKg.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <h4 style={{ marginBottom: 12 }}>Recepciones y distribuciones</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      <th style={{ textAlign: 'left', padding: 8 }}>Fecha</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Total kg</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Split kg</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Pendiente</th>
                      <th style={{ textAlign: 'center', padding: 8 }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yieldData.receipts.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: 8 }}>{formatDatetime(r.receiptDate)}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{r.totalKg.toLocaleString()}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{r.splitSumKg.toLocaleString()}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{r.pendingKg.toLocaleString()}</td>
                        <td style={{ padding: 8, textAlign: 'center' }}>
                          <button onClick={() => openSplitModal({ id: r.id, totalKg: String(r.totalKg) })} style={btnStyle('#0ea5e9')}>
                            Distribuir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {yieldData.receipts.length === 0 && <p style={{ color: '#94a3b8' }}>Sin recepciones.</p>}
              </div>
            </>
          ) : (
            <p style={{ color: '#94a3b8' }}>No se pudo cargar el rendimiento.</p>
          )}
        </div>
      )}

      {addInputModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setAddInputModal(false)}
        >
          <div
            style={{
              background: '#1e293b',
              padding: 24,
              borderRadius: 12,
              maxWidth: 560,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 16 }}>Agregar pesadas al lote</h3>
            {availableTickets.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No hay pesadas disponibles (todas ya están asignadas a lotes).</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    <th style={{ textAlign: 'left', padding: 8 }}>Fecha</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>Tipo</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>Proveedor</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Net (kg)</th>
                    <th style={{ textAlign: 'center', padding: 8 }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {availableTickets.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: 8 }}>{formatDatetime(t.datetime)}</td>
                      <td style={{ padding: 8 }}>{t.type}</td>
                      <td style={{ padding: 8 }}>{t.supplierName ?? '-'}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(t.netKg).toLocaleString()}</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        <button onClick={() => handleAddInput(t.id)} style={btnStyle('#10b981')}>
                          Agregar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button onClick={() => setAddInputModal(false)} style={{ ...btnStyle('#64748b'), marginTop: 16 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {splitModalReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSplitModalReceipt(null)}
        >
          <div
            style={{
              background: '#1e293b',
              padding: 24,
              borderRadius: 12,
              maxWidth: 480,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 16 }}>Distribuir a inventario</h3>
            <p style={{ color: '#94a3b8', marginBottom: 16, fontSize: 14 }}>
              Total recepción: {parseFloat(splitModalReceipt.totalKg).toLocaleString()} kg
            </p>
            {splitLoading ? (
              <p>Cargando...</p>
            ) : splitItems.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No hay items (FINISHED/SUBPRODUCT). Crea items en Inventario primero.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {splitItems.map((item) => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>{item.name} ({item.category})</span>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={splitData[item.id] ?? ''}
                        onChange={(e) =>
                          setSplitData((d) => ({
                            ...d,
                            [item.id]: parseFloat(e.target.value) || 0,
                          }))
                        }
                        style={{ ...inputStyle, width: 100 }}
                        placeholder="kg"
                      />
                    </label>
                  ))}
                </div>
                <p style={{ marginBottom: 16, fontSize: 14 }}>
                  Suma: {Object.values(splitData).reduce((a, b) => a + b, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} kg
                  {parseFloat(splitModalReceipt.totalKg) > 0 && (
                    <span style={{ color: Object.values(splitData).reduce((a, b) => a + b, 0) > parseFloat(splitModalReceipt.totalKg) ? '#ef4444' : '#94a3b8' }}>
                      {' '}/ {parseFloat(splitModalReceipt.totalKg).toLocaleString()} kg
                    </span>
                  )}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSaveSplit} disabled={splitLoading} style={btnStyle('#10b981')}>
                    Guardar
                  </button>
                  <button onClick={() => setSplitModalReceipt(null)} style={btnStyle('#64748b')}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && <p style={{ color: '#ef4444', marginTop: 16 }}>{error}</p>}
    </div>
  );
}
