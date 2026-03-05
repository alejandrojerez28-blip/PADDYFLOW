# Guía rápida — PaddyFlow

## Registro e inicio de sesión

1. **Registrarse**: En la página de inicio, usa el botón de registro. Proporciona email, contraseña, nombre y nombre de tu empresa (tenant).
2. **Login**: Tras el registro, inicia sesión con tu email y contraseña. Si tienes acceso a varias empresas, selecciona el tenant correspondiente.

## Conceptos clave

- **Tenant**: Tu empresa u organización. Cada tenant tiene sus propios datos aislados (proveedores, pesadas, lotes, inventario).
- **Usuarios**: Cada usuario pertenece a un tenant. Los roles definen permisos (AdminTenant, OperadorPesada, Contabilidad, Viewer).
- **Roles**: AdminTenant gestiona todo; OperadorPesada y Contabilidad pueden crear/editar; Viewer solo consulta.

## Flujo operativo

### 1. Terceros

Configura primero los actores del negocio:

- **Proveedores**: Quienes entregan arroz paddy o subproductos.
- **Choferes y camiones**: Para asociar a las pesadas.
- **Procesadores**: A quienes envías el arroz para procesar.
- **Clientes**: Para ventas y facturación.

Ruta: **Terceros** (pestañas Proveedores, Clientes, Procesadores, Choferes, Camiones).

### 2. Pesadas

Registra cada entrada de arroz:

- Crea un ticket de pesada con bruto, tara, neto.
- Asocia proveedor, chofer y camión si aplica.
- Imprime el ticket desde el botón de impresión.
- Exporta a Excel desde el listado.

Ruta: **Pesadas**.

### 3. Lotes

Agrupa pesadas en lotes para seguimiento:

1. **Entradas**: Crea un lote y agrega pesadas (cada pesada solo puede estar en un lote).
2. **Envío**: Registra envío a procesador con fecha, chofer, camión y kg enviados.
3. **Recepción granel**: Cuando regresa el producto procesado, registra recepción (super sacos, total kg).
4. **Distribuir**: En la pestaña Recepción, usa "Distribuir" para asignar los kg recibidos a items de inventario (arroz pulido, afrecho, etc.).

Ruta: **Lotes** → selecciona un lote.

### 4. Inventario

Gestiona productos y existencias:

- **Items**: Crea productos (FINISHED, SUBPRODUCT, OTHER).
- **Stock**: Consulta existencias actuales.
- **Movimientos**: Kardex de entradas y salidas.
- **Ajustes**: Correcciones manuales (entrada/salida).

Ruta: **Inventario**.

### 5. Rendimiento

Reportes de yield y liquidación por lote:

- Input kg (pesadas), recibido kg (recepción granel).
- Yield % y merma.
- Distribución por item si existe split.
- Export Excel del reporte.

Ruta: **Rendimiento** o pestaña Rendimiento en el detalle del lote.

## Imprimir tickets y exportar Excel

- **Pesadas**: Botón "Imprimir" en cada ticket. Botón "Exportar Excel" en el listado.
- **Inventario**: Pestaña Stock o Movimientos → "Exportar Excel".
- **Rendimiento**: Botón "Exportar Excel" en el reporte o en el detalle del lote.

## Buenas prácticas

- **Split completo**: Para reportes de rendimiento exactos, distribuye el 100% de cada recepción granel a items de inventario. Si no, verás "Distribución incompleta".
- **Pesadas únicas**: Una pesada solo puede estar en un lote. Planifica la asignación antes de crear lotes.
- **Items activos**: Desactiva items que ya no uses en lugar de eliminarlos, para mantener historial.
