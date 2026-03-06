import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

type TabType = 'suppliers' | 'customers' | 'processors' | 'drivers' | 'trucks';

interface Supplier {
  id: string;
  name: string;
  rncOrId: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
}

interface Customer {
  id: string;
  name: string;
  rnc: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  isActive: boolean;
}

interface Processor {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
}

interface Driver {
  id: string;
  name: string;
  idNumber: string | null;
  phone: string | null;
  license: string | null;
  isActive: boolean;
}

interface Truck {
  id: string;
  plate: string;
  capacityKg: string | null;
  owner: string | null;
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

export default function ThirdParties() {
  const [searchParams] = useSearchParams();
  const { getAuthHeaders } = useAuth();
  const tabParam = searchParams.get('tab') as TabType | null;
  const [tab, setTab] = useState<TabType>(
    tabParam && ['suppliers', 'customers', 'processors', 'drivers', 'trucks'].includes(tabParam) ? tabParam : 'suppliers'
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [drivers, setDriversList] = useState<Driver[]>([]);
  const [trucks, setTrucksList] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | Customer | Processor | Driver | Truck | null>(null);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [priceRulesOpen, setPriceRulesOpen] = useState(false);
  const [priceRulesSupplier, setPriceRulesSupplier] = useState<Supplier | null>(null);

  const fetchSuppliers = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (activeOnly) params.set('active', 'true');
    return fetch(`${API_URL}/suppliers?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSuppliers);
  }, [getAuthHeaders, search, activeOnly]);

  const fetchCustomers = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (activeOnly) params.set('active', 'true');
    return fetch(`${API_URL}/customers?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setCustomers);
  }, [getAuthHeaders, search, activeOnly]);

