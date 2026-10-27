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

## Mejoras de administración y asistencia (27/10/2026)

- **Administrador principal:** único rol de propietario. Control total del personal, accesos, contraseñas y asignación de encargados. Accede a **Empleados**, **Horarios**, **Asistencia**, **Fichajes**, **Incidencias** y **Auditoría**.
- **Encargado:** acceso con el código y contraseña de su cuenta personal. Puede consultar horarios y registros, planificar turnos, revisar justificaciones y corregir/crear fichajes, pero no puede dar de alta personal, restablecer contraseñas, asignar permisos ni consultar la auditoría reservada al titular.
- **Empleado:** fichaje de entrada, comienzo y fin de pausa y salida, así como consulta de turnos y envío de justificaciones de retrasos, salidas anticipadas o fuera de hora, ausencias y citas médicas. No compartir códigos y contraseñas.
- **Registros manuales:** en **Fichajes** hay una ficha para dar de alta una entrada/salida omitida, con pausas y motivo obligatorio; se conserva autor, fecha de intervención, datos declarados y vínculo con el turno cuando coincide.
- **Correcciones:** modal con datos anteriores, nuevos y explicación obligatoria. Las revisiones van a `public.corrections` inmutable y `public.admin_audit` con actor, afectado y marca de tiempo.
- **Auditoría:** registro de modificaciones de horarios, fichajes, permisos, solicitudes e incidencias; incluye CSV para el propietario.
- **Detección de puntualidad:** avisos con tolerancia visual de 5 minutos, basados en horarios asignados, incluidas jornadas que terminan al día siguiente. Revisar siempre las causas antes de valorar la asistencia.
- **Diseño:** paleta negro/naranja/blanco y emblema SVG circular inspirado en el logo fotografiado del Instagram de GOZA. Es una reconstrucción, **no una copia vectorial certificada del original**. Se puede sustituir por un archivo de marca de buena resolución.

La campana de notificaciones muestra avisos **dentro de la web mientras se utiliza**. No hay todavía notificaciones push al móvil con la web cerrada, ni envío automático de email/WhatsApp por llegadas tarde.

### Seguridad y comprobaciones

Las políticas de Supabase restringen acceso y los procedimientos de escritura validan en el servidor el rol de cada usuario. Los cambios de rol y fichajes manuales se realizan mediante RPC con operaciones en base de datos; el backend de altas utiliza función privada autenticada. No se almacena una contraseña en el histórico de auditoría. Las cuentas deben tener contraseñas personales; no existe verificación de presencia física, por lo que compartir voluntariamente las claves sigue siendo un riesgo.

Antes del uso oficial: comprobar periodos, convenios, descansos retribuidos, conservación de registros durante cuatro años, backup/recuperación, acceso inspector y aviso de protección de datos a los empleados. Los informes horarios no sustituyen una nómina calculada conforme al convenio.
