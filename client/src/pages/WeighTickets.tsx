import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

type WeighType = 'PADDY' | 'SUBPRODUCT' | 'OTHER';

interface WeighTicket {
  id: string;
  ticketNumber: string | null;
  type: WeighType;
  datetime: string;
  supplierId: string | null;
  supplierName?: string | null;
  driverId: string | null;
  driverName?: string | null;
  truckId: string | null;
  truckPlate?: string | null;
  grossKg: string;
  tareKg: string;
  netKg: string;
  notes: string | null;
}

interface Supplier {
  id: string;
  name: string;
  isActive: boolean;
}

interface Driver {
  id: string;
  name: string;
  isActive: boolean;
}

interface Truck {
  id: string;
  plate: string;
  isActive: boolean;
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
    const d = new Date(s);
    return d.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return s;
  }
}

export default function WeighTickets() {
  const { getAuthHeaders } = useAuth();
  const [list, setList] = useState<WeighTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<WeighTicket | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    type: '' as WeighType | '',
    supplierId: '',
    driverId: '',
    truckId: '',
    search: '',
  });

  const fetchList = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.type) params.set('type', filters.type);
    if (filters.supplierId) params.set('supplierId', filters.supplierId);
    if (filters.driverId) params.set('driverId', filters.driverId);
    if (filters.truckId) params.set('truckId', filters.truckId);
    if (filters.search.trim()) params.set('search', filters.search.trim());

    setLoading(true);
    fetch(`${API_URL}/weigh-tickets?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Error al cargar'))))
      .then((data: WeighTicket[]) => setList(data))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [getAuthHeaders, filters.dateFrom, filters.dateTo, filters.type, filters.supplierId, filters.driverId, filters.truckId, filters.search]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/suppliers?active=true`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/drivers?active=true`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/trucks?active=true`, { headers: getAuthHeaders() }),
    ])
      .then(async ([r1, r2, r3]) => [
        r1.ok ? r1.json() : [],
        r2.ok ? r2.json() : [],
        r3.ok ? r3.json() : [],
      ])
      .then(async ([s, d, t]) => {
        setSuppliers(await s);
        setDrivers(await d);
        setTrucks(await t);
      })
      .catch(() => {});
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const handleEdit = (row: WeighTicket) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta pesada?')) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/weigh-tickets/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      setList((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(String(e));
    }
  };

  const handlePrint = (id: string) => {
    window.location.href = `/print/weigh-ticket/${id}`;
  };

  const handleExportExcel = async () => {
    const params = new URLSearchParams({ format: 'xlsx' });
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.type) params.set('type', filters.type);
    if (filters.supplierId) params.set('supplierId', filters.supplierId);

    try {
      const res = await fetch(`${API_URL}/reports/weigh-tickets/export?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pesadas_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDrawerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const type = (form.elements.namedItem('type') as HTMLSelectElement).value as WeighType;
    const datetime = (form.elements.namedItem('datetime') as HTMLInputElement).value;
    const supplierIdRaw = (form.elements.namedItem('supplierId') as HTMLSelectElement).value;
    const supplierId = supplierIdRaw || null;
    const driverIdRaw = (form.elements.namedItem('driverId') as HTMLSelectElement).value;
    const driverId = driverIdRaw || null;
    const truckIdRaw = (form.elements.namedItem('truckId') as HTMLSelectElement).value;
    const truckId = truckIdRaw || null;
    const grossKg = parseFloat((form.elements.namedItem('grossKg') as HTMLInputElement).value);
    const tareKg = parseFloat((form.elements.namedItem('tareKg') as HTMLInputElement).value);
    const notes = (form.elements.namedItem('notes') as HTMLInputElement).value || null;

    if (grossKg < tareKg) {
      setError('Bruto debe ser >= tara');
      return;
    }

    setError(null);
    const body = { type, datetime, grossKg, tareKg, notes, supplierId, driverId, truckId };
    try {
      if (editing) {
        const res = await fetch(`${API_URL}/weigh-tickets/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? 'Error');
        }
        const updated = await res.json();
        setList((prev) => prev.map((x) => (x.id === editing.id ? updated : x)));
      } else {
        const res = await fetch(`${API_URL}/weigh-tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? 'Error');
        }
        const created = await res.json();
        setList((prev) => [created, ...prev]);
      }
      setDrawerOpen(false);
    } catch (e) {
      setError(String(e));
    }
  };

  if (loading && list.length === 0) {
    return <div style={{ padding: 24 }}>Cargando...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ marginBottom: 8 }}>Pesadas</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Registro de pesadas (bruto, tara, neto)
      </p>

      {/* Filtros */}
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
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Tipo</span>
          <select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as WeighType | '' }))}
            style={inputStyle}
          >
            <option value="">Todos</option>
            <option value="PADDY">PADDY</option>
            <option value="SUBPRODUCT">SUBPRODUCT</option>
            <option value="OTHER">OTHER</option>
          </select>
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Proveedor</span>
          <select
            value={filters.supplierId}
            onChange={(e) => setFilters((f) => ({ ...f, supplierId: e.target.value }))}
            style={inputStyle}
          >
            <option value="">Todos</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Chofer</span>
          <select
            value={filters.driverId}
            onChange={(e) => setFilters((f) => ({ ...f, driverId: e.target.value }))}
            style={inputStyle}
          >
            <option value="">Todos</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Camión</span>
          <select
            value={filters.truckId}
            onChange={(e) => setFilters((f) => ({ ...f, truckId: e.target.value }))}
            style={inputStyle}
          >
            <option value="">Todos</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>{t.plate}</option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Buscar (notas)</span>
          <input
            type="text"
            placeholder="Notas..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            style={{ ...inputStyle, minWidth: 160 }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={handleCreate} style={btnStyle('#10b981')}>
          Nueva Pesada
        </button>
        <button onClick={handleExportExcel} style={btnStyle('#334155')}>
          Exportar Excel
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #334155' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>Fecha/Hora</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Nº</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Tipo</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Proveedor</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Chofer</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Camión</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Bruto (kg)</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Tara (kg)</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Neto (kg)</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Notas</th>
            <th style={{ textAlign: 'center', padding: 8 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: 8 }}>{formatDatetime(row.datetime)}</td>
              <td style={{ padding: 8 }}>{row.ticketNumber ?? row.id.slice(0, 8)}</td>
              <td style={{ padding: 8 }}>{row.type}</td>
              <td style={{ padding: 8 }}>{row.supplierName ?? '-'}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(row.grossKg).toLocaleString()}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(row.tareKg).toLocaleString()}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(row.netKg).toLocaleString()}</td>
              <td style={{ padding: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.notes ?? '-'}
              </td>
              <td style={{ padding: 8, textAlign: 'center' }}>
                <button onClick={() => handleEdit(row)} style={{ ...btnStyle('#64748b'), padding: '6px 12px', marginRight: 4 }}>
                  Editar
                </button>
                <button onClick={() => handlePrint(row.id)} style={{ ...btnStyle('#0ea5e9'), padding: '6px 12px', marginRight: 4 }}>
                  Imprimir
                </button>
                <button onClick={() => handleDelete(row.id)} style={{ ...btnStyle('#ef4444'), padding: '6px 12px' }}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p style={{ color: '#94a3b8', marginTop: 16 }}>Sin pesadas</p>}

      {error && <p style={{ color: '#ef4444', marginTop: 16 }}>{error}</p>}

      {/* Drawer Create/Edit */}
      {drawerOpen && (
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
          onClick={() => setDrawerOpen(false)}
        >
          <div
            style={{
              background: '#1e293b',
              padding: 24,
              borderRadius: 12,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 20 }}>{editing ? 'Editar Pesada' : 'Nueva Pesada'}</h3>
            <form onSubmit={handleDrawerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Fecha y hora</span>
                <input
                  name="datetime"
                  type="datetime-local"
                  required
                  defaultValue={
                    editing
                      ? new Date(editing.datetime).toISOString().slice(0, 16)
                      : new Date().toISOString().slice(0, 16)
                  }
                  style={inputStyle}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Tipo</span>
                <select name="type" required style={inputStyle} defaultValue={editing?.type ?? 'PADDY'}>
                  <option value="PADDY">PADDY</option>
                  <option value="SUBPRODUCT">SUBPRODUCT</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Proveedor</span>
                <select name="supplierId" style={inputStyle} defaultValue={editing?.supplierId ?? ''}>
                  <option value="">Ninguno</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Chofer</span>
                <select name="driverId" style={inputStyle} defaultValue={editing?.driverId ?? ''}>
                  <option value="">Ninguno</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Camión</span>
                <select name="truckId" style={inputStyle} defaultValue={editing?.truckId ?? ''}>
                  <option value="">Ninguno</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>{t.plate}</option>
                  ))}
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Bruto (kg)</span>
                <input
                  name="grossKg"
                  type="number"
                  step="0.001"
                  min={0}
                  required
                  defaultValue={editing ? parseFloat(editing.grossKg) : ''}
                  style={inputStyle}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Tara (kg)</span>
                <input
                  name="tareKg"
                  type="number"
                  step="0.001"
                  min={0}
                  required
                  defaultValue={editing ? parseFloat(editing.tareKg) : ''}
                  style={inputStyle}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Notas</span>
                <input
                  name="notes"
                  type="text"
                  placeholder="Opcional"
                  defaultValue={editing?.notes ?? ''}
                  style={inputStyle}
                />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" style={btnStyle('#10b981')}>
                  {editing ? 'Guardar' : 'Crear'}
                </button>
                <button type="button" onClick={() => setDrawerOpen(false)} style={btnStyle('#64748b')}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
