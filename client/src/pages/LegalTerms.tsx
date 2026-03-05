import { Link } from 'react-router-dom';

export default function LegalTerms() {
  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginBottom: 16 }}>Términos de servicio</h1>
      <p style={{ color: '#94a3b8', fontStyle: 'italic', marginBottom: 24 }}>
        Placeholder — Contenido pendiente de revisión legal.
      </p>
      <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
        Los Términos de Servicio de PaddyFlow establecerán las condiciones de uso del software, responsabilidades del proveedor y del cliente, limitaciones de garantía, y procedimientos de resolución de disputas.
      </p>
      <p style={{ marginBottom: 24, lineHeight: 1.6 }}>
        Para consultas: contactar a soporte.
      </p>
      <Link to="/" style={{ color: '#0ea5e9' }}>← Volver al inicio</Link>
    </div>
  );
}