  const fetchProcessors = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (activeOnly) params.set('active', 'true');
    return fetch(`${API_URL}/processors?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setProcessors);
  }, [getAuthHeaders, search, activeOnly]);

  const fetchDrivers = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (activeOnly) params.set('active', 'true');
    return fetch(`${API_URL}/drivers?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setDriversList);
  }, [getAuthHeaders, search, activeOnly]);

  const fetchTrucks = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (activeOnly) params.set('active', 'true');
    return fetch(`${API_URL}/trucks?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setTrucksList);
  }, [getAuthHeaders, search, activeOnly]);

  const fetchCurrent = useCallback(() => {
    setLoading(true);
    setError(null);
    const fetchers: Record<TabType, () => Promise<unknown>> = {
      suppliers: fetchSuppliers,
      customers: fetchCustomers,
      processors: fetchProcessors,
      drivers: fetchDrivers,
      trucks: fetchTrucks,
    };
    fetchers[tab]().catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [tab, fetchSuppliers, fetchCustomers, fetchProcessors, fetchDrivers, fetchTrucks]);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && ['suppliers', 'customers', 'processors', 'drivers', 'trucks'].includes(t)) setTab(t as TabType);
  }, [searchParams]);

  const handleCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const handleEdit = (row: Supplier | Customer | Processor | Driver | Truck) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Inactivar este registro? (soft delete)')) return;
    setError(null);
    const endpoint = `${API_URL}/${tab}/${id}`;
    try {
      const res = await fetch(endpoint, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      fetchCurrent();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleReactivate = async (row: Supplier | Customer | Processor | Driver | Truck) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/${tab}/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      fetchCurrent();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDrawerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);

    if (tab === 'suppliers') {
      const body = {
        name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
        rncOrId: (form.elements.namedItem('rncOrId') as HTMLInputElement).value.trim() || null,
        phone: (form.elements.namedItem('phone') as HTMLInputElement).value.trim() || null,
        address: (form.elements.namedItem('address') as HTMLInputElement).value.trim() || null,
      };
      const url = editing ? `${API_URL}/suppliers/${(editing as Supplier).id}` : `${API_URL}/suppliers`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
    } else if (tab === 'customers') {
      const body = {
        name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
        rnc: (form.elements.namedItem('rnc') as HTMLInputElement).value.trim() || null,
        phone: (form.elements.namedItem('phone') as HTMLInputElement).value.trim() || null,
        address: (form.elements.namedItem('address') as HTMLInputElement).value.trim() || null,
        email: (form.elements.namedItem('email') as HTMLInputElement).value.trim() || null,
      };
      const url = editing ? `${API_URL}/customers/${(editing as Customer).id}` : `${API_URL}/customers`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
    } else if (tab === 'processors') {
      const body = {
        name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
        contactName: (form.elements.namedItem('contactName') as HTMLInputElement).value.trim() || null,
        phone: (form.elements.namedItem('phone') as HTMLInputElement).value.trim() || null,
        address: (form.elements.namedItem('address') as HTMLInputElement).value.trim() || null,
      };
      const url = editing ? `${API_URL}/processors/${(editing as Processor).id}` : `${API_URL}/processors`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
    } else if (tab === 'drivers') {
      const body = {
        name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
        idNumber: (form.elements.namedItem('idNumber') as HTMLInputElement).value.trim() || null,
        phone: (form.elements.namedItem('phone') as HTMLInputElement).value.trim() || null,
        license: (form.elements.namedItem('license') as HTMLInputElement).value.trim() || null,
      };
      const url = editing ? `${API_URL}/drivers/${(editing as Driver).id}` : `${API_URL}/drivers`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
    } else {
      const body = {
        plate: (form.elements.namedItem('plate') as HTMLInputElement).value.trim(),
        capacityKg: (form.elements.namedItem('capacityKg') as HTMLInputElement).value.trim() || null,
        owner: (form.elements.namedItem('owner') as HTMLInputElement).value.trim() || null,
      };
      const url = editing ? `${API_URL}/trucks/${(editing as Truck).id}` : `${API_URL}/trucks`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
    }
    setDrawerOpen(false);
    fetchCurrent();
  };

  const list = tab === 'suppliers' ? suppliers : tab === 'customers' ? customers : tab === 'processors' ? processors : tab === 'drivers' ? drivers : trucks;
  const columns = tab === 'suppliers'
    ? ['Nombre', 'RNC/ID', 'Teléfono', 'Activo']
    : tab === 'customers'
    ? ['Nombre', 'RNC', 'Email', 'Teléfono', 'Activo']
    : tab === 'processors'
    ? ['Nombre', 'Contacto', 'Teléfono', 'Activo']
    : tab === 'drivers'
    ? ['Nombre', 'Cédula/ID', 'Teléfono', 'Licencia', 'Activo']
    : ['Placa', 'Capacidad (kg)', 'Propietario', 'Activo'];

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ marginBottom: 8 }}>Terceros</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Proveedores, clientes y procesadores
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['suppliers', 'customers', 'processors', 'drivers', 'trucks'] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...btnStyle(tab === t ? '#0ea5e9' : '#334155'),
              padding: '8px 16px',
            }}
          >
            {t === 'suppliers' ? 'Proveedores' : t === 'customers' ? 'Clientes' : t === 'processors' ? 'Procesadores' : t === 'drivers' ? 'Choferes' : 'Camiones'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={tab === 'trucks' ? 'Buscar por placa...' : 'Buscar por nombre...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 200 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Solo activos
        </label>
        <button onClick={handleCreate} style={btnStyle('#10b981')}>
          Nuevo {tab === 'suppliers' ? 'Proveedor' : tab === 'customers' ? 'Cliente' : 'Procesador'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 24 }}>Cargando...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              {columns.map((c) => (
                <th key={c} style={{ textAlign: 'left', padding: 8 }}>{c}</th>
              ))}
              <th style={{ textAlign: 'center', padding: 8 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #334155' }}>
                <td style={{ padding: 8 }}>{tab === 'trucks' ? (row as Truck).plate : (row as Supplier | Customer | Processor | Driver).name}</td>
                {tab === 'suppliers' && (
                  <>
                    <td style={{ padding: 8 }}>{(row as Supplier).rncOrId ?? '-'}</td>
                    <td style={{ padding: 8 }}>{(row as Supplier).phone ?? '-'}</td>
                  </>
                )}
                {tab === 'customers' && (
                  <>
                    <td style={{ padding: 8 }}>{(row as Customer).rnc ?? '-'}</td>
                    <td style={{ padding: 8 }}>{(row as Customer).email ?? '-'}</td>
                    <td style={{ padding: 8 }}>{(row as Customer).phone ?? '-'}</td>
                  </>
                )}
                {tab === 'processors' && (
                  <>
                    <td style={{ padding: 8 }}>{(row as Processor).contactName ?? '-'}</td>
                    <td style={{ padding: 8 }}>{(row as Processor).phone ?? '-'}</td>
                  </>
                )}
                {tab === 'drivers' && (
                  <>
                    <td style={{ padding: 8 }}>{(row as Driver).idNumber ?? '-'}</td>
                    <td style={{ padding: 8 }}>{(row as Driver).phone ?? '-'}</td>
                    <td style={{ padding: 8 }}>{(row as Driver).license ?? '-'}</td>
                  </>
                )}
                {tab === 'trucks' && (
                  <>
                    <td style={{ padding: 8 }}>{(row as Truck).capacityKg ?? '-'}</td>
                    <td style={{ padding: 8 }}>{(row as Truck).owner ?? '-'}</td>
                  </>
                )}
                <td style={{ padding: 8 }}>{row.isActive ? 'Sí' : 'No'}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  {tab === 'suppliers' && (
                    <button
                      onClick={() => { setPriceRulesSupplier(row as Supplier); setPriceRulesOpen(true); }}
                      style={{ ...btnStyle('#8b5cf6'), padding: '6px 12px', marginRight: 4 }}
                    >
                      Reglas de precio
                    </button>
                  )}
                  <button onClick={() => handleEdit(row)} style={{ ...btnStyle('#64748b'), padding: '6px 12px', marginRight: 4 }}>
                    Editar
                  </button>
                  {row.isActive ? (
                    <button onClick={() => handleDelete(row.id)} style={{ ...btnStyle('#ef4444'), padding: '6px 12px' }}>
                      Inactivar
                    </button>
                  ) : (
                    <button onClick={() => handleReactivate(row)} style={{ ...btnStyle('#10b981'), padding: '6px 12px' }}>
                      Activar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {list.length === 0 && !loading && <p style={{ color: '#94a3b8', marginTop: 16 }}>Sin registros</p>}
      {error && <p style={{ color: '#ef4444', marginTop: 16 }}>{error}</p>}

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
            <h3 style={{ marginBottom: 20 }}>
              {editing ? 'Editar' : 'Nuevo'} {tab === 'suppliers' ? 'Proveedor' : tab === 'customers' ? 'Cliente' : tab === 'processors' ? 'Procesador' : tab === 'drivers' ? 'Chofer' : 'Camión'}
            </h3>
            <form onSubmit={handleDrawerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tab !== 'trucks' && (
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Nombre *</span>
                  <input
                    name="name"
                    required
                    defaultValue={editing && 'name' in editing ? editing.name : ''}
                    style={inputStyle}
                  />
                </label>
              )}
              {tab === 'trucks' && (
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Placa *</span>
                  <input
                    name="plate"
                    required
                    defaultValue={(editing as Truck)?.plate ?? ''}
                    style={inputStyle}
                    placeholder="Ej: A123456"
                  />
                </label>
              )}
              {tab === 'suppliers' && (
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>RNC/ID</span>
                  <input name="rncOrId" defaultValue={(editing as Supplier)?.rncOrId ?? ''} style={inputStyle} />
                </label>
              )}
              {tab === 'customers' && (
                <>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>RNC</span>
                    <input name="rnc" defaultValue={(editing as Customer)?.rnc ?? ''} style={inputStyle} />
                  </label>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Email</span>
                    <input name="email" type="email" defaultValue={(editing as Customer)?.email ?? ''} style={inputStyle} />
                  </label>
                </>
              )}
              {tab === 'processors' && (
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Contacto</span>
                  <input name="contactName" defaultValue={(editing as Processor)?.contactName ?? ''} style={inputStyle} />
                </label>
              )}
              {tab === 'drivers' && (
                <>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Cédula/Pasaporte</span>
                    <input name="idNumber" defaultValue={(editing as Driver)?.idNumber ?? ''} style={inputStyle} />
                  </label>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Licencia</span>
                    <input name="license" defaultValue={(editing as Driver)?.license ?? ''} style={inputStyle} />
                  </label>
                </>
              )}
              {tab === 'trucks' && (
                <>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Capacidad (kg)</span>
                    <input name="capacityKg" defaultValue={(editing as Truck)?.capacityKg ?? ''} style={inputStyle} />
                  </label>
                  <label>
                    <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Propietario</span>
                    <input name="owner" defaultValue={(editing as Truck)?.owner ?? ''} style={inputStyle} />
                  </label>
                </>
              )}
              {tab !== 'trucks' && (
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Teléfono</span>
                  <input
                    name="phone"
                    defaultValue={
                      tab === 'suppliers'
                        ? (editing as Supplier)?.phone ?? ''
                        : tab === 'customers'
                        ? (editing as Customer)?.phone ?? ''
                        : tab === 'processors'
                        ? (editing as Processor)?.phone ?? ''
                        : (editing as Driver)?.phone ?? ''
                    }
                    style={inputStyle}
                  />
                </label>
              )}
              {(tab === 'suppliers' || tab === 'customers' || tab === 'processors') && (
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Dirección</span>
                  <input
                    name="address"
                    defaultValue={
                      tab === 'suppliers'
                        ? (editing as Supplier)?.address ?? ''
                        : tab === 'customers'
                        ? (editing as Customer)?.address ?? ''
                        : (editing as Processor)?.address ?? ''
                    }
                    style={inputStyle}
                  />
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" style={btnStyle('#10b981')}>{editing ? 'Guardar' : 'Crear'}</button>
                <button type="button" onClick={() => setDrawerOpen(false)} style={btnStyle('#64748b')}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer Reglas de precio (solo proveedores) */}
      {priceRulesOpen && priceRulesSupplier && (
        <PriceRulesDrawer
          supplier={priceRulesSupplier}
          onClose={() => { setPriceRulesOpen(false); setPriceRulesSupplier(null); }}
          getAuthHeaders={getAuthHeaders}
        />
      )}
    </div>
  );
}

interface PriceRule {
  id: string;
  effectiveFrom: string;
  basePricePerKg: string;
  currency: string;
  moistureBasePct: string;
  moisturePenaltyPerPct: string;
  impurityBasePct: string;
  impurityPenaltyPerPct: string;
  roundingMode: string;
  isActive: boolean;
}

function PriceRulesDrawer({
  supplier,
  onClose,
  getAuthHeaders,
}: {
  supplier: Supplier;
  onClose: () => void;
  getAuthHeaders: () => Record<string, string>;
}) {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchRules = useCallback(() => {
    setLoading(true);
    fetch(`${API_URL}/suppliers/${supplier.id}/price-rules`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRules)
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, [supplier.id, getAuthHeaders]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      effectiveFrom: (form.elements.namedItem('effectiveFrom') as HTMLInputElement).value,
      basePricePerKg: parseFloat((form.elements.namedItem('basePricePerKg') as HTMLInputElement).value),
      moistureBasePct: parseFloat((form.elements.namedItem('moistureBasePct') as HTMLInputElement).value) || 14,
      moisturePenaltyPerPct: parseFloat((form.elements.namedItem('moisturePenaltyPerPct') as HTMLInputElement).value) || 0,
      impurityBasePct: parseFloat((form.elements.namedItem('impurityBasePct') as HTMLInputElement).value) || 1,
      impurityPenaltyPerPct: parseFloat((form.elements.namedItem('impurityPenaltyPerPct') as HTMLInputElement).value) || 0,
    };
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/suppliers/${supplier.id}/price-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error');
      }
      setFormOpen(false);
      fetchRules();
    } catch (e) {
      setErr(String(e));
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('¿Eliminar esta regla?')) return;
    try {
      const res = await fetch(`${API_URL}/suppliers/${supplier.id}/price-rules/${ruleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error');
      fetchRules();
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e293b',
          padding: 24,
          borderRadius: 12,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 8 }}>Reglas de precio</h3>
        <p style={{ color: '#94a3b8', marginBottom: 20 }}>{supplier.name}</p>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              {rules.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    background: '#0f172a',
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <strong>Desde {r.effectiveFrom}</strong> – {parseFloat(r.basePricePerKg).toFixed(4)} {r.currency}/kg
                    <br />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      Humedad base {r.moistureBasePct}%, penalidad {r.moisturePenaltyPerPct}/% · Impurezas base {r.impurityBasePct}%, penalidad {r.impurityPenaltyPerPct}/%
                    </span>
                  </div>
                  <button onClick={() => handleDelete(r.id)} style={{ ...btnStyle('#ef4444'), padding: '6px 12px' }}>
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
            {formOpen ? (
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Vigente desde</span>
                  <input name="effectiveFrom" type="date" required style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Precio base (kg)</span>
                  <input name="basePricePerKg" type="number" step="0.0001" min={0} required style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Humedad base (%)</span>
                  <input name="moistureBasePct" type="number" step="0.01" defaultValue={14} style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Penalidad humedad por %</span>
                  <input name="moisturePenaltyPerPct" type="number" step="0.0001" min={0} defaultValue={0} style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Impurezas base (%)</span>
                  <input name="impurityBasePct" type="number" step="0.01" defaultValue={1} style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Penalidad impurezas por %</span>
                  <input name="impurityPenaltyPerPct" type="number" step="0.0001" min={0} defaultValue={0} style={inputStyle} />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={btnStyle('#10b981')}>Crear</button>
                  <button type="button" onClick={() => setFormOpen(false)} style={btnStyle('#64748b')}>Cancelar</button>
                </div>
              </form>
            ) : (
              <button onClick={() => setFormOpen(true)} style={btnStyle('#10b981')}>
                Nueva regla
              </button>
            )}
          </>
        )}
        {err && <p style={{ color: '#ef4444', marginTop: 16 }}>{err}</p>}
        <div style={{ marginTop: 20 }}>
          <button onClick={onClose} style={btnStyle('#64748b')}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
