# GOZA Fichaje — Tacos Franceses Zaragoza

Aplicación web móvil de fichaje para equipos pequeños.

## Probar la demostración

La página principal muestra una **demo interactiva** mientras `config.js` no tenga un Supabase configurado. No necesita contraseñas. Entra en **Soy empleado**, selecciona un empleado ficticio, ficha y después entra en **Soy responsable** para revisar los datos, dar de alta empleados de prueba y exportar CSV.

**No es un registro laboral real:** los datos de prueba se guardan únicamente en el almacenamiento local del navegador, sin sincronización entre dispositivos, sin autenticación real y sin copias de seguridad. No utilizar nombres o datos laborales reales durante esta prueba. La demo está marcada como tal en todas las pantallas.

## Activar la web pública

Ya está preparado `.github/workflows/pages.yml` para publicar automáticamente desde `main`.

En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. No hace falta crear otro workflow; al guardar o relanzar el workflow de Pages, la web quedará en `https://ayyoub1616.github.io/goza-fichaje/` cuando GitHub confirme que se ha desplegado.

## Preparar registro real

1. Crear un proyecto nuevo y exclusivo de Supabase para GOZA, preferiblemente en una región de la UE. Revisar coste y plan.
2. Aplicar y auditar `schema.sql`; verificar RPC/RLS, permisos, seguridad y backups.
3. Deshabilitar el registro público en Supabase Authentication y crear usuario administrador individual (correo y contraseña segura).
4. Vincular el UUID del administrador a `public.staff` con rol `admin`.
5. Rellenar `config.js` **solo** con la URL de Supabase y la clave publicable. Nunca subir claves `service_role`, contraseñas o secretos al repositorio.
6. Probar integralmente fichajes reales desde móviles distintos, panel, incidencias y exportación; implantar copias externas y retención de al menos cuatro años.

La web detecta la conexión real y deja de mostrar la demo automáticamente. Para ver la demo aun con backend conectado, se puede añadir `?demo=1` a la URL.

**Diseño:** logotipo tipográfico provisional GOZA en naranja/amarillo; no se ha verificado la imagen oficial del perfil de Google Business. Reemplazar al disponer del archivo de marca original.

**Aviso legal:** prototipo no auditado. Antes de operar como sistema oficial, verificar cumplimiento laboral aplicable, conservación de registros y RGPD, incluyendo jornadas partidas, descanso efectivo, trazabilidad de correcciones y acceso de inspección.
