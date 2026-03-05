import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supportConfig, hasSupport } from '../config/support';

const API_URL = '/api';

export default function Home() {
  const { token, setToken, getAuthHeaders } = useAuth();
  const [health, setHealth] = useState<string | null>(null);
  const [me, setMe] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setError(null);
    try {
      const res = await fetch('/health');
      const data = await res.json();
      setHealth(JSON.stringify(data, null, 2));
    } catch (e) {
      setError(String(e));
    }
  };

  const register = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@demo.com',
          password: 'password123',
          name: 'Admin Demo',
          tenantName: 'Arrocera Demo',
          country: 'DO',
        }),
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setMe({ user: data.user, tenant: data.tenant });
      } else {
        setError(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const fetchMe = async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/tenants/me`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setMe(data);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 600 }}>
      <h1 style={{ marginBottom: '1rem' }}>PaddyFlow</h1>
      <p style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>
        Multi-tenant + Auth + Billing
      </p>

      <nav style={{ marginBottom: 24 }}>
        <Link to="/dashboard" style={{ color: '#0ea5e9', marginRight: 16 }}>Dashboard</Link>
        <Link to="/settings/billing" style={{ color: '#0ea5e9', marginRight: 16 }}>Facturación</Link>
        <Link to="/settings/fiscal" style={{ color: '#0ea5e9', marginRight: 16 }}>Fiscal RD</Link>
        <Link to="/sales" style={{ color: '#0ea5e9', marginRight: 16 }}>Ventas</Link>
        <Link to="/weigh-tickets" style={{ color: '#0ea5e9', marginRight: 16 }}>Pesadas</Link>
        <Link to="/third-parties" style={{ color: '#0ea5e9' }}>Terceros</Link>
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <button onClick={checkHealth} style={btnStyle('#334155')}>
          Health check
        </button>
        <button onClick={register} style={btnStyle('#0ea5e9')}>
          Registrar tenant + usuario
        </button>
        {token && (
          <button onClick={fetchMe} style={btnStyle('#10b981')}>
            GET /api/tenants/me (protegido)
          </button>
        )}
      </div>

      {(health || me || error) && (
        <pre
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#1e293b',
            borderRadius: 8,
            fontSize: 12,
            overflow: 'auto',
          }}
        >
          {error ?? JSON.stringify(health ? JSON.parse(health) : me, null, 2)}
        </pre>
      )}

      <footer style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #334155', fontSize: 14, color: '#64748b' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
          <Link to="/legal/terms" style={{ color: '#94a3b8' }}>Términos</Link>
          <Link to="/legal/privacy" style={{ color: '#94a3b8' }}>Privacidad</Link>
        </div>
        {hasSupport() && (
          <p style={{ margin: 0 }}>
            ¿Necesitas ayuda?{' '}
            {supportConfig.email && (
              <a href={`mailto:${supportConfig.email}`} style={{ color: '#0ea5e9' }}>Email</a>
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
      </footer>
    </div>
  );
}

const btnStyle = (bg: string) => ({
  padding: '0.5rem 1rem',
  background: bg,
  color: '#e2e8f0',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
});
