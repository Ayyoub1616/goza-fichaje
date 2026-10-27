# GOZA Fichaje — Zaragoza
Web móvil para registros de jornada con acceso individual. El código del frontend está en GitHub Pages. Los registros reales requieren un proyecto Supabase separado con RLS y cuentas privadas.

## Pendiente antes de producción
1. Crear Supabase independiente (UE) con el permiso del propietario y revisar coste.
2. Aplicar migración SQL del paquete de instalación y auditar funciones/RLS.
3. En Authentication desactivar registro público, crear administrador con contraseña segura y asociar su UUID a public.staff.
4. Introducir solo URL y clave PUBLICABLE en config.js (nunca service_role).
5. Activar GitHub Pages en Settings > Pages > Deploy from branch > main > root.
6. Probar fichajes, cambios de turno, backups y retención mínima de 4 años antes de utilizar como registro laboral oficial.

No almacenar nombres de empleados, contraseñas ni fichajes en el repositorio público.
