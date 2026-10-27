# GOZA Fichaje · Goza Tacos Franceses, Zaragoza

Web: https://ayyoub1616.github.io/goza-fichaje/

## Instalación actual (27/10/2026)

- Proyecto Supabase **GOZA Fichaje**, exclusivo de este restaurante, `cbadexhiekwcxcbivifk` en `eu-west-3` (París).
- Coste cotizado para el proyecto: **0 USD/mes** según Supabase; plan gratuito con límites, sin garantía de copias automáticas.
- Esquema SQL instalado con RLS, tablas privadas, RPC transaccionales, auditoría de correcciones y eventos.
- Edge Function `manage-staff` con JWT obligatorio desplegada; accesos iniciales por código deshabilitados por seguridad.
- `config.js` conectado mediante URL y **clave publicable**. No hay claves de servicio ni contraseñas en GitHub.
- GitHub Pages conectado con publicación automática.
- **Pendiente:** el titular debe activar su primera cuenta con su propio correo y contraseña. Antes de eso no hay cuentas ni fichajes reales registrados.

## Activación inicial de administrador (paso pendiente)

Por seguridad, el arranque mediante códigos temporales está desactivado. Los dos endpoints de activación inicial tienen `verify_jwt=true` y no permiten otorgar permisos anónimamente.

1. Abre [Supabase Authentication > Users](https://supabase.com/dashboard/project/cbadexhiekwcxcbivifk/auth/users).
2. Con `Add user`, crea **tu propio usuario** con correo y contraseña segura (no compartir credenciales por el chat).
3. Una vez creado, autoriza su UUID en `public.staff` como administrador único:
   ```sql
   insert into public.staff(user_id,employee_code,full_name,role,active)
   values ('UUID_DEL_USUARIO_AUTH','GOZA-ADMIN','Administrador GOZA','admin',true);
   ```
   Este segundo paso puede realizarlo el asistente al detectar el usuario recién creado, después de que el titular indique que ha terminado el alta.
4. Desde la web principal, entra como Administrador y utiliza `Empleados` para crear al personal y entregar sus códigos individuales.

**Nunca pegues contraseñas, tokens ni claves secretas en GitHub, en un formulario público o en este chat.**

## Qué permite

- Empleados: iniciar/cerrar jornada, comenzar/terminar pausa, revisar historial y enviar incidencias.
- Administrador: altas, desactivaciones, regenerar credenciales, jornadas abiertas, KPIs de horas, incidencias, filtros, CSV y correcciones con motivo.
- Se conservan horas en UTC (servidor), visualización Europe/Madrid, bloqueo de doble fichaje y eventos de fichaje inmutables.
- Acceso restringido por usuario con **Row Level Security**. El código de empleado no equivale a contraseña.
- Turnos de noche o partidos. Los KPI son estimaciones: determinar si una pausa es retribuida o tiempo efectivo según convenio.

## Uso responsable antes de adoptar como registro laboral oficial

1. Probar en **dos móviles distintos**: administrador y empleado; entrada/pausa/salida, doble pulsación, nocturnos y conexión intermitente.
2. Establecer política de correcciones, acceso de trabajadores y acreditación ante Inspección de Trabajo.
3. Implementar **copias de seguridad externas** periódicas y comprobar recuperación. La base gratuita puede suspenderse por inactividad y el plan no asegura conservación durante cuatro años.
4. Restringir el registro libre en Authentication y revisar políticas de contraseñas/MFA para administrador en Supabase.
5. Configurar RGPD (información al personal, encargado de tratamiento, minimización, retención, acceso y eliminación al expirar el plazo legal).
6. Antes de usar para nóminas o cotizaciones, auditar cálculo de pausas y reglas del convenio correspondiente. No usar los datos de demostración.

## Seguridad

El frontend es público por diseño (GitHub Pages); los datos están exclusivamente en Supabase bajo RLS. No almacenar secretos en `config.js`, `app.js`, `schema.sql` o un repositorio público. Los empleados reciben credenciales individuales; no se puede fichar simplemente seleccionando un nombre, pero compartir voluntariamente credenciales sigue siendo un riesgo residual.

## Identidad visual

Interfaz original en naranja/crema de GOZA. El logotipo del Instagram facilitado por el titular no ha podido verificarse o recuperarse con fiabilidad, por lo que se utiliza una versión tipográfica provisional.