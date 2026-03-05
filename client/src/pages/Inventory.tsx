import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

type TabType = 'items' | 'stock' | 'movements' | 'adjustments';

interface Item {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  uom: string;
  isActive: boolean;
}

interface StockRow {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  uom: string;
  stockKg: number;
}

interface Move {
  id: string;
  itemId: string;
  itemName: string;
  datetime: string;
  direction: string;
  qtyKg: string;
  refType: string;
  refId: string | null;
  notes: string | null;
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

export default function Inventory() {
  const { getAuthHeaders } = useAuth();
  const [tab, setTab] = useState<TabType>('items');
  const [items, setItems] = useState<Item[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [itemForm, setItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [adjustForm, setAdjustForm] = useState(false);
  const [moveFilters, setMoveFilters] = useState({ itemId: '', dateFrom: '', dateTo: '', refType: '' });

  const fetchItems = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (categoryFilter) params.set('category', categoryFilter);
    if (activeOnly) params.set('active', 'true');
    return fetch(`${API_URL}/items?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems);
  }, [getAuthHeaders, search, categoryFilter, activeOnly]);

  const fetchStock = useCallback(() => {
    return fetch(`${API_URL}/inventory/stock`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setStock);
  }, [getAuthHeaders]);

  const fetchMoves = useCallback(() => {
    const params = new URLSearchParams();
    if (moveFilters.itemId) params.set('itemId', moveFilters.itemId);
    if (moveFilters.dateFrom) params.set('dateFrom', moveFilters.dateFrom);
    if (moveFilters.dateTo) params.set('dateTo', moveFilters.dateTo);
    if (moveFilters.refType) params.set('refType', moveFilters.refType);
    return fetch(`${API_URL}/inventory/moves?${params}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setMoves);
  }, [getAuthHeaders, moveFilters]);

  const fetchCurrent = useCallback(() => {
    setLoading(true);
    setError(null);
    const fetchers: Record<TabType, () => Promise<unknown>> = {
      items: fetchItems,
      stock: fetchStock,
      movements: fetchMoves,
      adjustments: () => Promise.resolve(),
    };
    fetchers[tab]().catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [tab, fetchItems, fetchStock, fetchMoves]);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const handleCreateItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const sku = (form.elements.namedItem('sku') as HTMLInputElement).value.trim() || null;
    const category = (form.elements.namedItem('category') as HTMLSelectElement).value;
    if (!name || !category) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name, sku, category }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      setItemForm(false);
      fetchItems();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleUpdateItem = async (e: React.FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const sku = (form.elements.namedItem('sku') as HTMLInputElement).value.trim() || null;
    const category = (form.elements.namedItem('category') as HTMLSelectElement).value;
    const isActive = (form.elements.namedItem('isActive') as HTMLInputElement).checked;
    if (!name || !category) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name, sku, category, isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      setEditingItem(null);
      fetchItems();
      fetchStock();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('¿Desactivar este item?')) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/items/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error');
      setEditingItem(null);
      fetchItems();
      fetchStock();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleAdjustment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const itemId = (form.elements.namedItem('itemId') as HTMLSelectElement).value;
    const direction = (form.elements.namedItem('direction') as HTMLSelectElement).value;
    const qtyKg = parseFloat((form.elements.namedItem('qtyKg') as HTMLInputElement).value);
    const notes = (form.elements.namedItem('notes') as HTMLInputElement).value.trim() || null;
    if (!itemId || !direction || isNaN(qtyKg) || qtyKg <= 0) return;
    const qty = direction === 'OUT' ? -qtyKg : qtyKg;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/inventory/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ itemId, direction: 'ADJUST', qtyKg: qty, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error');
      }
      setAdjustForm(false);
      fetchStock();
      fetchMoves();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleExportStock = async () => {
    try {
      const res = await fetch(`${API_URL}/reports/inventory/stock/export?format=xlsx`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_stock_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleExportMoves = async () => {
    try {
      const params = new URLSearchParams({ format: 'xlsx' });
      if (moveFilters.dateFrom) params.set('from', moveFilters.dateFrom);
      if (moveFilters.dateTo) params.set('to', moveFilters.dateTo);
      if (moveFilters.itemId) params.set('itemId', moveFilters.itemId);
      const res = await fetch(`${API_URL}/reports/inventory/moves/export?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_moves_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  };

  const activeItems = items.filter((i) => i.isActive);

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ marginBottom: 8 }}>Inventario</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Items, existencias, kardex y ajustes
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['items', 'stock', 'movements', 'adjustments'] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...btnStyle(tab === t ? '#0ea5e9' : '#334155'),
              padding: '8px 16px',
            }}
          >
            {t === 'items' ? 'Items' : t === 'stock' ? 'Stock' : t === 'movements' ? 'Movimientos' : 'Ajustes'}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: 12, background: '#7f1d1d', borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {tab === 'items' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label>
              <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Buscar</span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} placeholder="Nombre" />
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Categoría</span>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={inputStyle}>
                <option value="">Todas</option>
                <option value="FINISHED">FINISHED</option>
                <option value="SUBPRODUCT">SUBPRODUCT</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Solo activos</span>
            </label>
            <button onClick={() => { setItemForm(true); setEditingItem(null); }} style={btnStyle('#10b981')}>
              Nuevo item
            </button>
          </div>

          {itemForm && (
            <div style={{ padding: 20, background: '#1e293b', borderRadius: 8, marginBottom: 24, maxWidth: 400 }}>
              <h4>Nuevo item</h4>
              <form onSubmit={handleCreateItem} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Nombre *</span>
                  <input name="name" required style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>SKU</span>
                  <input name="sku" style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Categoría *</span>
                  <select name="category" required style={inputStyle}>
                    <option value="FINISHED">FINISHED</option>
                    <option value="SUBPRODUCT">SUBPRODUCT</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={btnStyle('#10b981')}>Crear</button>
                  <button type="button" onClick={() => setItemForm(false)} style={btnStyle('#64748b')}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>Nombre</th>
                <th style={{ textAlign: 'left', padding: 8 }}>SKU</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Categoría</th>
                <th style={{ textAlign: 'left', padding: 8 }}>UOM</th>
                <th style={{ textAlign: 'center', padding: 8 }}>Activo</th>
                <th style={{ textAlign: 'center', padding: 8 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #334155' }}>
                  {editingItem?.id === item.id ? (
                    <td colSpan={6} style={{ padding: 16 }}>
                      <form onSubmit={(e) => handleUpdateItem(e, item.id)} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
                        <label>
                          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Nombre *</span>
                          <input name="name" required style={inputStyle} defaultValue={item.name} />
                        </label>
                        <label>
                          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>SKU</span>
                          <input name="sku" style={inputStyle} defaultValue={item.sku ?? ''} />
                        </label>
                        <label>
                          <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Categoría *</span>
                          <select name="category" required style={inputStyle} defaultValue={item.category}>
                            <option value="FINISHED">FINISHED</option>
                            <option value="SUBPRODUCT">SUBPRODUCT</option>
                            <option value="OTHER">OTHER</option>
                          </select>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input name="isActive" type="checkbox" defaultChecked={item.isActive} />
                          <span>Activo</span>
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="submit" style={btnStyle('#10b981')}>Guardar</button>
                          <button type="button" onClick={() => setEditingItem(null)} style={btnStyle('#64748b')}>Cancelar</button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: 8 }}>{item.name}</td>
                      <td style={{ padding: 8 }}>{item.sku ?? '-'}</td>
                      <td style={{ padding: 8 }}>{item.category}</td>
                      <td style={{ padding: 8 }}>{item.uom}</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>{item.isActive ? 'Sí' : 'No'}</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        <button onClick={() => setEditingItem(item)} style={{ ...btnStyle('#64748b'), padding: '6px 12px', marginRight: 8 }}>Editar</button>
                        {item.isActive && (
                          <button onClick={() => handleDeleteItem(item.id)} style={{ ...btnStyle('#ef4444'), padding: '6px 12px' }}>Desactivar</button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && !loading && <p style={{ color: '#94a3b8' }}>Sin items. Crea uno para comenzar.</p>}
        </div>
      )}

      {tab === 'stock' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Existencias actuales</h3>
            <button onClick={handleExportStock} style={btnStyle('#0ea5e9')}>Exportar Excel</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>Item</th>
                <th style={{ textAlign: 'left', padding: 8 }}>SKU</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Categoría</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Stock (kg)</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: 8 }}>{s.name}</td>
                  <td style={{ padding: 8 }}>{s.sku ?? '-'}</td>
                  <td style={{ padding: 8 }}>{s.category}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{s.stockKg.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stock.length === 0 && !loading && <p style={{ color: '#94a3b8' }}>Sin stock registrado.</p>}
        </div>
      )}

      {tab === 'movements' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label>
              <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Item</span>
              <select
                value={moveFilters.itemId}
                onChange={(e) => setMoveFilters((f) => ({ ...f, itemId: e.target.value }))}
                style={inputStyle}
              >
                <option value="">Todos</option>
                {activeItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Desde</span>
              <input
                type="date"
                value={moveFilters.dateFrom}
                onChange={(e) => setMoveFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Hasta</span>
              <input
                type="date"
                value={moveFilters.dateTo}
                onChange={(e) => setMoveFilters((f) => ({ ...f, dateTo: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Ref. tipo</span>
              <select
                value={moveFilters.refType}
                onChange={(e) => setMoveFilters((f) => ({ ...f, refType: e.target.value }))}
                style={inputStyle}
              >
                <option value="">Todos</option>
                <option value="BULK_RECEIPT">BULK_RECEIPT</option>
                <option value="SALE">SALE</option>
                <option value="PURCHASE">PURCHASE</option>
                <option value="MANUAL">MANUAL</option>
              </select>
            </label>
            <button onClick={fetchMoves} style={btnStyle('#64748b')}>Filtrar</button>
            <button onClick={handleExportMoves} style={btnStyle('#0ea5e9')}>Exportar Excel</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>Fecha</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Item</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Dirección</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Cantidad (kg)</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Ref. tipo</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Notas</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: 8 }}>{formatDatetime(m.datetime)}</td>
                  <td style={{ padding: 8 }}>{m.itemName}</td>
                  <td style={{ padding: 8 }}>{m.direction}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{parseFloat(m.qtyKg).toLocaleString()}</td>
                  <td style={{ padding: 8 }}>{m.refType}</td>
                  <td style={{ padding: 8 }}>{m.notes ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {moves.length === 0 && !loading && <p style={{ color: '#94a3b8' }}>Sin movimientos.</p>}
        </div>
      )}

      {tab === 'adjustments' && (
        <div>
          <h3 style={{ marginBottom: 16 }}>Ajuste manual</h3>
          {!adjustForm ? (
            <button onClick={() => setAdjustForm(true)} style={btnStyle('#10b981')}>
              Crear ajuste
            </button>
          ) : (
            <div style={{ padding: 20, background: '#1e293b', borderRadius: 8, maxWidth: 400 }}>
              <form onSubmit={handleAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Item *</span>
                  <select name="itemId" required style={inputStyle}>
                    <option value="">Seleccionar</option>
                    {activeItems.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Tipo</span>
                  <select name="direction" style={inputStyle}>
                    <option value="IN">Entrada (+)</option>
                    <option value="OUT">Salida (-)</option>
                  </select>
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Cantidad (kg) *</span>
                  <input name="qtyKg" type="number" step="0.001" min="0.001" required style={inputStyle} />
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>Notas</span>
                  <input name="notes" style={inputStyle} />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={btnStyle('#10b981')}>Crear ajuste</button>
                  <button type="button" onClick={() => setAdjustForm(false)} style={btnStyle('#64748b')}>Cancelar</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {loading && <p style={{ color: '#94a3b8' }}>Cargando...</p>}
    </div>
  );
}
