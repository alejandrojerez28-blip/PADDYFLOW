import { Link } from 'react-router-dom';

export default function LegalPrivacy() {
  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginBottom: 16 }}>Política de privacidad</h1>
      <p style={{ color: '#94a3b8', fontStyle: 'italic', marginBottom: 24 }}>
        Placeholder — Contenido pendiente de revisión legal.
      </p>
      <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
        La Política de Privacidad de PaddyFlow describirá:
      </p>
      <ul style={{ marginBottom: 16, paddingLeft: 24, lineHeight: 1.8 }}>
        <li>Qué datos personales recopilamos</li>
        <li>Cómo los usamos y almacenamos</li>
        <li>Con quién los compartimos (si aplica)</li>
        <li>Derechos del usuario (acceso, rectificación, eliminación)</li>
        <li>Uso de cookies y tecnologías similares</li>
        <li>Medidas de seguridad</li>
      </ul>
      <p style={{ marginBottom: 24, lineHeight: 1.6 }}>
        Para consultas: contactar a soporte.
      </p>
      <Link to="/" style={{ color: '#0ea5e9' }}>← Volver al inicio</Link>
    </div>
  );
}
