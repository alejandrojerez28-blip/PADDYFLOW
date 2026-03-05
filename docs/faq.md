# Preguntas frecuentes — PaddyFlow

## ¿Por qué "Distribución incompleta"?

Cuando registras una recepción granel (ej. 20.000 kg), debes **distribuir** esos kg entre los items de inventario (arroz pulido, afrecho, etc.). Si la suma de los splits es menor que el total de la recepción, el sistema marca "Distribución incompleta". Para reportes de rendimiento exactos, distribuye el 100% usando el botón "Distribuir" en cada recepción.

## ¿Cómo corregir una pesada?

Si cometiste un error en una pesada ya registrada:

1. Si la pesada **no está en un lote**: puedes editarla desde el listado de Pesadas (si tu rol lo permite).
2. Si la pesada **ya está en un lote**: quítala del lote primero (en el detalle del lote, pestaña Entradas → Quitar), luego edita la pesada y vuelve a agregarla al lote si corresponde.

## ¿Cómo ajustar inventario?

En **Inventario** → pestaña **Ajustes**:

1. Selecciona el item.
2. Elige tipo: Entrada (+) o Salida (-).
3. Ingresa la cantidad en kg.
4. Opcional: notas para auditoría.

El ajuste se registra como movimiento MANUAL y afecta el stock inmediatamente.

## ¿Cómo funciona el aislamiento por empresa?

Cada **tenant** (empresa) tiene sus datos completamente separados. Los usuarios de un tenant solo ven y gestionan datos de su propia empresa. Proveedores, pesadas, lotes, inventario y reportes son independientes por tenant. No hay forma de acceder a datos de otro tenant.

## ¿Puedo tener varios usuarios en mi empresa?

Sí. El administrador del tenant puede invitar usuarios (según la configuración de tu plan). Cada usuario tiene un rol que define sus permisos.

## ¿Qué pasa si mi suscripción vence?

Las lecturas (consultas, reportes, exportaciones) siguen disponibles. Las escrituras (crear, editar, eliminar) se bloquean hasta que reactives la suscripción. Recibirás recordatorios por email.
