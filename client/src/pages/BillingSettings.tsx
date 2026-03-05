import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

interface BillingStatus {
  tenantId: string;
  subscriptionStatus: string;
  plan: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  isBlocked: boolean;
  features: { maxUsers: number; has3D: boolean; hasSavedViews: boolean };
}

export default function BillingSettings() {
  const { getAuthHeaders } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/billing/status`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setStatus)
      .catch(() => setError('No autorizado. Inicia sesión.'))
      .finally(() => setLoading(false));
  }, [getAuthHeaders]);

  const handleCheckout = async (plan: 'basic' | 'pro') => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/billing/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.redirectToPortal) {
        const portalRes = await fetch(`${API_URL}/billing/portal-session`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        const portalData = await portalRes.json();
        if (portalData.url) window.location.href = portalData.url;
        else setError(portalData.error ?? 'Error al abrir portal');
      } else {
        setError(data.error ?? 'Error al crear checkout');
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handlePortal = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/billing/portal-session`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Error al abrir portal');
      }
    } catch (e) {
      setError(String(e));
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (error && !status) return <div style={{ padding: 24, color: '#ef4444' }}>{error}</div>;

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es') : '—';

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <h1 style={{ marginBottom: 8 }}>Facturación</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Gestiona tu suscripción y plan
      </p>

      {status?.isBlocked && (
        <div
          style={{
            padding: 16,
            background: '#7f1d1d',
            borderRadius: 8,
            marginBottom: 24,
            color: '#fecaca',
          }}
        >
          Tu suscripción requiere atención. Actualiza tu método de pago.
        </div>
      )}

      {status && (
        <div
          style={{
            padding: 20,
            background: '#1e293b',
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <p>
            <strong>Estado:</strong> {status.subscriptionStatus}
          </p>
          <p>
            <strong>Plan:</strong> {status.plan}
          </p>
          <p>
            <strong>Próximo período:</strong> {formatDate(status.currentPeriodEnd)}
          </p>
          <p>
            <strong>Trial hasta:</strong> {formatDate(status.trialEndsAt)}
          </p>
          <p>
            <strong>Features:</strong> {status.features.maxUsers} usuarios, 3D:{' '}
            {status.features.has3D ? 'Sí' : 'No'}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(!status?.subscriptionStatus ||
          status.subscriptionStatus === 'no_subscription') && (
          <>
            <button
              onClick={() => handleCheckout('basic')}
              style={btnStyle('#0ea5e9')}
            >
              Start Basic
            </button>
            <button
              onClick={() => handleCheckout('pro')}
              style={btnStyle('#8b5cf6')}
            >
              Start Pro
            </button>
          </>
        )}
        {(status?.subscriptionStatus === 'trialing' ||
          status?.subscriptionStatus === 'active') && (
          <button onClick={handlePortal} style={btnStyle('#10b981')}>
            Upgrade / Manage billing
          </button>
        )}
      </div>

      {error && (
        <p style={{ marginTop: 16, color: '#ef4444' }}>{error}</p>
      )}
    </div>
  );
}

const btnStyle = (bg: string) => ({
  padding: '12px 20px',
  background: bg,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 16,
});
