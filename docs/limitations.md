# Limitaciones conocidas — PaddyFlow

## e-CF / DGII (República Dominicana)

El módulo fiscal está preparado para integración con proveedores de Comprobantes Fiscales Electrónicos (e-CF). **El proveedor actual es un stub**: no envía comprobantes reales a la DGII. Las facturas se crean en el sistema con estado pendiente de envío, pero no se transmiten a ningún proveedor autorizado.

Para producción fiscal en RD, se requiere configurar un proveedor e-CF real (PROVIDER_X, PROVIDER_Y u otro que se integre).

## Token y sesión

- **Almacenamiento**: El token JWT se guarda en `sessionStorage`. Esto mitiga riesgos de XSS respecto a `localStorage`, pero el token sigue siendo accesible desde JavaScript en la misma pestaña.
- **Persistencia**: Al cerrar la pestaña o el navegador, la sesión se pierde. Debes iniciar sesión de nuevo.
- **Plan futuro**: Migración a cookie HttpOnly para mayor seguridad y opción de "recordarme".

## Otros

- **Exportaciones**: Los reportes Excel tienen límites de filas (ej. 5000 movimientos, 500 lotes) para evitar timeouts. Para datos muy grandes, usa filtros de fecha.
- **Impresión**: Los tickets de pesada usan la ventana de impresión del navegador. Para impresión térmica directa, puede requerirse configuración adicional.
