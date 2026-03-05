# Seguridad — PaddyFlow

## Almacenamiento del token

**Actualmente se usa `sessionStorage` como mitigación frente a XSS** (el token no persiste entre pestañas/ventanas, reduciendo la superficie de exposición respecto a `localStorage`).

**Migración a cookie HttpOnly planificada** para mayor protección (el token no sería accesible desde JavaScript).

## Medidas implementadas

- JWT con algoritmo HS256 explícito
- CORS restringido a orígenes permitidos
- Rate limiting en login/register
- Webhook Stripe con validación de firma
- `req.user` sin `passwordHash`
- Token en `sessionStorage` (no `localStorage`)
