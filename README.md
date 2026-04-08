<!-- 
-> C:\Windows\System32\drivers\etc\HOSTS
127.0.0.1   playmarker.local.cl

C:\xampp\apache\conf\extra\httpd-xampp.conf
<VirtualHost *:80>
	DocumentRoot "C:\xampp\htdocs\playmarker"
	ServerName playmarker.local.com
	<Directory "C:\xampp\htdocs\playmarker">
	</Directory>
</VirtualHost>

en "C:\xampp\apache\conf\httpd.conf" agrega
<Directory "C:/Proyectos/playmarker">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
-->

# PlayMarker

PlayMarker es una pizarra tactica web para organizar alineaciones de futbol, mover jugadores sobre la cancha y dejar suplentes en la banca con una interfaz simple de arrastrar y soltar.

La aplicacion corre sobre una estructura PHP liviana, sin build, con frontend vanilla y persistencia en MySQL para usuarios y tableros. Tambien mantiene una URL compartible para abrir tableros concretos desde el navegador.

## Caracteristicas

- Login con Google para acceder a tableros personales.
- Persistencia de tableros en MySQL.
- Crear jugadores con nombre, numero, posicion y equipo.
- Editar o eliminar jugadores desde el panel lateral.
- Arrastrar fichas dentro de la cancha o hacia la banca.
- Diferenciar equipos `Local` y `Visita`.
- Marcar posiciones `Arquero`, `Defensa`, `Medio` y `Delantero`.
- Compartir tableros publicos mediante URL.
- Soporte responsive para escritorio y mobile.

## Vista general

La interfaz se divide en dos zonas principales:

- Un panel lateral para administrar la plantilla y el formulario de edicion.
- Un tablero principal con la cancha interactiva y una zona de banca.

Cada jugador se representa con una ficha visual que incluye:

- Numero de camiseta.
- Nombre.
- Color segun equipo.
- Indicador de posicion.

## Como usarlo

Como es un proyecto PHP liviano, lo ideal es ejecutarlo en Apache/XAMPP o con el servidor embebido de PHP. Antes de arrancar, crea tu `.env` a partir de [.env.example](/C:/Users/paulo/Proyectos/playmarker/.env.example) y carga la base con [db/bootstrap.sql](/C:/Users/paulo/Proyectos/playmarker/db/bootstrap.sql).

### Opcion 1: servidor embebido de PHP

```powershell
php -S localhost:8000
```

Luego abre `http://localhost:8000`.

### Opcion 2: Apache/XAMPP

Apunta el virtual host o `DocumentRoot` a la carpeta del proyecto y asegurate de que `AllowOverride All` este habilitado para usar [`.htaccess`](/C:/Users/paulo/Proyectos/playmarker/.htaccess).

Para producción en subdominio revisa [docs/production-subdomain.md](/C:/Users/paulo/Proyectos/playmarker/docs/production-subdomain.md).

## Flujo de uso

1. Crea un jugador desde el formulario lateral.
2. El jugador aparecera en la cancha con una posicion inicial automatica segun su equipo.
3. Haz clic sobre una ficha o sobre un item de la lista para editarlo.
4. Arrastra la ficha para moverla dentro de la cancha o llevarla a la banca.
5. Comparte la URL si quieres conservar o enviar la alineacion actual.

## Persistencia

PlayMarker usa MySQL para guardar:

- Usuarios autenticados con Google.
- Tableros personales.
- Estado JSON de cada tablero.
- Visibilidad publica o privada.
- Ultimo tablero abierto por usuario.

La URL sigue incluyendo `?tablero=<id>` para abrir directamente un tablero concreto y compartir vistas publicas.

## Validaciones actuales

- El nombre es obligatorio.
- El numero debe estar entre `1` y `99`.
- La posicion debe ser una de estas: `arquero`, `defensa`, `medio`, `delantero`.
- El equipo debe ser `home` o `away`.

## Estructura del proyecto

