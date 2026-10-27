# GOZA Fichaje · Control horario para Goza Tacos Franceses (Zaragoza)

Sitio de pruebas / futura versión real: https://ayyoub1616.github.io/goza-fichaje/

## Estado actual

**El frontend privado y el backend SQL están programados; no está activado el fichaje real.**
Si `config.js` no tiene URL y clave pública de un proyecto Supabase propio, la web sigue mostrando una demostración **sin autenticación, no apta para uso laboral**. La demo guarda datos exclusivamente en el navegador. No introducir fichajes o nombres reales en la demo.

## Funciones desarrolladas para la versión real

- Acceso con contraseña individual y código de empleado. No se puede seleccionar un compañero por su nombre.
- Administrador con correo y contraseña propios; solo el administrador crea empleados y genera/restablece credenciales.
- Alta, baja lógica, cambio de contraseña, objetivo semanal opcional y límite de 10 empleados activos.
- Fichajes de entrada, pausa, fin de pausa y salida; jornadas partidas y turnos nocturnos.
- Fecha/hora del servidor en UTC, interfaz en Europe/Madrid. Transacciones atómicas y bloqueo de jornadas abiertas duplicadas.
- Resumen de jornadas abiertas, horas hoy/semana, incidencias y avisos de descanso inferior a 12 horas o jornada abierta más de 12 horas.
- Informes filtrables, paginación histórica, CSV y correcciones con motivo y auditoría inmutable.
- Datos guardados en Supabase Postgres con RLS; empleados solo pueden ver sus propios datos.
- La Edge Function `supabase/functions/manage-staff/index.ts` utiliza credenciales de servidor **solo en el entorno privado**.

## Pasos obligatorios para activar el fichaje real

1. Crear un **proyecto Supabase independiente** para GOZA en una organización seleccionada expresamente por el propietario (preferible región UE). Confirmar cualquier coste antes de crearlo.
2. Ejecutar `schema.sql` como migración de esquema en el proyecto GOZA. **No ejecutarlo en otros proyectos existentes.**
3. En Supabase Authentication, configurar que no existan nuevos registros públicos (**Disable signup**); añadir una cuenta de administrador con un correo tuyo verificable y contraseña elegida por ti en un canal privado (no compartas contraseñas en GitHub ni aquí).
4. Desde Authentication > Users, copiar el UUID del usuario que acabas de crear y registrar solo ese UUID como administrador:
   ```sql
   insert into public.staff(user_id, employee_code, full_name, role)
   values ('UUID_DEL_ADMIN', 'GOZA-ADMIN', 'Administrador GOZA', 'admin');
   ```
5. Desplegar Edge Function `manage-staff` con validación JWT activada. Configurar el servicio para que use secretos de Supabase disponibles **solo en el servidor**. No publicar service role ni contraseñas.
6. Configurar `config.js` con URL y `publishable key` reales del proyecto GOZA (estas dos son públicas por diseño; las políticas RLS son obligatorias):
   ```js
   window.GOZA_CONFIG = {supabaseUrl: 'https://TU-PROYECTO.supabase.co',supabasePublishableKey: 'TU_CLAVE_PUBLICABLE'};
   ```
7. Verificar 2 teléfonos, inicio/fin de jornada, doble clic, entrada de noche y salida a día siguiente, acceso a historial, edición auditada y restablecimiento de clave.
8. Configurar **copias de seguridad externas periódicas**, prueba de restauración, control de acceso e información de protección de datos; garantizar 4 años de conservación conforme a la norma española. Supabase gratis no garantiza automáticamente esta conservación.

## Seguridad / notas de uso

- Prohibidos códigos PIN idénticos a número de empleado; se generan contraseñas aleatorias robustas y se muestran una sola vez al administrador.
- El trabajador puede cambiar su contraseña. La desactivación de su perfil impide consultas y fichajes aunque conserve una sesión abierta.
- Las credenciales no se guardan en localStorage de la demo ni en la tabla de empleados.
- Las correcciones requieren motivo y dejan auditada la versión original. Nunca borrar eventos de fichaje.
- Compartir voluntariamente la contraseña sigue siendo posible: para verificar presencia física pueden estudiarse medidas adicionales proporcionadas y compatibles con RGPD, pero no se ha implementado vigilancia ni geolocalización.
- El descanso descontado del tiempo efectivo depende del convenio/acuerdo aplicable; comprobarlo antes de usar los informes para nóminas.
- La media temporal de los KPI cuando un turno cruza medianoche reparte la pausa proporcionalmente; se presenta como **estimación**, no como liquidación salarial automática.
- Diseño visual propio de GOZA (tipográfico provisional). El logo oficial de Instagram no se ha podido obtener y verificar.

## GitHub Pages

La publicación usa `.github/workflows/pages.yml`, valida JavaScript y publica solo los archivos estáticos incluidos en `dist`. Los archivos de base de datos y de funciones servidor no se suben como recursos de la web pública.

Desarrollo responsable de un sistema de registro horario requiere verificación funcional y asesoramiento laboral antes de producción.
