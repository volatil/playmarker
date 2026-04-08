# Despliegue en subdominio

Esta aplicacion puede vivir en un subdominio del sitio principal sin compartir sesion ni base de datos con el dominio padre.

## 1. Variables de entorno

Parte desde [.env.example](/C:/Users/paulo/Proyectos/playmarker/.env.example) y crea un `.env` real en el servidor.

Con un unico `.env` que contiene bloques `DEVELOP` y `PRODUCTION`, define siempre `APP_ENV=production` en el servidor para no depender de la deteccion por host.

Variables clave:

- `APP_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_CHARSET` compartidos
- `DB_NAME_PRODUCTION`, `DB_USER_PRODUCTION`, `DB_PASS_PRODUCTION`
- `DB_NAME`, `DB_USER`, `DB_PASS` solo si de verdad quieres compartir esos valores entre entornos
- `GOOGLE_CLIENT_ID_PRODUCTION`
- `APP_SESSION_NAME`
- `APP_SESSION_DOMAIN`
- `APP_SESSION_SECURE=1` cuando el subdominio corra sobre HTTPS

La app resuelve primero las variables `*_PRODUCTION` y solo despues usa las variantes compartidas sin sufijo. No toma automaticamente credenciales ni client IDs del bloque `DEVELOP`.

## 2. Base de datos

Ejecuta [db/bootstrap.sql](/C:/Users/paulo/Proyectos/playmarker/db/bootstrap.sql) en la base destinada a PlayMarker.

El script crea:

- `usuarios` para login con Google
- `tablas` para guardar tableros, visibilidad y reapertura

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

Si el sitio ya termina en HTTPS por proxy o balanceador, asegurate de reenviar `X-Forwarded-Proto=https` para que la cookie segura se calcule bien.

## 4. Google Identity

En Google Cloud / Google Identity Services registra el subdominio final como origen autorizado del frontend. El `client_id` debe corresponder al subdominio exacto donde se mostrara el boton de acceso.

## 5. Checklist de validacion

- `GET /health` responde con `ok=true`, `app="playmarker"`, `env` y `googleClientIdConfigured`
- `APP_ENV` esta definido en `production`
- Login con Google crea o actualiza una fila en `usuarios`
- Crear, guardar, renombrar y eliminar boards persiste en `tablas`
- Abrir una URL `?tablero=<id>` carga el tablero esperado
- Un tablero publico abre en modo solo lectura si no hay sesion
- Cerrar sesion en el subdominio no afecta al sitio padre
