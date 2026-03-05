import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

interface FiscalProfile {
  country: string | null;
  onboardingStatus: string;
  taxMode: string;
  legalName: string | null;
  tradeName: string | null;
  rnc: string | null;
  fiscalAddress: string | null;
  fiscalEmail: string | null;
  fiscalPhone: string | null;
  itbisRegistered: boolean;
  defaultDocCurrency: string | null;
  ecfProvider: string;
}

interface Sequence {
  id: string;
  docType: string;
  prefix: string;
  startNumber: number;
  endNumber: number;
  currentNumber: number;
  isActive: boolean;
}

export default function FiscalSettings() {
  const { getAuthHeaders } = useAuth();
  const [profile, setProfile] = useState<FiscalProfile | null>(null);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    Promise.all([
      fetch(`${API_URL}/tenants/fiscal-profile`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/dgii/sequences`, { headers: getAuthHeaders() }),
    ])
      .then(async ([r1, r2]) => {
        if (!r1.ok && r1.status === 401) throw new Error('Inicia sesión');
        const p = r1.ok ? r1.json() : null;
        const s = r2.ok ? r2.json() : [];
        return [await p, await s];
      })
      .then(([p, s]) => {
        setProfile(p);
        setSequences(Array.isArray(s) ? s : []);
      })
      .catch((e) => setError(e?.message ?? 'No autorizado'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [getAuthHeaders]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      legalName: (form.elements.namedItem('legalName') as HTMLInputElement).value,
      tradeName: (form.elements.namedItem('tradeName') as HTMLInputElement).value,
      rnc: (form.elements.namedItem('rnc') as HTMLInputElement).value,
      fiscalAddress: (form.elements.namedItem('fiscalAddress') as HTMLInputElement).value,
      fiscalEmail: (form.elements.namedItem('fiscalEmail') as HTMLInputElement).value || undefined,
      fiscalPhone: (form.elements.namedItem('fiscalPhone') as HTMLInputElement).value || undefined,
      itbisRegistered: (form.elements.namedItem('itbisRegistered') as HTMLInputElement).checked,
      defaultDocCurrency: (form.elements.namedItem('defaultDocCurrency') as HTMLSelectElement).value,
    };

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/tenants/fiscal-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error al guardar');
      }
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSequence = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const docType = (form.elements.namedItem('docType') as HTMLSelectElement).value;
    const startNumber = parseInt((form.elements.namedItem('startNumber') as HTMLInputElement).value, 10);
    const endNumber = parseInt((form.elements.namedItem('endNumber') as HTMLInputElement).value, 10);

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/dgii/sequences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify([{ docType, startNumber, endNumber }]),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error al crear secuencia');
      }
      load();
      form.reset();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (error && !profile) return <div style={{ padding: 24, color: '#ef4444' }}>{error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <h1 style={{ marginBottom: 8 }}>Configuración Fiscal RD</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Perfil fiscal y secuencias NCF/e-CF
      </p>

      {profile?.country !== 'DO' && (
        <p style={{ color: '#f59e0b', marginBottom: 16 }}>
          Esta configuración aplica para tenants de República Dominicana (country=DO).
        </p>
      )}

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 16 }}>Perfil fiscal</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            Razón social *
            <input name="legalName" required defaultValue={profile?.legalName ?? ''} style={inputStyle} />
          </label>
          <label>
            Nombre comercial
            <input name="tradeName" defaultValue={profile?.tradeName ?? ''} style={inputStyle} />
          </label>
          <label>
            RNC *
            <input name="rnc" required defaultValue={profile?.rnc ?? ''} style={inputStyle} />
          </label>
          <label>
            Dirección fiscal *
            <input name="fiscalAddress" required defaultValue={profile?.fiscalAddress ?? ''} style={inputStyle} />
          </label>
          <label>
            Email fiscal
            <input name="fiscalEmail" type="email" defaultValue={profile?.fiscalEmail ?? ''} style={inputStyle} />
          </label>
          <label>
            Teléfono
            <input name="fiscalPhone" defaultValue={profile?.fiscalPhone ?? ''} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input name="itbisRegistered" type="checkbox" defaultChecked={profile?.itbisRegistered ?? true} />
            Registrado ITBIS
          </label>
          <label>
            Moneda por defecto
            <select name="defaultDocCurrency" defaultValue={profile?.defaultDocCurrency ?? 'DOP'} style={inputStyle}>
              <option value="DOP">DOP</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <button type="submit" disabled={saving} style={btnStyle('#0ea5e9')}>
            {saving ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </form>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 16 }}>Secuencias NCF/e-CF</h2>
        <form onSubmit={handleAddSequence} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <label>
            Tipo
            <select name="docType" required style={inputStyle}>
              <option value="ECF_E31">ECF E31</option>
              <option value="ECF_E32">ECF E32</option>
              <option value="NCF_B01">NCF B01</option>
              <option value="NCF_B02">NCF B02</option>
            </select>
          </label>
          <label>
            Desde número
            <input name="startNumber" type="number" min={1} required defaultValue={1} style={inputStyle} />
          </label>
          <label>
            Hasta número
            <input name="endNumber" type="number" min={1} required defaultValue={100} style={inputStyle} />
          </label>
          <button type="submit" disabled={saving} style={btnStyle('#10b981')}>
            Agregar secuencia
          </button>
        </form>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <th style={{ textAlign: 'left', padding: 8 }}>Tipo</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Rango</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Actual</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {sequences.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #334155' }}>
                <td style={{ padding: 8 }}>{s.docType}</td>
                <td style={{ padding: 8 }}>{s.startNumber} - {s.endNumber}</td>
                <td style={{ padding: 8 }}>{s.currentNumber}</td>
                <td style={{ padding: 8 }}>{s.isActive ? 'Activa' : 'Inactiva'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sequences.length === 0 && <p style={{ color: '#94a3b8', marginTop: 12 }}>Sin secuencias</p>}
      </div>

      <div style={{ padding: 16, background: '#1e293b', borderRadius: 8, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Proveedor e-CF</h3>
        <p>Proveedor actual: <strong>{profile?.ecfProvider ?? 'NONE'}</strong></p>
        <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>
          e-CF envío deshabilitado hasta configurar proveedor autorizado (fase futura).
        </p>
      </div>

      {profile?.onboardingStatus === 'FISCAL_READY' && (
        <div style={{ padding: 16, background: '#064e3b', borderRadius: 8, color: '#6ee7b7' }}>
          ✓ Configuración fiscal lista. Puedes emitir facturas fiscales.
        </div>
      )}

      {error && <p style={{ color: '#ef4444', marginTop: 16 }}>{error}</p>}
    </div>
  );
}

const inputStyle = {
  display: 'block',
  width: '100%',
  padding: 8,
  marginTop: 4,
  background: '#1e293b',
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
  alignSelf: 'flex-start',
});
