# Despliegue en subdominio

Esta aplicacion puede vivir en un subdominio del sitio principal sin compartir sesion ni base de datos con el dominio padre.

## 1. Variables de entorno

Parte desde [.env.production.example](/C:/Users/paulo/Proyectos/playmarker/.env.production.example) y crea un `.env` real en el servidor.

Variables clave:

- `APP_ENV=production` para no depender de la deteccion por host.
- `DB_*` apuntando a la base exclusiva de PlayMarker.
- `GOOGLE_CLIENT_ID_PRODUCTION` con el cliente registrado para el subdominio exacto.
- `APP_SESSION_NAME` para dejar una cookie de sesion propia.
- `APP_SESSION_DOMAIN` vacio para no compartir sesion con el dominio padre.
- `APP_SESSION_SECURE=1` cuando el subdominio corra sobre HTTPS.

## 2. Base de datos

Ejecuta [db/bootstrap.sql](/C:/Users/paulo/Proyectos/playmarker/db/bootstrap.sql) en la base destinada a PlayMarker.

El script crea:

- `usuarios` para login con Google.
- `tablas` para guardar tableros, visibilidad y reapertura.

## 3. Apache / VirtualHost

Ejemplo de vhost para `playmarker.midominio.com`:

```apache
<VirtualHost *:80>
    ServerName playmarker.midominio.com
    DocumentRoot "/var/www/playmarker"

    <Directory "/var/www/playmarker">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

Si el sitio ya termina en HTTPS por proxy o balanceador, asegúrate de reenviar `X-Forwarded-Proto=https` para que la cookie segura se calcule bien.

## 4. Google Identity

En Google Cloud / Google Identity Services registra el subdominio final como origen autorizado del frontend. El `client_id` debe corresponder al subdominio exacto donde se mostrará el botón de acceso.

## 5. Checklist de validación

- `GET /health` responde `{ "ok": true, "app": "playmarker" }`.
- Login con Google crea o actualiza una fila en `usuarios`.
- Crear, guardar, renombrar y eliminar boards persiste en `tablas`.
- Abrir una URL `?tablero=<id>` carga el tablero esperado.
- Un tablero público abre en modo solo lectura si no hay sesión.
- Cerrar sesión en el subdominio no afecta al sitio padre.