- [index.php](/C:/Users/paulo/Proyectos/playmarker/index.php): front controller principal.
- [db/bootstrap.sql](/C:/Users/paulo/Proyectos/playmarker/db/bootstrap.sql): esquema minimo de MySQL para `usuarios` y `tablas`.
- [docs/production-subdomain.md](/C:/Users/paulo/Proyectos/playmarker/docs/production-subdomain.md): guia de despliegue en subdominio.
- [config/routes.php](/C:/Users/paulo/Proyectos/playmarker/config/routes.php): definicion de rutas.
- [controllers/MainController.php](/C:/Users/paulo/Proyectos/playmarker/controllers/MainController.php): render base de layouts, vistas y respuestas JSON.
- [controllers/SitioController.php](/C:/Users/paulo/Proyectos/playmarker/controllers/SitioController.php): home, login con Google, logout y healthcheck.
- [controllers/TablasController.php](/C:/Users/paulo/Proyectos/playmarker/controllers/TablasController.php): CRUD de tableros y visibilidad.
- [templates/layout/main/index.php](/C:/Users/paulo/Proyectos/playmarker/templates/layout/main/index.php): layout HTML principal.
- [views/sitio/home.php](/C:/Users/paulo/Proyectos/playmarker/views/sitio/home.php): vista principal de la pizarra.
- [assets/css/styles.css](/C:/Users/paulo/Proyectos/playmarker/assets/css/styles.css): estilos visuales, layout responsive, cancha, banca y fichas.
- [assets/js/app.js](/C:/Users/paulo/Proyectos/playmarker/assets/js/app.js): logica de estado, formulario, renderizado, drag and drop y llamadas a la API.
- [assets/images/favicon.ico](/C:/Users/paulo/Proyectos/playmarker/assets/images/favicon.ico), [assets/images/favicon-64.png](/C:/Users/paulo/Proyectos/playmarker/assets/images/favicon-64.png): iconos de la aplicacion.
- [assets/images/og-image.png](/C:/Users/paulo/Proyectos/playmarker/assets/images/og-image.png): imagen usada para compartir en redes.

## Detalles tecnicos

- Proyecto PHP liviano con frontend vanilla: PHP, HTML, CSS y JavaScript.
- Sin frameworks y sin proceso de compilacion.
- Base de datos MySQL con PDO.
- Sesion PHP aislada por aplicacion, configurable por variables de entorno.
- Login con Google Identity Services.
- Uso de `pointer events` para el drag and drop.
- Uso de `history.replaceState` para sincronizar `?tablero=<id>` sin recargar.
- Uso de `crypto.getRandomValues` para generar IDs de jugadores cuando esta disponible.

## Variables de entorno

- `APP_ENV`: fuerza `develop` o `production`.
- `GOOGLE_CLIENT_ID_DEVELOP`: client ID para desarrollo.
- `GOOGLE_CLIENT_ID_PRODUCTION`: client ID para producción.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_CHARSET`: conexión a MySQL.
- `APP_SESSION_NAME`: nombre de cookie de sesión propia de PlayMarker.
- `APP_SESSION_DOMAIN`: déjalo vacío para no compartir sesión con el dominio padre.
- `APP_SESSION_SAMESITE`: política SameSite de la cookie.
- `APP_SESSION_SECURE`: usa `1` en HTTPS.

## Responsividad

La interfaz adapta el layout para pantallas pequenas:

- En escritorio se muestran sidebar y tablero en dos columnas.
- En mobile el layout pasa a una sola columna.
- La cancha y la banca ajustan sus dimensiones para seguir siendo utilizables en pantallas reducidas.

## Ideas de mejora

- Guardado opcional en `localStorage`.
- Exportar e importar alineaciones.
- Soporte para multiples formaciones predefinidas.
- Renombrar equipos.
- Agregar dibujo de flechas o anotaciones tacticas.
- Compartir mediante un boton de copiar enlace.

## Licencia

Este repositorio no define una licencia por ahora. Si vas a distribuirlo o reutilizarlo, conviene agregar una.
