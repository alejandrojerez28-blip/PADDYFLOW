import { Link } from 'react-router-dom';

export default function BillingCancel() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h1 style={{ marginBottom: 16 }}>Checkout cancelado</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        No se realizó ningún cargo. Puedes suscribirte cuando quieras.
      </p>
      <Link
        to="/settings/billing"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          background: '#334155',
          color: '#fff',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        Volver a Facturación
      </Link>
    </div>
  );
}
