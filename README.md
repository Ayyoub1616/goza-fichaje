# GOZA Fichaje · Goza Tacos Franceses, Zaragoza

Web: https://ayyoub1616.github.io/goza-fichaje/

## Instalación actual (27/10/2026)

- Proyecto Supabase **GOZA Fichaje**, exclusivo de este restaurante, `cbadexhiekwcxcbivifk` en `eu-west-3` (París).
- Coste cotizado para el proyecto: **0 USD/mes** según Supabase; plan gratuito con límites, sin garantía de copias automáticas.
- Esquema SQL instalado con RLS, tablas privadas, RPC transaccionales, auditoría de correcciones y eventos.
- Edge Functions `manage-staff` (JWT obligatorio) y `bootstrap-goza-admin` (activación inicial protegida por código de un solo uso; `setup-admin` antiguo deshabilitado) desplegadas.
- `config.js` conectado mediante URL y **clave publicable**. No hay claves de servicio ni contraseñas en GitHub.
- GitHub Pages conectado con publicación automática.
- **Pendiente:** el titular debe activar su primera cuenta con su propio correo y contraseña. Antes de eso no hay cuentas ni fichajes reales registrados.

## Activación inicial de administrador

Abre: https://ayyoub1616.github.io/goza-fichaje/?setup=1

1. Escribe tu correo personal y una contraseña nueva de al menos 12 caracteres con letras y números.
2. Copia el código privado de activación facilitado en la conversación con ChatGPT. **El código no está en este repositorio.**
3. Después entra desde la web principal, elige «Administrador» e inicia sesión con correo y contraseña.
4. Ve a «Empleados», crea cada trabajador y entrega su código y contraseña provisional de manera privada.
5. Pide que cada trabajador cambie su contraseña tras el primer acceso. La función de activación ya no admite crear un segundo administrador.

**Importante:** la activación solo funciona si no hay ningún administrador dado de alta. El código privado jamás debe publicarse en GitHub o redes sociales.

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