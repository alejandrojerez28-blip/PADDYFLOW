import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supportConfig, hasSupport } from '../config/support';

const API_URL = '/api';
const ONBOARDING_HIDDEN_KEY = 'paddyflow_onboarding_hidden';

interface TenantMe {
  tenant: {
    id: string;
    name: string;
    country: string | null;
    onboardingStatus: string;
    taxMode: string;
  };
}

interface OnboardingStatus {
  suppliersCount: number;
  driversCount: number;
  trucksCount: number;
  weighTicketsCount: number;
  lotsCount: number;
  hasLotWithoutInputs: boolean;
  hasLotWithoutReceipts: boolean;
  hasReceiptWithPendingSplit: boolean;
  firstLotIdWithoutInputs: string | null;
  firstLotIdWithoutReceipts: string | null;
  firstLotIdWithReceiptPendingSplit: string | null;
}

export default function Dashboard() {
  const { getAuthHeaders } = useAuth();
  const [tenant, setTenant] = useState<TenantMe['tenant'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [checklistHidden, setChecklistHidden] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_HIDDEN_KEY) === '1'
  );

  useEffect(() => {
    fetch(`${API_URL}/tenants/me`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: TenantMe) => setTenant(data.tenant))
      .catch(() => setTenant(null))
      .finally(() => setLoading(false));
  }, [getAuthHeaders]);

  useEffect(() => {
    if (tenant) {
      fetch(`${API_URL}/onboarding/status`, { headers: getAuthHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then(setOnboarding)
        .catch(() => setOnboarding(null));
    }
  }, [tenant, getAuthHeaders]);

  const hideChecklist = () => {
    setChecklistHidden(true);
    localStorage.setItem(ONBOARDING_HIDDEN_KEY, '1');
  };

  const showChecklist = () => {
    setChecklistHidden(false);
    localStorage.removeItem(ONBOARDING_HIDDEN_KEY);
  };

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

  const s = onboarding;
  const hasSuppliers = (s?.suppliersCount ?? 0) > 0;
  const hasDriversAndTrucks = (s?.driversCount ?? 0) > 0 && (s?.trucksCount ?? 0) > 0;
  const hasWeighTickets = (s?.weighTicketsCount ?? 0) > 0;
  const hasLots = (s?.lotsCount ?? 0) > 0;
  const hasLotWithReceipts = hasLots && !(s?.hasLotWithoutReceipts ?? true);
  const allReceiptsDistributed = !(s?.hasReceiptWithPendingSplit ?? false);
  const hasSeenYieldReport = hasLots && hasLotWithReceipts;

  const checklistItems = [
    { done: hasSuppliers, label: 'Crear Proveedor', cta: '/third-parties?tab=suppliers', ctaLabel: 'Ir a Terceros' },
    { done: hasDriversAndTrucks, label: 'Crear Chofer y Camión', cta: '/third-parties?tab=drivers', ctaLabel: 'Ir a Terceros' },
    { done: hasWeighTickets, label: 'Registrar Pesadas', cta: '/weigh-tickets', ctaLabel: 'Ir a Pesadas' },
    { done: hasLots, label: 'Crear Lote', cta: '/lots', ctaLabel: 'Ir a Lotes' },
    { done: !(s?.hasLotWithoutInputs ?? false), label: 'Agregar Pesadas a un Lote', cta: s?.firstLotIdWithoutInputs ? `/lots/${s.firstLotIdWithoutInputs}` : '/lots', ctaLabel: 'Abrir lote' },
    { done: !(s?.hasLotWithoutReceipts ?? false), label: 'Registrar Recepción Granel', cta: s?.firstLotIdWithoutReceipts ? `/lots/${s.firstLotIdWithoutReceipts}?tab=receipts` : '/lots', ctaLabel: 'Abrir lote' },
    { done: allReceiptsDistributed, label: 'Distribuir Recepción a Inventario', cta: s?.firstLotIdWithReceiptPendingSplit ? `/lots/${s.firstLotIdWithReceiptPendingSplit}?tab=receipts` : '/lots', ctaLabel: 'Distribuir' },
    { done: hasSeenYieldReport, label: 'Ver Reporte de Rendimiento', cta: '/reports/yield', ctaLabel: 'Ver reporte' },
  ];

  const allDone = checklistItems.every((i) => i.done);
  const showChecklistBlock = onboarding && !allDone && !checklistHidden;

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginBottom: 8 }}>Dashboard — {tenant.name}</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Estado: {tenant.onboardingStatus} | Modo: {tenant.taxMode}
      </p>

      {showChecklistBlock && (
        <div style={{ padding: 20, background: '#1e3a5f', borderRadius: 8, marginBottom: 24, borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Primeros pasos</h3>
            <button
              onClick={hideChecklist}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}
            >
              Ocultar
            </button>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
            {checklistItems.map((item, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: item.done ? '#10b981' : '#94a3b8' }}>{item.done ? '✓' : '○'}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {!item.done && (
                  <Link to={item.cta} style={{ color: '#7dd3fc', fontSize: 14 }}>
                    {item.ctaLabel} →
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {checklistHidden && (
        <button
          onClick={showChecklist}
          style={{ marginBottom: 24, background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
        >
          Mostrar primeros pasos
        </button>
      )}

      <nav style={{ marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link to="/settings/fiscal" style={{ color: '#0ea5e9' }}>Configuración Fiscal RD</Link>
        <Link to="/sales" style={{ color: '#0ea5e9' }}>Ventas</Link>
        <Link to="/weigh-tickets" style={{ color: '#0ea5e9' }}>Pesadas</Link>
        <Link to="/settlements" style={{ color: '#0ea5e9' }}>Liquidaciones</Link>
        <Link to="/third-parties" style={{ color: '#0ea5e9' }}>Terceros</Link>
        <Link to="/lots" style={{ color: '#0ea5e9' }}>Lotes</Link>
        <Link to="/inventory" style={{ color: '#0ea5e9' }}>Inventario</Link>
        <Link to="/reports/yield" style={{ color: '#0ea5e9' }}>Rendimiento</Link>
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

      {hasSupport() && (
        <p style={{ marginBottom: 24, fontSize: 14, color: '#94a3b8' }}>
          ¿Necesitas ayuda?{' '}
          {supportConfig.email && (
            <a href={`mailto:${supportConfig.email}`} style={{ color: '#0ea5e9' }}>Contactar soporte</a>
          )}
          {supportConfig.email && supportConfig.whatsapp && ' · '}
          {supportConfig.whatsapp && (
            <a href={`https://wa.me/${supportConfig.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9' }}>WhatsApp</a>
          )}
          {(supportConfig.email || supportConfig.whatsapp) && supportConfig.url && ' · '}
          {supportConfig.url && (
            <a href={supportConfig.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9' }}>Soporte</a>
          )}
        </p>
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
