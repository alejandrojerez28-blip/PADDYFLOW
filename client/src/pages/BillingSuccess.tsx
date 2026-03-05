import { Link } from 'react-router-dom';

export default function BillingSuccess() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h1 style={{ marginBottom: 16 }}>¡Suscripción activada!</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Tu pago se ha procesado correctamente.
      </p>
      <Link
        to="/settings/billing"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          background: '#10b981',
          color: '#fff',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        Ir a Facturación
      </Link>
    </div>
  );
}
