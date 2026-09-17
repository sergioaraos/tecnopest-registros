# Bitácora — TecnoRegistros

Instrucciones para la herramienta que trabaje en este proyecto: antes de empezar, revisa la última entrada para saber en qué se quedó. Al terminar una sesión de trabajo con cambios relevantes, agrega una entrada nueva al final de este archivo (no edites entradas anteriores) con este formato exacto:

## AAAA-MM-DD HH:MM — <herramienta>
Estado: <en progreso | bloqueado | terminado>
Resumen: <2 a 4 líneas de qué se hizo>
Archivos/carpetas tocados: <lista breve>
Recursos/URLs/config: <si aplica, si no, omitir la línea>
Pendientes: <qué queda para la próxima sesión>

---

## 2026-09-17 19:00 — Cowork
Estado: en progreso
Resumen: se creó la bitácora del proyecto para integrarlo al gestor de proyectos (gestor-proyectos-app). Repo verificado limpio, main al día con origin, último commit el merge del PR #11.
Archivos/carpetas tocados: BITACORA.md (nuevo)
Pendientes: definir cliente y prioridad de este proyecto en el gestor, y conectar la carpeta para que el gestor empiece a leerla.

## 2026-09-17 22:36 — Cowork
Estado: en progreso
Resumen: se reconcilio el estado de git (main local estaba desincronizado de origin/main), se corrigio el reseteo de contrasena del admin por variables de entorno, se agrego indicador de version/hora de inicio del servidor en el pie de pagina, se confirmo que SQLite persiste entre redeploys en Cloudways, se agrego boton para eliminar clientes sin registros/certificados asociados, y se reemplazo la paleta de colores generica por los colores del logo de TecnoPest (azul #0c87c3 y verde lima #b9cc00), agregando el logo en el login y en ambas barras de navegacion.
Archivos/carpetas tocados: server.js, version.js, db.js, routes/admin.js, views/login.ejs, views/partials/footer.ejs, views/partials/header.ejs, views/partials/header-tecnico.ejs, views/admin/clientes/list.ejs, public/img/logo.png
Recursos/URLs/config: produccion en registros.tecnopest.cl (Cloudways), variables ADMIN_EMAIL/ADMIN_PASSWORD
Pendientes: falta comitear y desplegar el cambio de colores/logo (revisar visualmente antes de subir), y sigue pendiente confirmar el ajuste de Package Manager Yarn/npm en Cloudways.
