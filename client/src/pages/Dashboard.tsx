import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

interface TenantMe {
  tenant: {
    id: string;
    name: string;
    country: string | null;
    onboardingStatus: string;
    taxMode: string;
  };
}

export default function Dashboard() {
  const { getAuthHeaders } = useAuth();
  const [tenant, setTenant] = useState<TenantMe['tenant'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/tenants/me`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: TenantMe) => setTenant(data.tenant))
      .catch(() => setTenant(null))
      .finally(() => setLoading(false));
  }, [getAuthHeaders]);

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (!tenant) {
    return (
      <div style={{ padding: 24 }}>
        <p>Inicia sesión para ver el dashboard.</p>
        <Link to="/" style={{ color: '#0ea5e9' }}>Ir al inicio</Link>
      </div>
    );
  }

  const isDO = tenant.country === 'DO';
  const isFiscalReady = tenant.onboardingStatus === 'FISCAL_READY';

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginBottom: 8 }}>Dashboard — {tenant.name}</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Estado: {tenant.onboardingStatus} | Modo: {tenant.taxMode}
      </p>

      <nav style={{ marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link to="/settings/fiscal" style={{ color: '#0ea5e9' }}>Configuración Fiscal RD</Link>
        <Link to="/sales" style={{ color: '#0ea5e9' }}>Ventas</Link>
        <Link to="/settings/billing" style={{ color: '#0ea5e9' }}>Facturación</Link>
      </nav>

      {isDO && !isFiscalReady && (
        <div
          style={{
            padding: 20,
            background: '#1e3a5f',
            borderRadius: 8,
            marginBottom: 24,
            borderLeft: '4px solid #0ea5e9',
          }}
        >
          <h3 style={{ marginBottom: 12 }}>Configuración fiscal pendiente</h3>
          <ol style={{ marginLeft: 20, lineHeight: 1.8 }}>
            <li>Completar datos fiscales (RNC, dirección) en <Link to="/settings/fiscal" style={{ color: '#7dd3fc' }}>Configuración Fiscal</Link></li>
            <li>Cargar secuencias NCF/e-CF</li>
            <li>Activar emisión</li>
          </ol>
          <p style={{ marginTop: 12, color: '#94a3b8', fontSize: 14 }}>
            Mientras tanto puedes crear <strong>Proformas</strong>. Las facturas fiscales requieren completar el setup.
          </p>
        </div>
      )}

      <div style={{ padding: 20, background: '#1e293b', borderRadius: 8 }}>
        <h3 style={{ marginBottom: 12 }}>Acciones rápidas</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            to="/sales?new=proforma"
            style={{
              padding: '12px 20px',
              background: '#10b981',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Nueva Proforma
          </Link>
          {isFiscalReady && (
            <Link
              to="/sales?new=invoice"
              style={{
                padding: '12px 20px',
                background: '#8b5cf6',
                color: '#fff',
                borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              Nueva factura fiscal
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
