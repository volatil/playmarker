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

La aplicacion ahora se sirve desde una estructura PHP liviana inspirada en `fulbo`, pero sigue funcionando principalmente en el navegador y sin dependencias de build. El estado del tablero se guarda en la URL para que puedas compartir una alineacion enviando el enlace.

## Caracteristicas

- Crear jugadores con nombre, numero, posicion y equipo.
- Editar o eliminar jugadores desde el panel lateral.
- Arrastrar fichas dentro de la cancha o hacia la banca.
- Diferenciar equipos `Local` y `Visita`.
- Marcar posiciones `Arquero`, `Defensa`, `Medio` y `Delantero`.
- Mantener el estado en la URL con una serializacion compacta.
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

Como es un proyecto PHP liviano, lo ideal es ejecutarlo en Apache/XAMPP o con el servidor embebido de PHP. Tambien se mantiene un `index.html` de compatibilidad para abrirlo de forma estatica.

### Opcion 1: servidor embebido de PHP

```powershell
php -S localhost:8000
```

Luego abre `http://localhost:8000`.

### Opcion 2: Apache/XAMPP

Apunta el virtual host o `DocumentRoot` a la carpeta del proyecto y asegurate de que `AllowOverride All` este habilitado para usar [`.htaccess`](/C:/Users/paulo/Proyectos/playmarker/.htaccess).

### Opcion 3: abrir el fallback estatico

Abre [index.html](/C:/Users/paulo/Proyectos/playmarker/index.html) en tu navegador.

### Opcion 4: servidor local simple

Si prefieres servir el fallback estatico, puedes usar cualquiera de estas opciones:

```powershell
python -m http.server 8000
```

o

```powershell
npx serve .
```

Luego abre `http://localhost:8000` o la URL que te entregue la herramienta que uses.

## Flujo de uso

1. Crea un jugador desde el formulario lateral.
2. El jugador aparecera en la cancha con una posicion inicial automatica segun su equipo.
3. Haz clic sobre una ficha o sobre un item de la lista para editarlo.
4. Arrastra la ficha para moverla dentro de la cancha o llevarla a la banca.
5. Comparte la URL si quieres conservar o enviar la alineacion actual.

## Persistencia en URL

PlayMarker no usa base de datos ni almacenamiento remoto. La app serializa la lista de jugadores en el parametro `s` de la URL.

Eso permite:

- Recuperar el tablero al recargar la pagina.
- Compartir una alineacion exacta mediante un link.
- Mantener la aplicacion completamente del lado del cliente.

Tambien existe compatibilidad con un formato legacy basado en multiples parametros `player`, aunque el formato actual preferido es el estado compacto en `s`.

## Validaciones actuales

- El nombre es obligatorio.
- El numero debe estar entre `1` y `99`.
- La posicion debe ser una de estas: `arquero`, `defensa`, `medio`, `delantero`.
- El equipo debe ser `home` o `away`.

## Estructura del proyecto

- [index.php](/C:/Users/paulo/Proyectos/playmarker/index.php): front controller principal.
- [config/routes.php](/C:/Users/paulo/Proyectos/playmarker/config/routes.php): definicion de rutas.
- [controllers/MainController.php](/C:/Users/paulo/Proyectos/playmarker/controllers/MainController.php): render base de layouts, vistas y respuestas JSON.
- [controllers/SitioController.php](/C:/Users/paulo/Proyectos/playmarker/controllers/SitioController.php): controlador de la home y 404.
- [templates/layout/main/index.php](/C:/Users/paulo/Proyectos/playmarker/templates/layout/main/index.php): layout HTML principal.
- [views/sitio/home.php](/C:/Users/paulo/Proyectos/playmarker/views/sitio/home.php): vista principal de la pizarra.
- [assets/css/styles.css](/C:/Users/paulo/Proyectos/playmarker/assets/css/styles.css): estilos visuales, layout responsive, cancha, banca y fichas.
- [assets/js/app.js](/C:/Users/paulo/Proyectos/playmarker/assets/js/app.js): logica de estado, formulario, renderizado, drag and drop y serializacion en URL.
- [assets/images/favicon.ico](/C:/Users/paulo/Proyectos/playmarker/assets/images/favicon.ico), [assets/images/favicon-64.png](/C:/Users/paulo/Proyectos/playmarker/assets/images/favicon-64.png): iconos de la aplicacion.
- [assets/images/og-image.png](/C:/Users/paulo/Proyectos/playmarker/assets/images/og-image.png): imagen usada para compartir en redes.

## Detalles tecnicos

- Proyecto PHP liviano con frontend vanilla: PHP, HTML, CSS y JavaScript.
- Sin frameworks y sin proceso de compilacion.
- Uso de `pointer events` para el drag and drop.
- Uso de `history.replaceState` para sincronizar la URL sin recargar.
- Uso de `TextEncoder`, `TextDecoder`, `btoa` y `atob` para compactar el estado.
- Uso de `crypto.getRandomValues` para generar IDs de jugadores cuando esta disponible.

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
